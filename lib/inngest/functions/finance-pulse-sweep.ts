/**
 * Inngest cron: finance-pulse sweep.
 *
 * Wave-4 discipline-wrap closer for the finance discipline. Runs once
 * a week (Monday 13:05 UTC — five minutes after the analytics pulse
 * to avoid an Anthropic-side burst on the same minute). For each
 * active workspace whose finance discipline is NOT disabled AND the
 * finance-pulse skill is installed (default-on for all verticals via
 * the marketplace), drafts one FINANCE_PULSE row into /approvals.
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
import { runFinancePulseForWorkspace } from '@/lib/skills/finance-pulse-general';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import type { Vertical } from '@prisma/client';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const FINANCE_PULSE_SWEEP_FUNCTION_ID =
  'agentplain-finance-pulse-sweep';
/** Mondays at 13:05 UTC — five minutes after the analytics pulse so the
 *  two LLM-heavy crons don't collide on the same minute. */
export const FINANCE_PULSE_SWEEP_CRON = '5 13 * * MON';
export const FINANCE_PULSE_SWEEP_TRIGGER_EVENT =
  'agentplain/finance-pulse-sweep.requested';

const FINANCE_PULSE_DISCIPLINE_ID = 'finance';
const FINANCE_PULSE_SKILL_SLUG = 'finance-pulse-general';

export interface FinancePulseSweepResult {
  workspacesConsidered: number;
  workspacesWithPulse: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotInstalled: number;
  workspacesSkippedPausedForBilling: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  disabledDisciplines: string[];
}

export interface RunFinancePulseSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace runner. Tests inject. */
  runForWorkspace?: (input: {
    workspaceId: string;
    now?: Date;
  }) => Promise<{ ok: boolean; sunk: boolean; reason?: string }>;
  /** Override the marketplace install check. Tests inject. */
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  /** Override the paused-for-billing check. Tests inject. */
  isPaused?: (workspaceId: string) => Promise<boolean>;
  /** Fixed clock for tests. */
  now?: Date;
}

export async function runFinancePulseSweep(
  args: RunFinancePulseSweepArgs = {},
): Promise<FinancePulseSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();
  const now = args.now;

  const result: FinancePulseSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithPulse: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedPausedForBilling: 0,
    failures: [],
  };

  for (const ws of candidates) {
    const isPaused = args.isPaused
      ? await args.isPaused(ws.id).catch(() => false)
      : (
          await isWorkspacePaused({ workspaceId: ws.id }).catch(() => ({
            isPaused: false,
          }))
        ).isPaused;
    if (isPaused) {
      result.workspacesSkippedPausedForBilling += 1;
      continue;
    }
    const disabled = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter(
        (d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null,
      );
    if (disabled.includes(FINANCE_PULSE_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: FINANCE_PULSE_SKILL_SLUG,
        }).catch(() => true));
    if (!installed) {
      result.workspacesSkippedNotInstalled += 1;
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
        functionId: FINANCE_PULSE_SWEEP_FUNCTION_ID,
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
  const res = await runFinancePulseForWorkspace({ workspaceId, now });
  if (!res.ok) {
    return {
      ok: false,
      sunk: false,
      reason: `${res.error.code}: ${res.error.message}`,
    };
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

export const financePulseSweepFn = inngest.createFunction(
  {
    id: FINANCE_PULSE_SWEEP_FUNCTION_ID,
    name: 'agentplain finance weekly pulse sweep',
    triggers: [
      { cron: FINANCE_PULSE_SWEEP_CRON },
      { event: FINANCE_PULSE_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(FINANCE_PULSE_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: FINANCE_PULSE_SWEEP_FUNCTION_ID,
          schedule: FINANCE_PULSE_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: FINANCE_PULSE_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: FINANCE_PULSE_SWEEP_FUNCTION_ID,
              });
              logger.info('finance-pulse sweep started');
              const out = await runFinancePulseSweep();
              logger.info('finance-pulse sweep finished', {
                considered: out.workspacesConsidered,
                with_pulse: out.workspacesWithPulse,
                skipped_discipline_disabled:
                  out.workspacesSkippedDisciplineDisabled,
                skipped_not_installed: out.workspacesSkippedNotInstalled,
                skipped_paused_for_billing:
                  out.workspacesSkippedPausedForBilling,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
