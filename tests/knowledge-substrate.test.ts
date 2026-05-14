import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OpenAIEmbeddingProvider,
  TestEmbeddingProvider,
  TestKnowledgeStore,
  hashToVector,
  knowledgeOk,
} from '@/lib/knowledge';
import { TEST_OPERATOR_CONTEXT } from '@/lib/knowledge/test-store';
import { buildSeedAssembly, SEED_COUNTS } from '@/lib/knowledge/seed-data';
import type { FetchLike } from '@/lib/knowledge/openai-embedding';
import { pgvectorLiteral } from '@/lib/knowledge/pgvector-store';

// ── TestEmbeddingProvider ───────────────────────────────────────────────

describe('TestEmbeddingProvider', () => {
  it('emits vectors of the configured dimension', async () => {
    const p = new TestEmbeddingProvider({ dimensions: 1536 });
    const r = await p.embed('hello world');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.vector.length, 1536);
    assert.equal(p.dimensions, 1536);
  });

  it('is deterministic — same text → same vector', async () => {
    const p = new TestEmbeddingProvider({ dimensions: 256 });
    const a = await p.embed('counter offer at 385K');
    const b = await p.embed('counter offer at 385K');
    assert.ok(a.ok && b.ok);
    if (!a.ok || !b.ok) return;
    assert.deepEqual(a.value.vector, b.value.vector);
  });

  it('different texts → different vectors', async () => {
    const p = new TestEmbeddingProvider({ dimensions: 256 });
    const a = await p.embed('alpha');
    const b = await p.embed('beta');
    assert.ok(a.ok && b.ok);
    if (!a.ok || !b.ok) return;
    assert.notDeepEqual(a.value.vector, b.value.vector);
  });

  it('seedText forces an exact vector', async () => {
    const p = new TestEmbeddingProvider({ dimensions: 4 });
    p.seedText('pinned', [0.1, 0.2, 0.3, 0.4]);
    const r = await p.embed('pinned');
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.value.vector, [0.1, 0.2, 0.3, 0.4]);
  });

  it('seedText rejects wrong-length vectors', () => {
    const p = new TestEmbeddingProvider({ dimensions: 4 });
    assert.throws(() => p.seedText('x', [0.1, 0.2]), /vector length/);
  });

  it('rejects empty input', async () => {
    const p = new TestEmbeddingProvider({ dimensions: 4 });
    const r = await p.embed('');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'INVALID_ARGUMENT');
  });

  it('hashToVector produces a normalized vector', () => {
    const v = hashToVector('any-input', 256);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(norm - 1) < 1e-9, `expected unit norm, got ${norm}`);
  });
});

// ── OpenAIEmbeddingProvider (via stub fetch) ────────────────────────────

describe('OpenAIEmbeddingProvider', () => {
  function makeFetch(handler: (init: { body?: string }) => {
    status: number;
    body: unknown;
  }): FetchLike {
    return async (_url, init) => {
      const out = handler(init ?? {});
      return {
        ok: out.status >= 200 && out.status < 300,
        status: out.status,
        text: async () => JSON.stringify(out.body),
      };
    };
  }

  it('returns NOT_CONFIGURED when api key absent', async () => {
    const p = new OpenAIEmbeddingProvider({ apiKey: '' });
    const r = await p.embed('hi');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'NOT_CONFIGURED');
  });

  it('parses a valid response into the vector', async () => {
    const p = new OpenAIEmbeddingProvider({
      apiKey: 'sk-test',
      dimensions: 4,
      fetchImpl: makeFetch(() => ({
        status: 200,
        body: {
          object: 'list',
          model: 'text-embedding-3-small',
          data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }],
          usage: { prompt_tokens: 7, total_tokens: 7 },
        },
      })),
    });
    const r = await p.embed('hello');
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.value.vector, [0.1, 0.2, 0.3, 0.4]);
    assert.equal(r.value.usage.promptTokens, 7);
    assert.equal(r.value.model, 'text-embedding-3-small');
  });

  it('flags dim mismatch when api returns wrong length', async () => {
    const p = new OpenAIEmbeddingProvider({
      apiKey: 'sk-test',
      dimensions: 1536,
      fetchImpl: makeFetch(() => ({
        status: 200,
        body: {
          object: 'list',
          model: 'text-embedding-3-small',
          data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }],
        },
      })),
    });
    const r = await p.embed('hi');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'DIMENSION_MISMATCH');
  });

  it('maps 401 → AUTHENTICATION', async () => {
    const p = new OpenAIEmbeddingProvider({
      apiKey: 'sk-test',
      fetchImpl: makeFetch(() => ({
        status: 401,
        body: { error: { message: 'Bad key' } },
      })),
    });
    const r = await p.embed('hi');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'AUTHENTICATION');
    assert.equal(r.error.status, 401);
  });

  it('maps 429 → RATE_LIMITED', async () => {
    const p = new OpenAIEmbeddingProvider({
      apiKey: 'sk-test',
      fetchImpl: makeFetch(() => ({ status: 429, body: { error: { message: 'slow down' } } })),
    });
    const r = await p.embed('hi');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'RATE_LIMITED');
  });

  it('maps 5xx → UPSTREAM_ERROR', async () => {
    const p = new OpenAIEmbeddingProvider({
      apiKey: 'sk-test',
      fetchImpl: makeFetch(() => ({ status: 503, body: { error: { message: 'try later' } } })),
    });
    const r = await p.embed('hi');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'UPSTREAM_ERROR');
  });
});

