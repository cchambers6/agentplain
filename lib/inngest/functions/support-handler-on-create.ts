/**
 * Inngest function: support-handler-on-create.
 *
 * Fires on the `agentplain/support-request.created` event, which
 * `lib/support/index.ts → submitSupportRequest` emits after a
 * SupportRequest row persists. Reads the request, queries the
 * knowledge substrate for relevant context, drafts a first-touch reply
 * via the LLM, and writes the proposal to WorkApprovalQueueItem
 * (kind=SUPPORT_HANDLER_REPLY_DRAFT, discipline=customer-success) for
 * operator review.
 *
 * Event-driven (not cron) — drafts land in the queue within seconds of
 * submit instead of minutes, so the customer can see "drafted, under
 * review" on /help on the next refresh rather than a 5-minute window
 * of dead air.
 *
 * The existing operator-email notification (the SUPPORT_EMAIL Resend
 * send in submitSupportRequest) STAYS LIVE in parallel until the
 * draft-into-review path is verified in prod. This function is purely
 * additive — a failure here never affects the customer's submit ack.
 *
 * Per project_no_outbound_architecture.md: this function reads + drafts
 * + writes durable state. It does NOT send a reply to the customer.
 *
 * Per feedback_cold_start_safe_agents.md: stateless. Re-fires on the
 * same SupportRequest are bounded by the operator queue: a fresh row
 * shows up with a fresh proposalId, the operator can dismiss
 * duplicates. Idempotency at the queue level is deferred — the audit
 * trail (refTable=SupportRequest, refId) lets us collapse duplicates
 * if the volume warrants it.
 *
 * Per feedback_no_silent_vendor_lock.md: this file imports nothing
 * from `@anthropic-ai/sdk`, the knowledge store, or Prisma directly.
 * Every external dependency flows through the support-handler
 * package's port.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger } from '@/lib/observability';
import { runSupportHandlerForRequest } from '@/lib/skills/support-handler';
import { runTriageForRequest } from '@/lib/skills/customer-support-triage';
import {
  TRIAGE_SKILL_SLUG,
  TRIAGE_DISCIPLINE_ID,
} from '@/lib/skills/customer-support-triage';
import { gateSkillFire } from '@/lib/skills/fire-gate';
import { withSystemContext } from '@/lib/db/rls';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';

export const SUPPORT_HANDLER_ON_CREATE_FUNCTION_ID =
  'agentplain-support-handler-on-create';

/** Event the SupportRequest submit path emits after persistence. */
export const SUPPORT_REQUEST_CREATED_EVENT =
  'agentplain/support-request.created';

/** Shape of the event data payload. The SupportRequest id is the only
 *  durable handle the function needs — everything else is re-read
 *  from the row to stay cold-start safe. */
export interface SupportRequestCreatedEventData {
  supportRequestId: string;
  workspaceId: string;
}

