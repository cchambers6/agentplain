/**
 * scripts/corpus-ingest/run.ts
 *
 * CLI entry for the knowledge-corpus ingestion.
 *
 * Run:
 *   npx tsx scripts/corpus-ingest/run.ts            # ingest into the store
 *   npx tsx scripts/corpus-ingest/run.ts --dry-run  # preview chunk counts, no writes
 *
 * Env:
 *   KNOWLEDGE_STORE=pgvector|test                  (default pgvector; needs DATABASE_URL)
 *   KNOWLEDGE_EMBEDDING_PROVIDER=openai|test       (default openai; needs OPENAI_API_KEY)
 *
 * Cost (production embedder, text-embedding-3-small @ $0.02/1M tokens):
 *   ~61 chunks x ~350 tokens ≈ 21k tokens ≈ $0.0004 for a full re-ingest.
 *   A no-op re-ingest costs $0 — unchanged content hashes skip the embedder.
 *
 * Locally, with no DATABASE_URL/OPENAI key, run against the deterministic
 * test store + embedder to exercise the full pipeline:
 *   KNOWLEDGE_STORE=test KNOWLEDGE_EMBEDDING_PROVIDER=test npx tsx scripts/corpus-ingest/run.ts
 */

import { getEmbeddingProvider } from '@/lib/knowledge';
import { ingestCorpus } from './ingest';
import { ALL_SOURCES } from './sources';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const embedder = getEmbeddingProvider();
  console.log(
    `Corpus ingest${dryRun ? ' (DRY RUN)' : ''} — embedder=${embedder.name} model=${embedder.model} dim=${embedder.dimensions}`,
  );
  console.log(`Sources: ${ALL_SOURCES.map((s) => s.id).join(', ')}\n`);

  const start = Date.now();
  const stats = await ingestCorpus({ dryRun, onProgress: (l) => console.log(l) });
  const elapsed = Date.now() - start;

  console.log('\n── per vertical (chunks) ──');
  for (const [v, n] of Object.entries(stats.byVertical).sort()) {
    console.log(`  ${v.padEnd(20)} ${n}`);
  }
  console.log('── per jurisdiction (chunks) ──');
  for (const [j, n] of Object.entries(stats.byJurisdiction).sort()) {
    console.log(`  ${j.padEnd(20)} ${n}`);
  }
  console.log(
    `\nDone in ${elapsed}ms. sources=${stats.sources} items=${stats.itemsFetched} chunks=${stats.chunksProcessed} ` +
      `created=${stats.created} updated=${stats.updated} unchanged=${stats.unchanged} ` +
      `superseded=${stats.superseded} failed=${stats.failed}`,
  );
  if (stats.errors.length > 0) {
    for (const e of stats.errors) console.error(`  ! ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('corpus-ingest: uncaught', err);
  process.exit(1);
});
