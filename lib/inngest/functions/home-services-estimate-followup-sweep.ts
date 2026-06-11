/**
 * Inngest cron: home-services estimate follow-up sweep.
 *
 * Runs daily at 09:00 UTC. For each HOME_SERVICES workspace with at least
 * one ACTIVE membership AND an ACTIVE QUICKBOOKS credential AND the
 * sales-enablement discipline NOT disabled on
 * `WorkspacePreference.disabledDisciplines`:
 *
 *   1. Billing-pause gate — paused/past-due workspaces are skipped so
 *      a dunning customer isn't charged tokens for drafts they can't act on.
 *   2. Discipline gate — operator has disabled sales-enablement for this
 *      workspace.
 *   3. QB credential gate — workspace must have an ACTIVE QUICKBOOKS
 *      IntegrationCredential (race-condition safety: re-checks after the
 *      candidate list was built).
 *   4. Marketplace install gate — workspace must have explicitly installed
 *      the skill from /marketplace.
 *   5. Fire gate — vacation/PTO pause + scheduling-window check
 *      (`gateSkillFire`).
 *
 *   Then: `runEstimateFollowupForWorkspace` fetches Pending QB estimates,
 *   classifies each by follow-up stage (day 2 / 5 / 10 / 14+), renders
 *   polite nudge drafts, and stages each as a WorkApprovalQueueItem
 *   (kind=FOLLOW_UP_NUDGE, status=PENDING) for the operator to approve.
 *
 * Per `project_no_outbound_architecture.md`: this cron READS QB and
 * WRITES rows into WorkApprovalQueueItem. Never sends email/SMS directly.
 *
 * Per `feedback_cold_start_safe_agents.md`: reads durable state (QB
 * credentials, workspace preferences) on every fire. No in-memory state
 * reused across runs.
 *
 * Per `feedback_runner_portability.md`: workspace lister and
 * runForWorkspace are injectable so the test impl can pin deterministic
 * state without standing up Prisma or the QB MCP server.
 *
 * Cadence rationale (daily at 09:00 UTC):
 *   - Estimate follow-up is a day-granularity cadence (thresholds at day
 *     2, 5, 10, 14). Running once a day is sufficient; running more often
 *     would re-classify estimates already staged and create duplicates.
 *   - 09:00 UTC is distinct from all sibling crons (07:00 stripe, 10:00
 *     b2b-ceo, 13:00 compliance/analytics, 16:00 stripe-abandoned, 21:00
 *     b2b-reply) and lands before US business hours open, so drafts are
 *     ready when the operator reviews their queue in the morning.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import {
  runEstimateFollowupForWorkspace,
  ESTIMATE_FOLLOWUP_SKILL_SLUG,
} from '@/lib/skills/home-services-estimate-followup/run-for-workspace';
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

export const HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID =
  'agentplain-home-services-estimate-followup-sweep';
/** Daily at 09:00 UTC — before US business hours open. */
export const HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_CRON = '0 9 * * *';
/** On-demand trigger for dev-console smoke-testing. */
export const HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_TRIGGER_EVENT =
  'agentplain/home-services-estimate-followup-sweep.requested';

/** Discipline the estimate-followup skill is tagged under. */
const ESTIMATE_FOLLOWUP_DISCIPLINE_ID =
  SKILL_DISCIPLINE[ESTIMATE_FOLLOWUP_SKILL_SLUG] ?? 'sales-enablement';

export interface EstimateFollowupSweepResult {
  workspacesConsidered: number;
  workspacesWithDrafts: number;
  workspacesSkippedPausedForBilling: number;
  workspacesSkippedDisciplineDisabled: number;
  /** QB credential missing or disconnected at sweep time. */
  workspacesSkippedNotConnected: number;
  /** Workspace explicitly uninstalled the skill from /marketplace. */
  workspacesSkippedNotInstalled: number;
  /** Vacation/PTO pause or scheduling-window exclusion. */
  workspacesSkippedFireGate: number;
  draftsWritten: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  /** Operator name sourced from the workspace profile — used to sign
   *  the follow-up drafts. Falls back to 'Your team' when absent. */
  operatorName: string;
  /** Operator email used to sign the follow-up drafts. */
  operatorEmail: string;
  operatorPhone: string | null;
  hasQuickbooks: boolean;
  disabledDisciplines: string[];
}