export const supportHandlerOnCreateFn = inngest.createFunction(
  {
    id: SUPPORT_HANDLER_ON_CREATE_FUNCTION_ID,
    name: 'agentplain support-handler on SupportRequest create',
    // Bounded concurrency so a burst of /help submissions doesn't
    // pin the LLM budget on a single deploy.
    concurrency: { limit: 5 },
    // Retry a transient LLM / substrate failure twice before
    // deadlettering. Beyond that the operator-email path already
    // gave the customer a human-readable signal.
    retries: 2,
    triggers: [{ event: SUPPORT_REQUEST_CREATED_EVENT }],
  },
  async ({ event }) =>
    runWithDisableGate(SUPPORT_HANDLER_ON_CREATE_FUNCTION_ID, () =>
      withInngestErrorReporting(
        { functionId: SUPPORT_HANDLER_ON_CREATE_FUNCTION_ID },
        async () => {
          const logger = getLogger().child({
            boundary: 'inngest',
            function_id: SUPPORT_HANDLER_ON_CREATE_FUNCTION_ID,
          });
          const data = parseEventData(event?.data);
          if (!data) {
            logger.info('event missing supportRequestId, skipping');
            return { skipped: true, reason: 'malformed-event' as const };
          }
          logger.info('support-handler fire started', {
            support_request_id: data.supportRequestId,
            workspace_id: data.workspaceId,
          });

          // Wave-3 phase 5 — paused-for-billing gate. A workspace with
          // a PAUSED / PAST_DUE subscription skips the draft entirely so
          // no LLM call runs + no row lands in /approvals. The
          // operator-email path (the human ack) stays live regardless.
          const pause = await isWorkspacePaused({
            workspaceId: data.workspaceId,
          }).catch(() => ({ isPaused: false, status: null, reason: '' }));
          if (pause.isPaused) {
            logger.info('support-handler skipped — workspace paused for billing', {
              support_request_id: data.supportRequestId,
              workspace_id: data.workspaceId,
              subscription_status: pause.status,
            });
            return {
              skipped: true,
              reason: 'paused-for-billing' as const,
            };
          }

          // Wave-3 phase 3 — marketplace install gate. A workspace that
          // explicitly uninstalled `support-handler` from /marketplace
          // expects the on-create draft path to NOT fire. The original
          // operator-email path stays live regardless (the customer still
          // sees a human ack); only the draft skips. `.catch(() => true)`
          // keeps the loop alive on a transient DB blip — better to draft
          // and let the operator dismiss than silently drop work.
          const workspace = await withSystemContext((tx) =>
            tx.workspace.findUnique({
              where: { id: data.workspaceId },
              select: { vertical: true },
            }),
          );
          if (!workspace) {
            logger.info('support-handler skipped — workspace not found', {
              support_request_id: data.supportRequestId,
              workspace_id: data.workspaceId,
            });
            return { skipped: true, reason: 'workspace-not-found' as const };
          }
          const installed = await isSkillInstalledForWorkspace({
            workspaceId: data.workspaceId,
            workspaceVertical: workspace.vertical,
            skillSlug: 'support-handler',
          }).catch(() => true);
          if (!installed) {
            logger.info('support-handler skipped — uninstalled on workspace', {
              support_request_id: data.supportRequestId,
              workspace_id: data.workspaceId,
            });
            return {
              skipped: true,
              reason: 'skill-uninstalled' as const,
            };
          }

          // pfd-3 — the missing fire gate (audit SIGNUP_TO_GO_2026_06_10).
          // Before this wave the support-handler skipped gateSkillFire, so a
          // workspace's vacation pause / off-hours schedule window did NOT
          // stop a support draft (or now an auto-answer) from firing. Wire it
          // here so the customer-controlled pause/schedule actually governs
          // this caller too. A gate denial means: no auto-answer, no
          // auto-resolve, no draft — the customer's request stays NEW for the
          // operator (the submit-time email already gave a human ack).
          const fireGate = await withSystemContext((tx) =>
            gateSkillFire({
              tx,
              workspaceId: data.workspaceId,
              skillSlug: TRIAGE_SKILL_SLUG,
              disciplineId: TRIAGE_DISCIPLINE_ID,
            }),
          ).catch(() => ({ allowed: true as const }));
          if (!fireGate.allowed) {
            logger.info('support-handler skipped — fire gate', {
              support_request_id: data.supportRequestId,
              workspace_id: data.workspaceId,
              reason: fireGate.reason,
            });
            return { skipped: true, reason: 'fire-gate' as const };
          }

          // pfd-3 — L1 TRIAGE runs BEFORE the draft path. It escalates
          // sensitive messages (legal / distress / vuln / deletion / human
          // ask / big dispute) to a human via pageHuman with a 24h deadline,
          // auto-answers high-confidence KB questions, or auto-resolves
          // bounded account actions. ONLY when it returns 'drafted' (the
          // self-routing floor) do we fall through to the existing
          // SUPPORT_HANDLER_REPLY_DRAFT path. The standing gates we just
          // evaluated thread into bounded auto-resolve.
          const triage = await runTriageForRequest({
            supportRequestId: data.supportRequestId,
            gates: { fireGatePassed: true, billingActive: true },
          });
          if (triage.ok && triage.value.decision !== 'drafted') {
            logger.info('support-handler — triage handled', {
              support_request_id: data.supportRequestId,
              workspace_id: data.workspaceId,
              decision: triage.value.decision,
              degraded: triage.value.degraded,
              escalation_trigger: triage.value.escalationTrigger,
              paged: triage.value.page?.delivered ?? null,
            });
            return {
              ok: true as const,
              triaged: triage.value.decision,
              degraded: triage.value.degraded,
            };
          }
          if (!triage.ok) {
            // Triage failed to even load the request (deleted, etc.) — log,
            // then fall through to the draft path so the message still gets
            // an outcome rather than vanishing.
            logger.info('support-handler — triage non-ok, falling through to draft', {
              support_request_id: data.supportRequestId,
              workspace_id: data.workspaceId,
              error_code: triage.error.code,
            });
          }

          const res = await runSupportHandlerForRequest({
            supportRequestId: data.supportRequestId,
          });

          if (!res.ok) {
            reportInngestItemFailure(
              new Error(`${res.error.code}: ${res.error.message}`),
              {
                functionId: SUPPORT_HANDLER_ON_CREATE_FUNCTION_ID,
                extraTags: {
                  support_request_id: data.supportRequestId,
                  workspace_id: data.workspaceId,
                  error_code: res.error.code,
                },
              },
            );
            await recordAuditFailure({
              workspaceId: data.workspaceId,
              supportRequestId: data.supportRequestId,
              error: res.error,
            });
            // Don't throw — the operator email already landed at submit
            // time, so a draft failure is degraded-state, not lost.
            // Inngest's retries will pick up a transient case via the
            // function's `retries` setting before we reach this branch.
            return {
              ok: false as const,
              error: { code: res.error.code, message: res.error.message },
            };
          }

          await recordAuditSuccess({
            workspaceId: data.workspaceId,
            supportRequestId: data.supportRequestId,
            proposalId: res.value.proposal.proposalId,
            confidence: res.value.proposal.confidence,
            sunk: res.value.sunk,
            substrate: res.value.substrate,
          });
          // When the draft landed in the operator queue, advance the
          // request NEW → IN_REVIEW so /operator/support shows "a draft is
          // waiting". Only NEW rows move — an operator who already touched
          // it (OPEN / RESOLVED) keeps their state. Best-effort: the draft
          // is already durable, so a status-flip failure is non-fatal.
          if (res.value.sunk) {
            await markRequestInReview(data.supportRequestId);
          }
          logger.info('support-handler fire finished', {
            support_request_id: data.supportRequestId,
            workspace_id: data.workspaceId,
            confidence: res.value.proposal.confidence,
            sunk: res.value.sunk,
            substrate_returned: res.value.substrate.returned,
            high_confidence_hits: res.value.substrate.highConfidenceHits,
          });
          return {
            ok: true as const,
            confidence: res.value.proposal.confidence,
            sunk: res.value.sunk,
          };
        },
      ),
    ),
);

