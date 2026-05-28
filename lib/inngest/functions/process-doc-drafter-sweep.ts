/**
 * Inngest cron: process-doc-drafter weekly sweep.
 *
 * Runs Monday 13:00 UTC (≈ 09:00 ET — close enough for a weekly
 * batch; we don't chase the DST seam). For each workspace with at
 * least one ACTIVE membership AND at least one ACTIVE email
 * credential (GOOGLE or M365) AND the process-doc-drafter's
 * discipline (operations) NOT disabled on
 * `WorkspacePreference.disabledDisciplines`:
 *
 *   1. Build a `ProcessDocMultiplexFetcher` that routes to Gmail
 *      (ACTIVE GOOGLE) or Outlook (ACTIVE M365). Google wins when
 *      both are connected.
 *   2. Invoke `runProcessDocDrafterForWorkspace(...)` which composes
 *      `runSkill` with `PrismaProcessDocApprovalSink`. Each drafted
 *      SOP lands in `WorkApprovalQueueItem` as PENDING, tagged with
 *      `discipline = 'operations'`.
 *   3. NOT_CONFIGURED on the underlying fetcher is a clean skip.
 *
 * Per `project_no_outbound_architecture.md`: this cron READS the
 * customer's mailbox and WRITES rows into `WorkApprovalQueueItem`
 * only. It NEVER publishes an SOP to Notion / Confluence / Drive —
 * the skill drafts; the operator copies the body into their own
 * documentation system once accurate.
 *
 * Per `feedback_cold_start_safe_agents.md`: reads durable state on
 * every fire. No cache.
 *
 * Per `feedback_runner_portability.md`: workspace lister + fetcher
 * factory are injectable for deterministic tests.
 *
 * Cadence rationale (weekly):
 *   - Process patterns surface across days-to-weeks, not minutes.
 *     Once a week is the right granularity — frequent enough that a
 *     newly emerging pattern (3+ repeats in 30 days) gets drafted
 *     while still fresh, rare enough that the operator's queue
 *     doesn't fill with duplicate SOPs.
 *   - The skill's substring dedupe + occurrence floor (`minOccurrences
 *     = 3`) + per-run cap (`maxProposalsPerRun = 3`) bound the queue
 *     noise per workspace per run.
 *   - Monday morning lands the drafts at the start of the operator's
 *     week, when there's slack to review and adopt SOPs.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { runProcessDocDrafterForWorkspace } from '@/lib/skills/process-doc-drafter-general/run-for-workspace';
import { ProcessDocMultiplexFetcher } from '@/lib/skills/process-doc-drafter-general/multiplex-fetcher';
import type { ProcessDocFetcher } from '@/lib/skills/process-doc-drafter-general/types';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID =
  'agentplain-process-doc-drafter-sweep';
/** Monday 13:00 UTC (~09:00 ET; we don't chase DST for a weekly job). */
export const PROCESS_DOC_DRAFTER_SWEEP_CRON = '0 13 * * 1';
/** On-demand trigger for dev-console smoke-testing. */
export const PROCESS_DOC_DRAFTER_SWEEP_TRIGGER_EVENT =
  'agentplain/process-doc-drafter-sweep.requested';

/** Discipline the process-doc-drafter is tagged under. Read from the
 *  sidecar mapping so the cron stays honest if the mapping changes. */
const PROCESS_DOC_DISCIPLINE_ID =
  SKILL_DISCIPLINE['process-doc-drafter-general'] ?? 'operations';

const DEFAULT_LOOKBACK_DAYS = 30;

export interface ProcessDocDrafterSweepResult {
  workspacesConsidered: number;
  workspacesWithProposals: number;
  workspacesSkippedUnconfigured: number;
  workspacesSkippedDisciplineDisabled: number;
  proposalsWritten: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  hasGoogle: boolean;
  hasM365: boolean;
  disabledDisciplines: string[];
}

export interface RunProcessDocDrafterSweepArgs {
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  buildFetcher?: (workspaceId: string) => ProcessDocFetcher;
  now?: Date;
  lookbackDays?: number;
}

export async function runProcessDocDrafterSweep(
  args: RunProcessDocDrafterSweepArgs = {},
): Promise<ProcessDocDrafterSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const now = args.now ?? new Date();
  const lookbackDays = args.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const candidates = await listCandidates();

  const result: ProcessDocDrafterSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithProposals: 0,
    workspacesSkippedUnconfigured: 0,
    workspacesSkippedDisciplineDisabled: 0,
    proposalsWritten: 0,
    failures: [],
  };

  for (const ws of candidates) {
    const disabledIds = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter((d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null);
    if (disabledIds.includes(PROCESS_DOC_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }
    if (!ws.hasGoogle && !ws.hasM365) {
      result.workspacesSkippedUnconfigured += 1;
      continue;
    }

    const fetcher =
      args.buildFetcher?.(ws.id) ??
      new ProcessDocMultiplexFetcher({ workspaceId: ws.id });

    try {
      const run = await runProcessDocDrafterForWorkspace({
        workspaceId: ws.id,
        fetcher,
        now,
        lookbackDays,
      });
      if (!run.ok) {
        if (run.error.code === 'NOT_CONFIGURED') {
          result.workspacesSkippedUnconfigured += 1;
          continue;
        }
        reportInngestItemFailure(new Error(run.error.message), {
          functionId: PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID,
          extraTags: {
            workspace_id: ws.id,
            phase: 'run-skill',
            error_code: run.error.code,
          },
        });
        result.failures.push({
          workspaceId: ws.id,
          reason: `${run.error.code}: ${run.error.message}`,
        });
        continue;
      }
      const sunk = run.value.sunk;
      if (sunk > 0) {
        result.workspacesWithProposals += 1;
        result.proposalsWritten += sunk;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-skill' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

async function defaultListCandidates(): Promise<WorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        memberships: { some: { status: 'ACTIVE' } },
        integrationCredentials: {
          some: {
            status: 'ACTIVE',
            provider: { in: ['GOOGLE', 'M365'] },
          },
        },
      },
      select: {
        id: true,
        integrationCredentials: {
          where: {
            status: 'ACTIVE',
            provider: { in: ['GOOGLE', 'M365'] },
          },
          select: { provider: true },
        },
        preference: {
          select: { disabledDisciplines: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({
      id: ws.id,
      hasGoogle: ws.integrationCredentials.some((c) => c.provider === 'GOOGLE'),
      hasM365: ws.integrationCredentials.some((c) => c.provider === 'M365'),
      disabledDisciplines: ws.preference?.disabledDisciplines ?? [],
    }));
  });
}

export const processDocDrafterSweepFn = inngest.createFunction(
  {
    id: PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID,
    name: 'agentplain process-doc drafter sweep',
    triggers: [
      { cron: PROCESS_DOC_DRAFTER_SWEEP_CRON },
      { event: PROCESS_DOC_DRAFTER_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID,
          schedule: PROCESS_DOC_DRAFTER_SWEEP_CRON,
          // Weekly cadence — give the monitor a generous margin.
          checkinMargin: 30,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: PROCESS_DOC_DRAFTER_SWEEP_FUNCTION_ID,
              });
              logger.info('process-doc-drafter sweep started');
              const out = await runProcessDocDrafterSweep();
              logger.info('process-doc-drafter sweep finished', {
                considered: out.workspacesConsidered,
                with_proposals: out.workspacesWithProposals,
                skipped_unconfigured: out.workspacesSkippedUnconfigured,
                skipped_discipline_disabled: out.workspacesSkippedDisciplineDisabled,
                proposals_written: out.proposalsWritten,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
