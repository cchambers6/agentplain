/**
 * Inngest cron: law intake-conflict-screen daily sweep.
 *
 * Fires once per day (7 AM UTC). For each workspace that has:
 *   - vertical = LAW
 *   - At least one ACTIVE membership
 *   - The 'legal' discipline NOT disabled in WorkspacePreference
 *
 * Per qualifying workspace:
 *   1. Billing-pause gate — skip PAUSED / PAST_DUE workspaces.
 *   2. Marketplace install gate — skip if the skill was uninstalled.
 *   3. Fire gate (vacation / schedule window) — skip if paused / off-window.
 *   4. `runConflictScreenForWorkspace` — reads the firm's un-screened
 *      new-matter intakes, screens each against the firm ledger, and stages
 *      a COMPLIANCE_FLAG (conflict) or PROCESS_DOC_DRAFT (clear →
 *      engagement-letter) approval item the responsible attorney reviews.
 *
 * Closes the audit's silent-gating gap: law-intake-conflict-screen shipped
 * (PR #206) module-complete but had NO production caller — a paying law
 * workspace never saw a conflict-screen verdict. This is that caller.
 *
 * NO QuickBooks dependency: the ledger + intakes come from the workspace's
 * ingested KnowledgeDocument rows (the same substrate the ledger fetcher
 * reads). A firm with an empty ledger gets a `needs-counsel-review` verdict
 * that says so explicitly — never a false "clear."
 *
 * Per `project_no_outbound_architecture.md`: writes WorkApprovalQueueItem
 * rows ONLY. The attorney decides per MRPC 1.7 / 1.18.
 *
 * Per `feedback_cold_start_safe_agents.md`: reads all durable state per
 * fire; no in-memory workspace cache between fires.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { runConflictScreenForWorkspace } from '@/lib/skills/law-intake-conflict-screen/run-for-workspace';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import { gateSkillFire, type FireGateOutcome } from '@/lib/skills/fire-gate';
import type { Vertical } from '@prisma/client';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID =
  'agentplain-law-intake-conflict-screen-sweep';
/** Once daily at 7 AM UTC — new matters get screened before the day starts. */
export const LAW_CONFLICT_SCREEN_SWEEP_CRON = '0 7 * * *';
/** On-demand trigger for dev-console smoke-testing. */
export const LAW_CONFLICT_SCREEN_SWEEP_TRIGGER_EVENT =
  'agentplain/law-intake-conflict-screen-sweep.requested';

const LAW_CONFLICT_SCREEN_SKILL_SLUG = 'law-intake-conflict-screen';
const LAW_CONFLICT_SCREEN_DISCIPLINE_ID =
  SKILL_DISCIPLINE[LAW_CONFLICT_SCREEN_SKILL_SLUG] ?? 'legal';

export interface LawConflictScreenSweepResult {
  workspacesConsidered: number;
  workspacesWithVerdicts: number;
  workspacesSkippedPaused: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotInstalled: number;
  workspacesSkippedFireGate: number;
  intakesScreened: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  disabledDisciplines: string[];
}

export interface RunLawConflictScreenSweepArgs {
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  runForWorkspace?: (input: {
    workspaceId: string;
    now?: Date;
  }) => Promise<{
    ok: boolean;
    intakesScreened: number;
    failures: Array<{ matterId: string; reason: string }>;
  }>;
  now?: Date;
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
}

export async function runLawConflictScreenSweep(
  args: RunLawConflictScreenSweepArgs = {},
): Promise<LawConflictScreenSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const now = args.now ?? new Date();
  const candidates = await listCandidates();

  const result: LawConflictScreenSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithVerdicts: 0,
    workspacesSkippedPaused: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedFireGate: 0,
    intakesScreened: 0,
    failures: [],
  };

  for (const ws of candidates) {
    // Gate 0: billing pause.
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(
      () => ({ isPaused: false }),
    );
    if (pause.isPaused) {
      result.workspacesSkippedPaused += 1;
      continue;
    }

    // Gate 1: discipline enabled.
    const disabledIds = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter(
        (d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null,
      );
    if (disabledIds.includes(LAW_CONFLICT_SCREEN_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }

    // Gate 2: marketplace install check.
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: LAW_CONFLICT_SCREEN_SKILL_SLUG,
        }).catch(() => true));
    if (!installed) {
      result.workspacesSkippedNotInstalled += 1;
      continue;
    }

    // Gate 3: vacation / schedule-window gate.
    const gateResult = await (args.gateFire
      ? args.gateFire(ws.id)
      : withSystemContext((tx) =>
          gateSkillFire({
            tx,
            workspaceId: ws.id,
            skillSlug: LAW_CONFLICT_SCREEN_SKILL_SLUG,
            disciplineId: LAW_CONFLICT_SCREEN_DISCIPLINE_ID,
            now,
          }),
        ).catch((): FireGateOutcome => ({ allowed: true })));
    if (!gateResult.allowed) {
      result.workspacesSkippedFireGate += 1;
      continue;
    }

    // Run the conflict screen across the workspace's pending intakes.
    try {
      const runForWorkspace =
        args.runForWorkspace ??
        ((input: { workspaceId: string; now?: Date }) =>
          runConflictScreenForWorkspace(input));
      const run = await runForWorkspace({ workspaceId: ws.id, now });

      for (const f of run.failures) {
        reportInngestItemFailure(new Error(f.reason), {
          functionId: LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID,
          extraTags: {
            workspace_id: ws.id,
            matter_id: f.matterId,
            phase: 'run-skill',
          },
        });
        result.failures.push({
          workspaceId: ws.id,
          reason: `${f.matterId}: ${f.reason}`,
        });
      }
      if (run.intakesScreened > 0) {
        result.workspacesWithVerdicts += 1;
        result.intakesScreened += run.intakesScreened;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-skill' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }

  return result;
}

/**
 * Default candidate lister — LAW workspaces with at least one ACTIVE
 * membership. No integration credential is required: the ledger + intakes
 * come from ingested KnowledgeDocument rows.
 */
async function defaultListCandidates(): Promise<WorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        vertical: 'LAW',
        memberships: { some: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        vertical: true,
        preference: {
          select: { disabledDisciplines: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({
      id: ws.id,
      vertical: ws.vertical,
      disabledDisciplines: ws.preference?.disabledDisciplines ?? [],
    }));
  });
}

export const lawConflictScreenSweepFn = inngest.createFunction(
  {
    id: LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID,
    name: 'agentplain law intake-conflict-screen daily sweep',
    triggers: [
      { cron: LAW_CONFLICT_SCREEN_SWEEP_CRON },
      { event: LAW_CONFLICT_SCREEN_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID,
          schedule: LAW_CONFLICT_SCREEN_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 20,
        },
        () =>
          withInngestErrorReporting(
            { functionId: LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: LAW_CONFLICT_SCREEN_SWEEP_FUNCTION_ID,
              });
              logger.info('law-intake-conflict-screen sweep started');
              const out = await runLawConflictScreenSweep();
              logger.info('law-intake-conflict-screen sweep finished', {
                considered: out.workspacesConsidered,
                with_verdicts: out.workspacesWithVerdicts,
                intakes_screened: out.intakesScreened,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
