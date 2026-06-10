/**
 * Inngest cron: HubSpot lead-sync sweep.
 *
 * Wave 7. Mirrors the FUB sync sweep. Hourly. For each workspace with
 * an ACTIVE HUBSPOT credential AND sales-enablement discipline NOT
 * disabled AND lead-triage skill installed, pull recently-modified
 * HubSpot contacts → run lead-triage → write the triage decision back
 * into HubSpot as a note attached to the contact.
 *
 * Universal — runs across every vertical (HubSpot has no
 * vertical-restriction; agentplain Wave 6 sales-enablement audit gave
 * us realty-DELIVERING but all-others-PARTIAL — this sweep moves all-
 * others to DELIVERING).
 *
 * Per `project_no_outbound_architecture.md`: the create_note write is
 * INTERNAL on the customer's own CRM. NO email/SMS/customer-facing send.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { runSkill as runLeadTriageSkill } from '@/lib/skills/lead-triage-realestate';
import { PrismaLeadTriageApprovalSink } from '@/lib/skills/lead-triage-realestate/prisma-approval-sink';
import { buildLeadDraftPersister } from '@/lib/skills/lead-triage-realestate/drafts-persister';
import { HubspotLeadFetcher, ProdHubspotMcpServer } from '@/lib/integrations/hubspot-mcp';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import type { Vertical } from '@prisma/client';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { reportInngestItemFailure, withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const HUBSPOT_SYNC_FUNCTION_ID = 'agentplain-hubspot-sync-sweep';
export const HUBSPOT_SYNC_CRON = '0 * * * *'; // hourly
export const HUBSPOT_SYNC_TRIGGER_EVENT = 'agentplain/hubspot-sync.requested';

const TRIAGE_DISCIPLINE_ID = 'sales-enablement';
const TRIAGE_SKILL_SLUG = 'lead-triage-realestate';

export interface HubspotSyncSweepResult {
  workspacesConsidered: number;
  workspacesSyncedSuccessfully: number;
  workspacesSkippedDisciplineDisabled: number;
  workspacesSkippedNotInstalled: number;
  workspacesSkippedNotConnected: number;
  workspacesSkippedPausedForBilling: number;
  leadsTriaged: number;
  notesWritten: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
  vertical: Vertical;
  disabledDisciplines: string[];
  hasHubspotCredential: boolean;
}

export interface RunHubspotSyncSweepArgs {
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  runForWorkspace?: (workspaceId: string) => Promise<{
    ok: boolean;
    leadsTriaged: number;
    notesWritten: number;
    reason?: string;
  }>;
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  now?: Date;
}

export async function runHubspotSyncSweep(
  args: RunHubspotSyncSweepArgs = {},
): Promise<HubspotSyncSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();

  const result: HubspotSyncSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesSyncedSuccessfully: 0,
    workspacesSkippedDisciplineDisabled: 0,
    workspacesSkippedNotInstalled: 0,
    workspacesSkippedNotConnected: 0,
    workspacesSkippedPausedForBilling: 0,
    leadsTriaged: 0,
    notesWritten: 0,
    failures: [],
  };

  for (const ws of candidates) {
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(() => ({ isPaused: false }));
    if (pause.isPaused) {
      result.workspacesSkippedPausedForBilling += 1;
      continue;
    }
    if (!ws.hasHubspotCredential) {
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
        : await runHubspotSyncForWorkspaceLive(ws.id);
      if (!run.ok) {
        result.failures.push({ workspaceId: ws.id, reason: run.reason ?? 'unknown' });
        continue;
      }
      result.workspacesSyncedSuccessfully += 1;
      result.leadsTriaged += run.leadsTriaged;
      result.notesWritten += run.notesWritten;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: HUBSPOT_SYNC_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-sync' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

async function runHubspotSyncForWorkspaceLive(
  workspaceId: string,
): Promise<{ ok: boolean; leadsTriaged: number; notesWritten: number; reason?: string }> {
  const mcp = new ProdHubspotMcpServer({ workspaceId });
  const fetcher = new HubspotLeadFetcher({ workspaceId, mcp });
  // Wire the real drafts persister so hot/warm leads get a first-touch
  // draft staged to /approvals. See FUB sweep for full rationale.
  const persister = buildLeadDraftPersister();
  const skill = await runLeadTriageSkill({
    workspaceId,
    fetcher,
    persister,
  });
  if (!skill.ok) {
    return {
      ok: false,
      leadsTriaged: 0,
      notesWritten: 0,
      reason: `${skill.error.code}: ${skill.error.message}`,
    };
  }
  const sink = new PrismaLeadTriageApprovalSink();
  let notesWritten = 0;
  for (const triaged of skill.value.triaged) {
    await sink.record({ workspaceId, triaged });
    if (!triaged.leadId.startsWith('hubspot-')) continue;
    const contactId = triaged.leadId.slice('hubspot-'.length);
    const note = await mcp.createNote({
      objectType: 'contacts',
      objectId: contactId,
      body:
        `agentplain triage: category=${triaged.category}, ` +
        `composite=${triaged.scores.composite.toFixed(2)}. ` +
        `Routing: ${triaged.routing.type}. First-touch draft is queued in agentplain /approvals for review.`,
    });
    if (note.ok) notesWritten += 1;
  }
  return {
    ok: true,
    leadsTriaged: skill.value.triaged.length,
    notesWritten,
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
          where: { status: 'ACTIVE', provider: 'HUBSPOT' },
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
      hasHubspotCredential: ws.integrationCredentials.length > 0,
    }));
  });
}

export const hubspotSyncSweepFn = inngest.createFunction(
  {
    id: HUBSPOT_SYNC_FUNCTION_ID,
    name: 'agentplain hubspot hourly sync',
    triggers: [
      { cron: HUBSPOT_SYNC_CRON },
      { event: HUBSPOT_SYNC_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(HUBSPOT_SYNC_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: HUBSPOT_SYNC_FUNCTION_ID,
          schedule: HUBSPOT_SYNC_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: HUBSPOT_SYNC_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: HUBSPOT_SYNC_FUNCTION_ID,
              });
              logger.info('hubspot sync started');
              const out = await runHubspotSyncSweep();
              logger.info('hubspot sync finished', {
                considered: out.workspacesConsidered,
                synced: out.workspacesSyncedSuccessfully,
                skipped_discipline_disabled: out.workspacesSkippedDisciplineDisabled,
                skipped_not_installed: out.workspacesSkippedNotInstalled,
                skipped_not_connected: out.workspacesSkippedNotConnected,
                leads_triaged: out.leadsTriaged,
                notes_written: out.notesWritten,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
