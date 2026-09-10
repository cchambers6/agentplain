/**
 * lib/knowledge/pgvector-search-scope.test.ts
 *
 * Pins the tenant predicate on the hottest query in the product:
 * `PgvectorKnowledgeStore.search`'s vector scan.
 *
 * Before this predicate existed, tenant scoping on that scan rested
 * ENTIRELY on the `embedding_read` RLS policy. RLS is applied as a
 * POST-filter: the ivfflat ANN scan picks candidates by distance across
 * the whole table, `LIMIT k` is taken, and only then are other tenants'
 * rows dropped. A workspace holding a small share of the corpus gets a
 * fraction of k -- sometimes zero -- and NO ERROR is raised. That is the
 * textbook pgvector post-filter recall failure, and it was live.
 *
 * Testing approach, and why it is falsifiable rather than tautological:
 * `withRls(ctx, fn, { client })` already accepts an injected client, so
 * the store can be driven with no database. `PostgresLikeClient` below
 * is a small row-store that behaves the way Postgres would:
 *
 *   1. it reads the WHERE clause of the SQL the store actually emitted
 *      and applies only the predicates that are DECLARED there,
 *   2. sorts by cosine distance and applies LIMIT k  (the ANN scan),
 *   3. and only THEN applies the RLS post-filter.
 *
 * Step 1 is what makes deleting the predicate from `pgvector-store.ts`
 * fail these tests: with the qual gone the fake stops filtering, k is
 * spent on foreign rows, the post-filter drops them, and the caller
 * silently receives fewer rows than it asked for -- exactly the
 * production symptom.
 *
 * Per feedback_runner_portability.md the same semantics are asserted
 * against the OTHER `IKnowledgeStore` implementation, since
 * `getKnowledgeStore` can return `TestKnowledgeStore` in a real
 * deployment (`KNOWLEDGE_STORE=test`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';

import { PgvectorKnowledgeStore } from './pgvector-store';
import { TestEmbeddingProvider } from './test-embedding';
import { TestKnowledgeStore } from './test-store';
import type { RlsContext } from '../db/rls';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

interface FakeRow {
  id: string;
  workspaceId: string | null;
  contextKind: string;
  verticalSlug: string | null;
  jurisdiction: string | null;
  title: string;
  /** Lower = closer. Stands in for the cosine distance the index computes. */
  distance: number;
}

/**
 * A Prisma-shaped client that models a Postgres + pgvector + RLS read.
 *
 * It deliberately does NOT know which predicates the store is supposed to
 * emit. It discovers them from the SQL it is handed, so the fake cannot
 * silently "pass" a store that stopped emitting one.
 */
class PostgresLikeClient {
  /** Every (sql, params) pair the store issued through $queryRawUnsafe. */
  queries: Array<{ sql: string; params: unknown[] }> = [];
  rlsCalls: Array<{ userId: string; workspaceId: string; isOperator: string }> = [];

  constructor(
    private readonly rows: FakeRow[],
    /** The workspace GUC the RLS policy compares against, i.e. the
     *  post-filter. Null = operator, sees everything. */
    private readonly rlsWorkspaceId: string | null,
  ) {}

  async $transaction<T>(cb: (tx: PostgresLikeClient) => Promise<T>): Promise<T> {
    return cb(this);
  }

  async $executeRawUnsafe(
    _sql: string,
    userId: string,
    workspaceId: string,
    isOperator: string,
  ): Promise<number> {
    this.rlsCalls.push({ userId, workspaceId, isOperator });
    return 0;
  }

  async $queryRawUnsafe<T>(sql: string, ...params: unknown[]): Promise<T> {
    this.queries.push({ sql, params });

    const k = Number(params[1]);
    const kindParamIdx = paramIndexFor(sql, /e\."contextKind"::text = ANY\(\$(\d+)::text\[\]\)/);
    const verticalParamIdx = paramIndexFor(sql, /d\."verticalSlug" = \$(\d+)::text/);
    const jurisdictionParamIdx = paramIndexFor(
      sql,
      /d\."jurisdiction" = ANY\(\$(\d+)::text\[\]\)/,
    );
    // The tenant qual. Matched with the column BARE -- a policy-style
    // `"workspaceId"::text = ...` would not match here, and would not be
    // sargable in production either.
    const workspaceParamIdx = paramIndexFor(sql, /e\."workspaceId" = \$(\d+)::uuid/);

    const kinds = kindParamIdx === null ? null : (params[kindParamIdx] as string[] | null);
    const vertical =
      verticalParamIdx === null ? null : (params[verticalParamIdx] as string | null);
    const jurisdictions =
      jurisdictionParamIdx === null ? null : (params[jurisdictionParamIdx] as string[] | null);
    const workspace =
      workspaceParamIdx === null ? null : (params[workspaceParamIdx] as string | null);

    // ---- 1 + 2. The scan: apply declared predicates, order, LIMIT k. ----
    const scanned = this.rows
      .filter((r) => (kinds === null ? true : kinds.includes(r.contextKind)))
      .filter((r) => (vertical === null ? true : r.verticalSlug === vertical))
      .filter((r) =>
        jurisdictions === null ? true : r.jurisdiction === null || jurisdictions.includes(r.jurisdiction),
      )
      .filter((r) => (workspace === null ? true : r.workspaceId === null || r.workspaceId === workspace))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k);

