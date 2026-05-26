/**
 * lib/integrations/webhook-idempotency.ts
 *
 * Shared idempotency helpers for the inbound Pub/Sub / Graph webhook
 * receivers (`/api/webhooks/google`, `/api/webhooks/microsoft`).
 *
 * Why this lives at the integrations layer (not under each provider): the
 * dedupe rule and the upsert shape are the same across providers — only
 * the *source* of the dedupe key changes. Keeping the upsert path here
 * means a future provider (DocuSign Connect, QuickBooks events, ...)
 * inherits the exact same idempotency story for one extra line in its
 * route handler.
 *
 * Per `feedback_verify_after_create.md`: we WRITE the WebhookEvent before
 * ACKing the provider. The upsert here preserves that guarantee — the
 * unique constraint on `(subscriptionId, dedupeKey)` makes the second
 * arrival a no-op insert that resolves to the original row.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this module imports `prisma`
 * via `lib/db/prisma` (the swap-point boundary) — never `@prisma/client`
 * directly.
 *
 * Per `project_no_outbound_architecture.md`: idempotent receive only. The
 * dedupe path NEVER sends mail; it just decides whether to insert a new
 * row or hand back the existing one.
 */

import { withSystemContext } from '@/lib/db/rls';
import type { Prisma } from '@prisma/client';

export interface UpsertWebhookEventInput {
  subscriptionId: string;
  /**
   * Denormalized workspaceId for the parent subscription. The
   * `webhook_event_workspace_isolation` RLS policy
   * (20260526000000_add_integration_rls) evaluates against this column,
   * so it must be set on every insert. Callers already hold the parent
   * WebhookSubscription row by the time they call upsertWebhookEvent;
   * threading it down is one parameter, not a join.
   */
  workspaceId: string;
  rawPayload: Prisma.InputJsonValue;
  /**
   * Provider-derived dedupe key (Pub/Sub messageId for Gmail; Graph
   * notification subscriptionId+changeType+resource for M365). If null,
   * the row is created without dedupe protection — equivalent to the
   * pre-migration behavior, kept for providers that don't surface a
   * stable id yet (so we don't lose events while wiring them up).
   */
  dedupeKey: string | null;
}

export interface UpsertWebhookEventResult {
  /** The DB row id (existing OR newly inserted). */
  id: string;
  /**
   * `true` when this call inserted a new row, `false` when an existing
   * row with the same (subscriptionId, dedupeKey) was found. The route
   * handler logs both cases and returns 200 to the provider either way.
   */
  inserted: boolean;
}

/**
 * Insert a WebhookEvent if (subscriptionId, dedupeKey) hasn't been seen
 * yet; otherwise return the existing row id. With `dedupeKey === null`
 * the row is always inserted — fallback for providers that don't carry
 * a stable id.
 *
 * Why not Prisma `upsert`: upsert needs a `where` that resolves to a
 * unique constraint, and Postgres treats NULL as distinct so the
 * (subscriptionId, dedupeKey) unique index doesn't actually constrain
 * NULL keys. We split the path explicitly so the NULL-key case stays
 * obvious to the reader.
 */