export interface RunEstimateFollowupSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace runner. Tests pass a stub that records
   *  calls without touching QB or Prisma. */
  runForWorkspace?: (
    workspaceId: string,
    rep: { name: string; email: string; phone: string | null },
    now: Date,
  ) => Promise<{ ok: boolean; draftsWritten: number; reason?: string }>;
  /** Override the marketplace install check. */
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  /** Override the fire-gate. Tests pass a deterministic result. */
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
  /** Clock injection for deterministic tests. */
  now?: Date;
}

/**
 * One pass of the home-services estimate follow-up sweep. Iterates
 * `WorkspaceCandidate[]` and calls `runEstimateFollowupForWorkspace` for
 * each one that passes the full gate stack.
 */
export async function runEstimateFollowupSweep(
  args: RunEstimateFollowupSweepArgs = {},
): Promise<EstimateFollowupSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const now = args.now ?? new Date();
  const candidates = await listCandidates();

  const result: EstimateFollowupSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithDrafts: 0,
    workspacesSkippedPausedForBilling: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotConnected: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedFireGate: 0,
    draftsWritten: 0,
    failures: [],
  };

  for (const ws of candidates) {
    // Gate 0: billing pause — PAUSED/PAST_DUE workspaces skip every sweep
    // so a dunning customer isn't charged tokens.
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(
      () => ({ isPaused: false }),
    );
    if (pause.isPaused) {
      result.workspacesSkippedPausedForBilling += 1;
      continue;
    }

    // Gate 1: discipline activation.
    const disabledIds = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter(
        (d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null,
      );
    if (disabledIds.includes(ESTIMATE_FOLLOWUP_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }

    // Gate 2: QB credential. The candidate lister already filters on this;
    // re-check defensively to guard against a race where the operator
    // disconnected QB between the list query and this loop iteration.
    if (!ws.hasQuickbooks) {
      result.workspacesSkippedNotConnected += 1;
      continue;
    }

    // Gate 3: marketplace install check. A workspace that explicitly
    // uninstalled this skill from /marketplace gets skipped.
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: ESTIMATE_FOLLOWUP_SKILL_SLUG,
        }).catch(() => true));
    if (!installed) {
      result.workspacesSkippedNotInstalled += 1;
      continue;
    }

    // Gate 4: vacation/PTO + scheduling-window check.
    const gateResult = await (args.gateFire
      ? args.gateFire(ws.id)
      : withSystemContext((tx) =>
          gateSkillFire({
            tx,
            workspaceId: ws.id,
            skillSlug: ESTIMATE_FOLLOWUP_SKILL_SLUG,
            disciplineId: ESTIMATE_FOLLOWUP_DISCIPLINE_ID,
            now,
          }),
        ).catch((): FireGateOutcome => ({ allowed: true })));
    if (!gateResult.allowed) {
      result.workspacesSkippedFireGate += 1;
      continue;
    }

    const rep = {
      name: ws.operatorName,
      email: ws.operatorEmail,
      phone: ws.operatorPhone,
    };

    try {
      const run = args.runForWorkspace
        ? await args.runForWorkspace(ws.id, rep, now)
        : await runEstimateFollowupForWorkspaceLive(ws.id, rep, now);

      if (!run.ok) {
        reportInngestItemFailure(new Error(run.reason ?? 'unknown'), {
          functionId: HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
          extraTags: { workspace_id: ws.id, phase: 'run-skill' },
        });
        result.failures.push({
          workspaceId: ws.id,
          reason: run.reason ?? 'unknown',
        });
        continue;
      }
      if (run.draftsWritten > 0) {
        result.workspacesWithDrafts += 1;
        result.draftsWritten += run.draftsWritten;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-skill' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }

  return result;
}

/**
 * Live adapter: calls `runEstimateFollowupForWorkspace` with the production
 * QB lookup + Prisma approval sink (both constructed inside the function).
 * Returns a flat `{ ok, draftsWritten, reason? }` shape so the sweep loop
 * doesn't need to know the inner skill result structure.
 */
async function runEstimateFollowupForWorkspaceLive(
  workspaceId: string,
  rep: { name: string; email: string; phone: string | null },
  now: Date,
): Promise<{ ok: boolean; draftsWritten: number; reason?: string }> {
  const result = await runEstimateFollowupForWorkspace({
    workspaceId,
    rep,
    now,
  });
  if (!result.ok) {
    return {
      ok: false,
      draftsWritten: 0,
      reason: `${result.error.code}: ${result.error.message}`,
    };
  }
  return {
    ok: true,
    draftsWritten: result.value.drafts.length,
  };
}

/**
 * Default candidate lister — HOME_SERVICES workspaces with at least one
 * ACTIVE membership AND an ACTIVE QUICKBOOKS IntegrationCredential. Pulls
 * `WorkspacePreference.disabledDisciplines` and operator profile fields so
 * the gate + draft-signing runs without a second round-trip.
 */
async function defaultListCandidates(): Promise<WorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        vertical: 'HOME_SERVICES',
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
        integrationCredentials: {
          where: { status: 'ACTIVE', provider: 'QUICKBOOKS' },
          select: { provider: true },
        },
        preference: {
          select: { disabledDisciplines: true },
        },
        // Resolve the BROKER_OWNER member so the skill can sign drafts with
        // their name + email. Phase-1 workspaces have exactly one BROKER_OWNER
        // (the workspace founder); take the first active one.
        memberships: {
          where: { status: 'ACTIVE', role: 'BROKER_OWNER' },
          take: 1,
          select: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => {
      const owner = ws.memberships[0]?.user;
      return {
        id: ws.id,
        vertical: ws.vertical,
        operatorName: owner?.name ?? 'Your team',
        operatorEmail: owner?.email ?? '',
        operatorPhone: null,
        hasQuickbooks: ws.integrationCredentials.some(
          (c) => c.provider === 'QUICKBOOKS',
        ),
        disabledDisciplines: ws.preference?.disabledDisciplines ?? [],
      };
    });
  });
}

