/**
 * lib/graph/__tests__/store-identity-and-tenancy.test.ts
 *
 * Three things this file pins, none of which had a test before:
 *
 *   A. IDENTITY. `InMemoryGraphStore` claims one row per
 *      (tenantId, typeSlug, naturalKey). It used to key on the exact
 *      string the caller passed, after `.trim()` and nothing else, so
 *      four spellings of one firm produced four rows while the store's
 *      own header cited the uniqueness as the reason it exposes no
 *      `create()`, and `graph-ledger-fetcher.nodesToLedger` cited it as
 *      the reason it runs no dedup pass.
 *
 *   B. TENANCY. Four guards carry the isolation for this layer and every
 *      one of them survived mutation green. Each has a test here, and
 *      each test was watched to fail with the guard removed before it
 *      was allowed to count.
 *
 *   C. THE DOCUMENTED CONTAINMENT INVARIANT in ../normalize.ts, which is
 *      false, and false in a wider class than the audit that found it
 *      described. Brute-forced below rather than asserted.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { naturalKeyFor } from '../normalize';
import { InMemoryGraphStore } from '../store';
import { PARTY_TYPE_SLUG } from '../types';
import type { NodeSpec } from '../types';

const TENANT_A = 'ws_alpha';
const TENANT_B = 'ws_beta';

function party(over: Partial<NodeSpec> & { naturalKey: string }): NodeSpec {
  return {
    tenantId: TENANT_A,
    typeSlug: PARTY_TYPE_SLUG,
    label: over.label ?? over.naturalKey,
    provenance: 'APPROVED',
    ...over,
  };
}

/**
 * The fixture the audit finding is about: one firm, four spellings that
 * differ only in case and whitespace. Passed to the store RAW - the
 * point is that the caller does not have to normalize.
 */
const FOUR_VARIANTS = [
  'Acme Holdings, LLC',
  'ACME HOLDINGS LLC',
  'Acme Holdings Llc',
  '  Acme  Holdings,  LLC  ',
] as const;

describe('InMemoryGraphStore identity', () => {
  it('four spellings of one party produce exactly ONE row', async () => {
    const store = new InMemoryGraphStore();
    for (const spelling of FOUR_VARIANTS) {
      await store.upsertEntity(party({ naturalKey: spelling, label: spelling }));
    }

    assert.equal(
      store.entityCount,
      1,
      `expected 1 row for 4 spellings of one firm, got ${store.entityCount}`,
    );
    const rows = await store.listEntities({ tenantId: TENANT_A });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].naturalKey, 'acme holdings');
  });

  it('getEntity finds that row by ANY of the four spellings', async () => {
    const store = new InMemoryGraphStore();
    const created = await store.upsertEntity(
      party({ naturalKey: FOUR_VARIANTS[0], label: FOUR_VARIANTS[0] }),
    );
    for (const spelling of FOUR_VARIANTS) {
      const found = await store.getEntity({
        tenantId: TENANT_A,
        typeSlug: PARTY_TYPE_SLUG,
        naturalKey: spelling,
      });
      assert.ok(found, `getEntity missed spelling ${JSON.stringify(spelling)}`);
      assert.equal(found.id, created.id);
    }
  });

  it('a repeat write under a different spelling corroborates rather than forks', async () => {
    // The payoff: `lastSeenAt` advancing is the store recording that a
    // second source saw the same firm. If the spellings forked, both
    // rows would look singly-sourced instead.
    let clock = new Date('2026-01-01T00:00:00Z');
    const store = new InMemoryGraphStore({ now: () => clock });
    const first = await store.upsertEntity(party({ naturalKey: FOUR_VARIANTS[0] }));
    clock = new Date('2026-02-01T00:00:00Z');
    const second = await store.upsertEntity(party({ naturalKey: FOUR_VARIANTS[1] }));

    assert.equal(store.entityCount, 1);
    assert.equal(second.id, first.id);
    assert.equal(second.firstSeenAt.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(second.lastSeenAt.toISOString(), '2026-02-01T00:00:00.000Z');
  });
});