    // ---- 3. RLS, AFTER the limit. This is the post-filter. ----
    const visible = scanned.filter(
      (r) => this.rlsWorkspaceId === null || r.workspaceId === null || r.workspaceId === this.rlsWorkspaceId,
    );

    return visible.map((r) => ({
      embeddingId: r.id,
      documentId: `doc-${r.id}`,
      contextKind: r.contextKind,
      workspaceId: r.workspaceId,
      title: r.title,
      body: `body of ${r.title}`,
      sourceUrl: null,
      verticalSlug: r.verticalSlug,
      jurisdiction: r.jurisdiction,
      metadata: {},
      distance: r.distance,
    })) as T;
  }
}

/** Zero-based index into the rest-params array for `$N` in the SQL, or
 *  null when the predicate is not present in the query at all. */
function paramIndexFor(sql: string, pattern: RegExp): number | null {
  const m = sql.match(pattern);
  if (!m) return null;
  return Number(m[1]) - 1;
}

function storeOver(rows: FakeRow[], rlsWorkspaceId: string | null) {
  const client = new PostgresLikeClient(rows, rlsWorkspaceId);
  const ctx: RlsContext = {
    userId: 'user-1',
    workspaceId: rlsWorkspaceId,
    isOperator: rlsWorkspaceId === null,
  };
  const store = new PgvectorKnowledgeStore({
    embedder: new TestEmbeddingProvider(),
    rlsContext: ctx,
    client: client as unknown as PrismaClient,
  });
  return { store, client };
}

/**
 * A corpus where tenant A is a small minority: 20 of tenant B's CUSTOMER
 * rows are nearer the query than any of A's. This is the ordinary case
 * for a new customer on a shared table, not a contrived one.
 */
function crowdedCorpus(): FakeRow[] {
  const rows: FakeRow[] = [];
  for (let i = 0; i < 20; i += 1) {
    rows.push({
      id: `b-${i}`,
      workspaceId: TENANT_B,
      contextKind: 'CUSTOMER',
      verticalSlug: null,
      jurisdiction: null,
      title: `tenant B doc ${i}`,
      distance: 0.01 * i,
    });
  }
  for (let i = 0; i < 5; i += 1) {
    rows.push({
      id: `a-${i}`,
      workspaceId: TENANT_A,
      contextKind: 'CUSTOMER',
      verticalSlug: null,
      jurisdiction: null,
      title: `tenant A doc ${i}`,
      distance: 0.5 + 0.01 * i,
    });
  }
  rows.push({
    id: 'shared-0',
    workspaceId: null,
    contextKind: 'SKILL',
    verticalSlug: null,
    jurisdiction: null,
    title: 'shared skill row',
    distance: 0.9,
  });
  return rows;
}

