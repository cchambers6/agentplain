/**
 * tests/knowledge-mcp-uuid.test.ts
 *
 * `knowledge.delete` id width.
 *
 * `app/api/knowledge/mcp/route.ts` guards the delete ids so that a value
 * Postgres cannot cast never reaches a `::uuid` cast and raises `22P02`.
 * That is the gate's ONLY job, so its accepted set must be Postgres's
 * accepted set -- 32 hex digits in 8-4-4-4-12 groups, case-insensitive --
 * and no narrower.
 *
 * `deleteParamsSchema` used `z.string().uuid()`, which is narrower: it
 * additionally enforces the RFC 9562 version and variant nibbles, which
 * the Postgres `uuid` type does not. So a legitimate delete of a row the
 * substrate had happily STORED came back 400. A validator narrower than
 * the thing it guards does not fail safe.
 *
 * This is the SAME defect already fixed for the workspace header a few
 * lines above it in that file, which is why the fix is to reuse the one
 * `workspaceUuidSchema` rather than write a second definition.
 *
 * Measured on `origin/main` (zod 4.4.3, whole tree at the ref): 169
 * occurrences, 54 distinct UUID literals, 33 of them (61%) refused by
 * `z.string().uuid()` and all 54 storable by Postgres.
 *
 * HOW THESE TESTS OBSERVE THE GATE
 *
 * Through the route's own `POST`, the way `tests/pgvector-tenant-scope-
 * callsites.test.ts` does -- not by importing the schema. A route module
 * should export only route fields (84 of 84 route.ts files on `main` do),
 * and the consumer-visible behaviour is the thing that regressed anyway:
 *
 *   accepted id  -> 200, and the store is reached (`deleted: 0`, because
 *                   this suite's store is empty -- the point is that the
 *                   GATE did not stop it)
 *   rejected id  -> 400 with JSON-RPC -32602, store never reached
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { getKnowledgeStore, resetKnowledgeStoreForTests, TestKnowledgeStore } from '@/lib/knowledge';

const MCP_KEY = 'test-mcp-key-knowledge-delete-uuid';

/** [value, acceptedByPostgres, why] */
const CASES: ReadonlyArray<readonly [string, boolean, string]> = [
  // --- ACCEPTED, and z.string().uuid() REFUSES them (the real pins) -----
  ['00000000-0000-0000-0000-00000000000a', true, 'version nibble 0, not nil'],
  ['a0eebc99-9c0b-6ef8-cbb6-6bb9bd380a11', true, 'version 6 + variant c'],
  ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true, 'version nibble a — on main today'],
  ['11111111-1111-1111-1111-111111111111', true, 'variant nibble 1 — on main today'],
  // --- ACCEPTED, but z.string().uuid() accepts them too (no pin value) --
  ['00000000-0000-0000-0000-000000000000', true, 'nil UUID — zod special-cases it'],
  ['a0eebc99-9c0b-1ef8-8bb6-6bb9bd380a11', true, 'v1-shaped — zod permits v1-v8'],
  ['ffffffff-ffff-ffff-ffff-ffffffffffff', true, 'max UUID — zod special-cases it'],
  ['3f2504e0-4f89-41d3-9a0c-0305e82c3301', true, 'canonical v4'],
  ['3F2504E0-4F89-41D3-9A0C-0305E82C3301', true, 'canonical v4, uppercase'],
  // --- must be REJECTED: Postgres cannot cast these ---------------------
  ['', false, 'empty string'],
  ['not-a-uuid', false, 'plain text'],
  ["'; DROP TABLE \"Embedding\"; --", false, 'sql fragment'],
  ['3f2504e0-4f89-41d3-9a0c-0305e82c330', false, 'one hex digit short'],
  ['3f2504e0-4f89-41d3-9a0c-0305e82c33011', false, 'one hex digit long'],
  ['3f2504e0-4f89-41d3-9a0c0305e82c3301', false, 'missing a group separator'],
  ['3f2504e0_4f89_41d3_9a0c_0305e82c3301', false, 'underscores, not hyphens'],
  ['3f2504e0-4f89-41d3-9a0c-0305e82c33zz', false, 'non-hex characters'],
  ['{3f2504e0-4f89-41d3-9a0c-0305e82c3301}', false, 'brace-wrapped form'],
  [' 3f2504e0-4f89-41d3-9a0c-0305e82c3301', false, 'leading whitespace'],
  ['3f2504e0-4f89-41d3-9a0c-0305e82c3301\n', false, 'trailing newline'],
];

