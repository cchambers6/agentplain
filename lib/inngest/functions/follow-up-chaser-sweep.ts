/**
 * Inngest cron: follow-up-chaser hourly sweep.
 *
 * Runs every hour. For each workspace with at least one ACTIVE
 * membership AND at least one ACTIVE email credential (GOOGLE or M365)
 * AND the follow-up-chaser's discipline (sales-enablement) NOT disabled
 * on `WorkspacePreference.disabledDisciplines`:
 *
 *   1. Build a `FollowUpMultiplexFetcher` that routes to Gmail (when
 *      ACTIVE GOOGLE) or Outlook (when ACTIVE M365) — Google wins when
 *      both are connected.
 *   2. Invoke `runFollowUpChaserForWorkspace(...)` which composes
 *      `runSkill` with `PrismaFollowUpApprovalSink`. Each nudge
 *      proposal lands in `WorkApprovalQueueItem` as PENDING, tagged
 *      with `discipline = 'sales-enablement'`.
 *   3. NOT_CONFIGURED on the underlying fetcher is a clean skip —
 *      "workspace removed their connector mid-sweep".
 *
 * Per `project_no_outbound_architecture.md`: this cron READS the
 * customer's mailbox and WRITES rows into `WorkApprovalQueueItem` only.
 * Never sends mail, never tags messages, never modifies Drafts. The
 * skill itself drafts the nudge body; the operator approves and the
 * customer's mailbox performs the send.
 *
 * Per `feedback_cold_start_safe_agents.md`: reads durable state on
 * every fire. No in-memory cache of "which workspaces need a sweep"
 * between fires.
 *
 * Per `feedback_runner_portability.md`: workspace lister + fetcher
 * factory are injectable so the test impl can pin deterministic state
 * without standing up Prisma or the Gmail/Outlook MCP servers.
 *
 * Cadence rationale (every hour):
 *   - Stale-thread state changes at the day granularity (default
 *     `staleAfterDays = 4`). Hourly cadence is generous — even
 *     mid-day, fresh nudges land within an hour of crossing the
 *     stale threshold.
 *   - Gmail's per-user quota (`gmail.users.threads.list`) is well
 *     above what an hourly sweep over a 30-day window consumes.
 *   - The skill caps proposals per run (`maxNudgesPerRun = 5` by
 *     default), so even on a workspace with hundreds of stalled
 *     threads, the operator's queue stays manageable.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { runFollowUpChaserForWorkspace } from '@/lib/skills/follow-up-chaser-general/run-for-workspace';
import { FollowUpMultiplexFetcher } from '@/lib/skills/follow-up-chaser-general/multiplex-fetcher';
import type { FollowUpFetcher } from '@/lib/skills/follow-up-chaser-general/types';
import {
  DEFAULT_FOLLOW_UP_CHASER_CONFIG,
  readFollowUpChaserConfig,
  type FollowUpChaserConfig,
} from '@/lib/skills/config';
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

export const FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID =
  'agentplain-follow-up-chaser-sweep';
/** Every hour on the hour. */
export const FOLLOW_UP_CHASER_SWEEP_CRON = '0 * * * *';
/** On-demand trigger for dev-console smoke-testing. */
export const FOLLOW_UP_CHASER_SWEEP_TRIGGER_EVENT =
  'agentplain/follow-up-chaser-sweep.requested';

/** Discipline the follow-up-chaser is tagged under — read from the
 *  sidecar mapping so the cron stays honest if the mapping changes. */
const FOLLOW_UP_DISCIPLINE_ID =
  SKILL_DISCIPLINE['follow-up-chaser-general'] ?? 'sales-enablement';

const DEFAULT_LOOKBACK_DAYS = 14;

export interface FollowUpChaserSweepResult {
  workspacesConsidered: number;
  workspacesWithNudges: number;
  workspacesSkippedUnconfigured: number;
  workspacesSkippedDisciplineDisabled: number;
  /** Wave-2 marketplace gate — workspace explicitly uninstalled the
   *  skill from /marketplace. */
  workspacesSkippedNotInstalled: number;
  /** Wave-5 customer-control gate — workspace is paused (vacation/PTO/
   *  cutover) OR the per-skill scheduling window excludes the
   *  current moment. */
  workspacesSkippedFireGate: number;
  nudgesWritten: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  /** Workspace vertical — needed for the wave-2 marketplace install
   *  check (`isSkillInstalledForWorkspace`). */
  vertical: Vertical;
  hasGoogle: boolean;
  hasM365: boolean;
  disabledDisciplines: string[];
}

export interface RunFollowUpChaserSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace fetcher factory. Tests inject stubs. */
  buildFetcher?: (workspaceId: string) => FollowUpFetcher;
  /** Clock injection for deterministic tests. */
  now?: Date;
  /** Lookback window in days. Defaults to 14. */
  lookbackDays?: number;
  /** Override the per-skill config reader. Tests pass a deterministic
   *  fake; production leaves this undefined and the live reader hits
   *  SkillConfig via the system context. */
  readConfig?: (workspaceId: string) => Promise<FollowUpChaserConfig>;
  /** Override the marketplace install check. Tests pass a deterministic
   *  fake; production leaves undefined and the live reader hits
   *  WorkspaceSkillInstallation via the system context. Default: live
   *  marketplace reader. */
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  /** Wave-5 customer-control gate override. Tests pass a deterministic
   *  result; production leaves undefined and the live reader hits
   *  WorkspacePauseConfig + SkillScheduleWindow via the system context. */
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
}

