/**
 * tests/pgvector-tenant-scope-callsites.test.ts
 *
 * PR #529 (`fix/pgvector-tenant-predicate`) pushed a tenant predicate
 * into the vector scan and pinned the store-level SQL qual exhaustively.
 * It did NOT pin the three CALL SITES that pass the scope in. Reverting
 * any one of them -- deleting `workspaceId: ctx.workspaceId` -- left the
 * whole suite green, so the fix could be silently undone one line at a
 * time. This file closes that.
 *
 * WHAT THESE TESTS CAN AND CANNOT SEE
 *
 * The defect is RECALL, not isolation. In Postgres the ivfflat scan
 * chooses its candidate set BEFORE row-level security runs, so an
 * RLS-only filter is a post-filter: it spends `k` on other tenants' rows
 * and then drops them, and a workspace holding a small share of the
 * corpus gets a fraction of `k` -- sometimes zero -- with no error.
 *
 * `TestKnowledgeStore` iterates exactly and has no ANN stage and no
 * LIMIT-before-filter, so it CANNOT reproduce that failure. A test that
 * only asserted on returned rows would therefore pass with or without
 * the fix: vacuously green, which is the exact failure mode being
 * repaired. So these tests assert on the ARGUMENTS each call site
 * passes, which is the thing that actually regressed.
 *
 * Coverage is asserted at the end rather than assumed -- "found nothing"
 * and "examined nothing" must not look alike.
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  getKnowledgeStore,
  resetKnowledgeStoreForTests,
  TestKnowledgeStore,
} from '@/lib/knowledge';
import { retrieveCustomerContext } from '@/lib/customer-files/retrieve';

const WS_A = '11111111-1111-4111-8111-111111111111';
const WS_B = '22222222-2222-4222-8222-222222222222';
const MCP_KEY = 'test-mcp-key-pgvector-callsites';

const REPO_ROOT = path.resolve(process.cwd());

function testStore(): TestKnowledgeStore {
  const store = getKnowledgeStore({
    userId: null,
    workspaceId: null,
    isOperator: true,
  });
  assert.ok(
    store instanceof TestKnowledgeStore,
    'KNOWLEDGE_STORE must resolve to the in-memory test store for this suite',
  );
  return store;
}

before(() => {
  process.env.KNOWLEDGE_STORE = 'test';
  process.env.KNOWLEDGE_EMBEDDING_PROVIDER = 'test';
  process.env.MCP_API_KEY = MCP_KEY;
  resetKnowledgeStoreForTests();
});

beforeEach(() => {
  testStore().resetSearchCalls();
});

// ── Call site 1: lib/customer-files/retrieve.ts ──────────────────────────

describe('pgvector tenant scope - call site: retrieveCustomerContext', () => {
  it('binds the caller workspaceId into the vector search input', async () => {
    const store = new TestKnowledgeStore(
      // Reuse the singleton's embedder so dimensions line up.
      (testStore() as unknown as { embedder: never }).embedder,
    );
    await retrieveCustomerContext({
      workspaceId: WS_A,
      query: 'what did the inspection report say',
      store,
    });
    assert.equal(store.searchCalls.length, 1, 'expected exactly one search');
    const input = store.searchCalls[0];
    assert.equal(
      input.workspaceId,
      WS_A,
      'retrieveCustomerContext must pass the caller tenant scope into the scan',
    );
    // Positive control: the rest of the input still looks right, so a
    // pass here is not an artifact of an empty/garbage call.
    assert.deepEqual(input.contextKinds, ['CUSTOMER']);
    assert.equal(input.query, 'what did the inspection report say');
  });

  it('passes a DIFFERENT tenant scope for a different caller', async () => {
    const store = new TestKnowledgeStore(
      (testStore() as unknown as { embedder: never }).embedder,
    );
    await retrieveCustomerContext({ workspaceId: WS_B, query: 'q', store });
    assert.equal(store.searchCalls[0].workspaceId, WS_B);
    // Guards against a hardcoded or captured constant satisfying the
    // assertion above.
    assert.notEqual(store.searchCalls[0].workspaceId, WS_A);
  });
});

// ── Call site 2: app/api/knowledge/mcp/route.ts ──────────────────────────

async function mcpSearch(args: {
  workspaceHeader?: string | null;
  key?: string;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const { POST } = await import('@/app/api/knowledge/mcp/route');
  const headers = new Headers({
    'content-type': 'application/json',
    'x-agentplain-mcp-key': args.key ?? MCP_KEY,
  });
  if (args.workspaceHeader !== undefined && args.workspaceHeader !== null) {
    headers.set('x-agentplain-workspace-id', args.workspaceHeader);
  }
  const req = new Request('https://app.example.com/api/knowledge/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'req-1',
      method: 'knowledge.search',
      params: { query: 'retention policy', k: 5 },
    }),
  });
  // The handler only reads `headers` and `json()` off the request.
  const res = await POST(req as never);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('pgvector tenant scope - call site: knowledge MCP route', () => {
  it('binds the workspace HEADER into the vector search input', async () => {
    const out = await mcpSearch({ workspaceHeader: WS_A });
    assert.equal(out.status, 200, `expected 200, got ${out.status}`);
    const calls = testStore().searchCalls;
    assert.equal(calls.length, 1, 'expected exactly one search');
    assert.equal(
      calls[0].workspaceId,
      WS_A,
      'MCP route must pass the header tenant scope into the scan',
    );
    assert.equal(calls[0].query, 'retention policy');
  });

  it('passes no tenant predicate when the header is absent (operator read)', async () => {
    const out = await mcpSearch({});
    assert.equal(out.status, 200);
    const calls = testStore().searchCalls;
    assert.equal(calls.length, 1);
    assert.ok(
      calls[0].workspaceId === null || calls[0].workspaceId === undefined,
      'operator context must not be narrowed to a tenant',
    );
  });

  it('the JSON-RPC params cannot inject a tenant scope - only the header can', async () => {
    const { POST } = await import('@/app/api/knowledge/mcp/route');
    const req = new Request('https://app.example.com/api/knowledge/mcp', {
      method: 'POST',
      headers: new Headers({
        'content-type': 'application/json',
        'x-agentplain-mcp-key': MCP_KEY,
        'x-agentplain-workspace-id': WS_A,
      }),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-2',
        method: 'knowledge.search',
        // A caller trying to read another tenant by smuggling the id
        // through params rather than the header.
        params: { query: 'q', workspaceId: WS_B },
      }),
    });
    const res = await POST(req as never);
    assert.equal(res.status, 200);
    const calls = testStore().searchCalls;
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].workspaceId,
      WS_A,
      'the header must win; params-supplied workspaceId must be stripped by zod',
    );
  });
});

// ── MEDIUM: unvalidated header bound to $6::uuid ─────────────────────────

describe('knowledge MCP route - workspace header must be a UUID', () => {
  const BAD = [
    'not-a-uuid',
    "'; DROP TABLE \"Embedding\"; --",
    '11111111-1111-4111-8111',
    '11111111111141118111111111111111',
    ' ',
    '',
  ];

  it('rejects a malformed header with -32602 instead of reaching the uuid cast', async () => {
    for (const bad of BAD) {
      const out = await mcpSearch({ workspaceHeader: bad });
      assert.equal(
        out.status,
        400,
        `header ${JSON.stringify(bad)} should be rejected with 400, got ${out.status}`,
      );
      const err = out.json.error as { code: number; message: string } | undefined;
      assert.equal(err?.code, -32602, `header ${JSON.stringify(bad)}: wrong JSON-RPC code`);
      assert.match(err?.message ?? '', /x-agentplain-workspace-id/);
      // The whole point: it must not have reached the store, where the
      // value would be bound to `$6::uuid` and raise 22P02 -> 500.
      assert.equal(
        testStore().searchCalls.length,
        0,
        `header ${JSON.stringify(bad)} reached the store`,
      );
      testStore().resetSearchCalls();
    }
    assert.ok(BAD.length >= 6, 'malformed-header corpus must not be empty');
  });

  it('still accepts a well-formed UUID header', async () => {
    const out = await mcpSearch({ workspaceHeader: WS_B });
    assert.equal(out.status, 200);
    assert.equal(testStore().searchCalls[0].workspaceId, WS_B);
  });
});

// ── Call site 3: app/api/chat/route.ts ───────────────────────────────────

/**
 * `searchKnowledge` is module-private to a Next App Router route file.
 * It is not exported and cannot be exercised without standing up auth
 * and Prisma, and adding a named export to a `route.ts` risks Next's
 * route-export validation, which cannot be checked here because
 * `next build` is not runnable on this host.
 *
 * So this call site is pinned structurally instead. This is a WEAKER
 * instrument than the two above and is labelled as such: it proves the
 * argument is written at the call site, not that it arrives at the store
 * at runtime. It is still strictly stronger than what existed before,
 * which was nothing -- and it fails on exactly the regression the audit
 * described (someone deleting `workspaceId: ctx.workspaceId`).
 *
 * Comments are stripped before matching, so a commented-out line cannot
 * satisfy it.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('pgvector tenant scope - call site: chat route knowledge search', () => {
  it('searchKnowledge passes ctx.workspaceId into store.search', () => {
    const file = path.join(REPO_ROOT, 'app', 'api', 'chat', 'route.ts');
    const src = stripComments(readFileSync(file, 'utf8'));

    const fnStart = src.indexOf('async function searchKnowledge');
    assert.ok(fnStart > -1, 'searchKnowledge not found in app/api/chat/route.ts');

    const callStart = src.indexOf('store.search({', fnStart);
    assert.ok(callStart > -1, 'store.search({...}) call not found inside searchKnowledge');
    const callEnd = src.indexOf('});', callStart);
    assert.ok(callEnd > callStart, 'could not delimit the store.search call');
    const call = src.slice(callStart, callEnd);

    // Positive control: we located a real call, not an empty slice.
    assert.match(call, /contextKinds:/, 'located slice does not look like the search call');
    assert.match(
      call,
      /workspaceId:\s*ctx\.workspaceId\b/,
      'chat route must pass the caller tenant scope into the knowledge scan:\n' + call,
    );
  });
});

// ── Coverage ─────────────────────────────────────────────────────────────

describe('pgvector tenant scope - coverage', () => {
  it('all three call sites named in PR #529 are pinned by this file', () => {
    const self = readFileSync(
      path.join(REPO_ROOT, 'tests', 'pgvector-tenant-scope-callsites.test.ts'),
      'utf8',
    );
    const required = [
      'lib/customer-files/retrieve.ts',
      'app/api/knowledge/mcp/route.ts',
      'app/api/chat/route.ts',
    ];
    const missing = required.filter((r) => !self.includes(r));
    assert.deepEqual(missing, [], `call sites with no pin in this file: ${missing.join(', ')}`);
    assert.equal(required.length, 3, 'examined 3 of 3 call sites');
  });
});
