/**
 * lib/knowledge/jurisdiction.test.ts
 *
 * Pins the jurisdiction-awareness + corpus update-detection added to the
 * knowledge substrate (PR feat/knowledge-pgvector-rag):
 *   - jurisdiction filter: NULL-jurisdiction rows ALWAYS eligible; state
 *     rows only when in the requested set; "no filter" returns everything.
 *   - unchanged-content fast path: matching contentHash → embed skipped,
 *     created=false, unchanged=true.
 *   - markSupersededExcept: stamps stale rows, refuses an empty live set.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TestEmbeddingProvider } from './test-embedding';
import { TestKnowledgeStore, TEST_OPERATOR_CONTEXT } from './test-store';

function store() {
  const s = new TestKnowledgeStore(new TestEmbeddingProvider());
  s.setContext(TEST_OPERATOR_CONTEXT);
  return s;
}

describe('knowledge jurisdiction filter', () => {
  it('treats NULL jurisdiction as always eligible and filters state rows', async () => {
    const s = store();
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'GA rule', body: 'georgia statute body', jurisdiction: 'GA', sourceType: 'corpus:t', sourceId: 'ga#0' });
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'US rule', body: 'federal statute body', jurisdiction: 'US', sourceType: 'corpus:t', sourceId: 'us#0' });
    await s.upsert({ contextKind: 'SKILL', title: 'Skill', body: 'agnostic skill body', sourceType: 'corpus:t', sourceId: 'sk#0' });

    const res = await s.search({ query: 'body', k: 50, jurisdictions: ['GA'] });
    assert.ok(res.ok);
    const titles = res.value.map((h) => h.title).sort();
    // GA matches; SKILL (null jurisdiction) always eligible; US excluded.
    assert.deepEqual(titles, ['GA rule', 'Skill']);
  });

  it('returns every jurisdiction when no filter is given', async () => {
    const s = store();
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'GA rule', body: 'b', jurisdiction: 'GA', sourceType: 'c', sourceId: 'ga#0' });
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'US rule', body: 'b', jurisdiction: 'US', sourceType: 'c', sourceId: 'us#0' });
    const res = await s.search({ query: 'b', k: 50 });
    assert.ok(res.ok);
    assert.equal(res.value.length, 2);
    // jurisdiction is surfaced on the hit.
    const ga = res.value.find((h) => h.title === 'GA rule');
    assert.equal(ga?.jurisdiction, 'GA');
  });

  it('layers GA + US together for a Georgia workspace', async () => {
    const s = store();
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'GA', body: 'b', jurisdiction: 'GA', sourceType: 'c', sourceId: 'ga#0' });
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'US', body: 'b', jurisdiction: 'US', sourceType: 'c', sourceId: 'us#0' });
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'CA', body: 'b', jurisdiction: 'CA', sourceType: 'c', sourceId: 'ca#0' });
    const res = await s.search({ query: 'b', k: 50, jurisdictions: ['GA', 'US'] });
    assert.ok(res.ok);
    assert.deepEqual(res.value.map((h) => h.title).sort(), ['GA', 'US']);
  });
});

describe('unchanged-content fast path', () => {
  it('skips re-embedding when contentHash matches and bumps lastSeen', async () => {
    const s = store();
    const first = await s.upsert({
      contextKind: 'COMPLIANCE', title: 'T', body: 'same body',
      jurisdiction: 'GA', sourceType: 'corpus:t', sourceId: 'k#0', contentHash: 'HASH_A',
    });
    assert.ok(first.ok && first.value.created && !first.value.unchanged);

    const again = await s.upsert({
      contextKind: 'COMPLIANCE', title: 'T', body: 'same body',
      jurisdiction: 'GA', sourceType: 'corpus:t', sourceId: 'k#0', contentHash: 'HASH_A',
    });
    assert.ok(again.ok);
    assert.equal(again.value.created, false);
    assert.equal(again.value.unchanged, true);
  });

  it('re-embeds when the contentHash changes', async () => {
    const s = store();
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'T', body: 'v1', sourceType: 'c', sourceId: 'k#0', contentHash: 'A' });
    const changed = await s.upsert({ contextKind: 'COMPLIANCE', title: 'T', body: 'v2', sourceType: 'c', sourceId: 'k#0', contentHash: 'B' });
    assert.ok(changed.ok);
    assert.equal(changed.value.unchanged, false);
  });
});

describe('markSupersededExcept', () => {
  it('stamps rows absent from the live set and leaves live rows', async () => {
    const s = store();
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'keep', body: 'b', sourceType: 'corpus:x', sourceId: 'keep#0' });
    await s.upsert({ contextKind: 'COMPLIANCE', title: 'drop', body: 'b', sourceType: 'corpus:x', sourceId: 'drop#0' });
    const res = await s.markSupersededExcept({ sourceType: 'corpus:x', liveSourceIds: ['keep#0'] });
    assert.ok(res.ok);
    assert.equal(res.value.superseded, 1);
  });

  it('refuses an empty live set (would tombstone everything)', async () => {
    const s = store();
    const res = await s.markSupersededExcept({ sourceType: 'corpus:x', liveSourceIds: [] });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'INVALID_ARGUMENT');
  });
});
