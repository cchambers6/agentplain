/**
 * Inngest cron: Follow Up Boss lead-sync sweep.
 *
 * Hourly. For each real-estate workspace with an ACTIVE FOLLOW_UP_BOSS
 * credential AND sales-enablement discipline NOT disabled AND
 * lead-triage-realestate skill installed, pull recently-modified FUB
 * leads → run lead-triage-realestate → write the triage decision back
 * into FUB as a note + `agentplain-triaged` tag.
 *
 * Per `project_no_outbound_architecture.md`: the create_note + add_tag
 * writes are INTERNAL annotations on the broker's own CRM. NO email,
 * SMS, or customer-facing send. The first-touch draft still lands in
 * /approvals for the broker to send from their own client.
 *
 * Per `feedback_cold_start_safe_agents.md`: durable read of the
 * lastSyncedAt watermark on every fire — no shared in-memory cursor.
 */

import { withSystemContext } from '@/lib/db/rls';
import { asDisciplineId } from '@/lib/disciplines';
import { runSkill as runLeadTriageSkill } from '@/lib/skills/lead-triage-realestate';
import { PrismaLeadTriageApprovalSink } from '@/lib/skills/lead-triage-realestate/prisma-approval-sink';
import { buildLeadDraftPersister } from '@/lib/skills/lead-triage-realestate/drafts-persister';
import { FubLeadFetcher } from '@/lib/integrations/follow-up-boss-mcp';
import { ProdFollowUpBossMcpServer } from '@/lib/integrations/follow-up-boss-mcp';
import { isSkillInstalledForWorkspace } from '@/lib/skills/marketplace';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import { enqueueRetryableAction } from '@/lib/integrations/retry-queue';
import { ACTION_LEAD_TRIAGE_PERSIST_DRAFT } from '@/lib/integrations/retry-handlers';
import type { Vertical } from '@prisma/client';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const FOLLOW_UP_BOSS_SYNC_FUNCTION_ID =
  'agentplain-follow-up-boss-sync-sweep';
export const FOLLOW_UP_BOSS_SYNC_CRON = '0 * * * *'; // hourly
export const FOLLOW_UP_BOSS_SYNC_TRIGGER_EVENT =
  'agentplain/follow-up-boss-sync.requested';

const TRIAGE_DISCIPLINE_ID = 'sales-enablement';
const TRIAGE_SKILL_SLUG = 'lead-triage-realestate';

export interface FubSyncSweepResult {
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
  hasFubCredential: boolean;
}

export interface RunFubSyncSweepArgs {
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace runner. Tests inject. */
  runForWorkspace?: (workspaceId: string) => Promise<{
    ok: boolean;
    leadsTriaged: number;
    notesWritten: number;
    reason?: string;
  }>;
  isInstalled?: (workspaceId: string, vertical: Vertical) => Promise<boolean>;
  now?: Date;
}

