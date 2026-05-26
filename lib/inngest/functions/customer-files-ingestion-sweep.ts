/**
 * Inngest cron: customer-files ingestion sweep.
 *
 * Every 6 hours: for each Workspace with at least one ACTIVE membership,
 * call `ingestWorkspaceFiles(workspaceId, source)`. The default source is
 * `DriveFileSource`, which goes through the per-workspace Drive MCP
 * (`lib/integrations/google-drive-mcp`). Workspaces with no GOOGLE
 * `IntegrationCredential` row surface as `NOT_CONFIGURED` and the sweep
 * counts them as `workspacesSkippedUnconfigured` (a clean zero, not a
 * failure). The first sweep after a workspace connects Drive via OAuth
 * ingests their files — no code change required.
 *
 * Why this exists: `lib/customer-files/ingest.ts` and the per-fire
 * retrieval path in `lib/inngest/functions/process-webhook-event.ts` are
 * complete and tenant-isolated, but NOTHING in production was calling
 * ingestion (grep finds only tests). So the "works from your files"
 * surface returns zero hits in prod, even though every layer below it is
 * built. This cron is the missing production trigger.
 *
 * Per `feedback_cold_start_safe_agents.md`: the sweep reads durable state
 * (Workspace + Membership rows) on every fire. No in-memory cache of
 * "who needs re-ingesting" across runs.
 *
 * Per `feedback_runner_portability.md` + `feedback_no_silent_vendor_lock.md`:
 * the source is injected via a factory (`buildSource`). Default factory
 * returns the prod `DriveFileSource` (MCP-backed); tests inject a
 * `FixtureFileSource` per workspace. Switching providers (Dropbox,
 * OneDrive, …) is a new IFileSource adapter behind the same factory.
 *
 * Per `project_no_outbound_architecture.md`: this cron READS the
 * customer's file source and WRITES rows into our own KnowledgeDocument
 * table. It never writes back to the customer's Drive. The customer-
 * receive carve-out applies the other direction.
 *
 * Re-sync cadence: 6 hours. Drive files don't change minute-to-minute,
 * embeddings are cost work, and re-ingesting dedupes in place via the
 * `sourceType:sourceId` upsert key in `ingestWorkspaceFiles`. A more
 * responsive cadence (Drive Activity API push, or per-file
 * `modifiedAt` diff) is a follow-up — this PR ships the trigger.
 */

import type { Workspace } from '@prisma/client';
import { SYSTEM_OPERATOR_CONTEXT, withSystemContext } from '@/lib/db';
import {
  DriveFileSource,
  ingestWorkspaceFiles,
  type IFileSource,
  type IngestWorkspaceFilesResult,
} from '@/lib/customer-files';
import type { IKnowledgeStore } from '@/lib/knowledge/types';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID =
  'agentplain-customer-files-ingestion-sweep';
/**
 * Every 6 hours on the hour (UTC). Spec rationale:
 *   - Drive files change on human timescales, not minute scales — 6h
 *     is responsive enough for a "works from your files" loop.
 *   - Embeddings cost real money per chunk; a tighter cadence at scale
 *     would burn budget on no-op re-embeds.
 *   - The dedupe key in `ingestWorkspaceFiles` (sourceType:sourceId)
 *     means re-fires don't pile up duplicates.
 */
export const CUSTOMER_FILES_INGESTION_SWEEP_CRON = '0 */6 * * *';
/** On-demand trigger for dev-console smoke-testing. */
export const CUSTOMER_FILES_INGESTION_SWEEP_TRIGGER_EVENT =
  'agentplain/customer-files-ingestion-sweep.requested';

export interface CustomerFilesIngestionSweepResult {
  /** Workspaces the sweep considered (filtered to active memberships). */
  workspacesConsidered: number;
  /**
   * Workspaces whose source returned ok=true (the source was configured —
   * any positive number of files counts as ingested, even zero, because
   * the source actively listed an empty folder).
   */
  workspacesIngested: number;
  /**
   * Workspaces whose source returned NOT_CONFIGURED. Expected pre-OAuth —
   * surfaces in the result so operator dashboards can see how many seats
   * are still un-connected. Not an error.
   */
  workspacesSkippedUnconfigured: number;
  /** Total file refs that survived listFiles + fetchFile across all workspaces. */
  filesIngested: number;
  /** Total chunks written across all workspaces. */
  chunksWritten: number;
  /** Per-workspace failures — one row dies, the sweep keeps going. */
  failures: Array<{ workspaceId: string; reason: string }>;
}

