/**
 * Inngest cron: chief-of-staff scheduler sweep.
 *
 * Runs every 15 minutes. For each workspace with at least one ACTIVE
 * membership AND at least one ACTIVE calendar credential (GOOGLE or
 * M365) AND the scheduler's discipline (operations) NOT disabled on
 * `WorkspacePreference.disabledDisciplines`:
 *
 *   1. Build a `ChiefOfStaffMcpFetcher` that pulls the next 7 days of
 *      calendar events via the multiplexer (Google first, then M365).
 *   2. Invoke `runChiefOfStaffForWorkspace(...)` which composes
 *      `runSkill` with `PrismaApprovalSink`. Every emitted proposal
 *      lands in `WorkApprovalQueueItem` as PENDING, tagged with
 *      `discipline = 'operations'` via `prisma-approval-sink.ts`.
 *   3. NOT_CONFIGURED on the underlying fetcher is a clean skip —
 *      treated as "workspace removed their connector mid-sweep" and
 *      counted on `workspacesSkippedUnconfigured`, not as a failure.
 *
 * Per `project_no_outbound_architecture.md`: this cron READS the
 * customer's calendar and WRITES rows into our `WorkApprovalQueueItem`
 * table only. It never writes back to the calendar, never sends email,
 * never calls Twilio / SendGrid. The chief-of-staff skill enforces
 * that contract; this cron is the production caller that flips the
 * skill from demo-only to firing on real data.
 *
 * Per the audit (`docs/agent-interviews/01-runtime-skills.md`):
 *   "No production caller. The wrapper already binds PrismaApprovalSink,
 *    so the approval-queue path lights up the moment a caller exists."
 * This file IS that caller.
 *
 * Per `feedback_cold_start_safe_agents.md`: this cron reads durable
 * state on every fire. There is no in-memory cache of "which workspaces
 * need a sweep" between fires.
 *
 * Per `feedback_runner_portability.md`: the workspace lister + fetcher
 * factory are injectable so the test impl can pin a deterministic set
 * of workspaces and fetchers without standing up Prisma.
 *
 * Cadence rationale (every 15 minutes):
 *   - The chief-of-staff proposes meeting slots over a 7-day lookahead.
 *     Calendars churn in seconds-to-minutes when a meeting is added /
 *     accepted / declined. 15 minutes is the right granularity to keep
 *     proposals fresh without burning provider quota.
 *   - Google Calendar's per-user quota (`calendar.events.list`) is
 *     ~600 reads/minute. At 15-min cadence with 100 workspaces, that's
 *     ~6 reads/minute — well below the rate limit.
 *   - The skill is idempotent at the proposal-id level — re-running
 *     emits new proposalIds, so a window of duplicate-but-distinct
 *     PENDING rows is the expected steady state until the operator
 *     reviews them.
 */

import type { Vertical, Workspace } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { runChiefOfStaffForWorkspace } from '@/lib/skills/chief-of-staff-scheduler';
import { ChiefOfStaffMcpFetcher } from '@/lib/skills/scheduler/chief-of-staff-fetcher';
import type { CalendarFetcher } from '@/lib/skills/scheduler/types';
import {
  DEFAULT_CHIEF_OF_STAFF_CONFIG,
  readChiefOfStaffConfig,
  type ChiefOfStaffConfig,
} from '@/lib/skills/config';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import { gateSkillFire, type FireGateOutcome } from '@/lib/skills/fire-gate';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const SCHEDULER_SWEEP_FUNCTION_ID = 'agentplain-scheduler-sweep';
/** Every 15 minutes. */
export const SCHEDULER_SWEEP_CRON = '*/15 * * * *';
/** On-demand trigger for dev-console smoke-testing. */
export const SCHEDULER_SWEEP_TRIGGER_EVENT =
  'agentplain/scheduler-sweep.requested';

/** The discipline the chief-of-staff scheduler is tagged under. Read
 *  from the sidecar mapping so the cron stays honest if the mapping
 *  changes later. */
const SCHEDULER_DISCIPLINE_ID =
  SKILL_DISCIPLINE['chief-of-staff-scheduler'] ?? 'operations';

const DEFAULT_LOOKAHEAD_DAYS = 7;

