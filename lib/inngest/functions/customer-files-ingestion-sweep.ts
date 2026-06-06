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
  reapTombstonedDriveCustomerData,
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

/**
 * Threshold used to classify a sweep's listing as complete vs. capped.
 * Mirrors `DriveFileSource`'s `DEFAULT_MAX_FILES_PER_WORKSPACE = 200`
 * (`lib/customer-files/drive-source.ts:69`). When `filesSeen` reaches
 * this value we can't tell whether the source had more files past the
 * cap, so the tombstone reaper SKIPS the workspace for this sweep —
 * a still-present file would otherwise be mis-classified as tombstoned
 * and deleted. The next sweep retries.
 *
 * Per-fixture test sources (which have < 10 files) always finish below
 * the cap, so reaper coverage in tests is unconditional.
 */
export const FILE_LISTING_COMPLETENESS_CAP = 200;

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
  /**
   * Total CUSTOMER Embedding rows the tombstone reaper deleted across
   * all workspaces this sweep. Reaper SKIPS workspaces with capped
   * listings (filesSeen >= `FILE_LISTING_COMPLETENESS_CAP`) and those
   * that returned NOT_CONFIGURED. The reaper is best-effort: a per-
   * workspace failure here surfaces as a sweep-level `failures` entry
   * but does not stall other workspaces.
   */
  embeddingsReaped: number;
  /** Workspaces the reaper ran against (i.e. listing was complete). */
  workspacesReaped: number;
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
   * Scope the sweep to a SINGLE workspace. Set by the immediate-ingestion
   * trigger the Drive OAuth callback fires (`{ workspaceId }` in the
   * event payload) so a fresh connect ingests within seconds instead of
   * waiting up to 6h for the next cron. Still goes through the same
   * active-membership filter — an id with no active membership lists
   * zero workspaces and the sweep is a clean no-op. Ignored when
   * `listWorkspaces` is overridden (tests already supply their own list).
   */
  scopeWorkspaceId?: string;
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
  const listWorkspaces =
    args.listWorkspaces ?? (() => listActiveWorkspaces(args.scopeWorkspaceId));
  const buildSource = args.buildSource ?? defaultBuildSource;

  const workspaces = await listWorkspaces();
  const result: CustomerFilesIngestionSweepResult = {
    workspacesConsidered: workspaces.length,
    workspacesIngested: 0,
    workspacesSkippedUnconfigured: 0,
    filesIngested: 0,
    chunksWritten: 0,
    embeddingsReaped: 0,
    workspacesReaped: 0,
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

    // Tombstone reap: a Drive file the customer deleted (or trashed —
    // DEFAULT_DRIVE_QUERY filters trashed=false) vanishes from listFiles().
    // Drop our ingested copy so the customer's delete propagates. SKIP
    // for NOT_CONFIGURED workspaces (no listing to compare against) and
    // for sweeps that hit the bounded listing cap (we don't have the
    // full live set, so still-present files would mis-classify as
    // tombstoned). Best-effort: reap errors surface as failures but do
    // not stall subsequent workspaces.
    if (!outcome.notConfigured) {
      const listingWasComplete = outcome.filesSeen < FILE_LISTING_COMPLETENESS_CAP;
      try {
        const reap = await reapTombstonedDriveCustomerData({
          workspaceId: workspace.id,
          sourceName: outcome.sourceName,
          liveFileIds: outcome.liveFileIds,
          listingWasComplete,
          store: args.store,
        });
        if (reap.ran) {
          result.workspacesReaped += 1;
          result.embeddingsReaped += reap.embeddingsDeleted;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        reportInngestItemFailure(err, {
          functionId: CUSTOMER_FILES_INGESTION_SWEEP_FUNCTION_ID,
          extraTags: {
            workspace_id: workspace.id,
            phase: 'reap',
          },
        });
        result.failures.push({
          workspaceId: workspace.id,
          reason: `tombstone reaper: ${reason}`,
        });
      }
    }
  }

  return result;
}

async function listActiveWorkspaces(
  scopeWorkspaceId?: string,
): Promise<Pick<Workspace, 'id' | 'slug'>[]> {
  // Only sweep workspaces with at least one ACTIVE membership. Dormant /
  // never-onboarded rows would burn LLM + DB budget for nothing.
  //
  // Workspace + Membership are both RLS-policied + FORCE'd via force_rls,
  // so this cron must open the system context to satisfy the
  // is_operator='true' branch of both policies. Otherwise findMany returns
  // zero rows under FORCE and the sweep silently NO-OPs forever.
  //
  // `scopeWorkspaceId` narrows to a single workspace (the immediate-
  // ingestion trigger from the Drive OAuth callback). The active-
  // membership filter still applies, so a stale/forbidden id is a clean
  // zero rather than an error.
  return withSystemContext((tx) =>
    tx.workspace.findMany({
      where: workspaceSweepFilter(scopeWorkspaceId),
      select: { id: true, slug: true },
      orderBy: { createdAt: 'asc' },
    }),
  );
}

/**
 * Prisma `where` for the sweep's workspace lister. Always requires at
 * least one ACTIVE membership; narrows to a single `id` when the
 * immediate-ingestion trigger scoped the sweep to one workspace.
 * Exported so the scoping decision can be unit-tested without a DB.
 */
export function workspaceSweepFilter(
  scopeWorkspaceId?: string,
): { memberships: { some: { status: 'ACTIVE' } }; id?: string } {
  const base = { memberships: { some: { status: 'ACTIVE' as const } } };
  return scopeWorkspaceId ? { ...base, id: scopeWorkspaceId } : base;
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
  async ({ event }) =>
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
              // The cron fire carries no data; the immediate-ingestion
              // trigger from the Drive OAuth callback carries
              // `{ workspaceId }` so a fresh connect ingests now instead
              // of waiting for the next 6h tick. `event.data` is a union
              // (cron payload has no fields) so read it defensively.
              const data = (event?.data ?? {}) as Record<string, unknown>;
              const scopeWorkspaceId =
                typeof data.workspaceId === 'string' ? data.workspaceId : undefined;
              const triggeredBy =
                typeof data.triggeredBy === 'string' ? data.triggeredBy : 'cron';
              logger.info('files ingestion sweep started', {
                scope: scopeWorkspaceId ?? 'all',
                triggered_by: triggeredBy,
              });
              const out = await runCustomerFilesIngestionSweep({
                scopeWorkspaceId,
              });
              logger.info('files ingestion sweep finished', {
                workspaces: out.workspacesConsidered,
                ingested: out.workspacesIngested,
                skipped_unconfigured: out.workspacesSkippedUnconfigured,
                files: out.filesIngested,
                chunks: out.chunksWritten,
                workspaces_reaped: out.workspacesReaped,
                embeddings_reaped: out.embeddingsReaped,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
