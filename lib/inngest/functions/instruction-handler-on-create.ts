/**
 * Inngest function: instruction-handler-on-create.
 *
 * Fires on the `agentplain/instruction.created` event the Plaino
 * dispatcher emits whenever a /talk turn classifies as INSTRUCT.
 * Reads the PLAINO_INSTRUCTION approval queue item the dispatcher
 * created, drafts the work via the discipline-tagged instruction
 * handler, and writes the draft back into the same row.
 *
 * Mirrors the support-handler-on-create pattern: bounded concurrency,
 * two retries on transient failures, audit-log on success + failure.
 *
 * Per `project_no_outbound_architecture`: this function reads + drafts
 * + writes durable state. It does NOT send anything to the customer.
 * The operator (or the customer on small workspaces) reviews the draft
 * in the approval queue and the customer's existing tools handle any
 * send.
 *
 * Per `feedback_cold_start_safe_agents`: stateless. Re-fires on the
 * same queue item are bounded — the store's `readForDrafting` returns
 * null when the row is already in `awaiting_review`, so the handler
 * is a no-op on retry.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger } from '@/lib/observability';
import { withSystemContext } from '@/lib/db/rls';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import {
  PrismaInstructionQueueStore,
  PrismaMemoryStore,
  runInstructionHandler,
} from '@/lib/plaino';

export const INSTRUCTION_HANDLER_ON_CREATE_FUNCTION_ID =
  'agentplain-instruction-handler-on-create';

export const INSTRUCTION_CREATED_EVENT = 'agentplain/instruction.created';

/** Shape of the event the dispatcher emits. */
export interface InstructionCreatedEventData {
  approvalQueueItemId: string;
  workspaceId: string;
  targetDiscipline: string;
}

export const instructionHandlerOnCreateFn = inngest.createFunction(
  {
    id: INSTRUCTION_HANDLER_ON_CREATE_FUNCTION_ID,
    name: 'agentplain instruction-handler on PLAINO_INSTRUCTION create',
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: INSTRUCTION_CREATED_EVENT }],
  },
  async ({ event }) =>
    runWithDisableGate(INSTRUCTION_HANDLER_ON_CREATE_FUNCTION_ID, () =>
      withInngestErrorReporting(
        { functionId: INSTRUCTION_HANDLER_ON_CREATE_FUNCTION_ID },
        async () => {
          const logger = getLogger().child({
            boundary: 'inngest',
            function_id: INSTRUCTION_HANDLER_ON_CREATE_FUNCTION_ID,
          });
          const data = parseEventData(event?.data);
          if (!data) {
            logger.info('event missing approvalQueueItemId, skipping');
            return { skipped: true, reason: 'malformed-event' as const };
          }
          logger.info('instruction-handler fire started', {
            approval_queue_item_id: data.approvalQueueItemId,
            workspace_id: data.workspaceId,
            target_discipline: data.targetDiscipline,
          });

          // Wave-3 phase 5 — paused-for-billing gate. Workspaces with
          // PAUSED / PAST_DUE subscription skip the LLM call entirely;
          // the draft never runs. The PLAINO_INSTRUCTION row stays
          // PENDING in /approvals — the operator can decide whether
          // to keep it or dismiss when billing is current again.
          const pause = await isWorkspacePaused({
            workspaceId: data.workspaceId,
          }).catch(() => ({ isPaused: false, status: null, reason: '' }));
          if (pause.isPaused) {
            logger.info('instruction-handler skipped — workspace paused for billing', {
              approval_queue_item_id: data.approvalQueueItemId,
              workspace_id: data.workspaceId,
              subscription_status: pause.status,
            });
            return {
              skipped: true,
              reason: 'paused-for-billing' as const,
            };
          }

          const store = new PrismaInstructionQueueStore(data.workspaceId);
          // The memory store runs in a system context too — the
          // instruction-handler is a background process with no user
          // session. It only READS for feedback rules; no writes here.
          const memory = new PrismaMemoryStore(data.workspaceId, {
            ctx: {
              userId: null,
              workspaceId: data.workspaceId,
              isOperator: true,
            },
          });
          const res = await runInstructionHandler({
            approvalQueueItemId: data.approvalQueueItemId,
            store,
            memory,
          });

          if (!res.ok) {
            reportInngestItemFailure(
              new Error(`${res.error.code}: ${res.error.message}`),
              {
                functionId: INSTRUCTION_HANDLER_ON_CREATE_FUNCTION_ID,
                extraTags: {
                  approval_queue_item_id: data.approvalQueueItemId,
                  workspace_id: data.workspaceId,
                  error_code: res.error.code,
                },
              },
            );
            await recordAuditFailure({
              workspaceId: data.workspaceId,
              approvalQueueItemId: data.approvalQueueItemId,
              error: res.error,
            });
            return {
              ok: false as const,
              error: { code: res.error.code, message: res.error.message },
            };
          }

          await recordAuditSuccess({
            workspaceId: data.workspaceId,
            approvalQueueItemId: data.approvalQueueItemId,
            honoredRulesCount: res.value.honoredRules.length,
            draftBodyChars: res.value.draftBody.length,
          });
          logger.info('instruction-handler fire finished', {
            approval_queue_item_id: data.approvalQueueItemId,
            workspace_id: data.workspaceId,
            honored_rules: res.value.honoredRules.length,
            draft_chars: res.value.draftBody.length,
          });
          return {
            ok: true as const,
            honored_rules: res.value.honoredRules.length,
            draft_chars: res.value.draftBody.length,
          };
        },
      ),
    ),
);

function parseEventData(raw: unknown): InstructionCreatedEventData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.approvalQueueItemId !== 'string') return null;
  if (typeof r.workspaceId !== 'string') return null;
  if (typeof r.targetDiscipline !== 'string') return null;
  return {
    approvalQueueItemId: r.approvalQueueItemId,
    workspaceId: r.workspaceId,
    targetDiscipline: r.targetDiscipline,
  };
}

interface AuditSuccessArgs {
  workspaceId: string;
  approvalQueueItemId: string;
  honoredRulesCount: number;
  draftBodyChars: number;
}

async function recordAuditSuccess(args: AuditSuccessArgs): Promise<void> {
  try {
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          workspaceId: args.workspaceId,
          action: 'instruction_handler.drafted',
          targetTable: 'WorkApprovalQueueItem',
          targetId: args.approvalQueueItemId,
          payload: {
            honoredRulesCount: args.honoredRulesCount,
            draftBodyChars: args.draftBodyChars,
          },
        },
      }),
    );
  } catch {
    // Best-effort. The draft is already in the operator queue; an
    // audit-log failure is non-fatal.
  }
}

interface AuditFailureArgs {
  workspaceId: string;
  approvalQueueItemId: string;
  error: { code: string; message: string };
}

async function recordAuditFailure(args: AuditFailureArgs): Promise<void> {
  try {
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          workspaceId: args.workspaceId,
          action: 'instruction_handler.failed',
          targetTable: 'WorkApprovalQueueItem',
          targetId: args.approvalQueueItemId,
          payload: {
            code: args.error.code,
            message: args.error.message,
          },
        },
      }),
    );
  } catch {
    // Non-fatal.
  }
}