describe('InMemoryGraphStore identity - the properties the design rests on', () => {
  it('naturalKeyFor is idempotent, so normalizing in the store breaks no caller', async () => {
    // `projections.partyNode` already calls naturalKeyFor before handing
    // the spec over. Applying it again in the store is only safe if it
    // is a no-op on an already-normalized key.
    const probes = [
      ...FOUR_VARIANTS,
      'Acme Holdings L.L.C.',
      'Acme Holdings & Co.',
      'The Company',
      'Smith v Jones',
      'pllc llc',
    ];
    for (const p of probes) {
      for (const slug of [PARTY_TYPE_SLUG, 'matter', 'document']) {
        const once = naturalKeyFor(slug, p);
        assert.equal(
          naturalKeyFor(slug, once),
          once,
          `naturalKeyFor not idempotent for [${slug}] ${JSON.stringify(p)}`,
        );
      }
    }
  });

  it('an unidentifiable key is still rejected rather than collapsing onto one row', async () => {
    const store = new InMemoryGraphStore();
    await assert.rejects(
      () => store.upsertEntity(party({ naturalKey: '...', label: 'punctuation only' })),
      /naturalKey is required and must be non-empty/,
    );
    assert.equal(store.entityCount, 0);
  });

  it('normalization does NOT merge across type slugs or tenants', async () => {
    const store = new InMemoryGraphStore();
    await store.upsertEntity(party({ naturalKey: 'Acme Holdings, LLC' }));
    await store.upsertEntity(
      party({ naturalKey: 'Acme Holdings, LLC', typeSlug: 'matter' }),
    );
    await store.upsertEntity(
      party({ naturalKey: 'Acme Holdings, LLC', tenantId: TENANT_B }),
    );
    assert.equal(store.entityCount, 3);
  });
});

/**
 * Two tenants, one node each, plus a legitimate same-tenant edge in each.
 * Every tenancy test below starts from this shape, so a guard that stops
 * filtering has something to leak.
 */
async function twoTenantFixture() {
  const store = new InMemoryGraphStore();
  const aClient = await store.upsertEntity(
    party({ tenantId: TENANT_A, naturalKey: 'Alpha Client', label: 'Alpha Client' }),
  );
  const aOpposing = await store.upsertEntity(
    party({ tenantId: TENANT_A, naturalKey: 'Alpha Opposing', label: 'Alpha Opposing' }),
  );
  const bClient = await store.upsertEntity(
    party({ tenantId: TENANT_B, naturalKey: 'Beta Client', label: 'Beta Client' }),
  );
  const bOpposing = await store.upsertEntity(
    party({ tenantId: TENANT_B, naturalKey: 'Beta Opposing', label: 'Beta Opposing' }),
  );
  await store.upsertEdge({
    tenantId: TENANT_A,
    fromEntityId: aClient.id,
    relType: 'adverse_to',
    toEntityId: aOpposing.id,
    provenance: 'APPROVED',
  });
  await store.upsertEdge({
    tenantId: TENANT_B,
    fromEntityId: bClient.id,
    relType: 'adverse_to',
    toEntityId: bOpposing.id,
    provenance: 'APPROVED',
  });
  return { store, aClient, aOpposing, bClient, bOpposing };
}

describe('InMemoryGraphStore tenant isolation', () => {
  it('GUARD 1: upsertEdge refuses a fromEntityId belonging to another tenant', async () => {
    const { store, aClient, bOpposing } = await twoTenantFixture();
    const before = store.edgeCount;
    // Tenant B tries to anchor an edge on tenant A's node. Node ids are
    // opaque, so without the guard this is a cross-tenant read primitive:
    // link it in, then traverse to it.
    await assert.rejects(
      () =>
        store.upsertEdge({
          tenantId: TENANT_B,
          fromEntityId: aClient.id,
          relType: 'adverse_to',
          toEntityId: bOpposing.id,
          provenance: 'APPROVED',
        }),
      /fromEntityId .* is not a node in tenant ws_beta/,
    );
    assert.equal(store.edgeCount, before, 'a refused edge must not be stored');
  });

  it('GUARD 1b: upsertEdge refuses a toEntityId belonging to another tenant', async () => {
    const { store, aOpposing, bClient } = await twoTenantFixture();
    const before = store.edgeCount;
    await assert.rejects(
      () =>
        store.upsertEdge({
          tenantId: TENANT_B,
          fromEntityId: bClient.id,
          relType: 'adverse_to',
          toEntityId: aOpposing.id,
          provenance: 'APPROVED',
        }),
      /toEntityId .* is not a node in tenant ws_beta/,
    );
    assert.equal(store.edgeCount, before, 'a refused edge must not be stored');
  });
});

