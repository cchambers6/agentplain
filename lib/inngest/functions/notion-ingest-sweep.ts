/**
 * Inngest cron + on-demand event: Notion-ingest sweep.
 *
 * Wave 7. Two trigger surfaces:
 *   1. Cron every 6 hours — mirrors the customer-files cron, scoped to
 *      workspaces with an ACTIVE NOTION credential.
 *   2. Event `agentplain/notion-ingest.requested` — fired by the Notion
 *      OAuth callback so the customer's pages land in the substrate
 *      immediately on connect (without waiting up to 6 hours).
 *
 * The sweep is a thin wrapper around `ingestWorkspaceFiles` with a
 * `NotionFileSource` per workspace. The shared pipeline handles
 * chunking + embedding + KnowledgeDocument upsert.
 *
 * Per `project_no_outbound_architecture.md`: this cron READS the
 * customer's Notion pages and WRITES into our own KnowledgeDocument
 * table. It never writes back to the customer's Notion.
 *
 * Per `feedback_cold_start_safe_agents.md`: durable read of the
 * workspace list on every fire; no shared in-memory cursor.
 */

import { SYSTEM_OPERATOR_CONTEXT, withSystemContext } from '@/lib/db';
import { ingestWorkspaceFiles } from '@/lib/customer-files';
import { NotionFileSource } from '@/lib/integrations/notion-mcp';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { reportInngestItemFailure, withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const NOTION_INGEST_SWEEP_FUNCTION_ID = 'agentplain-notion-ingest-sweep';
export const NOTION_INGEST_SWEEP_CRON = '0 */6 * * *';
export const NOTION_INGEST_REQUESTED_EVENT = 'agentplain/notion-ingest.requested';

export interface NotionIngestSweepResult {
  workspacesConsidered: number;
  workspacesIngested: number;
  workspacesSkippedUnconfigured: number;
  filesSeen: number;
  filesIngested: number;
  chunksWritten: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCandidate {
  id: string;
}

export interface RunNotionIngestSweepArgs {
  listCandidates?: () => Promise<WorkspaceCandidate[]>;
  /** Override the per-workspace ingest fn. Tests inject a recording impl. */
  runForWorkspace?: (workspaceId: string) => Promise<{
    ok: boolean;
    filesSeen: number;
    filesIngested: number;
    chunksWritten: number;
    notConfigured?: boolean;
    reason?: string;
  }>;
}

export async function runNotionIngestSweep(
  args: RunNotionIngestSweepArgs = {},
): Promise<NotionIngestSweepResult> {
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const candidates = await listCandidates();

  const result: NotionIngestSweepResult = {
    workspacesConsidered: candidates.length,
    workspacesIngested: 0,
    workspacesSkippedUnconfigured: 0,
    filesSeen: 0,
    filesIngested: 0,
    chunksWritten: 0,
    failures: [],
  };

  for (const ws of candidates) {
    try {
      const run = args.runForWorkspace
        ? await args.runForWorkspace(ws.id)
        : await runNotionIngestForWorkspaceLive(ws.id);
      if (!run.ok) {
        result.failures.push({ workspaceId: ws.id, reason: run.reason ?? 'unknown' });
        continue;
      }
      if (run.notConfigured) {
        result.workspacesSkippedUnconfigured += 1;
        continue;
      }
      result.workspacesIngested += 1;
      result.filesSeen += run.filesSeen;
      result.filesIngested += run.filesIngested;
      result.chunksWritten += run.chunksWritten;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: NOTION_INGEST_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'run-ingest' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

async function runNotionIngestForWorkspaceLive(
  workspaceId: string,
): Promise<{
  ok: boolean;
  filesSeen: number;
  filesIngested: number;
  chunksWritten: number;
  notConfigured?: boolean;
  reason?: string;
}> {
  const source = new NotionFileSource({ workspaceId });
  const ingest = await ingestWorkspaceFiles({
    workspaceId,
    source,
    rlsContext: SYSTEM_OPERATOR_CONTEXT,
  });
  return {
    ok: true,
    filesSeen: ingest.filesSeen,
    filesIngested: ingest.filesIngested,
    chunksWritten: ingest.chunksWritten,
    notConfigured: ingest.notConfigured,
  };
}

async function defaultListCandidates(): Promise<WorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        memberships: { some: { status: 'ACTIVE' } },
        closureStatus: 'ACTIVE',
        integrationCredentials: {
          some: { status: 'ACTIVE', provider: 'NOTION' },
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({ id: ws.id }));
  });
}

/** On-demand variant — when the OAuth callback fires the event, the
 *  event body carries the one workspaceId to ingest. */
export async function runNotionIngestForWorkspace(workspaceId: string): Promise<NotionIngestSweepResult> {
  return runNotionIngestSweep({
    listCandidates: async () => [{ id: workspaceId }],
  });
}

export const notionIngestSweepFn = inngest.createFunction(
  {
    id: NOTION_INGEST_SWEEP_FUNCTION_ID,
    name: 'agentplain notion ingest sweep',
    triggers: [
      { cron: NOTION_INGEST_SWEEP_CRON },
      { event: NOTION_INGEST_REQUESTED_EVENT },
    ],
  },
  async ({ event }) =>
    runWithDisableGate(NOTION_INGEST_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: NOTION_INGEST_SWEEP_FUNCTION_ID,
          schedule: NOTION_INGEST_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: NOTION_INGEST_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: NOTION_INGEST_SWEEP_FUNCTION_ID,
              });
              const eventData = event?.data as { workspaceId?: string } | undefined;
              const targetedWorkspace = typeof eventData?.workspaceId === 'string' && eventData.workspaceId.length > 0
                ? eventData.workspaceId
                : null;
              logger.info('notion-ingest sweep started', {
                targeted: targetedWorkspace ?? 'all-active',
              });
              const out = targetedWorkspace
                ? await runNotionIngestForWorkspace(targetedWorkspace)
                : await runNotionIngestSweep();
              logger.info('notion-ingest sweep finished', {
                considered: out.workspacesConsidered,
                ingested: out.workspacesIngested,
                skipped_unconfigured: out.workspacesSkippedUnconfigured,
                files_seen: out.filesSeen,
                files_ingested: out.filesIngested,
                chunks_written: out.chunksWritten,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