export interface RunCustomerFilesIngestionSweepArgs {
  /**
   * Override the workspace lister. Tests pass a fixture list. Production
   * reads workspaces that have at least one ACTIVE membership.
   */
  listWorkspaces?: () => Promise<Pick<Workspace, 'id' | 'slug'>[]>;
  /**
   * Per-workspace IFileSource factory. Default returns an unwired
   * `DriveFileSource`. The factory shape leaves room to inspect
   * IntegrationCredential rows per workspace and route to OneDrive /
   * Dropbox / fixture as those adapters land.
   */
  buildSource?: (workspaceId: string) => IFileSource;
  /**
   * Knowledge store override. Production uses the pgvector store under
   * `SYSTEM_OPERATOR_CONTEXT`; tests inject `TestKnowledgeStore`.
   */
  store?: IKnowledgeStore;
}

export async function runCustomerFilesIngestionSweep(
  args: RunCustomerFilesIngestionSweepArgs = {},
): Promise<CustomerFilesIngestionSweepResult> {
  const listWorkspaces = args.listWorkspaces ?? listActiveWorkspaces;
  const buildSource = args.buildSource ?? defaultBuildSource;

  const workspaces = await listWorkspaces();
  const result: CustomerFilesIngestionSweepResult = {
    workspacesConsidered: workspaces.length,
    workspacesIngested: 0,
    workspacesSkippedUnconfigured: 0,
    filesIngested: 0,
    chunksWritten: 0,
    failures: [],
  };

  for (const workspace of workspaces) {
    let outcome: IngestWorkspaceFilesResult;
    try {
      const source = buildSource(workspace.id);
      outcome = await ingestWorkspaceFiles({
        workspaceId: workspace.id,
        source,
        store: args.store,
        rlsContext: SYSTEM_OPERATOR_CONTEXT,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID,
        extraTags: {
          workspace_id: workspace.id,
          phase: 'ingest',
        },
      });
      result.failures.push({ workspaceId: workspace.id, reason });
      continue;
    }

    // `ingestWorkspaceFiles` flags NOT_CONFIGURED results explicitly via
    // `notConfigured: true` so we can separate "no Drive OAuth yet"
    // (safe-to-ship-before-OAuth path) from "OAuth connected, folder is
    // empty" — both share filesSeen=0 but mean different things.
    if (outcome.notConfigured) {
      result.workspacesSkippedUnconfigured += 1;
    } else {
      result.workspacesIngested += 1;
    }
    result.filesIngested += outcome.filesIngested;
    result.chunksWritten += outcome.chunksWritten;

    // Per-file errors surface as per-workspace failures in the result —
    // one workspace's bad file shouldn't stall the sweep, but operators
    // need a Sentry breadcrumb when a fetch consistently fails.
    for (const report of outcome.reports) {
      if (report.error) {
        result.failures.push({
          workspaceId: workspace.id,
          reason: `${report.title} (${report.fileId}): ${report.error.code} — ${report.error.message}`,
        });
      }
    }
  }

  return result;
}

async function listActiveWorkspaces(): Promise<Pick<Workspace, 'id' | 'slug'>[]> {
  // Only sweep workspaces with at least one ACTIVE membership. Dormant /
  // never-onboarded rows would burn LLM + DB budget for nothing.
  //
  // Workspace + Membership are both RLS-policied + FORCE'd via force_rls,
  // so this cron must open the system context to satisfy the
  // is_operator='true' branch of both policies. Otherwise findMany returns
  // zero rows under FORCE and the sweep silently NO-OPs forever.
  return withSystemContext((tx) =>
    tx.workspace.findMany({
      where: {
        memberships: { some: { status: 'ACTIVE' } },
      },
      select: { id: true, slug: true },
      orderBy: { createdAt: 'asc' },
    }),
  );
}

function defaultBuildSource(_workspaceId: string): IFileSource {
  // Prod default is the Drive adapter (MCP-backed). It lists + fetches via
  // `lib/integrations/google-drive-mcp` and gracefully returns
  // `NOT_CONFIGURED` when the workspace has no active GOOGLE
  // IntegrationCredential row. The sweep flips from no-op to live-ingesting
  // the moment a workspace connects Drive — no code change here.
  return new DriveFileSource();
}

export const customerFilesIngestionSweepFn = inngest.createFunction(
  {
    id: CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID,
    name: 'agentplain customer-files ingestion sweep',
    triggers: [
      { cron: CUSTOMER_FILES_INGESTION_SWEEP_CRON },
      { event: CUSTOMER_FILES_INGESTION_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID,
          schedule: CUSTOMER_FILES_INGESTION_SWEEP_CRON,
          // 6-hour cadence — give the monitor a 30min margin so a slightly
          // delayed Vercel cron fire doesn't false-alarm.
          checkinMargin: 30,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID,
              });
              logger.info('files ingestion sweep started');
              const out = await runCustomerFilesIngestionSweep();
              logger.info('files ingestion sweep finished', {
                workspaces: out.workspacesConsidered,
                ingested: out.workspacesIngested,
                skipped_unconfigured: out.workspacesSkippedUnconfigured,
                files: out.filesIngested,
                chunks: out.chunksWritten,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
