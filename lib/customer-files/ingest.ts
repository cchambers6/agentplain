/**
 * lib/customer-files/ingest.ts
 *
 * Per-workspace file ingestion pipeline. Reads from an IFileSource,
 * chunks the text bodies, and writes one KnowledgeDocument +
 * Embedding row per chunk under contextKind=CUSTOMER + workspaceId.
 *
 * Per project_knowledge_substrate.md the substrate's tenant-isolation
 * contract is enforced by:
 *   (a) the schema CHECK constraint (CUSTOMER rows REQUIRE workspaceId),
 *   (b) the RLS policy on KnowledgeDocument + Embedding (customer
 *       queries see only workspaceId match plus null-scoped rows),
 *   (c) THIS file refusing to write a CUSTOMER row without a
 *       workspaceId (defense in depth — fails closed at the application
 *       layer too).
 *
 * Per feedback_runner_portability.md the source is injected — the
 * pipeline does not know whether it's reading from a fixture, Drive,
 * OneDrive, or a future provider. Tests inject FixtureFileSource; prod
 * will inject DriveFileSource once the OAuth scopes land.
 */

import { SYSTEM_OPERATOR_CONTEXT, type RlsContext } from '../db/rls';
import { getKnowledgeStore } from '../knowledge';
import type { IKnowledgeStore } from '../knowledge/types';
import { chunkText, type ChunkOptions } from './chunk';
import type { FileSourceResult, IFileSource } from './types';

export interface IngestWorkspaceFilesArgs {
  workspaceId: string;
  source: IFileSource;
  /** Override the knowledge store. Test injects the in-memory store;
   *  production reads through the pgvector store. */
  store?: IKnowledgeStore;
  /** Override chunk options. Defaults match lib/customer-files/chunk.ts. */
  chunk?: ChunkOptions;
  /** RLS context for the knowledge store. Defaults to the system /
   *  operator identity — ingestion runs as a background pass. */
  rlsContext?: RlsContext;
}

export interface IngestFileReport {
  fileId: string;
  title: string;
  /** How many chunks landed as KnowledgeDocuments. */
  chunksWritten: number;
  /** Embedding row ids written. */
  embeddingIds: string[];
  /** Non-fatal error captured per-file. Pipeline continues with the
   *  next file when set. */
  error?: { code: string; message: string };
}

export interface IngestWorkspaceFilesResult {
  workspaceId: string;
  sourceName: string;
  filesSeen: number;
  filesIngested: number;
  chunksWritten: number;
  reports: IngestFileReport[];
  /**
   * True iff the source returned NOT_CONFIGURED at listFiles — the
   * adapter is not wired for this workspace (e.g. Drive OAuth absent).
   * Distinguishes "skip cleanly" from "ok, folder is empty" so callers
   * (the ingestion cron) can count unconfigured workspaces separately
   * from ingested-but-empty ones. Absent on the success path.
   */
  notConfigured?: boolean;
}

export async function ingestWorkspaceFiles(
  args: IngestWorkspaceFilesArgs,
): Promise<IngestWorkspaceFilesResult> {
  if (!args.workspaceId) {
    throw new Error('ingestWorkspaceFiles requires a workspaceId');
  }
  const store =
    args.store ?? getKnowledgeStore(args.rlsContext ?? SYSTEM_OPERATOR_CONTEXT);

  const listed = await args.source.listFiles(args.workspaceId);
  if (!listed.ok) {
    // Treat NOT_CONFIGURED as a clean zero — the source simply isn't
    // wired yet for this workspace. Anything else surfaces as a thrown
    // error so the operator dashboard sees it.
    if (listed.error.code === 'NOT_CONFIGURED') {
      return {
        workspaceId: args.workspaceId,
        sourceName: args.source.name,
        filesSeen: 0,
        filesIngested: 0,
        chunksWritten: 0,
        reports: [],
        notConfigured: true,
      };
    }
    throw new Error(
      `${args.source.name}.listFiles failed: ${listed.error.code} — ${listed.error.message}`,
    );
  }

  const reports: IngestFileReport[] = [];
  let totalChunks = 0;
  let filesIngested = 0;

  for (const ref of listed.value) {
    const fetched: FileSourceResult<{ text: string }> =
      await args.source.fetchFile(args.workspaceId, ref);
    if (!fetched.ok) {
      reports.push({
        fileId: ref.id,
        title: ref.title,
        chunksWritten: 0,
        embeddingIds: [],
        error: {
          code: fetched.error.code,
          message: fetched.error.message,
        },
      });
      continue;
    }
    const chunks = chunkText(fetched.value.text, args.chunk);
    if (chunks.length === 0) {
      reports.push({
        fileId: ref.id,
        title: ref.title,
        chunksWritten: 0,
        embeddingIds: [],
        error: { code: 'EMPTY_BODY', message: 'file body was empty after normalization' },
      });
      continue;
    }
    const embeddingIds: string[] = [];
    let anyChunkFailed = false;
    let lastError: { code: string; message: string } | undefined;
    for (const chunk of chunks) {
      const upsert = await store.upsert({
        contextKind: 'CUSTOMER',
        workspaceId: args.workspaceId,
        title: chunks.length === 1
          ? ref.title
          : `${ref.title} (part ${chunk.index + 1}/${chunk.total})`,
        body: chunk.text,
        sourceUrl: ref.sourceUrl,
        verticalSlug: null,
        // sourceType + sourceId are the dedupe key: re-ingesting the
        // same file id replaces prior chunks in place rather than
        // accumulating duplicates.
        sourceType: 'customer_file_chunk',
        sourceId: `${args.source.name}:${ref.id}:${chunk.index}`,
        metadata: {
          source: args.source.name,
          fileId: ref.id,
          chunkIndex: chunk.index,
          chunkTotal: chunk.total,
          mimeType: ref.mimeType,
          sizeBytes: ref.sizeBytes,
          modifiedAt: ref.modifiedAt ? ref.modifiedAt.toISOString() : null,
          ...ref.metadata,
        },
      });
      if (!upsert.ok) {
        anyChunkFailed = true;
        lastError = { code: upsert.error.code, message: upsert.error.message };
        break;
      }
      embeddingIds.push(upsert.value.id);
    }
    if (anyChunkFailed) {
      reports.push({
        fileId: ref.id,
        title: ref.title,
        chunksWritten: embeddingIds.length,
        embeddingIds,
        error: lastError,
      });
      continue;
    }
    filesIngested += 1;
    totalChunks += embeddingIds.length;
    reports.push({
      fileId: ref.id,
      title: ref.title,
      chunksWritten: embeddingIds.length,
      embeddingIds,
    });
  }

  return {
    workspaceId: args.workspaceId,
    sourceName: args.source.name,
    filesSeen: listed.value.length,
    filesIngested,
    chunksWritten: totalChunks,
    reports,
  };
}
