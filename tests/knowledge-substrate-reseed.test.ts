/**
 * tests/knowledge-substrate-reseed.test.ts
 *
 * Demonstrates the value of the 2026-05-12 re-seed: queries land
 * vertical-aware compliance hits, full per-role JTBD synthesis, and
 * architecture-doc chunks — none of which existed in the prior seed.
 *
 * Uses the in-memory TestKnowledgeStore + deterministic
 * TestEmbeddingProvider so the test runs without OPENAI_API_KEY. Per
 * docs/knowledge-substrate.md (Architecture section), this is exactly
 * the dev / preview path — production embedding requires OPENAI_API_KEY
 * in Vercel env, which Conner will set before the first production seed
 * runs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestEmbeddingProvider, TestKnowledgeStore } from '@/lib/knowledge';
import { TEST_OPERATOR_CONTEXT } from '@/lib/knowledge/test-store';
import { buildSeedAssembly } from '@/lib/knowledge/seed-data';

const WS_CPA = '00000000-0000-0000-0000-00000000c0a0';
const WS_REALTY = '00000000-0000-0000-0000-000000005ea1';

async function seedAll(store: TestKnowledgeStore) {
  store.setContext(TEST_OPERATOR_CONTEXT);
  const a = buildSeedAssembly();
  for (const row of [...a.skill, ...a.vertical, ...a.compliance]) {
    const r = await store.upsert(row);
    if (!r.ok) {
      throw new Error(`seed failed for ${row.sourceId}: [${r.error.code}] ${r.error.message}`);
    }
  }
  return a;
}

describe('knowledge re-seed — coverage', () => {
  it('SKILL bucket includes architecture-doc chunks', () => {
    const a = buildSeedAssembly();
    const archIds = a.skill.filter((r) => r.sourceId?.startsWith('architecture:')).map((r) => r.sourceId);
    const skillIds = a.skill.filter((r) => r.sourceId?.startsWith('skill:')).map((r) => r.sourceId);
    assert.equal(skillIds.length, 5, 'expected 5 PR-C skill docs');
    assert.equal(archIds.length, 5, 'expected 5 architecture-doc chunks');
    assert.ok(archIds.includes('architecture:skills-architecture:loop-overview'));
    assert.ok(archIds.includes('architecture:knowledge-substrate:context-kinds'));
  });

  it('VERTICAL bucket includes both per-chunk and per-role jtbd synthesis rows', () => {
    const a = buildSeedAssembly();
    const chunkRows = a.vertical.filter((r) => r.sourceId?.startsWith('vertical:'));
    const jtbdRows = a.vertical.filter((r) => r.sourceId?.startsWith('jtbd:'));
    // 10 verticals × at least hero/roi/claims/integrations/value-loop = 50 chunk rows, plus per-role.
    assert.ok(chunkRows.length >= 50, `expected >=50 chunk rows, got ${chunkRows.length}`);
    // Per-role synthesis: at least 1 row per vertical (all 10 verticals
    // have role tables today; ratified 2026-05-12).
    assert.ok(jtbdRows.length >= 30, `expected >=30 jtbd synthesis rows, got ${jtbdRows.length}`);
    // Every JTBD row has a vertical slug + role metadata.
    for (const r of jtbdRows) {
      assert.ok(r.verticalSlug, `jtbd row missing verticalSlug: ${r.sourceId}`);
      assert.ok(
        (r.metadata as { role?: string } | undefined)?.role,
        `jtbd row missing role metadata: ${r.sourceId}`,
      );
    }
  });

  it('COMPLIANCE bucket includes both original real-estate fixtures and per-vertical sentinel rules', () => {
    const a = buildSeedAssembly();
    const original = a.compliance.filter((r) => r.sourceId?.startsWith('compliance:'));
    const corpus = a.compliance.filter((r) => r.sourceType === 'compliance-corpus');
    assert.equal(original.length, 5, 'expected 5 original real-estate fixtures');
    assert.ok(corpus.length >= 15, `expected >=15 verified corpus rules, got ${corpus.length}`);
    // Coverage check: at least 5 distinct verticals have at least one
    // verified rule. Per spec, every verified entry must cite the
    // sentinel source file path.
    const verticalsWithRules = new Set(corpus.map((r) => r.verticalSlug));
    assert.ok(
      verticalsWithRules.size >= 5,
      `expected >=5 verticals with verified rules, got ${verticalsWithRules.size}`,
    );
    for (const r of corpus) {
      const meta = (r.metadata ?? {}) as { source?: string; statute?: string };
      assert.ok(meta.source?.startsWith('lib/agents/sentinel/corpus/'), `corpus row missing source: ${r.sourceId}`);
      assert.ok(meta.statute && meta.statute.length > 0, `corpus row missing statute: ${r.sourceId}`);
    }
  });

  it('reports skipped unverified rules in diagnostics', () => {
    const a = buildSeedAssembly();
    // Most of today's drafted rules are flagged unverified pending
    // counsel red-line, so the skip count should be material (>0).
    assert.ok(
      a.diagnostics.skippedUnverifiedCompliance > 0,
      'expected unverified rules to be skipped',
    );
  });
});

describe('knowledge re-seed — vertical-aware queries', () => {
  function freshStore() {
    const embedder = new TestEmbeddingProvider({ dimensions: 256 });
    return { embedder, store: new TestKnowledgeStore(embedder) };
  }

  it('CPA-specific JTBD query lands a CPA row, not a real-estate row', async () => {
    const { store } = freshStore();
    const a = await seedAll(store);
    // Use the body text of a CPA jtbd row verbatim so the deterministic
    // hash embedder returns similarity ≈ 1.0 — semantic distance on a
    // hash embedder doesn't track meaning.
    const cpaRow = a.vertical.find(
      (r) => r.sourceId === 'jtbd:cpa:staff-accountant-tax-preparer',
    );
    assert.ok(cpaRow, 'expected the CPA tax-preparer jtbd synthesis row');
    store.setContext({ workspaceId: WS_CPA, isOperator: false });
    const search = await store.search({
      query: cpaRow.body,
      k: 3,
      contextKinds: ['VERTICAL'],
    });
    assert.ok(search.ok);
    if (!search.ok) return;
    assert.ok(search.value.length >= 1);
    assert.equal(search.value[0].verticalSlug, 'cpa');
    assert.equal(search.value[0].title, 'Staff accountant / tax preparer in CPA firms');
  });

  it('vertical-scoped search filter limits results to one vertical', async () => {
    const { store } = freshStore();
    await seedAll(store);
    store.setContext(TEST_OPERATOR_CONTEXT);
    const search = await store.search({
      query: 'pipeline coordination tax preparer',
      k: 20,
      contextKinds: ['VERTICAL'],
      verticalSlug: 'cpa',
    });
    assert.ok(search.ok);
    if (!search.ok) return;
    for (const hit of search.value) assert.equal(hit.verticalSlug, 'cpa');
  });

  it('mortgage RESPA section 8 query lands the mortgage compliance entry', async () => {
    const { store } = freshStore();
    const a = await seedAll(store);
    const respaRow = a.compliance.find(
      (r) => r.sourceId === 'mortgage:respa-section-8-anti-kickback',
    );
    assert.ok(respaRow, 'expected the mortgage RESPA section 8 corpus row');
    store.setContext(TEST_OPERATOR_CONTEXT);
    const search = await store.search({
      query: respaRow.body,
      k: 3,
      contextKinds: ['COMPLIANCE'],
    });
    assert.ok(search.ok);
    if (!search.ok) return;
    assert.ok(search.value.length >= 1);
    assert.equal(search.value[0].verticalSlug, 'mortgage');
    assert.ok(search.value[0].title.includes('RESPA Section 8'));
  });

  it('architecture query lands an architecture-doc skill row', async () => {
    const { store } = freshStore();
    const a = await seedAll(store);
    const archRow = a.skill.find(
      (r) => r.sourceId === 'architecture:knowledge-substrate:context-kinds',
    );
    assert.ok(archRow, 'expected the knowledge-substrate context-kinds architecture row');
    store.setContext(TEST_OPERATOR_CONTEXT);
    const search = await store.search({
      query: archRow.body,
      k: 3,
      contextKinds: ['SKILL'],
    });
    assert.ok(search.ok);
    if (!search.ok) return;
    assert.ok(search.value.length >= 1);
    assert.equal(search.value[0].title, archRow.title);
    const meta = search.value[0].metadata as { doc?: string };
    assert.ok(meta.doc?.includes('knowledge-substrate'));
  });
});

describe('knowledge re-seed — workspace RLS still holds', () => {
  function freshStore() {
    const embedder = new TestEmbeddingProvider({ dimensions: 256 });
    return { embedder, store: new TestKnowledgeStore(embedder) };
  }

  it('cross-customer queries (VERTICAL / COMPLIANCE) succeed from a workspace context', async () => {
    const { store } = freshStore();
    const a = await seedAll(store);
    // A CPA workspace querying a VERTICAL row should see it (workspaceId IS NULL).
    store.setContext({ workspaceId: WS_CPA, isOperator: false });
    const heroRow = a.vertical.find((r) => r.sourceId === 'vertical:cpa:hero');
    assert.ok(heroRow);
    const search = await store.search({
      query: heroRow.body,
      k: 3,
      contextKinds: ['VERTICAL'],
    });
    assert.ok(search.ok);
    if (!search.ok) return;
    assert.ok(search.value.length >= 1);
    for (const hit of search.value) {
      // Cross-customer rows have workspaceId = null. Customer-scoped
      // hits (none in this seed) would have workspaceId = WS_CPA.
      assert.equal(hit.workspaceId ?? null, null);
    }
  });

  it('writing a CUSTOMER row from one workspace stays isolated from another workspace', async () => {
    const { store } = freshStore();
    await seedAll(store);
    store.setContext(TEST_OPERATOR_CONTEXT);
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WS_CPA,
      title: 'CPA workspace pipeline note',
      body: 'WS-CPA: confidential tax-season pipeline detail',
    });
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WS_REALTY,
      title: 'Realty workspace pipeline note',
      body: 'WS-REALTY: confidential listing-pipeline detail',
    });
    // CPA workspace must NOT see the realty workspace's row.
    store.setContext({ workspaceId: WS_CPA, isOperator: false });
    const search = await store.search({
      query: 'confidential pipeline detail',
      k: 10,
      contextKinds: ['CUSTOMER'],
    });
    assert.ok(search.ok);
    if (!search.ok) return;
    const titles = search.value.map((h) => h.title);
    assert.ok(titles.includes('CPA workspace pipeline note'));
    assert.ok(!titles.includes('Realty workspace pipeline note'));
    for (const hit of search.value) assert.equal(hit.workspaceId, WS_CPA);
  });
});
