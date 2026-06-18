/**
 * tests/corpus-ingest.test.ts
 *
 * End-to-end coverage of the knowledge-corpus ingestion framework
 * (scripts/corpus-ingest) against the in-memory test store — no DB, no
 * paid embedder.
 *
 *   - normalize: idempotent + stable hash
 *   - chunk: single chunk for short bodies, windowed for long, with overlap
 *   - ingest: per-vertical / per-jurisdiction counts; idempotent re-ingest
 *     (second pass is all-unchanged, zero re-embeds)
 *   - retrieval: a real keyword query returns the right cited chunk (lexical
 *     embedder), incl. the strategic-build sample "GA broker license"
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { normalizeText, contentHash } from '../scripts/corpus-ingest/normalize';
import { chunkBody } from '../scripts/corpus-ingest/chunk';
import { ingestCorpus } from '../scripts/corpus-ingest/ingest';
import { ALL_SOURCES } from '../scripts/corpus-ingest/sources';
import { TestKnowledgeStore, TEST_OPERATOR_CONTEXT } from '../lib/knowledge/test-store';
import type {
  EmbeddingValue,
  IEmbeddingProvider,
  KnowledgeResult,
} from '../lib/knowledge/types';
import { knowledgeOk } from '../lib/knowledge/types';

// ── deterministic lexical embedder (keyword overlap → cosine) ─────────────
const DIMS = 1536;
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'for', 'and', 'or', 'is', 'are', 'what', 'whats', 'how', 's']);
class LexicalEmbedder implements IEmbeddingProvider {
  readonly name = 'test' as const;
  readonly model = 'lexical-test';
  readonly dimensions = DIMS;
  async embed(text: string): Promise<KnowledgeResult<EmbeddingValue>> {
    const v = new Array<number>(DIMS).fill(0);
    for (const tok of text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)) {
      if (tok.length < 2 || STOP.has(tok)) continue;
      const h = createHash('sha1').update(tok).digest();
      v[((h[0] << 16) | (h[1] << 8) | h[2]) % DIMS] += 1;
    }
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return knowledgeOk({ vector: v.map((x) => x / n), model: this.model, usage: { promptTokens: null } });
  }
}

function lexicalStore() {
  const s = new TestKnowledgeStore(new LexicalEmbedder());
  s.setContext(TEST_OPERATOR_CONTEXT);
  return s;
}

describe('normalize', () => {
  it('is idempotent and hashes stably', () => {
    const a = normalizeText('  Foo   bar\n\n\n baz  ');
    assert.equal(normalizeText(a), a);
    assert.equal(contentHash(a), contentHash(normalizeText(a)));
  });
  it('unifies smart quotes / dashes so cosmetic churn does not change the hash', () => {
    const curly = normalizeText('the broker’s trust—account');
    const plain = normalizeText("the broker's trust-account");
    assert.equal(contentHash(curly), contentHash(plain));
  });
});

describe('chunk', () => {
  it('returns a single chunk for a short body', () => {
    assert.deepEqual(chunkBody('One short sentence here.'), ['One short sentence here.']);
  });
  it('returns [] for empty input', () => {
    assert.deepEqual(chunkBody('   '), []);
  });
  it('windows a long body into multiple overlapping chunks', () => {
    const sentence = 'This is a moderately long sentence about Georgia statute and rules. ';
    const long = sentence.repeat(60); // ~4000 chars
    const chunks = chunkBody(long, { maxChars: 800, overlapChars: 100 });
    assert.ok(chunks.length > 1, 'expected multiple chunks');
    for (const c of chunks) assert.ok(c.length <= 1000, 'chunk within bound + overlap');
  });
});

describe('ingest', () => {
  it('ingests all GA sources with the expected per-vertical counts', async () => {
    const stats = await ingestCorpus({ store: lexicalStore(), now: new Date('2026-06-17T00:00:00Z') });
    assert.equal(stats.failed, 0);
    assert.equal(stats.byVertical['real-estate'], 16);
    assert.equal(stats.byVertical['cpa'], 15);
    assert.equal(stats.byVertical['law'], 15);
    assert.equal(stats.byVertical['property-management'], 14);
    assert.equal(stats.chunksProcessed, 60);
    // Federal IRS chunks carry "US"; everything else "GA".
    assert.equal(stats.byJurisdiction['US'], 9);
    assert.equal(stats.byJurisdiction['GA'], 51);
    assert.equal(stats.created, 60);
  });

  it('is idempotent — a second pass re-embeds nothing', async () => {
    const store = lexicalStore();
    const now = new Date('2026-06-17T00:00:00Z');
    await ingestCorpus({ store, now });
    const second = await ingestCorpus({ store, now });
    assert.equal(second.created, 0);
    assert.equal(second.updated, 0);
    assert.equal(second.unchanged, 60);
    assert.equal(second.failed, 0);
  });

  it('every source id is unique (natural-key safety)', () => {
    const ids = ALL_SOURCES.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('retrieval (lexical)', () => {
  async function seeded() {
    const store = lexicalStore();
    await ingestCorpus({ store });
    return store;
  }

  it('answers the strategic-build sample: GA broker license requirement', async () => {
    const store = await seeded();
    const res = await store.search({
      query: "what's the GA broker license requirement",
      k: 3,
      contextKinds: ['COMPLIANCE'],
      jurisdictions: ['GA', 'US'],
    });
    assert.ok(res.ok);
    const top = res.value[0];
    assert.match(top.title, /broker license/i);
    assert.equal(top.jurisdiction, 'GA');
    assert.equal(top.metadata.citation, 'O.C.G.A. § 43-40-8');
    assert.ok(top.sourceUrl?.includes('law.justia.com'));
  });

  it('retrieves the federal self-employment-tax chunk for a tax query', async () => {
    const store = await seeded();
    const res = await store.search({
      query: 'self-employment tax rate social security medicare',
      k: 3,
      contextKinds: ['COMPLIANCE'],
      jurisdictions: ['GA', 'US'],
    });
    assert.ok(res.ok);
    assert.equal(res.value[0].jurisdiction, 'US');
    assert.match(res.value[0].title, /self-employment tax/i);
  });
});
