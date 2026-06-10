/**
 * lib/integrations/retry-queue.ts
 *
 * Durable retry queue for in-flight actions that failed because an integration
 * was broken (pfd-2 integration self-heal). Two jobs:
 *
 *   1. ENQUEUE — when a killer-workflow producer hits a broken integration, it
 *      calls `enqueueRetryableAction` instead of silently dropping the work.
 *      The row persists in `RetryableAction` keyed by a MANDATORY per-workspace
 *      `idempotencyKey`. Enqueue is itself idempotent: a second enqueue under
 *      the same key updates the existing PENDING/HELD row rather than inserting
 *      a duplicate (so a producer that re-fires before resume doesn't pile up).
 *
 *   2. RESUME — the resume sweep calls `resumeRetryableActions` when an
 *      integration goes healthy again (and on a slow backstop timer). For each
 *      eligible PENDING/HELD row it looks up the registered handler for
 *      `actionKind` and runs it. The handler MUST be idempotent — it keys its
 *      side-effect on `idempotencyKey` so a resume racing the original retry
 *      never double-executes.
 *
 * Dead-letter: a row that exceeds `MAX_ATTEMPTS` resume attempts OR is older
 * than `DEAD_AFTER_MS` (7 days) is marked DEAD. The caller (the sweep) pages a
 * human (warn) and the integration page shows a customer-visible note. A DEAD
 * row is never retried automatically.
 *
 * Degraded mode (HELD): a non-critical side-effect (e.g. a Slack notification)
 * whose primary action already succeeded enqueues with `status: 'HELD'` via
 * `holdRetryableAction`. HELD rows flush on reconnect exactly like PENDING, but
 * the status lets surfaces say "your work is done; only the Slack ping waited".
 *
 * Per feedback_cold_start_safe_agents: every function reads durable rows on each
 * call; no in-memory queue. Per feedback_runner_portability: the store is a
 * Prisma-backed default with the handler registry injectable for tests.
 */

import type {
  IntegrationProvider,
  Prisma,
  RetryableAction,
  RetryableActionStatus,
} from '@prisma/client';
import { PrismaRetryStore, type RetryStore } from './retry-store';

/** Max resume attempts before a row dead-letters. */
export const MAX_ATTEMPTS = 5;
/** A queued action older than this is dead-lettered even under the attempt cap
 *  — a customer should never have a draft silently stuck for longer than this. */
export const DEAD_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Backoff base: nextAttemptAt = now + BACKOFF_BASE_MS * 2^(attempts-1). */
export const BACKOFF_BASE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * A re-run handler for one `actionKind`. Receives the persisted payload + the
 * idempotency key and re-performs the action. MUST be idempotent: key the
 * side-effect on `idempotencyKey` so a double-fire no-ops.
 *
 * Returns `ok: true` to RESOLVE the row, `ok: false` to bump attempts + retry,
 * or `ok: true, alreadyDone: true` to RESOLVE without re-doing work (the
 * idempotency check found the action already landed).
 */
export interface RetryHandlerResult {
  ok: boolean;
  alreadyDone?: boolean;
  detail?: string;
}

export type RetryHandler = (ctx: {
  workspaceId: string;
  provider: IntegrationProvider;
  actionKind: string;
  payload: Prisma.JsonValue;
  idempotencyKey: string;
}) => Promise<RetryHandlerResult>;

/** actionKind → handler. The resume sweep wires the real registry; tests inject
 *  a scriptable one. A row whose actionKind has no registered handler is left
 *  PENDING (not dead-lettered) — a missing handler is a deploy gap, not a
 *  customer's fault; it should resolve once the handler ships. */
export type RetryHandlerRegistry = Record<string, RetryHandler>;

export interface EnqueueArgs {
  workspaceId: string;
  provider: IntegrationProvider;
  actionKind: string;
  payload: Prisma.InputJsonValue;
  /** MANDATORY. Unique per workspace. The handler keys its side-effect on this. */
  idempotencyKey: string;
  /** Storage seam. Defaults to the Prisma store; tests inject in-memory. */
  store?: RetryStore;
  now?: Date;
}

/**
 * Enqueue a failed action for durable retry. Idempotent on
 * (workspaceId, idempotencyKey): a repeat enqueue updates the existing
 * non-terminal row rather than inserting a duplicate, and revives a DEAD/
 * RESOLVED row back to PENDING if the same logical action recurs.
 */
export async function enqueueRetryableAction(
  args: EnqueueArgs,
  status: Extract<RetryableActionStatus, 'PENDING' | 'HELD'> = 'PENDING',
): Promise<RetryableAction> {
  const now = args.now ?? new Date();
  const store = args.store ?? new PrismaRetryStore();
  const existing = await store.findByKey(args.workspaceId, args.idempotencyKey);
  // Reviving a terminal (DEAD/RESOLVED) row means the same logical action
  // recurred after we'd given up — reset the attempt counter so it gets a
  // fresh budget. A plain re-enqueue of a still-PENDING/HELD row keeps its
  // attempts so a hot-looping producer can't dodge the dead-letter cap.
  const isTerminalRevival =
    existing != null && (existing.status === 'DEAD' || existing.status === 'RESOLVED');
  return store.upsert({
    workspaceId: args.workspaceId,
    provider: args.provider,
    actionKind: args.actionKind,
    payload: args.payload,
    idempotencyKey: args.idempotencyKey,
    status,
    nextAttemptAt: now, // eligible immediately once the provider is healthy
    resetAttempts: isTerminalRevival,
  });
}