describe('pgvector search - tenant predicate is bound into the scan', () => {
  it('emits a workspace qual with the cast on the PARAMETER, not the column', async () => {
    const { store, client } = storeOver(crowdedCorpus(), TENANT_A);
    await store.search({ query: 'anything', k: 5, workspaceId: TENANT_A });

    const sql = client.queries[0].sql;
    const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('ORDER BY'));

    assert.match(
      where,
      /e\."workspaceId" = \$\d+::uuid/,
      'search SQL must carry an explicit workspaceId predicate in its WHERE clause',
    );
    // Sargability: every RLS policy in this repo writes
    // `"workspaceId"::text = current_setting(...)`, casting the COLUMN.
    // That defeats every btree index and makes hash-partition pruning
    // impossible. The predicate we add must not repeat that mistake.
    assert.ok(
      !/"workspaceId"::text\s*=/.test(where),
      'the tenant qual must not cast the column (non-sargable; blocks index + partition pruning)',
    );
    // The shared substrate must stay reachable.
    assert.match(
      where,
      /e\."workspaceId" IS NULL/,
      'NULL-workspace rows (SKILL / VERTICAL / COMPLIANCE / CROSS_CUSTOMER) must stay eligible',
    );
  });

  it('binds the caller workspaceId as the last parameter', async () => {
    const { store, client } = storeOver(crowdedCorpus(), TENANT_A);
    await store.search({ query: 'anything', k: 5, workspaceId: TENANT_A });

    const { sql, params } = client.queries[0];
    const idx = paramIndexFor(sql, /e\."workspaceId" = \$(\d+)::uuid/);
    assert.notEqual(idx, null, 'workspace predicate must reference a bound parameter');
    assert.equal(params[idx as number], TENANT_A);
  });

  it('fills k with the caller tenant instead of losing slots to the RLS post-filter', async () => {
    const { store } = storeOver(crowdedCorpus(), TENANT_A);
    const res = await store.search({
      query: 'anything',
      k: 5,
      contextKinds: ['CUSTOMER'],
      workspaceId: TENANT_A,
    });
    assert.ok(res.ok);
    // THE REGRESSION THIS FILE EXISTS FOR. Drop the predicate from
    // pgvector-store.ts and this is 0, not 5: the scan spends all five
    // slots on tenant B's nearer rows and RLS deletes every one of them.
    assert.equal(
      res.value.length,
      5,
      'tenant A must get a full k of its own rows, not the leftovers of a global top-k',
    );
    assert.deepEqual(
      res.value.map((h) => h.workspaceId),
      [TENANT_A, TENANT_A, TENANT_A, TENANT_A, TENANT_A],
    );
  });

  it('demonstrates the defect: the same corpus starves the tenant with no workspaceId passed', async () => {
    const { store } = storeOver(crowdedCorpus(), TENANT_A);
    const res = await store.search({
      query: 'anything',
      k: 5,
      contextKinds: ['CUSTOMER'],
      // workspaceId deliberately omitted - the pre-fix call shape.
    });
    assert.ok(res.ok);
    // Not an error. Not a warning. Just nothing, which is why this ran
    // in production undetected.
    assert.equal(res.value.length, 0);
  });

  it('keeps the shared substrate eligible while scoping tenant rows', async () => {
    const { store } = storeOver(crowdedCorpus(), TENANT_A);
    const res = await store.search({ query: 'anything', k: 100, workspaceId: TENANT_A });
    assert.ok(res.ok);
    const ids = res.value.map((h) => h.embeddingId);
    assert.ok(ids.includes('shared-0'), 'SKILL row with NULL workspaceId must still match');
    assert.ok(!ids.some((id) => id.startsWith('b-')), 'no tenant B row may survive the scan');
    assert.equal(ids.filter((id) => id.startsWith('a-')).length, 5);
  });

  it('applies no tenant predicate for operator / corpus-maintenance callers', async () => {
    const { store, client } = storeOver(crowdedCorpus(), null);
    const res = await store.search({ query: 'anything', k: 100 });
    assert.ok(res.ok);
    const idx = paramIndexFor(client.queries[0].sql, /e\."workspaceId" = \$(\d+)::uuid/);
    assert.equal(client.queries[0].params[idx as number], null, 'omitted scope binds NULL');
    // 20 B + 5 A + 1 shared: an operator read is unchanged by this work.
    assert.equal(res.value.length, 26);
  });

  it('still seeds the RLS GUCs - the predicate is defense in depth, not a replacement', async () => {
    const { store, client } = storeOver(crowdedCorpus(), TENANT_A);
    await store.search({ query: 'anything', k: 5, workspaceId: TENANT_A });
    assert.equal(client.rlsCalls.length, 1);
    assert.equal(client.rlsCalls[0].workspaceId, TENANT_A);
  });
});

describe('TestKnowledgeStore parity - the second IKnowledgeStore impl', () => {
  // getKnowledgeStore() returns this store whenever KNOWLEDGE_STORE=test,
  // so a filter that exists in only one impl is a real divergence.
  async function seeded() {
    const s = new TestKnowledgeStore(new TestEmbeddingProvider());
    s.setContext({ workspaceId: null, isOperator: true });
    await s.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: TENANT_A,
      title: 'A doc',
      body: 'shared query text',
      sourceType: 'c',
      sourceId: 'a#0',
    });
    await s.upsert({
      contextKind: 'CUSTOMER',
      workspaceId: TENANT_B,
      title: 'B doc',
      body: 'shared query text',
      sourceType: 'c',
      sourceId: 'b#0',
    });
    await s.upsert({
      contextKind: 'SKILL',
      title: 'Skill doc',
      body: 'shared query text',
      sourceType: 'c',
      sourceId: 's#0',
    });
    return s;
  }

  it('scopes to the tenant and keeps NULL-workspace rows eligible', async () => {
    const s = await seeded();
    const res = await s.search({ query: 'shared query text', k: 50, workspaceId: TENANT_A });
    assert.ok(res.ok);
    assert.deepEqual(res.value.map((h) => h.title).sort(), ['A doc', 'Skill doc']);
  });

  it('applies no tenant predicate when workspaceId is omitted', async () => {
    const s = await seeded();
    const res = await s.search({ query: 'shared query text', k: 50 });
    assert.ok(res.ok);
    assert.equal(res.value.length, 3);
  });
});
