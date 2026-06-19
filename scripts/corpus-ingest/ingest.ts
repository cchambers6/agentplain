/**
 * scripts/corpus-ingest/ingest.ts
 *
 * The ingestion runner. Pulls each `CorpusSource`, normalizes + chunks +
 * hashes every item, and upserts the chunks through the existing
 * `IKnowledgeStore` abstraction (so it works identically against pgvector
 * in prod and the in-memory test store in CI — no DB required to exercise
 * the full pipeline).
 *
 * Idempotent: the `(sourceType, sourceId)` natural key is
 * `(corpus:<sourceId>, <itemKey>#<chunkIndex>)`. Re-running updates rows in
 * place. When a chunk's content hash matches what's stored, the store skips
 * the embedder entirely and only bumps `lastSeenAt` — so a no-op re-ingest
 * (and the weekly refresh sweep) costs zero embedding calls.
 *
 * Context kind is COMPLIANCE — the schema's designated kind for the
 * "state-by-state + per-vertical rule corpus" (prisma/schema.prisma, the
 * ContextKind doc block). `searchKnowledge` already queries COMPLIANCE, so
 * ingested rows are retrievable the moment they land.
 *
 * Per `feedback_no_silent_vendor_lock.md` + `feedback_runner_portability.md`:
 * the runner speaks only `IKnowledgeStore`. Swapping embedder/store is a
 * factory change, never a runner change.
 */

import type { IKnowledgeStore } from '@/lib/knowledge/types';
import { getKnowledgeStore } from '@/lib/knowledge';
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db/rls';
import { chunkBody, type ChunkOptions } from './chunk';
import { contentHash, normalizeText } from './normalize';
import { ALL_SOURCES } from './sources';
import type { CorpusChunk, CorpusSource, RawCorpusItem } from './types';

export interface PerSourceStats {
  sourceId: string;
  label: string;
  verticalSlug: string;
  items: number;
  chunks: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Rows of this source marked stale (no longer produced upstream). */
  superseded: number;
  failed: number;
}

export interface IngestStats {
  sources: number;
  itemsFetched: number;
  chunksProcessed: number;
  created: number;
  /** Changed content → re-embedded. */
  updated: number;
  /** Hash matched stored → embed skipped, lastSeen bumped. */
  unchanged: number;
  /** Rows marked stale because their source no longer produces them. */
  superseded: number;
  failed: number;
  /** Chunk count per vertical slug. */
  byVertical: Record<string, number>;
  /** Chunk count per jurisdiction code. */
  byJurisdiction: Record<string, number>;
  bySource: PerSourceStats[];
  errors: string[];
  dryRun: boolean;
}

export interface IngestOptions {
  /** Sources to ingest. Default: the full registry (`ALL_SOURCES`). */
  sources?: CorpusSource[];
  /** Store to write through. Default: pgvector/test per env, system
   *  operator RLS context (corpus rows are shared, workspaceId NULL). */
  store?: IKnowledgeStore;
  /** When true, fetch + chunk + hash but DO NOT upsert. Use to preview
   *  per-vertical chunk counts and embedding cost before paying for it. */
  dryRun?: boolean;
  /** When true (the default for non-dry runs), after each source is
   *  successfully re-ingested, mark its previously-stored rows that the
   *  source no longer produces as superseded. The refresh cron relies on
   *  this; a plain first ingest is a harmless no-op (everything is live). */
  markSupersede?: boolean;
  chunkOptions?: ChunkOptions;
  /** Stamp for lastSeenAt. Default new Date() at call time. */
  now?: Date;
  /** Optional progress sink. Defaults to no-op. */
  onProgress?: (line: string) => void;
}

/** Build the embeddable chunks for one raw item (normalize → window →
 *  hash). Exposed for the refresh cron + unit tests. */
export function buildChunks(
  source: CorpusSource,
  item: RawCorpusItem,
  chunkOptions?: ChunkOptions,
): CorpusChunk[] {
  const sourceType = `corpus:${source.id}`;
  const normalized = normalizeText(item.body);
  const windows = chunkBody(normalized, chunkOptions);
  return windows.map((body, chunkIndex) => ({
    sourceType,
    sourceId: `${item.sourceKey}#${chunkIndex}`,
    itemKey: item.sourceKey,
    chunkIndex,
    chunkCount: windows.length,
    title: item.title,
    body,
    contentHash: contentHash(body),
    citation: item.citation,
    sourceUrl: item.sourceUrl,
    jurisdiction: item.jurisdiction,
    verticalSlug: item.verticalSlug,
    metadata: {
      source: sourceType,
      sourceLabel: source.label,
      authority: source.authority,
      citation: item.citation,
      jurisdiction: item.jurisdiction,
      itemKey: item.sourceKey,
      chunkIndex,
      chunkCount: windows.length,
      verifiedFrom: item.verifiedFrom ?? null,
      corpus: true,
    },
  }));
}