// ── pgvector literal formatter ──────────────────────────────────────────

describe('pgvectorLiteral', () => {
  it('formats a numeric array as a pgvector literal', () => {
    assert.equal(pgvectorLiteral([1, 2.5, -0.1]), '[1,2.5,-0.1]');
  });

  it('handles empty arrays', () => {
    assert.equal(pgvectorLiteral([]), '[]');
  });

  it('replaces NaN / Infinity with 0', () => {
    assert.equal(pgvectorLiteral([1, NaN, Infinity, -Infinity, 2]), '[1,0,0,0,2]');
  });
});

// ── TestKnowledgeStore: round-trip, RLS, validation ─────────────────────

const WS_A = '00000000-0000-0000-0000-00000000000a';
const WS_B = '00000000-0000-0000-0000-00000000000b';

function freshStore() {
  const e = new TestEmbeddingProvider({ dimensions: 64 });
  return { embedder: e, store: new TestKnowledgeStore(e) };
}

describe('TestKnowledgeStore — round-trip', () => {
  it('upsert + search returns the document', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    const body = 'agentplain replaces 8 hours of broker-owner coordination work per week.';
    const up = await store.upsert({
      contextKind: 'VERTICAL',
      workspaceId: null,
      title: 'Real estate hero',
      body,
      verticalSlug: 'real-estate',
    });
    assert.ok(up.ok);
    if (!up.ok) return;
    assert.equal(up.value.created, true);
    // Use the body text verbatim so the deterministic test embedder
    // produces identical vectors → cosine similarity ≈ 1.0. With a hash-
    // derived embedder, semantically-similar-but-different-text does not
    // imply geometric proximity; the test embedder is for round-trip
    // correctness, not semantic plausibility.
    const search = await store.search({
      query: body,
      k: 5,
      contextKinds: ['VERTICAL'],
    });
    assert.ok(search.ok);
    if (!search.ok) return;
    assert.ok(search.value.length >= 1);
    assert.equal(search.value[0].title, 'Real estate hero');
    assert.equal(search.value[0].verticalSlug, 'real-estate');
    assert.ok(search.value[0].similarity > 0.99, `similarity ${search.value[0].similarity}`);
  });

  it('upsert is idempotent on (sourceType, sourceId)', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    const first = await store.upsert({
      contextKind: 'SKILL',
      workspaceId: null,
      sourceType: 'skill_doc',
      sourceId: 'skill:read',
      title: 'Read skill v1',
      body: 'reads gmail messages',
    });
    const second = await store.upsert({
      contextKind: 'SKILL',
      workspaceId: null,
      sourceType: 'skill_doc',
      sourceId: 'skill:read',
      title: 'Read skill v2',
      body: 'reads gmail messages and parses them',
    });
    assert.ok(first.ok && second.ok);
    if (!first.ok || !second.ok) return;
    assert.equal(first.value.created, true);
    assert.equal(second.value.created, false);
    assert.equal(first.value.id, second.value.id);
  });

  it('delete by documentId removes the row', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    const up = await store.upsert({
      contextKind: 'VERTICAL',
      workspaceId: null,
      title: 'doomed',
      body: 'will be deleted',
      verticalSlug: 'mortgage',
    });
    assert.ok(up.ok);
    if (!up.ok) return;
    const del = await store.delete({ documentId: up.value.documentId as string });
    assert.ok(del.ok);
    if (!del.ok) return;
    assert.equal(del.value.deleted, 1);
    const search = await store.search({ query: 'will be deleted', k: 5 });
    assert.ok(search.ok);
    if (!search.ok) return;
    assert.equal(search.value.length, 0);
  });
});

