/**
 * Inngest cron: customer-feedback drift sweep.
 *
 * Wave-4 closed-loop closer. Runs weekly (Sunday 03:00 ET). For each
 * ACTIVE workspace with categorized draft feedback in the trailing 7-day
 * window, aggregates corrections by (targetSkillSlug, category). Any group
 * with ≥ DRIFT_PROPOSAL_THRESHOLD same-category corrections queues a
 * workspace-scoped CapabilityProposal ("skill X corrected N× for tone —
 * propose voice-block tightening"). The same aggregate is what the
 * /briefings "what we learned from your feedback" section shows the
 * customer, so the loop closes visibly even before the operator acts on
 * the proposal.
 *
 * Per `project_no_outbound_architecture.md`: READS feedback, WRITES
 * operator-internal CapabilityProposal rows. Sends nothing; makes no LLM
 * call. Paused-for-billing workspaces are not special-cased — this only
 * aggregates already-captured feedback into the operator's queue.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Reads durable state
 * on every fire; idempotency is enforced against the proposal table (the
 * drift marker), not in-memory.
 *
 * Per `feedback_runner_portability.md`: the batch lister, the existence
 * check, the proposal writer, and the clock are injectable so the unit
 * tests run without Postgres.
 */

import {
  DRIFT_PROPOSAL_THRESHOLD,
  selectDriftGroups,
  tallyBySkillAndCategory,
  createDriftProposal,
  hasOpenDriftProposal,
  listWorkspaceFeedbackBatchesSince,
  type WorkspaceFeedbackBatch,
} from '@/lib/feedback';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID =
  'agentplain-customer-feedback-drift-sweep';
/** Sundays at 07:00 UTC ≈ 03:00 ET (EDT) / 02:00 ET (EST). We use UTC and
 *  accept the DST hour-drift — this is a weekly batch, not a hard SLA. */
export const CUSTOMER_FEEDBACK_DRIFT_SWEEP_CRON = '0 7 * * SUN';
export const CUSTOMER_FEEDBACK_DRIFT_SWEEP_TRIGGER_EVENT =
  'agentplain/customer-feedback-drift-sweep.requested';

/** Trailing window the sweep aggregates over. */
export const DRIFT_SWEEP_WINDOW_DAYS = 7;
const WINDOW_MS = DRIFT_SWEEP_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface DriftSweepResult {
  workspacesConsidered: number;
  groupsOverThreshold: number;
  proposalsQueued: number;
  proposalsSkippedExisting: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

export interface RunDriftSweepArgs {
  /** Override the batch lister. Tests pass a deterministic list. */
  listBatches?: (since: Date) => Promise<WorkspaceFeedbackBatch[]>;
  /** Override the idempotency check. */
  hasExisting?: typeof hasOpenDriftProposal;
  /** Override the proposal writer. */
  createProposal?: typeof createDriftProposal;
  /** Fixed clock for tests. */
  now?: Date;
}

export async function runCustomerFeedbackDriftSweep(
  args: RunDriftSweepArgs = {},
): Promise<DriftSweepResult> {
  const now = args.now ?? new Date();
  const since = new Date(now.getTime() - WINDOW_MS);
  const listBatches = args.listBatches ?? listWorkspaceFeedbackBatchesSince;
  const hasExisting = args.hasExisting ?? hasOpenDriftProposal;
  const createProposal = args.createProposal ?? createDriftProposal;

  const batches = await listBatches(since);
  const result: DriftSweepResult = {
    workspacesConsidered: batches.length,
    groupsOverThreshold: 0,
    proposalsQueued: 0,
    proposalsSkippedExisting: 0,
    failures: [],
  };

  const weekStartIso = since.toISOString();
  const weekEndIso = now.toISOString();

  for (const batch of batches) {
    const groups = selectDriftGroups(
      tallyBySkillAndCategory(batch.rows),
      DRIFT_PROPOSAL_THRESHOLD,
    );
    for (const group of groups) {
      result.groupsOverThreshold += 1;
      try {
        const exists = await hasExisting(
          batch.workspaceId,
          group.targetSkillSlug,
          group.category,
          since,
        );
        if (exists) {
          result.proposalsSkippedExisting += 1;
          continue;
        }
        await createProposal({
          workspaceId: batch.workspaceId,
          targetSkillSlug: group.targetSkillSlug,
          category: group.category,
          count: group.count,
          weekStartIso,
          weekEndIso,
        });
        result.proposalsQueued += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        reportInngestItemFailure(err, {
          functionId: CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID,
          extraTags: {
            workspace_id: batch.workspaceId,
            skill: group.targetSkillSlug,
            phase: 'queue-proposal',
          },
        });
        result.failures.push({ workspaceId: batch.workspaceId, reason });
      }
    }
  }

  return result;
}

export const customerFeedbackDriftSweepFn = inngest.createFunction(
  {
    id: CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID,
    name: 'agentplain customer feedback drift sweep (weekly Sun ~03:00 ET)',
    triggers: [
      { cron: CUSTOMER_FEEDBACK_DRIFT_SWEEP_CRON },
      { event: CUSTOMER_FEEDBACK_DRIFT_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID,
          schedule: CUSTOMER_FEEDBACK_DRIFT_SWEEP_CRON,
          checkinMargin: 15,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID,
              });
              logger.info('customer-feedback drift sweep started');
              const out = await runCustomerFeedbackDriftSweep();
              logger.info('customer-feedback drift sweep finished', {
                considered: out.workspacesConsidered,
                over_threshold: out.groupsOverThreshold,
                proposals_queued: out.proposalsQueued,
                skipped_existing: out.proposalsSkippedExisting,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