describe('InMemoryGraphStore tenant isolation - read paths', () => {
  it('GUARD 2: listEntities returns only the querying tenant rows', async () => {
    const { store } = await twoTenantFixture();
    const a = await store.listEntities({ tenantId: TENANT_A });
    // Assert on identity, not just on count: a filter that returned the
    // right NUMBER of wrong rows would pass a length-only check.
    assert.deepEqual(
      a.map((n) => n.label).sort(),
      ['Alpha Client', 'Alpha Opposing'],
    );
    assert.ok(
      a.every((n) => n.tenantId === TENANT_A),
      'listEntities leaked a row from another tenant',
    );

    const typed = await store.listEntities({
      tenantId: TENANT_A,
      typeSlug: PARTY_TYPE_SLUG,
    });
    assert.equal(typed.length, 2);
    assert.ok(typed.every((n) => n.tenantId === TENANT_A));

    // Coverage: the fixture really does hold other-tenant rows, so a
    // green result here cannot mean "there was nothing to leak".
    assert.equal(store.entityCount, 4);
  });

  it('GUARD 3: listEdges returns only the querying tenant edges', async () => {
    const { store, aClient } = await twoTenantFixture();
    const a = await store.listEdges({ tenantId: TENANT_A });
    assert.equal(a.length, 1);
    assert.ok(
      a.every((e) => e.tenantId === TENANT_A),
      'listEdges leaked an edge from another tenant',
    );
    assert.equal(a[0].fromEntityId, aClient.id);

    const byRel = await store.listEdges({ tenantId: TENANT_A, relType: 'adverse_to' });
    assert.equal(byRel.length, 1);
    assert.ok(byRel.every((e) => e.tenantId === TENANT_A));

    assert.equal(store.edgeCount, 2, 'fixture must hold a foreign edge to leak');
  });

  it('GUARD 4: getEntityById re-checks the tenant on the way out', async () => {
    const { store, aClient, bClient } = await twoTenantFixture();
    // The id is valid and the row exists; only the tenant is wrong.
    assert.equal(
      await store.getEntityById({ tenantId: TENANT_B, id: aClient.id }),
      null,
      'getEntityById returned another tenant node by id',
    );
    assert.equal(
      await store.getEntityById({ tenantId: TENANT_A, id: bClient.id }),
      null,
      'getEntityById returned another tenant node by id',
    );
    // Positive control: the same call with the right tenant DOES resolve,
    // so the two nulls above are the guard and not a broken lookup.
    const ok = await store.getEntityById({ tenantId: TENANT_A, id: aClient.id });
    assert.ok(ok);
    assert.equal(ok.label, 'Alpha Client');
  });
});

/**
 * The screen's private `normalize()`, EXTRACTED FROM ITS SOURCE rather
 * than copied into this file.
 *
 * A hand-copied replica is the measurement hazard here: it drifts
 * silently and then the brute force below is measuring a normalizer that
 * no longer exists. Extraction fails loudly instead - if skill.ts is
 * reformatted past this regex, the tests error rather than pass over the
 * wrong function.
 */
function screenNormalizerFromSource(): (s: string) => string {
  const skillPath = path.resolve(
    __dirname,
    '../../skills/law-intake-conflict-screen/skill.ts',
  );
  const src = readFileSync(skillPath, 'utf8');
  const m = src.match(/function normalize\(name: string\): string \{[\s\S]*?\n\}/);
  assert.ok(m, 'could not extract normalize() from skill.ts - update this regex');
  const js = m[0].split(': string').join('');
  // eslint-disable-next-line no-eval
  const fn = eval(`(${js})`) as (s: string) => string;
  // Known-positive controls. The instrument is validated before use.
  assert.equal(fn('Acme Holdings, LLC'), 'acme holdings');
  assert.equal(fn('The Company'), '');
  assert.equal(fn('LLC'), '');
  return fn;
}

const SCREEN_TOKENS = [
  'llc', 'llp', 'inc', 'corp', 'corporation', 'co', 'company', 'pc', 'the',
];
const REAL_WORDS = ['acme', 'smith', 'holdings', 'jones'];

/** 9 singles + C(9,2)=36 noise pairs + 4 real + 4*9 real-with-noise = 85. */
function candidateSet(): string[] {
  const out: string[] = [];
  for (const t of SCREEN_TOKENS) out.push(t);
  for (let i = 0; i < SCREEN_TOKENS.length; i++) {
    for (let j = i + 1; j < SCREEN_TOKENS.length; j++) {
      out.push(`${SCREEN_TOKENS[i]} ${SCREEN_TOKENS[j]}`);
    }
  }
  for (const r of REAL_WORDS) out.push(r);
  for (const r of REAL_WORDS) for (const t of SCREEN_TOKENS) out.push(`${r} ${t}`);
  return out;
}

/** Names composed entirely of graph-noise tokens take the fallback branch. */
const GRAPH_NOISE = new Set([
  'llc', 'l l c', 'pllc', 'llp', 'lp', 'lllp', 'pc', 'plc', 'inc',
  'incorporated', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company',
  'gmbh', 'the',
]);

function takesFallback(name: string): boolean {
  const toks = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 0);
  return toks.length > 0 && toks.every((t) => GRAPH_NOISE.has(t));
}

