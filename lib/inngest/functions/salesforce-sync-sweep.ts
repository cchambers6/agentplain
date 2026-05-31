/**
 * Inngest cron: Salesforce lead-sync sweep.
 *
 * Wave 7. Mirrors the HubSpot/FUB sync sweep. Hourly. For each workspace
 * with an ACTIVE SALESFORCE credential AND sales-enablement discipline
 * NOT disabled AND lead-triage skill installed, pull recently-modified
 * Salesforce leads → run lead-triage → write the triage decision back
 * as a Salesforce Task attached to the lead.
 *
 * Universal — runs across every vertical.
 *
 * Per `project_no_outbound_architecture.md`: the createTask write is
 * INTERNAL on the customer's own CRM. NO email/SMS/customer-facing send.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { runSkill as runLeadTriageSkill } from '@/lib/skills/lead-triage-realestate';
import { PrismaLeadTriageApprovalSink } from '@/lib/skills/lead-triage-realestate/prisma-approval-sink';
import { SalesforceLeadFetcher, ProdSalesforceMcpServer } from '@/lib/integrations/salesforce-mcp';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import type { Vertical } from '@prisma/client';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { reportInngestItemFailure, withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const SALESFORCE_SYNC_FUNCTION_ID = 'agentplain-salesforce-sync-sweep';
export const SALESFORCE_SYNC_CRON = '0 * * * *'; // hourly
export const SALESFORCE_SYNC_TRIGGER_EVENT = 'agentplain/salesforce-sync.requested';

const TRIAGE_DISCIPLINE_ID = 'sales-enablement';
const TRIAGE_SKILL_SLUG = 'lead-triage-realestate';

export interface SalesforceSyncSweepResult {
  workspacesConsidered: number;
  workspacesSyncedSuccessfully: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotInstalled: number;
  workspacesSkippedNotConnected: number;
  workspacesSkippedPausedForBilling: number;
  leadsTriaged: number;
  tasksWritten: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  disabledDisciplines: string[];
  hasSalesforceCredential: boolean;
}

export interface RunSalesforceSyncSweepArgs {
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  runForWorkspace?: (workspaceId: string) => Promise<{
    ok: boolean;
    leadsTriaged: number;
    tasksWritten: number;
    reason?: string;
  }>;
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  now?: Date;
}

export async function runSalesforceSyncSweep(
  args: RunSalesforceSyncSweepArgs = {},
): Promise<SalesforceSyncSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();

  const result: SalesforceSyncSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesSyncedSuccessfully: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedNotConnected: 0,
    workspacesSkippedPausedForBilling: 0,
    leadsTriaged: 0,
    tasksWritten: 0,
    failures: [],
  };

  for (const ws of candidates) {
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(() => ({ isPaused: false }));
    if (pause.isPaused) {
      result.workspacesSkippedPausedForBilling += 1;
      continue;
    }
    if (!ws.hasSalesforceCredential) {
      result.workspacesSkippedNotConnected += 1;
      continue;
    }
    const disabled = ws.disabledDisciplines
      .map((d) => asDisciplineId(d))
      .filter((d): d is NonNullable<ReturnType<typeof asDisciplineId>> => d !== null);
    if (disabled.includes(TRIAGE_DISCIPLINE_ID)) {
      result.workspacesSkippedDisciplineDisabled += 1;
      continue;
    }
    const installed = await (args.isInstalled
      ? args.isInstalled(ws.id, ws.vertical)
      : isSkillInstalledForWorkspace({
          workspaceId: ws.id,
          workspaceVertical: ws.vertical,
          skillSlug: TRIAGE_SKILL_SLUG,
        }).catch(() => true));
    if (!installed) {
      result.workspacesSkippedNotInstalled += 1;
      continue;
    }
    try {
      const run = args.runForWorkspace
        ? await args.runForWorkspace(ws.id)
        : await runSalesforceSyncForWorkspaceLive(ws.id);
      if (!run.ok) {
        result.failures.push({ workspaceId: ws.id, reason: run.reason ?? 'unknown' });
        continue;
      }
      result.workspacesSyncedSuccessfully += 1;
      result.leadsTriaged += run.leadsTriaged;
      result.tasksWritten += run.tasksWritten;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: SALESFORCE_SYNC_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-sync' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

async function runSalesforceSyncForWorkspaceLive(
  workspaceId: string,
): Promise<{ ok: boolean; leadsTriaged: number; tasksWritten: number; reason?: string }> {
  const mcp = new ProdSalesforceMcpServer({ workspaceId });
  const fetcher = new SalesforceLeadFetcher({ workspaceId, mcp });
  const skill = await runLeadTriageSkill({
    workspaceId,
    fetcher,
    persister: null,
  });
  if (!skill.ok) {
    return {
      ok: false,
      leadsTriaged: 0,
      tasksWritten: 0,
      reason: `${skill.error.code}: ${skill.error.message}`,
    };
  }
  const sink = new PrismaLeadTriageApprovalSink();
  let tasksWritten = 0;
  for (const triaged of skill.value.triaged) {
    await sink.record({ workspaceId, triaged });
    if (!triaged.leadId.startsWith('salesforce-')) continue;
    const sfId = triaged.leadId.slice('salesforce-'.length);
    const task = await mcp.createTask({
      whoId: sfId,
      subject: `agentplain triage: ${triaged.category}`,
      description:
        `agentplain triage decision: category=${triaged.category}, ` +
        `composite=${triaged.scores.composite.toFixed(2)}. ` +
        `Routing: ${triaged.routing.type}. First-touch draft is queued in agentplain /approvals for review.`,
      priority: triaged.category === 'hot' ? 'High' : 'Normal',
    });
    if (task.ok) tasksWritten += 1;
  }
  return {
    ok: true,
    leadsTriaged: skill.value.triaged.length,
    tasksWritten,
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
        integrationCredentials: {
          where: { status: 'ACTIVE', provider: 'SALESFORCE' },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({
      id: ws.id,
      vertical: ws.vertical,
      disabledDisciplines: ws.preference?.disabledDisciplines ?? [],
      hasSalesforceCredential: ws.integrationCredentials.length > 0,
    }));
  });
}

export const salesforceSyncSweepFn = inngest.createFunction(
  {
    id: SALESFORCE_SYNC_FUNCTION_ID,
    name: 'agentplain salesforce hourly sync',
    triggers: [
      { cron: SALESFORCE_SYNC_CRON },
      { event: SALESFORCE_SYNC_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(SALESFORCE_SYNC_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: SALESFORCE_SYNC_FUNCTION_ID,
          schedule: SALESFORCE_SYNC_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: SALESFORCE_SYNC_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: SALESFORCE_SYNC_FUNCTION_ID,
              });
              logger.info('salesforce sync started');
              const out = await runSalesforceSyncSweep();
              logger.info('salesforce sync finished', {
                considered: out.workspacesConsidered,
                synced: out.workspacesSyncedSuccessfully,
                skipped_discipline_disabled: out.workspacesSkippedDisciplineDisabled,
                skipped_not_installed: out.workspacesSkippedNotInstalled,
                skipped_not_connected: out.workspacesSkippedNotConnected,
                leads_triaged: out.leadsTriaged,
                tasks_written: out.tasksWritten,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
