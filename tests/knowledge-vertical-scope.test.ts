/**
 * tests/knowledge-vertical-scope.test.ts
 *
 * The customer chat retrieves from a corpus that is SHARED ACROSS EVERY
 * VERTICAL. `searchKnowledge` passed `workspaceId`, which does nothing to
 * constrain it: every VERTICAL-kind row and every vertical-tagged
 * COMPLIANCE rule is written with `workspaceId: null` on purpose (the
 * shared substrate), so the tenant predicate never touches them. A
 * real-estate customer could therefore ask the chat about CPA and get
 * CPA's claims, ROI math and Circular 230 corpus back — including claims
 * for verticals nobody is maintaining.
 *
 * THE SCOPE HAS TO BE SOFT, AND THAT IS THE WHOLE DESIGN PROBLEM.
 * `KnowledgeSearchInput.verticalSlug` already existed, but it EXCLUDES
 * NULL-vertical rows. Passing it here would have dropped the entire
 * cross-vertical substrate — pricing, the support model, product
 * doctrine, the SKILL corpus, and the state / professional-body
 * compliance rules — leaving a customer's own pricing answer ungrounded.
 * That is the same defect in mirror image: it would have looked like a
 * fix, measured as "retrieval is now scoped", and broken the surface.
 * So the fix adds `verticalScope`, whose semantics are exactly those of
 * `jurisdictions`: NULL-vertical rows are ALWAYS eligible; a row that
 * declares a vertical must match.
 *
 * These tests therefore assert BOTH directions. A change that scopes too
 * little fails the leak tests; a change that scopes too much fails the
 * substrate tests. Passing one direction only is not a fix.
 *
 * Coverage is asserted, not assumed — `examined N of M`, failing when N
 * is zero, because a corpus built by a helper that silently returns []
 * would otherwise make every assertion below vacuously green.
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

const REPO_ROOT = path.resolve(process.cwd());

/** Rows the chat corpus actually contains, in miniature. Each row states
 *  which vertical (if any) owns it — that is the fact under test. */
const CORPUS: ReadonlyArray<{
  sourceId: string;
  contextKind: 'VERTICAL' | 'COMPLIANCE' | 'SKILL';
  verticalSlug: string | null;
  title: string;
  body: string;
}> = [
  {
    sourceId: 'vertical:real-estate:roi',
    contextKind: 'VERTICAL',
    verticalSlug: 'real-estate',
    title: 'Real estate — ROI math',
    body: 'coordination hours recovered for a brokerage owner',
  },
  {
    sourceId: 'vertical:real-estate:claims',
    contextKind: 'VERTICAL',
    verticalSlug: 'real-estate',
    title: 'Real estate — claims',
    body: 'buyer inquiry routing and showing scheduling claims',
  },
  {
    sourceId: 'vertical:cpa:roi',
    contextKind: 'VERTICAL',
    verticalSlug: 'cpa',
    title: 'CPA — ROI math',
    body: 'document chase consumes the front office for eight weeks a year',
  },
  {
    sourceId: 'vertical:home-services:claims',
    contextKind: 'VERTICAL',
    verticalSlug: 'home-services',
    title: 'Home services — claims',
    body: 'estimate follow-up claims for a home services operator',
  },
  {
    sourceId: 'compliance:fha-advertising-words',
    contextKind: 'COMPLIANCE',
    verticalSlug: 'real-estate',
    title: 'Fair Housing Act advertising words',
    body: 'HUD enumerated phrases that may not appear in listing advertising',
  },
  {
    sourceId: 'compliance:circular-230',
    contextKind: 'COMPLIANCE',
    verticalSlug: 'cpa',
    title: 'Treasury Circular 230',
    body: 'preparer conduct standards before the IRS',
  },
  // ── Cross-vertical substrate. NULL vertical. MUST survive scoping. ──
  {
    sourceId: 'doctrine:pricing',
    contextKind: 'SKILL',
    verticalSlug: null,
    title: 'Pricing',
    body: 'one flat monthly price, the same for every customer and every vertical',
  },
  {
    sourceId: 'doctrine:support-model',
    contextKind: 'SKILL',
    verticalSlug: null,
    title: 'Partner support',
    body: 'priority email and chat plus a quarterly check-in, no reserved hours',
  },
  {
    sourceId: 'compliance:ga-state-rules',
    contextKind: 'COMPLIANCE',
    verticalSlug: null,
    title: 'Georgia state corpus',
    body: 'state level rules that are not owned by any single vertical',
  },
];