function countViolations(names: string[], screen: (s: string) => string) {
  let total = 0;
  let emptyScreenKey = 0;
  let nonEmptyScreenKey = 0;
  let neitherTakesFallback = 0;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      const sa = screen(a);
      if (sa !== screen(b)) continue;
      if (naturalKeyFor(PARTY_TYPE_SLUG, a) === naturalKeyFor(PARTY_TYPE_SLUG, b)) {
        continue;
      }
      total += 1;
      if (sa === '') emptyScreenKey += 1;
      else nonEmptyScreenKey += 1;
      if (!takesFallback(a) && !takesFallback(b)) neitherTakesFallback += 1;
    }
  }
  return { total, emptyScreenKey, nonEmptyScreenKey, neitherTakesFallback };
}

describe('normalize.ts containment invariant (brute-forced, not asserted)', () => {
  it('the documented "same string to the screen implies same natural key" is FALSE', async () => {
    const screen = screenNormalizerFromSource();
    const names = candidateSet();

    // Coverage first: a brute force that examined nothing is
    // indistinguishable from one that found nothing.
    assert.equal(names.length, 85, 'candidate generator changed shape');
    assert.equal(new Set(names).size, 85, 'candidate set must be duplicate-free');
    const pairs = (names.length * (names.length - 1)) / 2;
    assert.equal(pairs, 3570);

    const v = countViolations(names, screen);
    assert.equal(
      v.total,
      990,
      `expected 990 violating pairs over ${pairs}, got ${v.total}`,
    );
    // 990 = C(45,2). Derived a second way: every all-noise name in the
    // set has a distinct natural key, so EVERY pair of them violates.
    const allNoise = names.filter((n) => screen(n) === '');
    assert.equal(allNoise.length, 45);
    assert.equal(
      new Set(allNoise.map((n) => naturalKeyFor(PARTY_TYPE_SLUG, n))).size,
      45,
    );
    assert.equal((allNoise.length * (allNoise.length - 1)) / 2, v.total);
  });

  it('a worked single case, so the 990 is legible', async () => {
    const screen = screenNormalizerFromSource();
    // The screen folds both to the empty string and calls them equal.
    assert.equal(screen('The Company'), '');
    assert.equal(screen('LLC'), '');
    // The graph keeps them apart, on purpose.
    assert.equal(naturalKeyFor(PARTY_TYPE_SLUG, 'The Company'), 'the company');
    assert.equal(naturalKeyFor(PARTY_TYPE_SLUG, 'LLC'), 'llc');
  });
});

describe('normalize.ts containment invariant - the violating class', () => {
  /** 85-name set plus graph-only noise tokens and punctuation shapes. */
  function wideSet(): string[] {
    const graphOnly = [
      'pllc', 'lp', 'lllp', 'plc', 'incorporated', 'ltd', 'limited', 'gmbh',
    ];
    const shapes = [
      '%s, LLC', '%s L.L.C.', '%s (LLC)', '%s & Co.', '%s-LLC', '%s  LLC',
    ];
    const out = [...candidateSet()];
    for (const t of graphOnly) {
      out.push(t);
      for (const r of REAL_WORDS) out.push(`${r} ${t}`);
      for (const s of SCREEN_TOKENS) out.push(`${t} ${s}`);
    }
    for (const r of [...REAL_WORDS, 'the', 'co']) {
      for (const s of shapes) out.push(s.replace('%s', r));
    }
    return [...new Set(out)];
  }

  it('violations are NOT confined to the class where the screen folds to empty', async () => {
    const screen = screenNormalizerFromSource();
    const names = wideSet();
    assert.ok(names.length > 200, 'wide set collapsed - check the generator');

    const v = countViolations(names, screen);
    assert.ok(v.total > 0);
    assert.ok(
      v.nonEmptyScreenKey > 0,
      'expected violations with a NON-empty screen key; the narrow ' +
        '"all-noise folds to empty" characterisation is incomplete',
    );
    assert.equal(v.total, v.emptyScreenKey + v.nonEmptyScreenKey);
  });

  it('the exact rule: a violation requires at least one name to take the fallback', async () => {
    const screen = screenNormalizerFromSource();
    const v = countViolations(wideSet(), screen);
    assert.ok(v.total > 0, 'nothing examined - the rule would be vacuous');
    assert.equal(
      v.neitherTakesFallback,
      0,
      'found a containment violation where neither name takes the ' +
        'kept.length > 0 ? kept : tokens fallback - the rule in ' +
        'normalize.ts is wrong',
    );
  });

  it('the concrete non-empty-screen-key counterexample', async () => {
    const screen = screenNormalizerFromSource();
    // The screen does not strip 'pllc', so both fold to 'pllc'.
    assert.equal(screen('pllc'), 'pllc');
    assert.equal(screen('pllc llc'), 'pllc');
    // The graph strips BOTH tokens, hits the fallback, and keeps them.
    assert.equal(naturalKeyFor(PARTY_TYPE_SLUG, 'pllc'), 'pllc');
    assert.equal(naturalKeyFor(PARTY_TYPE_SLUG, 'pllc llc'), 'pllc llc');
  });
});