describe('TestKnowledgeStore — RLS isolation', () => {
  it('customer A does NOT see customer B rows', async () => {
    const { store } = freshStore();
    // Seed both as operator.
    store.setContext(TEST_OPERATOR_CONTEXT);
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WS_A,
      title: 'Customer A pipeline',
      body: 'workspace A counter-offer playbook content',
    });
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WS_B,
      title: 'Customer B pipeline',
      body: 'workspace B counter-offer playbook content',
    });
    // Customer A queries.
    store.setContext({ workspaceId: WS_A, isOperator: false });
    const search = await store.search({ query: 'counter-offer playbook', k: 10 });
    assert.ok(search.ok);
    if (!search.ok) return;
    for (const hit of search.value) {
      // Customer A may see global rows (NULL workspaceId) but never workspace B.
      if (hit.workspaceId !== null) assert.equal(hit.workspaceId, WS_A);
    }
    const titles = search.value.map((h) => h.title);
    assert.ok(titles.includes('Customer A pipeline'));
    assert.ok(!titles.includes('Customer B pipeline'));
  });

  it('customer queries can read VERTICAL / COMPLIANCE / SKILL rows', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    await store.upsert({
      contextKind: 'VERTICAL',
      workspaceId: null,
      title: 'Real estate hero',
      body: 'realtor value prop content',
      verticalSlug: 'real-estate',
    });
    await store.upsert({
      contextKind: 'COMPLIANCE',
      workspaceId: null,
      title: 'Fair housing protected classes',
      body: 'FHA prohibits discrimination based on protected classes',
      verticalSlug: 'real-estate',
    });
    await store.upsert({
      contextKind: 'SKILL',
      workspaceId: null,
      title: 'Categorize skill',
      body: 'assigns intent labels to messages',
    });
    store.setContext({ workspaceId: WS_A, isOperator: false });
    const r = await store.search({ query: 'value prop', k: 10 });
    assert.ok(r.ok);
    if (!r.ok) return;
    const kinds = new Set(r.value.map((h) => h.contextKind));
    // At least one VERTICAL hit should surface for an "value prop" query.
    assert.ok(kinds.has('VERTICAL'));
  });

  it('operator sees both workspaces', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WS_A,
      title: 'A',
      body: 'pipeline A',
    });
    await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: WS_B,
      title: 'B',
      body: 'pipeline B',
    });
    const r = await store.search({ query: 'pipeline', k: 10, contextKinds: ['CUSTOMER'] });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.value.length, 2);
  });

  it('rejects CUSTOMER upsert without workspaceId', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    const r = await store.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: null,
      title: 'bogus',
      body: 'no workspace',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'CUSTOMER_REQUIRES_WORKSPACE');
  });

  it('rejects non-CUSTOMER upsert WITH workspaceId', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    const r = await store.upsert({
      contextKind: 'VERTICAL',
      workspaceId: WS_A,
      title: 'bogus',
      body: 'wrong shape',
      verticalSlug: 'real-estate',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.code, 'NON_CUSTOMER_HAS_WORKSPACE');
  });

  it('verticalSlug filter limits results to that vertical', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    await store.upsert({
      contextKind: 'VERTICAL',
      workspaceId: null,
      title: 'realty hero',
      body: 'broker coordination work',
      verticalSlug: 'real-estate',
    });
    await store.upsert({
      contextKind: 'VERTICAL',
      workspaceId: null,
      title: 'cpa hero',
      body: 'tax practice coordination work',
      verticalSlug: 'cpa',
    });
    const r = await store.search({
      query: 'coordination work',
      k: 10,
      contextKinds: ['VERTICAL'],
      verticalSlug: 'cpa',
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(r.value.length >= 1);
    for (const hit of r.value) assert.equal(hit.verticalSlug, 'cpa');
  });
});

// ── Seed assembly ───────────────────────────────────────────────────────