/**
 * One pass of the follow-up-chaser sweep. Iterates `WorkspaceCandidate[]`
 * and calls `runFollowUpChaserForWorkspace` for each one that passes
 * the discipline + connector gate.
 */
export async function runFollowUpChaserSweep(
  args: RunFollowUpChaserSweepArgs = {},
): Promise<FollowUpChaserSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const now = args.now ?? new Date();
  const lookbackDays = args.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const candidates = await listCandidates();

  const result: FollowUpChaserSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithNudges: 0,
    workspacesSkippedUnconfigured: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedFireGate: 0,
    nudgesWritten: 0,
    failures: [],
  };

  for (const ws of candidates) {
    // Gate 0 (wave-3): paused-for-billing. PAUSED/PAST_DUE workspaces
    // skip every sweep so a dunning customer pays nothing for nudges.
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(
      () => ({ isPaused: false }),
    );
    if (pause.isPaused) {
      result.workspacesSkippedUnconfigured += 1;
      continue;
    }
    // Gate 1: discipline activation.
    const disabledIds = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter((d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null);
    if (disabledIds.includes(FOLLOW_UP_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }
    // Gate 2: at least one email credential. The candidate lister
    // already filters on this; re-check defensively.
    if (!ws.hasGoogle && !ws.hasM365) {
      result.workspacesSkippedUnconfigured += 1;
      continue;
    }
    // Gate 3 (wave-2): marketplace install check. A workspace that
    // explicitly uninstalled this skill from /marketplace gets
    // skipped — no draft, no LLM cost, no /approvals row.
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: 'follow-up-chaser-general',
        }).catch(() => true));
    if (!installed) {
      result.workspacesSkippedNotInstalled += 1;
      continue;
    }

    // Gate 4 (wave-5): vacation/PTO + scheduling-window check. The
    // gate skips fires honestly — no LLM cost, no /approvals row. The
    // skipped count surfaces on the per-discipline scorecard.
    const gateResult = await (args.gateFire
      ? args.gateFire(ws.id)
      : withSystemContext((tx) =>
          gateSkillFire({
            tx,
            workspaceId: ws.id,
            skillSlug: 'follow-up-chaser-general',
            disciplineId: FOLLOW_UP_DISCIPLINE_ID,
            now,
          }),
        ).catch((): FireGateOutcome => ({ allowed: true })));
    if (!gateResult.allowed) {
      result.workspacesSkippedFireGate += 1;
      continue;
    }

    const fetcher =
      args.buildFetcher?.(ws.id) ??
      new FollowUpMultiplexFetcher({ workspaceId: ws.id });

    // Wave-2 per-skill config: read the customer's chaser knobs at fire
    // time so the sweep honors `staleAfterDays` + `maxNudgesPerRun`
    // straight from the settings UI. Per `feedback_cold_start_safe_agents`
    // this is a per-fire durable read, never cached across sweeps.
    // Tests inject `readConfig` to bypass the DB; the production
    // fallback uses the SkillConfig table.
    const skillConfig = await (args.readConfig
      ? args.readConfig(ws.id)
      : readFollowUpChaserConfig(ws.id).catch(() => DEFAULT_FOLLOW_UP_CHASER_CONFIG));

    try {
      const run = await runFollowUpChaserForWorkspace({
        workspaceId: ws.id,
        fetcher,
        now,
        lookbackDays,
        staleAfterDays: skillConfig.staleAfterDays,
        maxNudgesPerRun: skillConfig.maxNudgesPerRun,
      });
      if (!run.ok) {
        if (run.error.code === 'NOT_CONFIGURED') {
          result.workspacesSkippedUnconfigured += 1;
          continue;
        }
        reportInngestItemFailure(new Error(run.error.message), {
          functionId: FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID,
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
        result.workspacesWithNudges += 1;
        result.nudgesWritten += sunk;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-skill' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

/**
 * Default candidate lister — workspaces with at least one ACTIVE
 * membership AND at least one ACTIVE GOOGLE or M365
 * IntegrationCredential. Pulls `WorkspacePreference.disabledDisciplines`
 * so the per-workspace gate runs without a second round-trip.
 */
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
        vertical: true,
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
      vertical: ws.vertical,
      hasGoogle: ws.integrationCredentials.some((c) => c.provider === 'GOOGLE'),
      hasM365: ws.integrationCredentials.some((c) => c.provider === 'M365'),
      disabledDisciplines: ws.preference?.disabledDisciplines ?? [],
    }));
  });
}

export const followUpChaserSweepFn = inngest.createFunction(
  {
    id: FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID,
    name: 'agentplain follow-up chaser sweep',
    triggers: [
      { cron: FOLLOW_UP_CHASER_SWEEP_CRON },
      { event: FOLLOW_UP_CHASER_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID,
          schedule: FOLLOW_UP_CHASER_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID,
              });
              logger.info('follow-up-chaser sweep started');
              const out = await runFollowUpChaserSweep();
              logger.info('follow-up-chaser sweep finished', {
                considered: out.workspacesConsidered,
                with_nudges: out.workspacesWithNudges,
                skipped_unconfigured: out.workspacesSkippedUnconfigured,
                skipped_discipline_disabled: out.workspacesSkippedDisciplineDisabled,
                nudges_written: out.nudgesWritten,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