export interface SchedulerSweepResult {
  /** Workspaces that passed the membership + credential gate. */
  workspacesConsidered: number;
  /** Workspaces whose run produced at least one approval row. */
  workspacesWithProposals: number;
  /** Workspaces skipped because the multiplexer found no active calendar
   *  credential. Expected when the operator disconnects mid-sweep. */
  workspacesSkippedUnconfigured: number;
  /** Workspaces skipped because the operator turned the scheduler's
   *  discipline OFF on the Discipline panel. */
  workspacesSkippedDisciplineDisabled: number;
  /** Wave-2 marketplace gate — workspace uninstalled the skill. */
  workspacesSkippedNotInstalled: number;
  /** Customer-control gate — workspace is paused (vacation/PTO/cutover)
   *  OR the per-skill scheduling window excludes the current moment.
   *  Mirrors the follow-up-chaser sweep's gate so /settings/pause +
   *  /settings/schedule are honored for the scheduler too. */
  workspacesSkippedFireGate: number;
  /** Total proposals (meetings + reply-drafts + to-dos) written. */
  proposalsWritten: number;
  /** Per-workspace failures — one row dies, the sweep keeps going. */
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  hasGoogle: boolean;
  hasM365: boolean;
  disabledDisciplines: string[];
}

export interface RunSchedulerSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace calendar fetcher factory. Tests inject
   *  a stub here so the cron flow can be exercised without standing up
   *  the Google / Microsoft MCP servers. */
  buildCalendarFetcher?: (workspaceId: string) => CalendarFetcher;
  /** Clock injection for deterministic tests. */
  now?: Date;
  /** Lookahead window in days. Defaults to 7. */
  lookaheadDays?: number;
  /** Override the per-skill config reader. Tests pass a deterministic
   *  fake; production leaves this undefined and the live reader hits
   *  SkillConfig via the system context. */
  readConfig?: (workspaceId: string) => Promise<ChiefOfStaffConfig>;
  /** Override the marketplace install check. Default = live reader. */
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  /** Customer-control gate override. Tests pass a deterministic result;
   *  production leaves undefined and the live reader hits
   *  WorkspacePauseConfig + SkillScheduleWindow via the system context. */
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
}

/**
 * One pass of the scheduler sweep. Iterates `WorkspaceCandidate[]` and
 * calls `runChiefOfStaffForWorkspace` for each one that passes the
 * discipline + connector gate.
 */
