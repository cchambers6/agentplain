/**
 * Inngest cron: CPA month-end-close monthly sweep.
 *
 * Fires once a month, early on the 1st (5 AM UTC), to prep the close for
 * the PRIOR calendar month — the canonical "close last month" cadence. For
 * each workspace that has:
 *   - vertical = CPA
 *   - At least one ACTIVE membership
 *   - An ACTIVE QUICKBOOKS IntegrationCredential
 *   - The 'finance' discipline NOT disabled in WorkspacePreference
 *
 * Per qualifying workspace:
 *   1. Billing-pause gate — skip PAUSED / PAST_DUE workspaces.
 *   2. Marketplace install gate — skip if the skill was uninstalled.
 *   3. Fire gate (vacation / schedule window) — skip if paused / off-window.
 *   4. `runMonthEndCloseForWorkspace` — enumerates the firm's QuickBooks
 *      clients, runs the close skill per engagement, and stages each chase
 *      + client-status draft as a FOLLOW_UP_NUDGE approval item the CSM
 *      reviews in /approvals.
 *
 * Closes the audit's silent-gating gap: month-end-close-cpa shipped
 * (PR #205) module-complete but had NO production caller — a paying CPA
 * workspace never saw a close-prep row. This is that caller.
 *
 * Per `project_no_outbound_architecture.md`: writes WorkApprovalQueueItem
 * rows ONLY. The CSM sends from their own system after review.
 *
 * Per `feedback_cold_start_safe_agents.md`: reads all durable state per
 * fire; no in-memory workspace cache between fires.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { runMonthEndCloseForWorkspace } from '@/lib/skills/month-end-close-cpa/run-for-workspace';
import type { DraftPersister } from '@/lib/skills/types';
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

export const MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID =
  'agentplain-month-end-close-cpa-sweep';
/** Monthly, 5 AM UTC on the 1st — prep last month's close. */
export const MONTH_END_CLOSE_CPA_SWEEP_CRON = '0 5 1 * *';
/** On-demand trigger for dev-console smoke-testing. */
export const MONTH_END_CLOSE_CPA_SWEEP_TRIGGER_EVENT =
  'agentplain/month-end-close-cpa-sweep.requested';

const MONTH_END_CLOSE_SKILL_SLUG = 'month-end-close-cpa';
const MONTH_END_CLOSE_DISCIPLINE_ID =
  SKILL_DISCIPLINE[MONTH_END_CLOSE_SKILL_SLUG] ?? 'finance';

export interface MonthEndCloseCpaSweepResult {
  workspacesConsidered: number;
  workspacesWithDrafts: number;
  workspacesSkippedUnconfigured: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotInstalled: number;
  workspacesSkippedFireGate: number;
  engagementsPrepped: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  disabledDisciplines: string[];
}

export interface RunMonthEndCloseCpaSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace runner. Tests inject a stub. */
  runForWorkspace?: (input: {
    workspaceId: string;
    now?: Date;
  }) => Promise<{
    ok: boolean;
    notConfigured: boolean;
    clientsPrepped: number;
    failures: Array<{ clientId: string; reason: string }>;
  }>;
  /** Override the per-workspace persister factory (passed through to the
   *  runner). Tests inject a recording persister. */
  buildPersister?: (workspaceId: string) => DraftPersister;
  /** Clock injection for deterministic tests. */
  now?: Date;
  /** Override the marketplace install check. */
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  /** Override the fire-gate check. */
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
}

export async function runMonthEndCloseCpaSweep(
  args: RunMonthEndCloseCpaSweepArgs = {},
): Promise<MonthEndCloseCpaSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const now = args.now ?? new Date();
  const candidates = await listCandidates();

  const result: MonthEndCloseCpaSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithDrafts: 0,
    workspacesSkippedUnconfigured: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedFireGate: 0,
    engagementsPrepped: 0,
    failures: [],
  };

  for (const ws of candidates) {
    // Gate 0: billing pause.
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(
      () => ({ isPaused: false }),
    );
    if (pause.isPaused) {
      result.workspacesSkippedUnconfigured += 1;
      continue;
    }

    // Gate 1: discipline enabled.
    const disabledIds = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter(
        (d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null,
      );
    if (disabledIds.includes(MONTH_END_CLOSE_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }

    // Gate 2: marketplace install check.
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: MONTH_END_CLOSE_SKILL_SLUG,
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
            skillSlug: MONTH_END_CLOSE_SKILL_SLUG,
            disciplineId: MONTH_END_CLOSE_DISCIPLINE_ID,
            now,
          }),
        ).catch((): FireGateOutcome => ({ allowed: true })));
    if (!gateResult.allowed) {
      result.workspacesSkippedFireGate += 1;
      continue;
    }

    // Run the close across the workspace's clients.
    try {
      const runForWorkspace =
        args.runForWorkspace ??
        ((input: { workspaceId: string; now?: Date }) =>
          runMonthEndCloseForWorkspace({
            ...input,
            ...(args.buildPersister
              ? { buildPersister: args.buildPersister }
              : {}),
          }));
      const run = await runForWorkspace({ workspaceId: ws.id, now });

      if (run.notConfigured && run.clientsPrepped === 0) {
        result.workspacesSkippedUnconfigured += 1;
        continue;
      }
      for (const f of run.failures) {
        reportInngestItemFailure(new Error(f.reason), {
          functionId: MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID,
          extraTags: {
            workspace_id: ws.id,
            client_id: f.clientId,
            phase: 'run-skill',
          },
        });
        result.failures.push({
          workspaceId: ws.id,
          reason: `${f.clientId}: ${f.reason}`,
        });
      }
      if (run.clientsPrepped > 0) {
        result.workspacesWithDrafts += 1;
        result.engagementsPrepped += run.clientsPrepped;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-skill' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }

  return result;
}

/**
 * Default candidate lister — CPA workspaces with at least one ACTIVE
 * membership AND an ACTIVE QUICKBOOKS credential.
 */
async function defaultListCandidates(): Promise<WorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        vertical: 'CPA',
        memberships: { some: { status: 'ACTIVE' } },
        integrationCredentials: {
          some: {
            status: 'ACTIVE',
            provider: 'QUICKBOOKS',
          },
        },
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

export const monthEndCloseCpaSweepFn = inngest.createFunction(
  {
    id: MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID,
    name: 'agentplain CPA month-end-close monthly sweep',
    triggers: [
      { cron: MONTH_END_CLOSE_CPA_SWEEP_CRON },
      { event: MONTH_END_CLOSE_CPA_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID,
          schedule: MONTH_END_CLOSE_CPA_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: MONTH_END_CLOSE_CPA_SWEEP_FUNCTION_ID,
              });
              logger.info('month-end-close-cpa sweep started');
              const out = await runMonthEndCloseCpaSweep();
              logger.info('month-end-close-cpa sweep finished', {
                considered: out.workspacesConsidered,
                with_drafts: out.workspacesWithDrafts,
                engagements_prepped: out.engagementsPrepped,
                skipped_unconfigured: out.workspacesSkippedUnconfigured,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
