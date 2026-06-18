/**
 * scripts/corpus-ingest/verify.ts
 *
 * Offline end-to-end verification of the ingestion + retrieval contract,
 * with NO database and NO paid embedding key.
 *
 * The production embedder is OpenAI text-embedding-3-small (semantic). The
 * deterministic hash test embedder is great for plumbing but gives random
 * cosine ordering, so it can't demonstrate that a real question retrieves
 * the right chunk. This harness uses a tiny LEXICAL (term-frequency)
 * embedder so keyword overlap drives ranking deterministically and
 * meaningfully — enough to prove the full path: ingest -> vector search ->
 * top-k -> citation fields, including the jurisdiction filter. Semantic
 * quality in prod is the OpenAI embedder's job (parked on OPENAI_API_KEY).
 *
 * Run: npx tsx scripts/corpus-ingest/verify.ts
 */

import { createHash } from 'node:crypto';
import { TestKnowledgeStore, TEST_OPERATOR_CONTEXT } from '@/lib/knowledge/test-store';
import type {
  EmbeddingValue,
  IEmbeddingProvider,
  KnowledgeResult,
} from '@/lib/knowledge/types';
import { knowledgeOk } from '@/lib/knowledge/types';
import { ingestCorpus } from './ingest';

const DIMS = 1536;

/** Deterministic lexical embedder: hashing-trick term-frequency vector,
 *  L2-normalized. Cosine similarity ~ shared-keyword overlap. Offline. */
export class LexicalEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'test' as const;
  readonly model = 'lexical-tf-verify';
  readonly dimensions = DIMS;
  async embed(text: string): Promise<KnowledgeResult<EmbeddingValue>> {
    const vec = new Array<number>(DIMS).fill(0);
    for (const tok of tokenize(text)) {
      vec[bucket(tok)] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return knowledgeOk({
      vector: vec.map((v) => v / norm),
      model: this.model,
      usage: { promptTokens: null },
    });
  }
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'for', 'and', 'or', 'is', 'are', 'on',
  'at', 'by', 'with', 'as', 'that', 'this', 'be', 'it', 'from', 'what', 'whats',
  'how', 'when', 'who', 'does', 'do', 'must', 'can', 's',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function bucket(token: string): number {
  const h = createHash('sha1').update(token).digest();
  return ((h[0] << 16) | (h[1] << 8) | h[2]) % DIMS;
}

async function main() {
  const store = new TestKnowledgeStore(new LexicalEmbeddingProvider());
  store.setContext(TEST_OPERATOR_CONTEXT);
  const stats = await ingestCorpus({ store });
  console.log(
    `Ingested: chunks=${stats.chunksProcessed} created=${stats.created} failed=${stats.failed}`,
  );

  const queries = [
    "what's the GA broker license requirement",
    'how long to return a security deposit in Georgia',
    'Georgia attorney trust account IOLTA rules',
    'self-employment tax rate',
  ];

  for (const query of queries) {
    const res = await store.search({
      query,
      k: 3,
      contextKinds: ['COMPLIANCE'],
      jurisdictions: ['GA', 'US'],
    });
    console.log(`\nQUERY: ${query}`);
    if (!res.ok) {
      console.log(`  ERROR ${res.error.code}: ${res.error.message}`);
      continue;
    }
    res.value.forEach((hit, i) => {
      const cite = (hit.metadata.citation as string) ?? '(no citation)';
      console.log(
        `  [${i + 1}] (${hit.jurisdiction}) ${hit.title}\n` +
          `      cite: ${cite}  |  ${hit.sourceUrl}\n` +
          `      similarity=${hit.similarity.toFixed(3)}`,
      );
    });
  }
}

main().catch((err) => {
  console.error('verify: uncaught', err);
  process.exit(1);
});