describe('seed assembly', () => {
  it('builds the expected SKILL / VERTICAL / COMPLIANCE buckets', () => {
    const a = buildSeedAssembly();
    // 5 PR-C value-loop skill docs + 5 architecture-doc chunks (from
    // docs/skills-architecture.md + docs/knowledge-substrate.md).
    assert.equal(a.skill.length, 10);
    assert.ok(a.vertical.length >= 50); // 10 verticals × ~5 chunks each + per-role jtbd synthesis
    assert.ok(a.compliance.length >= 5);
    for (const r of a.skill) {
      assert.equal(r.contextKind, 'SKILL');
      assert.equal(r.workspaceId ?? null, null);
      // SKILL rows now come from two sourceTypes: `skill_doc` (sourceId
      // `skill:*`) and `architecture-doc` (sourceId `architecture:*`).
      assert.ok(
        r.sourceId?.startsWith('skill:') || r.sourceId?.startsWith('architecture:'),
        `unexpected skill sourceId: ${r.sourceId}`,
      );
    }
    for (const r of a.vertical) {
      assert.equal(r.contextKind, 'VERTICAL');
      // VERTICAL rows come from two sourceTypes: `vertical_content`
      // (sourceId `vertical:*`) and `jtbd` (sourceId `jtbd:*`).
      assert.ok(
        r.sourceId?.startsWith('vertical:') || r.sourceId?.startsWith('jtbd:'),
        `unexpected vertical sourceId: ${r.sourceId}`,
      );
      assert.ok(r.verticalSlug && r.verticalSlug.length > 0);
    }
    for (const r of a.compliance) {
      assert.equal(r.contextKind, 'COMPLIANCE');
      // Two sourceId prefixes: original `compliance:*` real-estate
      // fixtures + new per-vertical sentinel rules (sourceType
      // `compliance-corpus`, sourceId `<vertical>:<ruleId>`).
      assert.ok(r.sourceId !== undefined && r.sourceId.length > 0);
    }
    // Diagnostics should be populated.
    assert.ok(a.diagnostics.skippedUnverifiedCompliance >= 0);
  });

  it('SEED_COUNTS matches the assembly', () => {
    const a = buildSeedAssembly();
    assert.equal(SEED_COUNTS.SKILL, a.skill.length);
    assert.equal(SEED_COUNTS.VERTICAL, a.vertical.length);
    assert.equal(SEED_COUNTS.COMPLIANCE, a.compliance.length);
    assert.equal(SEED_COUNTS.CUSTOMER, 0);
    assert.equal(SEED_COUNTS.CROSS_CUSTOMER, 0);
  });

  it('seeds round-trip through the test store', async () => {
    const { store } = freshStore();
    store.setContext(TEST_OPERATOR_CONTEXT);
    const a = buildSeedAssembly();
    const coordinateRow = a.skill.find((r) => r.sourceId === 'skill:coordinate');
    assert.ok(coordinateRow, 'coordinate skill row missing from seed assembly');
    for (const row of a.skill) {
      const r = await store.upsert(row);
      if (!r.ok) {
        assert.fail(
          `upsert failed for sourceId=${row.sourceId}: [${r.error.code}] ${r.error.message}`,
        );
      }
    }
    // Query with the exact body text of the coordinate skill so the test
    // embedder produces an identical vector → that doc lands first by
    // construction.
    const search = await store.search({
      query: coordinateRow!.body,
      k: 3,
      contextKinds: ['SKILL'],
    });
    assert.ok(search.ok);
    if (!search.ok) return;
    assert.ok(search.value.length >= 1);
    assert.equal(search.value[0].title.toLowerCase().includes('coordinate'), true);
    assert.ok(search.value[0].similarity > 0.99);
  });
});

// ── MCP route handler ───────────────────────────────────────────────────

interface RouteResult {
  status: number;
  body: unknown;
}