export const homeServicesEstimateFollowupSweepFn = inngest.createFunction(
  {
    id: HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
    name: 'agentplain home-services estimate follow-up sweep',
    triggers: [
      { cron: HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_CRON },
      { event: HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(
      HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
      () =>
        withCronMonitor(
          {
            slug: HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
            schedule: HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_CRON,
            checkinMargin: 10,
            maxRuntime: 15,
          },
          () =>
            withInngestErrorReporting(
              {
                functionId: HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
              },
              async () => {
                const logger = getLogger().child({
                  boundary: 'inngest',
                  function_id:
                    HOME_SERVICES_ESTIMATE_FOLLOWUP_SWEEP_FUNCTION_ID,
                });
                logger.info('home-services estimate follow-up sweep started');
                const out = await runEstimateFollowupSweep();
                logger.info(
                  'home-services estimate follow-up sweep finished',
                  {
                    considered: out.workspacesConsidered,
                    with_drafts: out.workspacesWithDrafts,
                    skipped_billing: out.workspacesSkippedPausedForBilling,
                    skipped_discipline_disabled:
                      out.workspacesSkippedDisciplineDisabled,
                    skipped_not_connected: out.workspacesSkippedNotConnected,
                    skipped_not_installed: out.workspacesSkippedNotInstalled,
                    skipped_fire_gate: out.workspacesSkippedFireGate,
                    drafts_written: out.draftsWritten,
                    failed: out.failures.length,
                  },
                );
                return out;
              },
            ),
        ),
    ),
);