export async function runFubSyncSweep(
  args: RunFubSyncSweepArgs = {},
): Promise<FubSyncSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();

  const result: FubSyncSweepResult = {
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
    const pause = await isWorkspacePaused({ workspaceId: ws.id }).catch(
      () => ({ isPaused: false }),
    );
    if (pause.isPaused) {
      result.workspacesSkippedPausedForBilling += 1;
      continue;
    }
    if (!ws.hasFubCredential) {
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
        : await runFubSyncForWorkspaceLive(ws.id);
      if (!run.ok) {
        // The FUB integration (or the inbox we'd push the first-touch draft
        // into) was broken for this workspace — don't silently drop the sync.
        // Enqueue a retryable action so the resume sweep re-runs it the moment
        // the integration goes healthy again. Idempotent per UTC day so a
        // daily-failing workspace doesn't pile up duplicate rows.
        await enqueueRetryableAction({
          workspaceId: ws.id,
          provider: 'FOLLOW_UP_BOSS',
          actionKind: ACTION_LEAD_TRIAGE_PERSIST_DRAFT,
          payload: { source: 'follow-up-boss-sync', reason: run.reason ?? 'unknown' },
          idempotencyKey: `fub-sync-${ws.id}-${(args.now ?? new Date()).toISOString().slice(0, 10)}`,
          now: args.now,
        }).catch(() => {
          /* enqueue is best-effort; the failure is already recorded below */
        });
        result.failures.push({ workspaceId: ws.id, reason: run.reason ?? 'unknown' });
        continue;
      }
      result.workspacesSyncedSuccessfully += 1;
      result.leadsTriaged += run.leadsTriaged;
      result.notesWritten += run.notesWritten;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: FOLLOW_UP_BOSS_SYNC_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-sync' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

async function runFubSyncForWorkspaceLive(
  workspaceId: string,
): Promise<{ ok: boolean; leadsTriaged: number; notesWritten: number; reason?: string }> {
  const mcp = new ProdFollowUpBossMcpServer({ workspaceId });
  const fetcher = new FubLeadFetcher({ workspaceId, mcp });
  // Wire the real drafts persister so hot/warm leads get a first-touch
  // draft staged to /approvals (and, when LIVE_INBOX_FETCH is on + a live
  // adapter is supplied, pushed into the broker's Gmail/M365 Drafts).
  // `buildLeadDraftPersister()` with no live adapter resolves to the
  // FixtureLeadDraftPersister — always non-null, so the approval row
  // carries a persisted draft body the broker can open and send.
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
  // Sink the triage row into /approvals AND write a note back to FUB
  // for each triaged lead so the broker sees agentplain's pick in their
  // own CRM.
  const sink = new PrismaLeadTriageApprovalSink();
  let notesWritten = 0;
  for (const triaged of skill.value.triaged) {
    await sink.record({ workspaceId, triaged });
    // Each LeadRecord.id is "fub-<fubId>" — strip the prefix to call
    // back into FUB.
    if (!triaged.leadId.startsWith('fub-')) continue;
    const fubLeadId = triaged.leadId.slice('fub-'.length);
    const note = await mcp.createNote({
      leadId: fubLeadId,
      body:
        `agentplain triage: category=${triaged.category}, ` +
        `composite=${triaged.scores.composite.toFixed(2)}. ` +
        `Routing: ${triaged.routing.type}. First-touch draft is queued ` +
        `in agentplain /approvals for broker review.`,
      isPrivate: false,
    });
    if (note.ok) notesWritten += 1;
    await mcp.addTag({
      leadId: fubLeadId,
      tags: [`agentplain-${triaged.category}`],
    });
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
        vertical: 'REAL_ESTATE',
      },
      select: {
        id: true,
        vertical: true,
        preference: { select: { disabledDisciplines: true } },
        integrationCredentials: {
          where: {
            status: 'ACTIVE',
            provider: 'FOLLOW_UP_BOSS',
          },
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
      hasFubCredential: ws.integrationCredentials.length > 0,
    }));
  });
}

export const followUpBossSyncSweepFn = inngest.createFunction(
  {
    id: FOLLOW_UP_BOSS_SYNC_FUNCTION_ID,
    name: 'agentplain follow-up-boss hourly sync',
    triggers: [
      { cron: FOLLOW_UP_BOSS_SYNC_CRON },
      { event: FOLLOW_UP_BOSS_SYNC_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(FOLLOW_UP_BOSS_SYNC_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: FOLLOW_UP_BOSS_SYNC_FUNCTION_ID,
          schedule: FOLLOW_UP_BOSS_SYNC_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: FOLLOW_UP_BOSS_SYNC_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: FOLLOW_UP_BOSS_SYNC_FUNCTION_ID,
              });
              logger.info('follow-up-boss sync started');
              const out = await runFubSyncSweep();
              logger.info('follow-up-boss sync finished', {
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