function parseEventData(raw: unknown): SupportRequestCreatedEventData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.supportRequestId !== 'string') return null;
  if (typeof r.workspaceId !== 'string') return null;
  return {
    supportRequestId: r.supportRequestId,
    workspaceId: r.workspaceId,
  };
}

interface AuditSuccessArgs {
  workspaceId: string;
  supportRequestId: string;
  proposalId: string;
  confidence: string;
  sunk: boolean;
  substrate: { requested: number; returned: number; highConfidenceHits: number };
}

async function recordAuditSuccess(args: AuditSuccessArgs): Promise<void> {
  try {
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          workspaceId: args.workspaceId,
          action: 'support_handler.drafted',
          targetTable: 'SupportRequest',
          targetId: args.supportRequestId,
          payload: {
            proposalId: args.proposalId,
            confidence: args.confidence,
            sunk: args.sunk,
            substrate: args.substrate,
          },
        },
      }),
    );
  } catch {
    // Best-effort. The drafted proposal is already in the operator
    // queue; an audit-log failure is non-fatal.
  }
}

/** Advance a freshly-drafted SupportRequest NEW → IN_REVIEW. Scoped to
 *  NEW so an operator-touched row (OPEN / RESOLVED / ARCHIVED) is never
 *  clobbered by a late or retried fire. Best-effort. */
async function markRequestInReview(supportRequestId: string): Promise<void> {
  try {
    await withSystemContext((tx) =>
      tx.supportRequest.updateMany({
        where: { id: supportRequestId, status: "NEW" },
        data: { status: "IN_REVIEW" },
      }),
    );
  } catch {
    // Non-fatal — the draft is already in the operator queue.
  }
}

interface AuditFailureArgs {
  workspaceId: string;
  supportRequestId: string;
  error: { code: string; message: string };
}

async function recordAuditFailure(args: AuditFailureArgs): Promise<void> {
  try {
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          workspaceId: args.workspaceId,
          action: 'support_handler.failed',
          targetTable: 'SupportRequest',
          targetId: args.supportRequestId,
          payload: {
            code: args.error.code,
            message: args.error.message,
          },
        },
      }),
    );
  } catch {
    // See above — audit failures are non-fatal.
  }
}
