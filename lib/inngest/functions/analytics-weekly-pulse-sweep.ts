/**
 * Inngest cron: analytics-weekly-pulse sweep.
 *
 * Wave-3 discipline-wrap closer for the analytics discipline. Runs once
 * a week (Monday 08:00 ET = 13:00 UTC during EDT; the cron expression
 * uses UTC so spring/fall DST shifts the fire by an hour — acceptable
 * for a weekly read). For each active workspace whose analytics
 * discipline is NOT disabled AND the analytics-weekly-pulse skill is
 * installed (default-on for all verticals via the marketplace), drafts
 * one ANALYTICS_PULSE row into /approvals.
 *
 * Per `project_no_outbound_architecture.md`: the cron READS state and
 * WRITES one row per workspace. Sends nothing.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Reads durable
 * state on every fire.
 *
 * Per `feedback_runner_portability.md`: candidate lister + per-workspace
 * runner are injectable so unit tests don't need Postgres.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { runAnalyticsPulseForWorkspace } from '@/lib/skills/analytics-weekly-pulse-general';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import { shouldSweepFire, type SweepGateArgs } from '../sweep-fire-gate';
import type { Vertical } from '@prisma/client';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const ANALYTICS_PULSE_SWEEP_FUNCTION_ID =
  'agentplain-analytics-pulse-sweep';
/** Mondays at 13:00 UTC ≈ 9am ET (EDT) / 8am ET (EST). Weekly cadence. */
export const ANALYTICS_PULSE_SWEEP_CRON = '0 13 * * MON';
export const ANALYTICS_PULSE_SWEEP_TRIGGER_EVENT =
  'agentplain/analytics-pulse-sweep.requested';

const PULSE_DISCIPLINE_ID = 'analytics';
const PULSE_SKILL_SLUG = 'analytics-weekly-pulse-general';
/** Wave-7 activation slug — keeps this charter DORMANT until deliberately
 *  flipped on (see `lib/fleet/activation.ts`). */
const PULSE_AGENT_SLUG = 'analytics-weekly-pulse';

export interface AnalyticsPulseSweepResult {
  workspacesConsidered: number;
  workspacesWithPulse: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotInstalled: number;
  workspacesSkippedPausedForBilling: number;
  /** Wave-7: agent not activated (default-OFF) — the dominant skip until
   *  Conner flips this charter live. */
  workspacesSkippedDormant: number;
  /** Wave-7: customer /settings/pause (vacation) or /settings/schedule
   *  window blocked the fire for an already-activated agent. */
  workspacesSkippedFireGate: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  disabledDisciplines: string[];
}

export interface RunAnalyticsPulseSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace runner. Tests inject. */
  runForWorkspace?: (input: {
    workspaceId: string;
    now?: Date;
  }) => Promise<{ ok: boolean; sunk: boolean; reason?: string }>;
  /** Override the marketplace install check. Tests inject. */
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  /** Wave-7 activation + customer fire-gate overrides. Tests inject; in
   *  production both run live (default-OFF activation + WorkspacePauseConfig
   *  + SkillScheduleWindow). */
  isActivated?: SweepGateArgs['isActivated'];
  gateFire?: SweepGateArgs['gateFire'];
  /** Fixed clock for tests. */
  now?: Date;
}

export async function runAnalyticsPulseSweep(
  args: RunAnalyticsPulseSweepArgs = {},
): Promise<AnalyticsPulseSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();
  const now = args.now;

  const result: AnalyticsPulseSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithPulse: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedPausedForBilling: 0,
    workspacesSkippedDormant: 0,
    workspacesSkippedFireGate: 0,
    failures: [],
  };

  for (const ws of candidates) {
    // Wave-3 phase 5 — paused-for-billing gate. Subscription PAUSED /
    // PAST_DUE workspaces skip the LLM call entirely.
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(
      () => ({ isPaused: false }),
    );
    if (pause.isPaused) {
      result.workspacesSkippedPausedForBilling += 1;
      continue;
    }
    const disabled = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter((d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null);
    if (disabled.includes(PULSE_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: PULSE_SKILL_SLUG,
        }).catch(() => true));
    if (!installed) {
      result.workspacesSkippedNotInstalled += 1;
      continue;
    }
    // Wave-7 gate: (1) activation (default-OFF) keeps this charter dormant
    // until deliberately flipped on; (2) gateSkillFire honors the
    // customer's /settings/pause + /settings/schedule for an activated
    // agent. A dormant agent never reads the pause/schedule tables.
    const decision = await shouldSweepFire({
      workspaceId: ws.id,
      agentSlug: PULSE_AGENT_SLUG,
      skillSlug: PULSE_SKILL_SLUG,
      disciplineId: PULSE_DISCIPLINE_ID,
      now,
      isActivated: args.isActivated,
      gateFire: args.gateFire,
    });
    if (!decision.fire) {
      if (decision.gate === 'activation') result.workspacesSkippedDormant += 1;
      else result.workspacesSkippedFireGate += 1;
      continue;
    }
    try {
      const run = args.runForWorkspace
        ? await args.runForWorkspace({ workspaceId: ws.id, now })
        : await runForWorkspaceLive(ws.id, now);
      if (!run.ok) {
        result.failures.push({
          workspaceId: ws.id,
          reason: run.reason ?? 'unknown',
        });
        continue;
      }
      if (run.sunk) result.workspacesWithPulse += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: ANALYTICS_PULSE_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-skill' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }

  return result;
}

async function runForWorkspaceLive(
  workspaceId: string,
  now: Date | undefined,
): Promise<{ ok: boolean; sunk: boolean; reason?: string }> {
  const res = await runAnalyticsPulseForWorkspace({ workspaceId, now });
  if (!res.ok) {
    return { ok: false, sunk: false, reason: `${res.error.code}: ${res.error.message}` };
  }
  return { ok: true, sunk: res.value.sunk };
}

async function defaultListCandidates(): Promise<WorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        memberships: { some: { status: 'ACTIVE' } },
        closureStatus: 'ACTIVE',
      },
      select: {
        id: true,
        vertical: true,
        preference: { select: { disabledDisciplines: true } },
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

export const analyticsPulseSweepFn = inngest.createFunction(
  {
    id: ANALYTICS_PULSE_SWEEP_FUNCTION_ID,
    name: 'agentplain analytics weekly pulse sweep',
    triggers: [
      { cron: ANALYTICS_PULSE_SWEEP_CRON },
      { event: ANALYTICS_PULSE_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(ANALYTICS_PULSE_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: ANALYTICS_PULSE_SWEEP_FUNCTION_ID,
          schedule: ANALYTICS_PULSE_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: ANALYTICS_PULSE_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: ANALYTICS_PULSE_SWEEP_FUNCTION_ID,
              });
              logger.info('analytics-pulse sweep started');
              const out = await runAnalyticsPulseSweep();
              logger.info('analytics-pulse sweep finished', {
                considered: out.workspacesConsidered,
                with_pulse: out.workspacesWithPulse,
                skipped_discipline_disabled: out.workspacesSkippedDisciplineDisabled,
                skipped_not_installed: out.workspacesSkippedNotInstalled,
                skipped_dormant: out.workspacesSkippedDormant,
                skipped_fire_gate: out.workspacesSkippedFireGate,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
