/**
 * Inngest cron: property-management rent-collection chase sweep.
 *
 * Runs daily at 12:00 UTC (≈ 08:00 America/New_York). For each
 * PROPERTY_MANAGEMENT workspace with at least one ACTIVE membership AND an
 * ACTIVE BUILDIUM credential AND the finance discipline NOT disabled:
 *
 *   0. Live-flag gate — the whole sweep no-ops unless BUILDIUM_ADAPTER_LIVE=on.
 *      Without the flag the MCP builder serves FIXTURES, and we must never
 *      stage chase drafts against fixture tenants in a customer's approval
 *      queue. This is the gate "Conner pastes the key" flips: set the flag and
 *      the next 12:00 UTC fire stages real chases for connected workspaces.
 *   1. Billing-pause gate — paused/past-due workspaces are skipped.
 *   2. Discipline gate — operator disabled finance for this workspace.
 *   3. Buildium credential gate (re-check after candidate list built).
 *   4. Marketplace install gate — the skill must be installed for the
 *      workspace (runtime=live → installed-by-default for PROPERTY_MANAGEMENT).
 *   5. Fire gate — vacation/PTO pause + scheduling-window check.
 *
 *   Then: `runRentCollectionChaseForWorkspace` reads delinquent leases,
 *   buckets each by days-past-due (grace / soft-chase / formal-notice /
 *   escalation), renders the per-tenant chase, and stages each as a
 *   WorkApprovalQueueItem (kind=FOLLOW_UP_NUDGE, status=PENDING) for the PM to
 *   approve. Escalations also surface in the owner-review queue.
 *
 * Per `project_no_outbound_architecture.md`: READS Buildium, WRITES approval
 * rows. Never sends email/SMS directly.
 *
 * Per `feedback_cold_start_safe_agents.md`: reads durable state on every fire;
 * no in-memory state reused.
 *
 * Per `feedback_runner_portability.md`: candidate lister + per-workspace
 * runner are injectable so tests pin deterministic state without Prisma or
 * Buildium.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import {
  runRentCollectionChaseForWorkspace,
  RENT_COLLECTION_CHASE_SKILL_SLUG,
} from '@/lib/skills/property-management-rent-collection-chase';
import { isBuildiumLive } from '@/lib/integrations/buildium-mcp';
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

export const RENT_COLLECTION_CHASE_SWEEP_FUNCTION_ID =
  'agentplain-property-management-rent-collection-chase-sweep';
/** Daily at 12:00 UTC — ≈ 08:00 ET, before the PM opens their queue. */
export const RENT_COLLECTION_CHASE_SWEEP_CRON = '0 12 * * *';
/** On-demand trigger for dev-console smoke-testing + the onboarding
 *  "Sync 7 days of data" button. */
export const RENT_COLLECTION_CHASE_SWEEP_TRIGGER_EVENT =
  'agentplain/property-management-rent-collection-chase-sweep.requested';

const RENT_COLLECTION_CHASE_DISCIPLINE_ID =
  SKILL_DISCIPLINE[RENT_COLLECTION_CHASE_SKILL_SLUG] ?? 'finance';

export interface RentCollectionChaseSweepResult {
  workspacesConsidered: number;
  workspacesWithDrafts: number;
  /** BUILDIUM_ADAPTER_LIVE was off — the whole sweep no-op'd. */
  skippedFlagOff: boolean;
  workspacesSkippedPausedForBilling: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotConnected: number;
  workspacesSkippedNotInstalled: number;
  workspacesSkippedFireGate: number;
  draftsWritten: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  hasBuildium: boolean;
  disabledDisciplines: string[];
}

export interface RunRentCollectionChaseSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace runner. Tests pass a stub. */
  runForWorkspace?: (
    workspaceId: string,
    now: Date,
  ) => Promise<{ ok: boolean; draftsWritten: number; reason?: string }>;
  /** Override the marketplace install check. */
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  /** Override the fire-gate. */
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
  /** Override the live-flag check (defaults to isBuildiumLive). */
  liveFlag?: () => boolean;
  now?: Date;
}

