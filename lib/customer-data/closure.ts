/**
 * lib/customer-data/closure.ts
 *
 * Customer-initiated workspace closure state machine. The customer-facing
 * counterpart to the executor in `lib/customer-files/deletion.ts`. This
 * module owns the *decision* to close (typed confirmation, soft-delete,
 * grace window, audit row); the deletion module owns the *execution*
 * (cascading row purge under `withSystemContext`).
 *
 *   initiateWorkspaceClosure({ workspaceId, actorUserId, ... })
 *     ACTIVE  → CLOSING. Sets scheduledHardPurgeAt = now + grace days.
 *
 *   cancelWorkspaceClosure({ workspaceId, actorUserId })
 *     CLOSING → ACTIVE. Only callable while the grace window is open.
 *
 * Hard purge runs from the Inngest sweep (see `teardown-scheduler.ts`); the
 * customer surface never invokes the cascading delete directly. That seam
 * is what guarantees the grace window is real: there is no synchronous
 * path from a button click to a row purge.
 *
 * Per memory `feedback_cold_start_safe_agents.md`: every read pulls from
 * durable Postgres state. Per `feedback_no_silent_vendor_lock.md`: all DB
 * I/O routes through `withRls` / `withSystemContext` — no bare prisma reads.
 */

import { z } from 'zod';
import type { Prisma, Workspace, WorkspaceClosureStatus } from '@prisma/client';
import { withRls, withSystemContext, type RlsContext } from '../db/rls';

/**
 * Test-injection seam typed as Prisma's transaction-client interface. Tests
 * pass shape-compatible mocks through this seam (same convention as
 * `lib/customer-files/deletion.ts#tearDownWorkspaceData`).
 */
export type ClosureClient = Prisma.TransactionClient;

/**
 * Default grace window between the customer confirming closure and the
 * hard-purge sweep becoming eligible to run. Configurable via the
 * `WORKSPACE_CLOSURE_GRACE_DAYS` env var.
 *
 * 7 days picked because it's the longest common SaaS-grace floor and
 * covers a typical vacation absence. If the customer never cancels, the
 * hourly sweep runs the cascading delete on the next tick after the
 * scheduled time passes.
 */
export const DEFAULT_GRACE_DAYS = 7;

/** Read + validate the env override; falls back to DEFAULT_GRACE_DAYS. */
export function getGraceDays(envValue?: string | undefined): number {
  const raw = envValue ?? process.env.WORKSPACE_CLOSURE_GRACE_DAYS;
  if (!raw) return DEFAULT_GRACE_DAYS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 90) return DEFAULT_GRACE_DAYS;
  return n;
}

// ─── Initiate ───────────────────────────────────────────────────────────────

const InitiateInputSchema = z.object({
  workspaceId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  typedConfirmation: z.string().min(1),
  reason: z.string().max(1000).optional(),
  graceDays: z.number().int().min(1).max(90).optional(),
  now: z.date().optional(),
});

export type InitiateWorkspaceClosureInput = z.input<typeof InitiateInputSchema> & {
  /** Optional pre-built transaction client. When passed, the closure runs
   *  against this client directly (no `withSystemContext` wrap). Tests use
   *  it with mock clients. */
  client?: ClosureClient;
};

export interface InitiateWorkspaceClosureResult {
  workspaceId: string;
  closureStatus: WorkspaceClosureStatus;
  closingInitiatedAt: Date;
  scheduledHardPurgeAt: Date;
}

/**
 * Move a workspace from ACTIVE → CLOSING. Returns the new closure stamps.
 *
 * Throws on:
 *   - validation failure (zod)
 *   - workspace not found (callers must already have asserted membership)
 *   - workspace not in ACTIVE state (caller should call this once)
 *   - typed-confirmation mismatch (case-sensitive, trim-normalized)
 *
 * The Workspace update + AuditLog insert run inside ONE transaction so the
 * two stay in sync — a half-applied closure (status flipped, audit row
 * missing) would corrupt the operator forensic trail.
 */