const VERTICAL_OWNED = CORPUS.filter((r) => r.verticalSlug !== null);
const CROSS_VERTICAL = CORPUS.filter((r) => r.verticalSlug === null);

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
  resetKnowledgeStoreForTests();
});

/** Seed the miniature corpus and RETURN THE COUNT ACTUALLY WRITTEN. The
 *  count is asserted by callers: a helper that silently wrote nothing is
 *  the way this whole file goes vacuously green. */
async function seedCorpus(): Promise<number> {
  const store = testStore();
  let written = 0;
  for (const row of CORPUS) {
    const res = await store.upsert({
      contextKind: row.contextKind,
      workspaceId: null,
      title: row.title,
      body: row.body,
      verticalSlug: row.verticalSlug,
      sourceType: 'vertical-scope-fixture',
      sourceId: row.sourceId,
    });
    assert.ok(res.ok, `seed failed for ${row.sourceId}`);
    written += 1;
  }
  return written;
}

beforeEach(() => {
  resetKnowledgeStoreForTests();
});

async function searchScoped(verticalScope: string | null) {
  const store = testStore();
  const res = await store.search({
    query: 'claims roi compliance pricing',
    // k well above the corpus size so FILTERING, not ranking, decides
    // what comes back. A k at or below corpus size would let a ranking
    // change mimic a scoping change.
    k: 100,
    contextKinds: ['SKILL', 'CUSTOMER', 'VERTICAL', 'COMPLIANCE'],
    verticalScope,
  });
  assert.ok(res.ok, 'search failed');
  return res.value;
}

describe('knowledge vertical scope — a customer cannot reach another vertical', () => {
  it('seeds a corpus that actually contains both directions', async () => {
    const written = await seedCorpus();
    assert.equal(written, CORPUS.length, 'seed wrote fewer rows than the fixture declares');
    assert.ok(VERTICAL_OWNED.length > 0, 'examined 0 vertical-owned rows — fixture is empty');
    assert.ok(CROSS_VERTICAL.length > 0, 'examined 0 cross-vertical rows — fixture is empty');
  });

  it('scoping to real-estate returns NO other vertical\'s rows', async () => {
    const written = await seedCorpus();
    assert.equal(written, CORPUS.length);

    const hits = await searchScoped('real-estate');
    assert.ok(hits.length > 0, 'examined 0 hits — scope returned nothing at all');

    const foreign = hits.filter(
      (h) => h.verticalSlug !== null && h.verticalSlug !== 'real-estate',
    );
    assert.deepEqual(
      foreign.map((h) => `${h.verticalSlug}:${h.title}`),
      [],
      'a real-estate customer retrieved another vertical\'s content',
    );

    const otherVerticals = VERTICAL_OWNED.filter((r) => r.verticalSlug !== 'real-estate');
    assert.ok(
      otherVerticals.length > 0,
      'examined 0 foreign-vertical rows — this assertion proves nothing',
    );
  });

  it('scoping to cpa returns NO real-estate rows either (not a one-way rule)', async () => {
    await seedCorpus();
    const hits = await searchScoped('cpa');
    assert.ok(hits.length > 0, 'examined 0 hits');
    const foreign = hits.filter((h) => h.verticalSlug !== null && h.verticalSlug !== 'cpa');
    assert.deepEqual(foreign.map((h) => h.title), [], 'cpa customer reached another vertical');
  });

  it('the scoped customer STILL gets their own vertical\'s rows', async () => {
    await seedCorpus();
    const hits = await searchScoped('real-estate');
    const own = hits.filter((h) => h.verticalSlug === 'real-estate').map((h) => h.title).sort();
    const expected = VERTICAL_OWNED.filter((r) => r.verticalSlug === 'real-estate')
      .map((r) => r.title)
      .sort();
    assert.ok(expected.length > 0, 'examined 0 own-vertical rows');
    assert.deepEqual(own, expected, 'scoping dropped the customer\'s own vertical content');
  });
});