export async function runRentCollectionChaseSweep(
  args: RunRentCollectionChaseSweepArgs = {},
): Promise<RentCollectionChaseSweepResult> {
  const now = args.now ?? new Date();
  const liveFlag = args.liveFlag ?? isBuildiumLive;

  const result: RentCollectionChaseSweepResult = {
    workspacesConsidered: 0,
    workspacesWithDrafts: 0,
    skippedFlagOff: false,
    workspacesSkippedPausedForBilling: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotConnected: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedFireGate: 0,
    draftsWritten: 0,
    failures: [],
  };

  // Gate 0: live flag. Off → no live Buildium data → no fixture chases in the
  // customer queue. This is the deliberate "key not pasted yet" no-op.
  if (!liveFlag()) {
    result.skippedFlagOff = true;
    return result;
  }

  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();
  result.workspacesConsidered = candidates.length;

  for (const ws of candidates) {
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(
      () => ({ isPaused: false }),
    );
    if (pause.isPaused) {
      result.workspacesSkippedPausedForBilling += 1;
      continue;
    }

    const disabledIds = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter(
        (d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null,
      );
    if (disabledIds.includes(RENT_COLLECTION_CHASE_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }

    if (!ws.hasBuildium) {
      result.workspacesSkippedNotConnected += 1;
      continue;
    }

    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: RENT_COLLECTION_CHASE_SKILL_SLUG,
        }).catch(() => true));
    if (!installed) {
      result.workspacesSkippedNotInstalled += 1;
      continue;
    }

    const gateResult = await (args.gateFire
      ? args.gateFire(ws.id)
      : withSystemContext((tx) =>
          gateSkillFire({
            tx,
            workspaceId: ws.id,
            skillSlug: RENT_COLLECTION_CHASE_SKILL_SLUG,
            disciplineId: RENT_COLLECTION_CHASE_DISCIPLINE_ID,
            now,
          }),
        ).catch((): FireGateOutcome => ({ allowed: true })));
    if (!gateResult.allowed) {
      result.workspacesSkippedFireGate += 1;
      continue;
    }

    try {
      const run = args.runForWorkspace
        ? await args.runForWorkspace(ws.id, now)
        : await runRentCollectionChaseForWorkspaceLive(ws.id, now);

      if (!run.ok) {
        reportInngestItemFailure(new Error(run.reason ?? 'unknown'), {
          functionId: RENT_COLLECTION_CHASE_SWEEP_FUNCTION_ID,
          extraTags: { workspace_id: ws.id, phase: 'run-skill' },
        });
        result.failures.push({ workspaceId: ws.id, reason: run.reason ?? 'unknown' });
        continue;
      }
      if (run.draftsWritten > 0) {
        result.workspacesWithDrafts += 1;
        result.draftsWritten += run.draftsWritten;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: RENT_COLLECTION_CHASE_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-skill' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }

  return result;
}

async function runRentCollectionChaseForWorkspaceLive(
  workspaceId: string,
  now: Date,
): Promise<{ ok: boolean; draftsWritten: number; reason?: string }> {
  const result = await runRentCollectionChaseForWorkspace({ workspaceId, now });
  if (!result.ok) {
    return {
      ok: false,
      draftsWritten: 0,
      reason: `${result.error.code}: ${result.error.message}`,
    };
  }
  return { ok: true, draftsWritten: result.value.drafts.length };
}

async function defaultListCandidates(): Promise<WorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        vertical: 'PROPERTY_MANAGEMENT',
        memberships: { some: { status: 'ACTIVE' } },
        integrationCredentials: {
          some: { status: 'ACTIVE', provider: 'BUILDIUM' },
        },
      },
      select: {
        id: true,
        vertical: true,
        integrationCredentials: {
          where: { status: 'ACTIVE', provider: 'BUILDIUM' },
          select: { provider: true },
        },
        preference: { select: { disabledDisciplines: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({
      id: ws.id,
      vertical: ws.vertical,
      hasBuildium: ws.integrationCredentials.some((c) => c.provider === 'BUILDIUM'),
      disabledDisciplines: ws.preference?.disabledDisciplines ?? [],
    }));
  });
}

export const propertyManagementRentCollectionChaseSweepFn = inngest.createFunction(
  {
    id: RENT_COLLECTION_CHASE_SWEEP_FUNCTION_ID,
    name: 'agentplain property-management rent-collection chase sweep',
    triggers: [
      { cron: RENT_COLLECTION_CHASE_SWEEP_CRON },
      { event: RENT_COLLECTION_CHASE_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(
      RENT_COLLECTION_CHASE_SWEEP_FUNCTION_ID,
      () =>
        withCronMonitor(
          {
            slug: RENT_COLLECTION_CHASE_SWEEP_FUNCTION_ID,
            schedule: RENT_COLLECTION_CHASE_SWEEP_CRON,
            checkinMargin: 10,
            maxRuntime: 15,
          },
          () =>
            withInngestErrorReporting(
              { functionId: RENT_COLLECTION_CHASE_SWEEP_FUNCTION_ID },
              async () => {
                const logger = getLogger().child({
                  boundary: 'inngest',
                  function_id: RENT_COLLECTION_CHASE_SWEEP_FUNCTION_ID,
                });
                logger.info('property-management rent-collection chase sweep started');
                const out = await runRentCollectionChaseSweep();
                logger.info('property-management rent-collection chase sweep finished', {
                  flag_off: out.skippedFlagOff,
                  considered: out.workspacesConsidered,
                  with_drafts: out.workspacesWithDrafts,
                  skipped_billing: out.workspacesSkippedPausedForBilling,
                  skipped_discipline_disabled: out.workspacesSkippedDisciplineDisabled,
                  skipped_not_connected: out.workspacesSkippedNotConnected,
                  skipped_not_installed: out.workspacesSkippedNotInstalled,
                  skipped_fire_gate: out.workspacesSkippedFireGate,
                  drafts_written: out.draftsWritten,
                  failed: out.failures.length,
                });
                return out;
              },
            ),
        ),
    ),
);