export async function initiateWorkspaceClosure(
  rawInput: InitiateWorkspaceClosureInput,
): Promise<InitiateWorkspaceClosureResult> {
  const input = InitiateInputSchema.parse(rawInput);
  const client = rawInput.client;
  const now = input.now ?? new Date();
  const graceDays = input.graceDays ?? getGraceDays();
  const scheduledHardPurgeAt = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000);

  const run = async (tx: ClosureClient): Promise<InitiateWorkspaceClosureResult> => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true, name: true, closureStatus: true },
    });
    if (!workspace) {
      throw new Error(`workspace ${input.workspaceId} not found`);
    }
    if (workspace.closureStatus !== 'ACTIVE') {
      throw new Error(
        `workspace ${input.workspaceId} is in ${workspace.closureStatus}, cannot initiate closure`,
      );
    }
    if (workspace.name.trim() !== input.typedConfirmation.trim()) {
      throw new TypedConfirmationMismatchError(workspace.name);
    }

    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: {
        closureStatus: 'CLOSING',
        closingInitiatedAt: now,
        closingInitiatedByUserId: input.actorUserId,
        scheduledHardPurgeAt,
        closureReason: input.reason ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        action: 'workspace.closure.initiated',
        targetTable: 'Workspace',
        targetId: input.workspaceId,
        payload: {
          graceDays,
          scheduledHardPurgeAt: scheduledHardPurgeAt.toISOString(),
          reasonProvided: Boolean(input.reason && input.reason.trim().length > 0),
        },
      },
    });

    return {
      workspaceId: input.workspaceId,
      closureStatus: 'CLOSING' as const,
      closingInitiatedAt: now,
      scheduledHardPurgeAt,
    };
  };

  return client ? run(client) : withSystemContext(run);
}

export class TypedConfirmationMismatchError extends Error {
  constructor(expected: string) {
    super(`typed confirmation does not match workspace name "${expected}"`);
    this.name = 'TypedConfirmationMismatchError';
  }
}

// ─── Cancel ─────────────────────────────────────────────────────────────────

const CancelInputSchema = z.object({
  workspaceId: z.string().uuid(),
  actorUserId: z.string().uuid(),
  now: z.date().optional(),
});

export type CancelWorkspaceClosureInput = z.input<typeof CancelInputSchema> & {
  /** Optional pre-built transaction client; same injection seam as initiate. */
  client?: ClosureClient;
};

export interface CancelWorkspaceClosureResult {
  workspaceId: string;
  closureStatus: WorkspaceClosureStatus;
}

/**
 * Move a workspace from CLOSING → ACTIVE while the grace window is still
 * open. Throws when called against ACTIVE (nothing to cancel) or CLOSED
 * (grace window has elapsed and the purge already ran — irreversible).
 */
export async function cancelWorkspaceClosure(
  rawInput: CancelWorkspaceClosureInput,
): Promise<CancelWorkspaceClosureResult> {
  const input = CancelInputSchema.parse(rawInput);
  const client = rawInput.client;
  const run = async (tx: ClosureClient): Promise<CancelWorkspaceClosureResult> => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true, closureStatus: true },
    });
    if (!workspace) {
      throw new Error(`workspace ${input.workspaceId} not found`);
    }
    if (workspace.closureStatus === 'ACTIVE') {
      throw new Error(
        `workspace ${input.workspaceId} is ACTIVE, nothing to cancel`,
      );
    }
    if (workspace.closureStatus === 'CLOSED') {
      throw new Error(
        `workspace ${input.workspaceId} is already CLOSED, cancellation no longer possible`,
      );
    }

    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: {
        closureStatus: 'ACTIVE',
        closingInitiatedAt: null,
        closingInitiatedByUserId: null,
        scheduledHardPurgeAt: null,
        closureReason: null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        workspaceId: input.workspaceId,
        action: 'workspace.closure.cancelled',
        targetTable: 'Workspace',
        targetId: input.workspaceId,
        payload: {},
      },
    });

    return {
      workspaceId: input.workspaceId,
      closureStatus: 'ACTIVE' as const,
    };
  };

  return client ? run(client) : withSystemContext(run);
}

// ─── Read ──────────────────────────────────────────────────────────────────

export interface WorkspaceClosureView {
  closureStatus: WorkspaceClosureStatus;
  closingInitiatedAt: Date | null;
  scheduledHardPurgeAt: Date | null;
  closedAt: Date | null;
}

/**
 * Read the closure-state subset for a workspace under the caller's RLS
 * context. Returns null if the row isn't visible (caller should have
 * pre-checked membership; null here is a redirect-to-/app signal).
 */
export async function readWorkspaceClosureState(
  ctx: RlsContext,
  workspaceId: string,
): Promise<WorkspaceClosureView | null> {
  const row: Pick<
    Workspace,
    'closureStatus' | 'closingInitiatedAt' | 'scheduledHardPurgeAt' | 'closedAt'
  > | null = await withRls(ctx, (tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        closureStatus: true,
        closingInitiatedAt: true,
        scheduledHardPurgeAt: true,
        closedAt: true,
      },
    }),
  );
  if (!row) return null;
  return row;
}