/**
 * Degraded-mode hold: enqueue a NON-critical side-effect whose primary action
 * already succeeded. Identical to enqueue but tags the row HELD so surfaces can
 * distinguish "work blocked" (PENDING) from "work done, notification waiting"
 * (HELD).
 */
export async function holdRetryableAction(
  args: EnqueueArgs,
): Promise<RetryableAction> {
  return enqueueRetryableAction(args, 'HELD');
}

export interface ResumeResult {
  considered: number;
  resolved: number;
  retried: number;
  dead: Array<{ id: string; idempotencyKey: string; reason: string }>;
  /** actionKinds seen with no registered handler — left PENDING, reported. */
  noHandler: string[];
}

export interface ResumeArgs {
  /** Limit resume to one provider (the one that just went healthy). Omit to
   *  run the slow backstop across every provider. */
  provider?: IntegrationProvider;
  /** Limit to one workspace (provider-reconnect resume). Omit for fleet-wide. */
  workspaceId?: string;
  registry: RetryHandlerRegistry;
  now?: Date;
  /** Page a human when a row dead-letters. Injected so the sweep can wire the
   *  real `pageHuman` and tests can assert. Return value is ignored (pageHuman
   *  returns a result; we don't act on it here). */
  onDeadLetter?: (row: RetryableAction, reason: string) => Promise<unknown> | unknown;
  /** Max rows per run (safety bound on a large backlog). */
  limit?: number;
  /** Storage seam. Defaults to the Prisma store; tests inject in-memory. */
  store?: RetryStore;
}

/**
 * Resume eligible PENDING/HELD rows. Dead-letters rows past the attempt cap or
 * age cap. Never throws — a handler that throws is treated as a failed attempt.
 */
export async function resumeRetryableActions(
  args: ResumeArgs,
): Promise<ResumeResult> {
  const now = args.now ?? new Date();
  const limit = args.limit ?? 200;
  const store = args.store ?? new PrismaRetryStore();

  const rows = await store.findEligible({
    provider: args.provider,
    workspaceId: args.workspaceId,
    now,
    limit,
  });

  const result: ResumeResult = {
    considered: rows.length,
    resolved: 0,
    retried: 0,
    dead: [],
    noHandler: [],
  };

  for (const row of rows) {
    // Age cap: dead-letter a row that's been stuck too long, regardless of
    // attempts — a customer must never have work silently stuck > 7 days.
    if (now.getTime() - row.createdAt.getTime() > DEAD_AFTER_MS) {
      await markDead(store, row, `exceeded ${DEAD_AFTER_MS / (24 * 60 * 60 * 1000)}-day age cap`, now);
      result.dead.push({ id: row.id, idempotencyKey: row.idempotencyKey, reason: 'age cap' });
      if (args.onDeadLetter) await args.onDeadLetter(row, 'exceeded 7-day age cap');
      continue;
    }

    const handler = args.registry[row.actionKind];
    if (!handler) {
      if (!result.noHandler.includes(row.actionKind)) {
        result.noHandler.push(row.actionKind);
      }
      continue; // leave PENDING — a missing handler is a deploy gap, not dead
    }

    let outcome: RetryHandlerResult;
    try {
      outcome = await handler({
        workspaceId: row.workspaceId,
        provider: row.provider,
        actionKind: row.actionKind,
        payload: row.payload,
        idempotencyKey: row.idempotencyKey,
      });
    } catch (err) {
      outcome = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }

    if (outcome.ok) {
      await store.update(row.id, {
        status: 'RESOLVED',
        incrementAttempts: true,
        resolvedAt: now,
        nextAttemptAt: null,
        lastError: null,
      });
      result.resolved += 1;
      continue;
    }

    // Failed attempt: bump attempts, dead-letter at the cap, else back off.
    const nextAttempts = row.attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      await markDead(
        store,
        row,
        `exceeded ${MAX_ATTEMPTS} attempts (last error: ${outcome.detail ?? 'unknown'})`,
        now,
      );
      result.dead.push({
        id: row.id,
        idempotencyKey: row.idempotencyKey,
        reason: `max attempts (${outcome.detail ?? 'unknown'})`,
      });
      if (args.onDeadLetter) {
        await args.onDeadLetter(row, `exceeded ${MAX_ATTEMPTS} attempts: ${outcome.detail ?? 'unknown'}`);
      }
      continue;
    }
    const backoffMs = BACKOFF_BASE_MS * Math.pow(2, nextAttempts - 1);
    await store.update(row.id, {
      attempts: nextAttempts,
      nextAttemptAt: new Date(now.getTime() + backoffMs),
      lastError: outcome.detail ?? 'retry handler returned ok:false',
    });
    result.retried += 1;
  }

  return result;
}

async function markDead(
  store: RetryStore,
  row: RetryableAction,
  reason: string,
  now: Date,
): Promise<void> {
  await store.update(row.id, {
    status: 'DEAD',
    incrementAttempts: true,
    diedAt: now,
    nextAttemptAt: null,
    lastError: reason,
  });
}

/**
 * Count of actions a workspace currently has waiting on a given provider —
 * read by the integration page to show "3 actions are queued and will run when
 * you reconnect" (PENDING/HELD) and "1 action could not be completed" (DEAD).
 */
export async function summarizeRetryQueueForProvider(
  workspaceId: string,
  provider: IntegrationProvider,
  store: RetryStore = new PrismaRetryStore(),
): Promise<{ waiting: number; held: number; dead: number }> {
  return store.countByStatus(workspaceId, provider);
}