describe('knowledge vertical scope — the mirror-image failure', () => {
  it('cross-vertical substrate survives scoping (soft, not hard)', async () => {
    await seedCorpus();
    const hits = await searchScoped('real-estate');
    const shared = hits.filter((h) => h.verticalSlug === null).map((h) => h.title).sort();
    const expected = CROSS_VERTICAL.map((r) => r.title).sort();
    assert.ok(expected.length > 0, 'examined 0 cross-vertical rows');
    assert.deepEqual(
      shared,
      expected,
      'scoping used HARD semantics and dropped pricing / support / doctrine — ' +
        'this trades a leak for an ungrounded customer answer',
    );
  });

  it('a null scope is unfiltered (operator + corpus-maintenance path)', async () => {
    await seedCorpus();
    const hits = await searchScoped(null);
    assert.equal(hits.length, CORPUS.length, 'null scope must not filter anything');
  });
});

// ── Call-site and store pins ─────────────────────────────────────────────
//
// The behavioural tests above run against TestKnowledgeStore. They prove
// the SEMANTICS are right; they cannot prove the production path passes
// the scope, nor that the SQL keeps the qual. Both were revertible one
// line at a time, which is exactly how the tenant predicate regressed
// before (tests/pgvector-tenant-scope-callsites.test.ts). Pin both.

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('knowledge vertical scope — production wiring', () => {
  it('chat route passes verticalScope into store.search', () => {
    const file = path.join(REPO_ROOT, 'app', 'api', 'chat', 'route.ts');
    const src = stripComments(readFileSync(file, 'utf8'));

    const fnStart = src.indexOf('async function searchKnowledge');
    assert.ok(fnStart > -1, 'searchKnowledge not found in app/api/chat/route.ts');
    const callStart = src.indexOf('store.search({', fnStart);
    assert.ok(callStart > -1, 'store.search({...}) not found inside searchKnowledge');
    const callEnd = src.indexOf('});', callStart);
    assert.ok(callEnd > callStart, 'could not delimit the store.search call');
    const call = src.slice(callStart, callEnd);

    // Positive control: we located a real call, not an empty slice.
    assert.match(call, /contextKinds:/, 'located slice does not look like the search call');
    assert.match(
      call,
      /verticalScope\b/,
      'chat route must scope knowledge retrieval by vertical:\n' + call,
    );
    // And the HARD filter must not be what is passed here — it would
    // drop the cross-vertical substrate.
    assert.doesNotMatch(
      call,
      /verticalSlug:/,
      'chat route must use the SOFT verticalScope, not the hard verticalSlug filter',
    );
  });

  it('the chat route resolves the vertical BEFORE searching', () => {
    const file = path.join(REPO_ROOT, 'app', 'api', 'chat', 'route.ts');
    const src = stripComments(readFileSync(file, 'utf8'));
    const resolve = src.indexOf('verticalSlugFromEnum(workspace.vertical)');
    const search = src.indexOf('searchKnowledge(ctx, latestQuestion');
    assert.ok(resolve > -1, 'vertical resolution not found');
    assert.ok(search > -1, 'searchKnowledge call not found');
    assert.ok(
      resolve < search,
      'the vertical must be resolved before searchKnowledge is called, ' +
        'otherwise the scope argument is always null and the gate is a no-op',
    );
  });

  it('pgvector SQL keeps the SOFT vertical qual', () => {
    const file = path.join(REPO_ROOT, 'lib', 'knowledge', 'pgvector-store.ts');
    const src = readFileSync(file, 'utf8');
    assert.match(
      src,
      /\$7::text IS NULL OR d\."verticalSlug" IS NULL OR d\."verticalSlug" = \$7::text/,
      'the soft vertical qual was removed or hardened in the pgvector scan',
    );
  });
});

// ── Coverage ─────────────────────────────────────────────────────────────

describe('knowledge vertical scope — coverage', () => {
  it('reports examined N of M and fails when N is zero', () => {
    const examinedVerticals = new Set(
      VERTICAL_OWNED.map((r) => r.verticalSlug as string),
    );
    const M = CORPUS.length;
    const N = VERTICAL_OWNED.length + CROSS_VERTICAL.length;

    assert.ok(N > 0, `examined ${N} of ${M} corpus rows — a zero corpus proves nothing`);
    assert.ok(
      examinedVerticals.size >= 2,
      `examined ${examinedVerticals.size} verticals — need at least 2 for a leak to be possible`,
    );
    assert.ok(
      CROSS_VERTICAL.length > 0,
      `examined ${CROSS_VERTICAL.length} cross-vertical rows — ` +
        'without one, the mirror-image failure cannot be detected',
    );
    assert.equal(N, M, `examined ${N} of ${M} corpus rows`);
  });
});