export async function ingestCorpus(options: IngestOptions = {}): Promise<IngestStats> {
  const sources = options.sources ?? ALL_SOURCES;
  const store = options.store ?? getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);
  const dryRun = options.dryRun ?? false;
  const markSupersede = options.markSupersede ?? !dryRun;
  const lastSeenAt = options.now ?? new Date();
  const progress = options.onProgress ?? (() => {});

  const stats: IngestStats = {
    sources: sources.length,
    itemsFetched: 0,
    chunksProcessed: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    superseded: 0,
    failed: 0,
    byVertical: {},
    byJurisdiction: {},
    bySource: [],
    errors: [],
    dryRun,
  };

  for (const source of sources) {
    const per: PerSourceStats = {
      sourceId: source.id,
      label: source.label,
      verticalSlug: source.verticalSlug,
      items: 0,
      chunks: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      superseded: 0,
      failed: 0,
    };
    const liveSourceIds: string[] = [];
    const sourceType = `corpus:${source.id}`;

    let items: RawCorpusItem[];
    try {
      items = await source.fetch();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      stats.errors.push(`[${source.id}] fetch failed: ${reason}`);
      stats.failed += 1;
      per.failed += 1;
      stats.bySource.push(per);
      continue;
    }

    for (const item of items) {
      per.items += 1;
      stats.itemsFetched += 1;
      const chunks = buildChunks(source, item, options.chunkOptions);
      for (const chunk of chunks) {
        per.chunks += 1;
        stats.chunksProcessed += 1;
        liveSourceIds.push(chunk.sourceId);
        stats.byVertical[chunk.verticalSlug] = (stats.byVertical[chunk.verticalSlug] ?? 0) + 1;
        stats.byJurisdiction[chunk.jurisdiction] =
          (stats.byJurisdiction[chunk.jurisdiction] ?? 0) + 1;

        if (dryRun) continue;

        const res = await store.upsert({
          contextKind: 'COMPLIANCE',
          workspaceId: null,
          title: chunk.title,
          body: chunk.body,
          sourceUrl: chunk.sourceUrl,
          verticalSlug: chunk.verticalSlug,
          jurisdiction: chunk.jurisdiction,
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId,
          sourceKey: chunk.itemKey,
          contentHash: chunk.contentHash,
          lastSeenAt,
          metadata: chunk.metadata,
        });
        if (!res.ok) {
          per.failed += 1;
          stats.failed += 1;
          stats.errors.push(`[${source.id}] ${chunk.sourceId}: [${res.error.code}] ${res.error.message}`);
          continue;
        }
        if (res.value.created) {
          per.created += 1;
          stats.created += 1;
        } else if (res.value.unchanged) {
          per.unchanged += 1;
          stats.unchanged += 1;
        } else {
          per.updated += 1;
          stats.updated += 1;
        }
      }
    }

    // Supersede sweep: any previously-stored row of this source that the
    // fetch no longer produced is stale. Guarded by a non-empty live set so
    // a (somehow) empty successful fetch can't tombstone the whole source.
    if (markSupersede && !dryRun && liveSourceIds.length > 0) {
      const sweep = await store.markSupersededExcept({ sourceType, liveSourceIds, at: lastSeenAt });
      if (sweep.ok) {
        per.superseded += sweep.value.superseded;
        stats.superseded += sweep.value.superseded;
      } else {
        stats.errors.push(`[${source.id}] supersede sweep: [${sweep.error.code}] ${sweep.error.message}`);
      }
    }

    progress(
      `  ${source.id.padEnd(24)} items=${per.items} chunks=${per.chunks}` +
        (dryRun
          ? ' (dry-run)'
          : ` created=${per.created} updated=${per.updated} unchanged=${per.unchanged}` +
            ` superseded=${per.superseded} failed=${per.failed}`),
    );
    stats.bySource.push(per);
  }

  return stats;
}
