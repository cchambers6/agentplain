/**
 * Inngest cron: compliance-watch daily sweep.
 *
 * Wave-3 discipline-wrap closer for the legal discipline (cross-vertical).
 * Daily at 13:00 UTC (= 8/9am ET depending on DST). Scans the trailing 24h
 * of approval drafts via the sentinel corpus + a built-in PII pattern set;
 * drafts one COMPLIANCE_DIGEST row per workspace that had at least one
 * match.
 *
 * Per `project_no_outbound_architecture.md`: sentinel ADVISES — never
 * blocks. Nothing leaves the workspace.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { runComplianceWatchForWorkspace } from '@/lib/skills/compliance-watch-general';
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

export const COMPLIANCE_WATCH_SWEEP_FUNCTION_ID =
  'agentplain-compliance-watch-sweep';
export const COMPLIANCE_WATCH_SWEEP_CRON = '0 13 * * *';
export const COMPLIANCE_WATCH_SWEEP_TRIGGER_EVENT =
  'agentplain/compliance-watch-sweep.requested';

const COMPLIANCE_DISCIPLINE_ID = 'legal';
const COMPLIANCE_SKILL_SLUG = 'compliance-watch-general';

export interface ComplianceWatchSweepResult {
  workspacesConsidered: number;
  workspacesWithDigest: number;
  workspacesWithNoMatches: number;
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

export interface RunComplianceWatchSweepArgs {
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  runForWorkspace?: (input: {
    workspaceId: string;
    now?: Date;
  }) => Promise<{ ok: boolean; sunk: boolean; hadMatches: boolean; reason?: string }>;
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  now?: Date;
}

export async function runComplianceWatchSweep(
  args: RunComplianceWatchSweepArgs = {},
): Promise<ComplianceWatchSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();
  const now = args.now;

  const result: ComplianceWatchSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithDigest: 0,
    workspacesWithNoMatches: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedPausedForBilling: 0,
    failures: [],
  };

  for (const ws of candidates) {
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
    if (disabled.includes(COMPLIANCE_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: COMPLIANCE_SKILL_SLUG,
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
      if (run.hadMatches) {
        if (run.sunk) result.workspacesWithDigest += 1;
      } else {
        result.workspacesWithNoMatches += 1;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: COMPLIANCE_WATCH_SWEEP_FUNCTION_ID,
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
): Promise<{ ok: boolean; sunk: boolean; hadMatches: boolean; reason?: string }> {
  const res = await runComplianceWatchForWorkspace({ workspaceId, now });
  if (!res.ok) {
    return {
      ok: false,
      sunk: false,
      hadMatches: false,
      reason: `${res.error.code}: ${res.error.message}`,
    };
  }
  return {
    ok: true,
    sunk: res.value.sunk,
    hadMatches: res.value.proposal !== null,
  };
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

export const complianceWatchSweepFn = inngest.createFunction(
  {
    id: COMPLIANCE_WATCH_SWEEP_FUNCTION_ID,
    name: 'agentplain compliance-watch daily sweep',
    triggers: [
      { cron: COMPLIANCE_WATCH_SWEEP_CRON },
      { event: COMPLIANCE_WATCH_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(COMPLIANCE_WATCH_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: COMPLIANCE_WATCH_SWEEP_FUNCTION_ID,
          schedule: COMPLIANCE_WATCH_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: COMPLIANCE_WATCH_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: COMPLIANCE_WATCH_SWEEP_FUNCTION_ID,
              });
              logger.info('compliance-watch sweep started');
              const out = await runComplianceWatchSweep();
              logger.info('compliance-watch sweep finished', {
                considered: out.workspacesConsidered,
                with_digest: out.workspacesWithDigest,
                with_no_matches: out.workspacesWithNoMatches,
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
