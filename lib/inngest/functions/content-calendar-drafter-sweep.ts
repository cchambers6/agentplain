/**
 * Inngest cron: content-calendar-drafter weekly sweep.
 *
 * Wave-3 discipline-wrap closer for the marketing discipline. Mondays
 * at 13:00 UTC. Each active workspace whose marketing discipline is NOT
 * disabled + the calendar skill is installed gets one CONTENT_CALENDAR
 * row drafted into /approvals.
 *
 * Per `project_no_outbound_architecture.md`: nothing posts. The
 * calendar is a draft for the operator to review.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { runCalendarDrafterForWorkspace } from '@/lib/skills/content-calendar-drafter-general';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import type { Vertical } from '@prisma/client';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const CONTENT_CALENDAR_SWEEP_FUNCTION_ID =
  'agentplain-content-calendar-sweep';
export const CONTENT_CALENDAR_SWEEP_CRON = '0 13 * * MON';
export const CONTENT_CALENDAR_SWEEP_TRIGGER_EVENT =
  'agentplain/content-calendar-sweep.requested';

const CALENDAR_DISCIPLINE_ID = 'marketing';
const CALENDAR_SKILL_SLUG = 'content-calendar-drafter-general';

export interface ContentCalendarSweepResult {
  workspacesConsidered: number;
  workspacesWithCalendar: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotInstalled: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  disabledDisciplines: string[];
}

export interface RunContentCalendarSweepArgs {
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  runForWorkspace?: (input: {
    workspaceId: string;
    now?: Date;
  }) => Promise<{ ok: boolean; sunk: boolean; reason?: string }>;
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  now?: Date;
}

export async function runContentCalendarSweep(
  args: RunContentCalendarSweepArgs = {},
): Promise<ContentCalendarSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();
  const now = args.now;

  const result: ContentCalendarSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithCalendar: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    failures: [],
  };

  for (const ws of candidates) {
    const disabled = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter((d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null);
    if (disabled.includes(CALENDAR_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: CALENDAR_SKILL_SLUG,
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
        result.failures.push({ workspaceId: ws.id, reason: run.reason ?? 'unknown' });
        continue;
      }
      if (run.sunk) result.workspacesWithCalendar += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: CONTENT_CALENDAR_SWEEP_FUNCTION_ID,
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
  const res = await runCalendarDrafterForWorkspace({ workspaceId, now });
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

export const contentCalendarSweepFn = inngest.createFunction(
  {
    id: CONTENT_CALENDAR_SWEEP_FUNCTION_ID,
    name: 'agentplain content-calendar weekly sweep',
    triggers: [
      { cron: CONTENT_CALENDAR_SWEEP_CRON },
      { event: CONTENT_CALENDAR_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(CONTENT_CALENDAR_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: CONTENT_CALENDAR_SWEEP_FUNCTION_ID,
          schedule: CONTENT_CALENDAR_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: CONTENT_CALENDAR_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: CONTENT_CALENDAR_SWEEP_FUNCTION_ID,
              });
              logger.info('content-calendar sweep started');
              const out = await runContentCalendarSweep();
              logger.info('content-calendar sweep finished', {
                considered: out.workspacesConsidered,
                with_calendar: out.workspacesWithCalendar,
                skipped_discipline_disabled: out.workspacesSkippedDisciplineDisabled,
                skipped_not_installed: out.workspacesSkippedNotInstalled,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
