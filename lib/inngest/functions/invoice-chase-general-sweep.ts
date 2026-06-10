/**
 * Inngest cron: invoice-chase-general daily sweep.
 *
 * Fires once per day (6 AM UTC). For each workspace that has:
 *   - At least one ACTIVE membership
 *   - An ACTIVE QUICKBOOKS IntegrationCredential
 *   - The 'finance' discipline NOT disabled in WorkspacePreference
 *
 * Per sweep step for each qualifying workspace:
 *   1. Billing-pause gate — skip PAUSED / PAST_DUE workspaces.
 *   2. Marketplace install gate — skip if the skill was explicitly uninstalled.
 *   3. Fire gate (vacation / schedule window) — skip if paused or off-window.
 *   4. `runInvoiceChaseForWorkspace` — reads QB AR aging, drafts tier-
 *      escalating chase messages, stages each as a FOLLOW_UP_NUDGE
 *      approval item with `balanceUsd` in the payload for ROI tracking.
 *
 * FOLLOW_UP_NUDGE is on the bounded-execute allowlist, so when Conner
 * flips `BOUNDED_AUTO_EXECUTE_MASTER=on` AND enables the class, these
 * approvals execute without owner intervention — producing the "wake up
 * to chased invoices" owner outcome.
 *
 * Per `project_no_outbound_architecture.md`: writes `WorkApprovalQueueItem`
 * rows ONLY. Never sends mail.
 *
 * Per `feedback_cold_start_safe_agents.md`: reads all durable state on
 * every fire; no in-memory workspace cache between fires.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { runInvoiceChaseForWorkspace } from '@/lib/skills/invoice-chase-general/run-for-workspace';
import type { ArAgingFetcher, InvoiceChaseApprovalSink } from '@/lib/skills/invoice-chase-general/types';
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

export const INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID =
  'agentplain-invoice-chase-general-sweep';
/** Once daily at 6 AM UTC — owners start the day with their AR chased. */
export const INVOICE_CHASE_GENERAL_SWEEP_CRON = '0 6 * * *';
/** On-demand trigger for dev-console smoke-testing. */
export const INVOICE_CHASE_GENERAL_SWEEP_TRIGGER_EVENT =
  'agentplain/invoice-chase-general-sweep.requested';

/** Discipline the invoice-chase-general skill is tagged under. */
const INVOICE_CHASE_DISCIPLINE_ID =
  SKILL_DISCIPLINE['invoice-chase-general'] ?? 'finance';

export interface InvoiceChaseGeneralSweepResult {
  workspacesConsidered: number;
  workspacesWithDrafts: number;
  workspacesSkippedUnconfigured: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotInstalled: number;
  workspacesSkippedFireGate: number;
  draftsStaged: number;
  /** Sum of AR balances across all staged drafts (USD). */
  totalBalanceUsd: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  disabledDisciplines: string[];
}

export interface RunInvoiceChaseGeneralSweepArgs {
  /** Override the workspace lister. Tests pass a deterministic list. */
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace fetcher factory. Tests inject stubs. */
  buildFetcher?: (workspaceId: string) => ArAgingFetcher;
  /** Override the per-workspace sink factory. Tests inject a recording sink
   *  so no Prisma connection is required. */
  buildSink?: (workspaceId: string) => InvoiceChaseApprovalSink;
  /** Clock injection for deterministic tests. */
  now?: Date;
  /** Override the marketplace install check. */
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  /** Override the fire-gate check. */
  gateFire?: (workspaceId: string) => Promise<FireGateOutcome>;
}

export async function runInvoiceChaseGeneralSweep(
  args: RunInvoiceChaseGeneralSweepArgs = {},
): Promise<InvoiceChaseGeneralSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const now = args.now ?? new Date();
  const candidates = await listCandidates();

  const result: InvoiceChaseGeneralSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesWithDrafts: 0,
    workspacesSkippedUnconfigured: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedFireGate: 0,
    draftsStaged: 0,
    totalBalanceUsd: 0,
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
    if (disabledIds.includes(INVOICE_CHASE_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }

    // Gate 2: marketplace install check.
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: 'invoice-chase-general',
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
            skillSlug: 'invoice-chase-general',
            disciplineId: INVOICE_CHASE_DISCIPLINE_ID,
            now,
          }),
        ).catch((): FireGateOutcome => ({ allowed: true })));
    if (!gateResult.allowed) {
      result.workspacesSkippedFireGate += 1;
      continue;
    }

    // Run the skill.
    try {
      const run = await runInvoiceChaseForWorkspace({
        workspaceId: ws.id,
        now,
        ...(args.buildFetcher ? { fetcher: args.buildFetcher(ws.id) } : {}),
        ...(args.buildSink ? { sink: args.buildSink(ws.id) } : {}),
      });

      if (!run.ok) {
        if (run.error.code === 'NOT_CONFIGURED') {
          result.workspacesSkippedUnconfigured += 1;
          continue;
        }
        reportInngestItemFailure(new Error(run.error.message), {
          functionId: INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID,
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

      const { draftsStaged, totalBalanceUsd } = run.value;
      if (draftsStaged > 0) {
        result.workspacesWithDrafts += 1;
        result.draftsStaged += draftsStaged;
        result.totalBalanceUsd += totalBalanceUsd;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-skill' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }

  return result;
}

/**
 * Default candidate lister — workspaces with at least one ACTIVE
 * membership AND an ACTIVE QUICKBOOKS credential.
 */
async function defaultListCandidates(): Promise<WorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
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

export const invoiceChaseGeneralSweepFn = inngest.createFunction(
  {
    id: INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID,
    name: 'agentplain invoice-chase-general daily sweep',
    triggers: [
      { cron: INVOICE_CHASE_GENERAL_SWEEP_CRON },
      { event: INVOICE_CHASE_GENERAL_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID,
          schedule: INVOICE_CHASE_GENERAL_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 20,
        },
        () =>
          withInngestErrorReporting(
            { functionId: INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: INVOICE_CHASE_GENERAL_SWEEP_FUNCTION_ID,
              });
              logger.info('invoice-chase-general sweep started');
              const out = await runInvoiceChaseGeneralSweep();
              logger.info('invoice-chase-general sweep finished', {
                considered: out.workspacesConsidered,
                with_drafts: out.workspacesWithDrafts,
                drafts_staged: out.draftsStaged,
                total_balance_usd: out.totalBalanceUsd,
                skipped_unconfigured: out.workspacesSkippedUnconfigured,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
