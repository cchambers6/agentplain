/**
 * scripts/corpus-refresh.ts
 *
 * Weekly knowledge-corpus refresh. Re-runs ingestion over the source
 * registry; the content-hash machinery in the store decides, per chunk:
 *   - hash unchanged  -> skip the embedder, bump lastSeenAt  (zero cost)
 *   - hash changed    -> re-embed + replace                  (the update)
 *   - new chunk       -> create
 *   - source dropped  -> markSupersededExcept stamps supersededAt
 *
 * So a week with no upstream changes costs $0 in embeddings and just
 * refreshes lastSeenAt; only genuine changes pay to re-embed.
 *
 * SAFETY: re-embedding writes vectors into the store. If the resolved
 * embedder is the deterministic TEST embedder (no OPENAI_API_KEY) AND the
 * store is the real pgvector store, re-embedding CHANGED content would
 * write garbage vectors into prod. `refreshCorpus` guards against exactly
 * that: when embedder=test and store=pgvector, it runs in report-only mode
 * (lastSeen bumps for unchanged rows still happen, but changed/new chunks
 * are reported, not embedded) until the prod key lands. See the
 * OPENAI_API_KEY Conner TODO.
 *
 * Invoked by lib/inngest/functions/knowledge-corpus-refresh.ts (cron) and
 * runnable by hand: `npx tsx scripts/corpus-refresh.ts`.
 */

import { getEmbeddingProvider, getKnowledgeStore } from '@/lib/knowledge';
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db/rls';
import { ingestCorpus, type IngestStats } from './corpus-ingest/ingest';
import { ALL_SOURCES } from './corpus-ingest/sources';

export interface RefreshResult {
  ran: boolean;
  /** Why a refresh was skipped, when `ran` is false. */
  skippedReason?: string;
  stats?: IngestStats;
}

export interface RefreshOptions {
  now?: Date;
  onProgress?: (line: string) => void;
}

export async function refreshCorpus(options: RefreshOptions = {}): Promise<RefreshResult> {
  const embedder = getEmbeddingProvider();
  const store = getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);

  // Guard: never let the deterministic test embedder write vectors into the
  // real pgvector store. Re-embedding changed content with a hash embedder
  // would silently poison retrieval quality.
  if (embedder.name === 'test' && store.name === 'pgvector') {
    const dry = await ingestCorpus({
      sources: ALL_SOURCES,
      store,
      dryRun: true,
      now: options.now,
      onProgress: options.onProgress,
    });
    return {
      ran: false,
      skippedReason:
        'embedder=test + store=pgvector — refusing to write hash vectors to prod. Set OPENAI_API_KEY (see TODOS-FOR-CONNER).',
      stats: dry,
    };
  }

  const stats = await ingestCorpus({
    sources: ALL_SOURCES,
    store,
    now: options.now,
    onProgress: options.onProgress,
  });
  return { ran: true, stats };
}

// Allow `npx tsx scripts/corpus-refresh.ts` for a manual refresh.
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  /corpus-refresh\.ts$/.test(process.argv[1])
) {
  refreshCorpus({ onProgress: (l) => console.log(l) })
    .then((r) => {
      if (!r.ran) console.log(`Refresh skipped: ${r.skippedReason}`);
      const s = r.stats;
      if (s) {
        console.log(
          `\nchunks=${s.chunksProcessed} created=${s.created} updated=${s.updated} ` +
            `unchanged=${s.unchanged} superseded=${s.superseded} failed=${s.failed}`,
        );
      }
      if (s && s.failed > 0) process.exit(1);
    })
    .catch((err) => {
      console.error('corpus-refresh: uncaught', err);
      process.exit(1);
    });
}