async function callMcpRoute(opts: {
  envOverrides?: Record<string, string | undefined>;
  body: unknown;
  headers?: Record<string, string>;
  /** When true, reset the embedder/store cache before this call. Defaults
   *  to false — the route tests rely on the store keeping state across
   *  multiple calls inside one test case. */
  resetCachesFirst?: boolean;
}): Promise<RouteResult> {
  const prev: Record<string, string | undefined> = {};
  const overrides = opts.envOverrides ?? {};
  for (const k of Object.keys(overrides)) {
    prev[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    if (opts.resetCachesFirst) {
      const { resetEmbeddingProviderForTests, resetKnowledgeStoreForTests } = await import(
        '@/lib/knowledge'
      );
      resetEmbeddingProviderForTests();
      resetKnowledgeStoreForTests();
    }
    const mod = await import('@/app/api/knowledge/mcp/route');
    const req = new Request('http://localhost/api/knowledge/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify(opts.body),
    });
    const res = await mod.POST(req as unknown as Parameters<typeof mod.POST>[0]);
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } finally {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

describe('app/api/knowledge/mcp route', () => {
  const baseEnv = {
    KNOWLEDGE_STORE: 'test',
    KNOWLEDGE_EMBEDDING_PROVIDER: 'test',
    MCP_API_KEY: 'test-mcp-key',
  };

  beforeEach(async () => {
    const { resetKnowledgeStoreForTests, resetEmbeddingProviderForTests } = await import(
      '@/lib/knowledge'
    );
    resetKnowledgeStoreForTests();
    resetEmbeddingProviderForTests();
  });

  it('returns 503 when MCP_API_KEY is unset', async () => {
    const r = await callMcpRoute({
      envOverrides: { ...baseEnv, MCP_API_KEY: undefined },
      body: { jsonrpc: '2.0', method: 'knowledge.search', params: { query: 'x' }, id: 1 },
      headers: { 'x-agentplain-mcp-key': 'whatever' },
    });
    assert.equal(r.status, 503);
  });

  it('returns 401 when MCP key header is wrong', async () => {
    const r = await callMcpRoute({
      envOverrides: baseEnv,
      body: { jsonrpc: '2.0', method: 'knowledge.search', params: { query: 'x' }, id: 1 },
      headers: { 'x-agentplain-mcp-key': 'wrong' },
    });
    assert.equal(r.status, 401);
  });

  it('returns -32700 on malformed JSON', async () => {
    const prev = process.env.MCP_API_KEY;
    process.env.MCP_API_KEY = baseEnv.MCP_API_KEY;
    process.env.KNOWLEDGE_STORE = baseEnv.KNOWLEDGE_STORE;
    process.env.KNOWLEDGE_EMBEDDING_PROVIDER = baseEnv.KNOWLEDGE_EMBEDDING_PROVIDER;
    try {
      const { resetEmbeddingProviderForTests, resetKnowledgeStoreForTests } = await import(
        '@/lib/knowledge'
      );
      resetEmbeddingProviderForTests();
      resetKnowledgeStoreForTests();
      const mod = await import('@/app/api/knowledge/mcp/route');
      const req = new Request('http://localhost/api/knowledge/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-agentplain-mcp-key': 'test-mcp-key',
        },
        body: 'not json',
      });
      const res = await mod.POST(req as unknown as Parameters<typeof mod.POST>[0]);
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: number } };
      assert.equal(body.error.code, -32700);
    } finally {
      if (prev === undefined) delete process.env.MCP_API_KEY;
      else process.env.MCP_API_KEY = prev;
    }
  });

  it('returns -32600 on invalid JSON-RPC envelope', async () => {
    const r = await callMcpRoute({
      envOverrides: baseEnv,
      body: { method: 'knowledge.search' }, // missing jsonrpc
      headers: { 'x-agentplain-mcp-key': 'test-mcp-key' },
    });
    assert.equal(r.status, 400);
    const body = r.body as { error: { code: number } };
    assert.equal(body.error.code, -32600);
  });

  it('returns -32601 on unknown method', async () => {
    const r = await callMcpRoute({
      envOverrides: baseEnv,
      body: { jsonrpc: '2.0', method: 'knowledge.bogus', params: {}, id: 1 },
      headers: { 'x-agentplain-mcp-key': 'test-mcp-key' },
    });
    assert.equal(r.status, 404);
    const body = r.body as { error: { code: number } };
    assert.equal(body.error.code, -32601);
  });

  it('returns -32602 on invalid params', async () => {
    const r = await callMcpRoute({
      envOverrides: baseEnv,
      body: { jsonrpc: '2.0', method: 'knowledge.search', params: {}, id: 1 },
      headers: { 'x-agentplain-mcp-key': 'test-mcp-key' },
    });
    assert.equal(r.status, 400);
    const body = r.body as { error: { code: number } };
    assert.equal(body.error.code, -32602);
  });

  it('upsert + search round-trip through the route', async () => {
    const body = 'agentplain replaces broker-owner coordination work and drafts replies.';
    const up = await callMcpRoute({
      envOverrides: baseEnv,
      body: {
        jsonrpc: '2.0',
        method: 'knowledge.upsert',
        params: {
          contextKind: 'VERTICAL',
          title: 'Realty value loop',
          body,
          verticalSlug: 'real-estate',
        },
        id: 1,
      },
      headers: { 'x-agentplain-mcp-key': 'test-mcp-key' },
    });
    assert.equal(up.status, 200, `upsert body: ${JSON.stringify(up.body)}`);
    const upBody = up.body as { result: { id: string; documentId: string; created: boolean } };
    assert.equal(upBody.result.created, true);

    const search = await callMcpRoute({
      envOverrides: baseEnv,
      // Exact-text query → identical vector under the deterministic test
      // embedder → similarity ≈ 1.0. Same caveat as the in-memory test:
      // semantically-similar-but-different-text is not geometrically close
      // when the embedder is hash-derived.
      body: {
        jsonrpc: '2.0',
        method: 'knowledge.search',
        params: { query: body, k: 3, contextKinds: ['VERTICAL'] },
        id: 2,
      },
      headers: { 'x-agentplain-mcp-key': 'test-mcp-key' },
    });
    assert.equal(search.status, 200, `search body: ${JSON.stringify(search.body)}`);
    const sBody = search.body as { result: { hits: Array<{ title: string; verticalSlug: string }> } };
    assert.ok(sBody.result.hits.length >= 1, `expected hits; got ${JSON.stringify(sBody)}`);
    assert.equal(sBody.result.hits[0].title, 'Realty value loop');
    assert.equal(sBody.result.hits[0].verticalSlug, 'real-estate');

    const del = await callMcpRoute({
      envOverrides: baseEnv,
      body: {
        jsonrpc: '2.0',
        method: 'knowledge.delete',
        params: { documentId: upBody.result.documentId },
        id: 3,
      },
      headers: { 'x-agentplain-mcp-key': 'test-mcp-key' },
    });
    assert.equal(del.status, 200);
    const dBody = del.body as { result: { deleted: number } };
    assert.equal(dBody.result.deleted, 1);
  });

  it('CUSTOMER upsert requires x-agentplain-workspace-id', async () => {
    const r = await callMcpRoute({
      envOverrides: baseEnv,
      body: {
        jsonrpc: '2.0',
        method: 'knowledge.upsert',
        params: {
          contextKind: 'CUSTOMER',
          title: 'Customer note',
          body: 'workspace-scoped note',
        },
        id: 1,
      },
      headers: { 'x-agentplain-mcp-key': 'test-mcp-key' },
    });
    assert.equal(r.status, 400);
    const body = r.body as { error: { code: number; message: string } };
    assert.equal(body.error.code, -32602);
    assert.ok(body.error.message.toLowerCase().includes('workspace'));
  });

  it('CUSTOMER upsert with workspace header succeeds; workspace-scoped search isolates results', async () => {
    const upA = await callMcpRoute({
      envOverrides: baseEnv,
      body: {
        jsonrpc: '2.0',
        method: 'knowledge.upsert',
        params: {
          contextKind: 'CUSTOMER',
          title: 'WS-A note',
          body: 'workspace A pipeline detail',
        },
        id: 1,
      },
      headers: {
        'x-agentplain-mcp-key': 'test-mcp-key',
        'x-agentplain-workspace-id': WS_A,
      },
    });
    assert.equal(upA.status, 200);

    const upB = await callMcpRoute({
      envOverrides: baseEnv,
      body: {
        jsonrpc: '2.0',
        method: 'knowledge.upsert',
        params: {
          contextKind: 'CUSTOMER',
          title: 'WS-B note',
          body: 'workspace B pipeline detail',
        },
        id: 2,
      },
      headers: {
        'x-agentplain-mcp-key': 'test-mcp-key',
        'x-agentplain-workspace-id': WS_B,
      },
    });
    assert.equal(upB.status, 200);

    // Customer A's search sees A but not B.
    const search = await callMcpRoute({
      envOverrides: baseEnv,
      body: {
        jsonrpc: '2.0',
        method: 'knowledge.search',
        params: { query: 'pipeline detail', k: 10, contextKinds: ['CUSTOMER'] },
        id: 3,
      },
      headers: {
        'x-agentplain-mcp-key': 'test-mcp-key',
        'x-agentplain-workspace-id': WS_A,
      },
    });
    assert.equal(search.status, 200);
    const sBody = search.body as { result: { hits: Array<{ title: string; workspaceId: string }> } };
    const titles = sBody.result.hits.map((h) => h.title);
    assert.ok(titles.includes('WS-A note'));
    assert.ok(!titles.includes('WS-B note'));
    for (const hit of sBody.result.hits) assert.equal(hit.workspaceId, WS_A);
  });
});