export async function upsertWebhookEvent(
  input: UpsertWebhookEventInput,
): Promise<UpsertWebhookEventResult> {
  // The WebhookEvent table is RLS-protected (workspace isolation, with an
  // operator bypass) per 20260526000000_add_integration_rls. The receivers
  // run unauthenticated; withSystemContext seeds the operator GUC so the
  // policy resolves to TRUE for both the INSERT and the lookup-by-dedupe
  // fallback.
  if (input.dedupeKey === null) {
    return withSystemContext(async (tx) => {
      const created = await tx.webhookEvent.create({
        data: {
          subscriptionId: input.subscriptionId,
          workspaceId: input.workspaceId,
          rawPayload: input.rawPayload,
          processed: false,
        },
        select: { id: true },
      });
      return { id: created.id, inserted: true };
    });
  }

  // Race-safe path: try a unique-keyed insert; on UNIQUE violation, the
  // dupe arrived a moment ago and we resolve to that row id.
  //
  // The two legs MUST run in SEPARATE Postgres transactions. When `create`
  // raises P2002 inside a `$transaction`, Postgres flips the tx into the
  // aborted state (SQLSTATE 25P02) and rejects every subsequent statement
  // — including the `findUnique` we'd use to fetch the existing row.
  // Wrapping both in one `withSystemContext` therefore breaks the dedupe
  // path: the provider's redelivered webhook returns 500, the provider
  // retries, and the row dead-letters. Pub/Sub + MS Graph are both
  // at-least-once, so this path is hit routinely in production.
  //
  // Each `withSystemContext` opens its own transaction and seeds the
  // operator GUC independently, so RLS is satisfied on BOTH legs without
  // sharing tx state across them.
  //
  // Re-bind dedupeKey to a non-null local so the type narrows inside the
  // async callbacks (without this TS loses the input.dedupeKey !== null
  // narrowing across the closure boundary).
  const dedupeKey: string = input.dedupeKey;
  try {
    const created = await withSystemContext((tx) =>
      tx.webhookEvent.create({
        data: {
          subscriptionId: input.subscriptionId,
          workspaceId: input.workspaceId,
          rawPayload: input.rawPayload,
          dedupeKey,
          processed: false,
        },
        select: { id: true },
      }),
    );
    return { id: created.id, inserted: true };
  } catch (err) {
    // P2002 = unique constraint violation. The dupe arrived first; fetch
    // the existing row in a FRESH operator transaction. Any other error
    // rethrows so the route handler can return 500 and the provider can
    // retry.
    if (!isPrismaUniqueViolation(err)) {
      throw err;
    }
    const existing = await withSystemContext((tx) =>
      tx.webhookEvent.findUnique({
        where: {
          subscriptionId_dedupeKey: {
            subscriptionId: input.subscriptionId,
            dedupeKey,
          },
        },
        select: { id: true },
      }),
    );
    if (!existing) {
      // Extremely unlikely — the unique violation said the row exists,
      // but findUnique just returned null. Treat as a transient and
      // surface so the provider retries.
      throw new Error(
        `webhook idempotency upsert: unique violation but no row found for (${input.subscriptionId}, ${dedupeKey})`,
      );
    }
    return { id: existing.id, inserted: false };
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  // `Prisma.PrismaClientKnownRequestError` exposes `code` as a string. We
  // duck-type it to avoid pulling the symbol into client bundles.
  const candidate = err as { code?: unknown };
  return typeof candidate.code === 'string' && candidate.code === 'P2002';
}

// =====================================================================
// Retry / backoff for the drain consumer
// =====================================================================

export interface RetryDecision {
  /** Whether the row should be retried again later. */
  retryable: boolean;
  /** When non-null, the next attempt timestamp the drain consumer writes. */
  nextAttemptAt: Date | null;
  /** When `true`, the drain consumer flips `deadlettered = true`. */
  deadletter: boolean;
}

/**
 * Decide what the drain consumer does after a failed attempt. Pure —
 * no DB access — so the policy is unit-testable in isolation.
 *
 * Backoff schedule (per `feedback_no_quick_fixes`: the *right* fix is
 * exponential, not a constant retry):
 *   attempt 1 → wait  1 min
 *   attempt 2 → wait  5 min
 *   attempt 3 → wait 30 min
 *   attempt 4 → wait  2 hours
 *   attempt 5 → wait  6 hours
 *   attempt 6 → DEADLETTER (operator triage)
 *
 * The cron sweep fires every 5 minutes, so the resolution is +/- 5 min.
 * Six attempts cover roughly a 9-hour transient window — enough for a
 * provider outage / token-refresh blip without piling on.
 */
export function decideRetry(args: { attemptCount: number; now?: Date }): RetryDecision {
  const now = args.now ?? new Date();
  const minutesByAttempt = [1, 5, 30, 120, 360];
  // `attemptCount` is the count INCLUDING the just-failed attempt.
  // attempt 1 failed -> minutesByAttempt[0] = 1 minute.
  const idx = Math.max(0, args.attemptCount - 1);
  if (idx >= minutesByAttempt.length) {
    return { retryable: false, nextAttemptAt: null, deadletter: true };
  }
  const waitMs = minutesByAttempt[idx]! * 60 * 1000;
  return {
    retryable: true,
    nextAttemptAt: new Date(now.getTime() + waitMs),
    deadletter: false,
  };
}

/**
 * The drain consumer's WHERE filter for "ready to process". Centralized
 * here so the inbound receiver + the operator dashboard agree on what
 * "in-flight" means. Pure data — no DB access.
 */
export function readyForProcessingFilter(now: Date = new Date()): Prisma.WebhookEventWhereInput {
  return {
    processed: false,
    deadlettered: false,
    OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lt: now } }],
  };
}
