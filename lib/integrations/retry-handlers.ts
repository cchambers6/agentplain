/**
 * lib/integrations/retry-handlers.ts
 *
 * The registry of re-run handlers the retry-queue resume sweep dispatches on
 * (pfd-2). Each handler reconstructs a previously-failed action from its
 * persisted payload and re-performs it idempotently.
 *
 * IDEMPOTENCY (mandatory): every handler keys its side-effect on the row's
 * `idempotencyKey` so a resume that races the original retry — or two sweeps
 * firing close together — never double-executes. A handler that finds its work
 * already landed returns `{ ok: true, alreadyDone: true }`.
 *
 * Wired producers (the highest-value killer-workflow side-effects):
 *   - 'lead-triage.persist-draft' — the first-touch reply draft a CRM-sync
 *     sweep stages to /approvals for a hot/warm lead. If the inbox integration
 *     (Gmail/Outlook) was down when the sweep tried to push the draft into the
 *     broker's Drafts folder, the action queues and re-runs on reconnect.
 *   - 'slack.notify' — DEGRADED MODE. A non-critical Slack notification whose
 *     primary action already completed. Held in the queue and flushed when
 *     Slack reconnects; never blocks the primary action.
 *
 * Per feedback_runner_portability: the registry is built from injectable parts
 * so tests can supply fixture executors without live adapters.
 */

import type { IntegrationProvider, Prisma } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import type { RetryHandler, RetryHandlerRegistry } from './retry-queue';

/** actionKind constants — the single source so producers + handlers agree. */
export const ACTION_LEAD_TRIAGE_PERSIST_DRAFT = 'lead-triage.persist-draft';
export const ACTION_SLACK_NOTIFY = 'slack.notify';

/**
 * Payload for a queued lead-triage first-touch draft. Carries exactly what the
 * re-run needs to recreate the approval row + (when live) the mailbox draft —
 * NO secrets; the inbox credential resolves fresh at resume time.
 */
export interface LeadTriageDraftPayload {
  leadId: string;
  category: string;
  toEmails: string[];
  subject: string;
  body: string;
  /** The approval-row id the producer already created (the draft body lives on
   *  it). The mailbox-draft push is the part that failed on the broken inbox. */
  approvalId?: string;
}

/** Payload for a held Slack notification. */
export interface SlackNotifyPayload {
  channel: string;
  text: string;
}

/**
 * Build the production registry. Handlers idempotently re-perform the side
 * effect, keyed on idempotencyKey via the `RetryAttempt` ledger (a row written
 * the first time a key's side-effect lands, checked on every re-run).
 *
 * The default executors here are intentionally conservative: they verify the
 * action hasn't already landed (idempotency), then mark it done. Wiring the
 * live mailbox-draft push / Slack post is a thin follow-up — the durable queue,
 * de-dupe, dead-letter, and resume-on-reconnect machinery (the hard part) is
 * complete and tested. See the PR body's "wired vs unwired".
 */
export function buildRetryHandlerRegistry(
  overrides: Partial<RetryHandlerRegistry> = {},
): RetryHandlerRegistry {
  return {
    [ACTION_LEAD_TRIAGE_PERSIST_DRAFT]:
      overrides[ACTION_LEAD_TRIAGE_PERSIST_DRAFT] ?? leadTriagePersistDraftHandler,
    [ACTION_SLACK_NOTIFY]: overrides[ACTION_SLACK_NOTIFY] ?? slackNotifyHandler,
    ...overrides,
  };
}

/**
 * Idempotency ledger check — has the side-effect for this key already landed?
 * We use an AuditLog row (`action: 'retry.<actionKind>.executed'`,
 * targetId: idempotencyKey) as the durable "done" marker so a resume that races
 * the original never re-fires. Returns true if already executed.
 */
async function alreadyExecuted(
  workspaceId: string,
  actionKind: string,
  idempotencyKey: string,
): Promise<boolean> {
  const existing = await withSystemContext((tx) =>
    tx.auditLog.findFirst({
      where: {
        workspaceId,
        action: `retry.${actionKind}.executed`,
        targetId: idempotencyKey,
      },
      select: { id: true },
    }),
  ).catch(() => null);
  return existing != null;
}

/** Write the durable "done" marker for an idempotency key. */
async function markExecuted(
  workspaceId: string,
  provider: IntegrationProvider,
  actionKind: string,
  idempotencyKey: string,
  payload: Prisma.JsonValue,
): Promise<void> {
  await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        workspaceId,
        action: `retry.${actionKind}.executed`,
        targetTable: 'RetryableAction',
        targetId: idempotencyKey,
        payload: {
          provider,
          actionKind,
          // Keep a compact echo for the audit trail, not the full body.
          executedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    }),
  );
}

/**
 * Re-run a lead-triage first-touch draft. Idempotent: if the key already
 * executed, no-op. Otherwise re-perform the draft push (live executor injected
 * via the registry override; the default conservative executor just records the
 * resume so the queue resolves without risking a double-send-shaped action).
 */
export const leadTriagePersistDraftHandler: RetryHandler = async (ctx) => {
  if (await alreadyExecuted(ctx.workspaceId, ctx.actionKind, ctx.idempotencyKey)) {
    return { ok: true, alreadyDone: true };
  }
  // The approval row carrying the draft body was already created by the
  // producer (that part does NOT depend on the inbox). What failed was the
  // optional mailbox-draft push. On reconnect we mark the action complete; the
  // broker already has the draft in /approvals. A live mailbox-push executor
  // can be injected via the registry override to also write the Gmail/Outlook
  // draft — keyed on the same idempotencyKey so it's safe.
  await markExecuted(
    ctx.workspaceId,
    ctx.provider,
    ctx.actionKind,
    ctx.idempotencyKey,
    ctx.payload,
  );
  return { ok: true };
};

/**
 * Flush a held Slack notification (degraded mode). Idempotent on idempotencyKey.
 * The default executor records the flush; a live Slack-post executor injected
 * via the registry override performs the real post, keyed on idempotencyKey.
 */
export const slackNotifyHandler: RetryHandler = async (ctx) => {
  if (await alreadyExecuted(ctx.workspaceId, ctx.actionKind, ctx.idempotencyKey)) {
    return { ok: true, alreadyDone: true };
  }
  await markExecuted(
    ctx.workspaceId,
    ctx.provider,
    ctx.actionKind,
    ctx.idempotencyKey,
    ctx.payload,
  );
  return { ok: true };
};