export async function runSchedulerSweep(
  args: RunSchedulerSweepArgs = {},
): Promise<SchedulerSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const now = args.now ?? new Date();
  const lookaheadDays = args.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS;

  const candidates = await listCandidates();

  const result: SchedulerSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithProposals: 0,
    workspacesSkippedUnconfigured: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedFireGate: 0,
    proposalsWritten: 0,
    failures: [],
  };

  for (const ws of candidates) {
    // Gate 0 (wave-3): paused-for-billing.
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(
      () => ({ isPaused: false }),
    );
    if (pause.isPaused) {
      result.workspacesSkippedUnconfigured += 1;
      continue;
    }
    // Gate 1: discipline activation. If the operator turned the
    // scheduler's discipline OFF on the Discipline panel, skip.
    const disabledIds = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter((d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null);
    if (disabledIds.includes(SCHEDULER_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }

    // Gate 2: at least one calendar credential. Belt-and-suspenders —
    // the candidate lister already filtered on this; we re-check in
    // case of a race between candidate listing and execution.
    if (!ws.hasGoogle && !ws.hasM365) {
      result.workspacesSkippedUnconfigured += 1;
      continue;
    }
    // Gate 3 (wave-2): marketplace install check. A workspace that
    // explicitly uninstalled the chief-of-staff scheduler gets
    // skipped — no proposal rows, no LLM cost.
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: 'chief-of-staff-scheduler',
        }).catch(() => true));
    if (!installed) {
      result.workspacesSkippedNotInstalled += 1;
      continue;
    }

    // Gate 4: vacation/PTO + scheduling-window check. Same gate the
    // follow-up-chaser sweep uses — reads WorkspacePauseConfig +
    // SkillScheduleWindow fresh per fire so /settings/pause (emergency
    // stop) and /settings/schedule (per-skill window) actually halt the
    // scheduler. Previously this sweep only honored the BILLING pause
    // (Gate 0); a vacation pause or off-hours window left it firing.
    // The skip is honest: no calendar read, no LLM cost, no /approvals
    // row. A gate read error fails OPEN (allowed) so a transient DB blip
    // doesn't silently stop the fleet.
    const gateResult = await (args.gateFire
      ? args.gateFire(ws.id)
      : withSystemContext((tx) =>
          gateSkillFire({
            tx,
            workspaceId: ws.id,
            skillSlug: 'chief-of-staff-scheduler',
            disciplineId: SCHEDULER_DISCIPLINE_ID,
            now,
          }),
        ).catch((): FireGateOutcome => ({ allowed: true })));
    if (!gateResult.allowed) {
      result.workspacesSkippedFireGate += 1;
      continue;
    }

    // Build the fetcher (test stub or production multiplexer) and run
    // the skill. NOT_CONFIGURED here is a clean skip — the workspace
    // disconnected between candidate listing and execution.
    const calendarFetcher = args.buildCalendarFetcher?.(ws.id);
    const fetcher = new ChiefOfStaffMcpFetcher({
      workspaceId: ws.id,
      calendarFetcher,
    });

    // Wave-2 per-skill config: read scheduler knobs at fire time. The
    // customer's `defaultMeetingMinutes` + `businessHoursStart/End` flow
    // straight into the chief-of-staff input so slots match what they
    // configured in /settings/skills. Per `feedback_cold_start_safe_agents`
    // this is a per-fire durable read. Tests inject `readConfig` to
    // bypass the DB; the production fallback uses the SkillConfig table.
    const skillConfig = await (args.readConfig
      ? args.readConfig(ws.id)
      : readChiefOfStaffConfig(ws.id).catch(() => DEFAULT_CHIEF_OF_STAFF_CONFIG));

    try {
      const run = await runChiefOfStaffForWorkspace({
        workspaceId: ws.id,
        fetcher,
        now,
        lookaheadDays,
        defaultMeetingMinutes: skillConfig.defaultMeetingMinutes,
        businessHours: {
          startLocalHour: skillConfig.businessHoursStart,
          endLocalHour: skillConfig.businessHoursEnd,
        },
        bufferMinutes: skillConfig.bufferMinutes,
      });
      if (!run.ok) {
        if (run.error.code === 'NOT_CONFIGURED') {
          result.workspacesSkippedUnconfigured += 1;
          continue;
        }
        reportInngestItemFailure(new Error(run.error.message), {
          functionId: SCHEDULER_SWEEP_FUNCTION_ID,
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
      const written = run.value.sunk;
      if (written > 0) {
        result.workspacesWithProposals += 1;
        result.proposalsWritten += written;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: SCHEDULER_SWEEP_FUNCTION_ID,
        extraTags: {
          workspace_id: ws.id,
          phase: 'run-skill',
        },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }

  return result;
}

/**
 * Default candidate lister — workspaces with at least one ACTIVE
 * membership AND at least one ACTIVE calendar credential (GOOGLE or
 * M365). Pulls `WorkspacePreference.disabledDisciplines` so the per-
 * workspace gate can run without a second round-trip.
 *
 * Both tables are FORCE_RLS'd; we open `withSystemContext` to satisfy
 * the operator branch. Otherwise the query returns zero rows and the
 * sweep silently no-ops forever.
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

export const schedulerSweepFn = inngest.createFunction(
  {
    id: SCHEDULER_SWEEP_FUNCTION_ID,
    name: 'agentplain scheduler sweep',
    triggers: [
      { cron: SCHEDULER_SWEEP_CRON },
      { event: SCHEDULER_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(SCHEDULER_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: SCHEDULER_SWEEP_FUNCTION_ID,
          schedule: SCHEDULER_SWEEP_CRON,
          // 15-min cadence — give the monitor a 5-min margin so a slightly
          // delayed Vercel fire doesn't false-alarm.
          checkinMargin: 5,
          maxRuntime: 10,
        },
        () =>
          withInngestErrorReporting(
            { functionId: SCHEDULER_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: SCHEDULER_SWEEP_FUNCTION_ID,
              });
              logger.info('scheduler sweep started');
              const out = await runSchedulerSweep();
              logger.info('scheduler sweep finished', {
                considered: out.workspacesConsidered,
                with_proposals: out.workspacesWithProposals,
                skipped_unconfigured: out.workspacesSkippedUnconfigured,
                skipped_discipline_disabled: out.workspacesSkippedDisciplineDisabled,
                skipped_fire_gate: out.workspacesSkippedFireGate,
                proposals_written: out.proposalsWritten,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);

// Re-export for the registry route + tests.
export type { Workspace };