function testStore(): TestKnowledgeStore {
  const store = getKnowledgeStore({ userId: null, workspaceId: null, isOperator: true });
  assert.ok(
    store instanceof TestKnowledgeStore,
    'KNOWLEDGE_STORE must resolve to the in-memory test store for this suite',
  );
  return store;
}

async function mcpDelete(
  params: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const { POST } = await import('@/app/api/knowledge/mcp/route');
  const req = new Request('https://app.example.com/api/knowledge/mcp', {
    method: 'POST',
    headers: new Headers({
      'content-type': 'application/json',
      'x-agentplain-mcp-key': MCP_KEY,
    }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 'del-1', method: 'knowledge.delete', params }),
  });
  const res = await POST(req as never);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

before(() => {
  process.env.KNOWLEDGE_STORE = 'test';
  process.env.KNOWLEDGE_EMBEDDING_PROVIDER = 'test';
  process.env.MCP_API_KEY = MCP_KEY;
  resetKnowledgeStoreForTests();
  // Fail loudly here rather than letting a real store make these
  // assertions mean something other than what they say.
  testStore();
});

describe('knowledge.delete — id gate matches Postgres, not RFC 9562', () => {
  it('accepts every id Postgres can cast and rejects every id it cannot', async () => {
    let examined = 0;
    for (const [value, accepted, why] of CASES) {
      for (const field of ['embeddingId', 'documentId'] as const) {
        const out = await mcpDelete({ [field]: value });
        if (accepted) {
          assert.equal(
            out.status,
            200,
            `${field} ${JSON.stringify(value)} (${why}) must reach the store, got ${out.status}`,
          );
        } else {
          assert.equal(
            out.status,
            400,
            `${field} ${JSON.stringify(value)} (${why}) must be refused, got ${out.status}`,
          );
          const err = out.json.error as { code: number } | undefined;
          assert.equal(err?.code, -32602, `${field} ${JSON.stringify(value)}: wrong JSON-RPC code`);
        }
      }
      examined++;
    }
    // "found nothing" and "examined nothing" must not look alike.
    assert.equal(examined, CASES.length);
    assert.ok(examined >= 20, `expected the full corpus, examined ${examined}`);
  });

  /**
   * Known-positive control on the CORPUS ITSELF.
   *
   * Every assertion above would still pass against a corpus containing
   * only values both validators agree on — green, and pinning nothing.
   * This asserts the corpus actually straddles the boundary, so the suite
   * cannot quietly stop discriminating if someone edits CASES.
   *
   * It matters here more than usual: on zod 4 `z.string().uuid()`
   * special-cases the nil and max UUIDs and permits version nibbles 1-8,
   * so the two obvious probes — the nil UUID and a v1-shaped id — BOTH
   * PASS under the narrow validator. A test built on those alone goes
   * green against the unfixed code. Verified by planting
   * `z.string().uuid()` back: the corpus test went red, a nil+v1
   * assertion stayed green.
   */
  it('the corpus contains values the narrow validator would have refused', () => {
    const narrow = z.string().uuid();
    const mustAccept = CASES.filter(([, accepted]) => accepted);
    const refusedByNarrow = mustAccept.filter(([v]) => !narrow.safeParse(v).success);
    assert.ok(
      refusedByNarrow.length >= 4,
      `corpus no longer discriminates: only ${refusedByNarrow.length} of ` +
        `${mustAccept.length} must-accept values are refused by z.string().uuid()`,
    );
  });

  it('a refused id never reaches the store', async () => {
    // The whole purpose of the gate. A malformed value must not be bound
    // to a `::uuid` cast, and a well-formed one must not be stopped short
    // of the store by a validator that was never asked to have an opinion.
    const out = await mcpDelete({ embeddingId: 'not-a-uuid' });
    assert.equal(out.status, 400);
    const ok = await mcpDelete({ embeddingId: '00000000-0000-0000-0000-00000000000a' });
    assert.equal(ok.status, 200);
    // Reached the store and found nothing, rather than being refused.
    const result = ok.json.result as { deleted?: number } | undefined;
    assert.equal(result?.deleted, 0);
  });

  it('still requires at least one of embeddingId / documentId', async () => {
    const out = await mcpDelete({});
    assert.equal(out.status, 400);
    assert.equal((out.json.error as { code: number } | undefined)?.code, -32602);
  });
});
