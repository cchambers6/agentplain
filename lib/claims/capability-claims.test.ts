/**
 * lib/claims/capability-claims.test.ts
 *
 * Where the claim-vs-code invariants run. Checks 1-3 live in
 * `capability-claims.ts`; check 4 (`approval-slug-parity.ts`) is wired here
 * rather than in its own file so there is exactly ONE place a reader has to
 * look to see what the claim gate covers, and so it inherits the same ratchet.
 * `tools/test-gate.mjs` globs `lib/**\/*.test.ts`, so all four run on every PR.
 *
 * Two kinds of assertion live here, and both are load-bearing:
 *
 *   1. PRODUCTION assertions — bind each checker to the real registries and
 *      assert no unaccepted violation. This is the gate.
 *   2. DELIBERATE-FAILURE assertions — feed each checker a synthetic fixture
 *      built to violate it and assert it reports the violation. Without
 *      these, a checker that silently stopped working would look exactly like
 *      a codebase with no drift. An unfired check and a broken check are
 *      indistinguishable, and that indistinguishability is the bug.
 *
 * Every deliberate-failure fixture also carries a near-miss control (the same
 * shape, one field changed so it is legal) so the checker is proven to
 * discriminate rather than to fire on everything handed to it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkRosterCapabilityClaims,
  checkConnectorActionScopes,
  checkVerticalReachability,
  type CatalogEntryLike,
  type ConnectorTileLike,
  type VerticalRosterLike,
} from './capability-claims';
import {
  checkApprovalSlugParity,
  extractApprovalSlugUsage,
  type SourceFileLike,
} from './approval-slug-parity';
import { applyRatchet, KNOWN_CLAIM_DRIFT } from './known-drift';
import { formatViolations } from './types';

import {
  VERTICAL_SLUGS,
  ON_RAMP_SLUGS,
  getAllVerticalsIncludingOnRamps,
} from '@/lib/verticals';
import {
  resolveVerticalReadiness,
  SIGNUP_ON_RAMP_ALLOWLIST,
} from '@/lib/verticals/readiness';
import { SKILL_CATALOG } from '@/lib/skills/registry';
import {
  SWEEP_DISPATCH_MANIFEST,
  NON_SWEEP_LIVE_SKILLS,
} from '@/lib/skills/sweep-dispatch-manifest';
import { MARKETPLACE_ENTRIES } from '@/lib/integrations/marketplace';

const DECLARED_CALLERS: ReadonlySet<string> = new Set([
  ...SWEEP_DISPATCH_MANIFEST.map((r) => r.skillSlug),
  ...Object.keys(NON_SWEEP_LIVE_SKILLS),
]);

function productionRosterViolations() {
  return checkRosterCapabilityClaims({
    verticals: getAllVerticalsIncludingOnRamps(),
    catalog: SKILL_CATALOG,
    declaredCallers: DECLARED_CALLERS,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Check 1 — roster capability
// ─────────────────────────────────────────────────────────────────────────

describe('claim-vs-code: fleet cards vs. skills that can fire', () => {
  it('no UNACCEPTED live fleet card is bound to a skill nothing can trigger', () => {
    const { unaccepted } = applyRatchet(productionRosterViolations(), new Date());
    assert.deepEqual(
      unaccepted,
      [],
      `New capability-claim drift — a fleet card renders "Watching — ready when ` +
        `triggered" for a capability nothing can trigger:\n${formatViolations(unaccepted)}\n\n` +
        `Fix the card (or wire the caller). Accepting it means adding a dated entry ` +
        `to lib/claims/known-drift.ts with a reason.`,
    );
  });

  it('DELIBERATE FAILURE: fires on a live card bound to a schema-only skill', () => {
    const verticals: VerticalRosterLike[] = [
      {
        slug: 'fixture-vertical',
        agentRoster: [
          { slug: 'fixture-card', runtime: 'live', boundSkill: 'fixture-skill' },
        ],
      },
    ];
    const catalog: CatalogEntryLike[] = [
      { slug: 'fixture-skill', runtime: 'schema-only' },
    ];

    const violations = checkRosterCapabilityClaims({
      verticals,
      catalog,
      declaredCallers: new Set(['fixture-skill']),
    });

    assert.equal(violations.length, 1, 'checker did not fire on planted drift');
    assert.equal(violations[0].check, 'roster-capability');
    assert.equal(violations[0].subject, 'fixture-vertical/fixture-card');
    assert.match(violations[0].detail, /schema-only/);
  });

  it('DELIBERATE FAILURE: fires on a catalog-live skill with no declared caller', () => {
    const violations = checkRosterCapabilityClaims({
      verticals: [
        {
          slug: 'fixture-vertical',
          agentRoster: [
            { slug: 'fixture-card', runtime: 'live', boundSkill: 'fixture-skill' },
          ],
        },
      ],
      catalog: [{ slug: 'fixture-skill', runtime: 'live' }],
      declaredCallers: new Set<string>(), // nothing fires it
    });

    assert.equal(violations.length, 1, 'checker did not fire on planted drift');
    assert.match(violations[0].detail, /neither SWEEP_DISPATCH_MANIFEST nor/);
  });

  it('DELIBERATE FAILURE: fires on a live card bound to a skill missing from the catalog', () => {
    const violations = checkRosterCapabilityClaims({
      verticals: [
        {
          slug: 'fixture-vertical',
          agentRoster: [
            { slug: 'fixture-card', runtime: 'live', boundSkill: 'ghost-skill' },
          ],
        },
      ],
      catalog: [],
      declaredCallers: new Set(['ghost-skill']),
    });

    assert.equal(violations.length, 1);
    assert.match(violations[0].detail, /not in SKILL_CATALOG/);
  });

  it('CONTROL: stays silent on a legal card (live + catalog-live + declared caller)', () => {
    const violations = checkRosterCapabilityClaims({
      verticals: [
        {
          slug: 'fixture-vertical',
          agentRoster: [
            { slug: 'fixture-card', runtime: 'live', boundSkill: 'fixture-skill' },
            // rooting cards make no claim, and owns-only cards are pinned by
            // tests/vertical-roster-bindings.test.ts, not here.
            { slug: 'rooting-card', runtime: 'rooting', boundSkill: 'dark-skill' },
            { slug: 'owns-card', runtime: 'live', owns: ['buyer-inquiry'] },
          ],
        },
      ],
      catalog: [
        { slug: 'fixture-skill', runtime: 'live' },
        { slug: 'dark-skill', runtime: 'schema-only' },
      ],
      declaredCallers: new Set(['fixture-skill']),
    });

    assert.deepEqual(violations, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Check 2 — connector action vs. scope
// ─────────────────────────────────────────────────────────────────────────

describe('claim-vs-code: connector tiles vs. OAuth scopes requested', () => {
  it('no available connector advertises an action it never requests a scope for', () => {
    const violations = checkConnectorActionScopes(MARKETPLACE_ENTRIES);
    const { unaccepted } = applyRatchet(violations, new Date());
    assert.deepEqual(
      unaccepted,
      [],
      `A connector tile sells an action the connect flow never asks permission ` +
        `for — every call of that kind 403s at the provider while the tile still ` +
        `says "connected":\n${formatViolations(unaccepted)}`,
    );
  });

  it('is not vacuous — at least one production tile is actually evaluated', () => {
    // A rule vocabulary that matches nothing would pass the assertion above
    // forever. DocuSign advertises signing AND requests the `signature` scope,
    // so it exercises the full match-then-satisfy path.
    const docusign = MARKETPLACE_ENTRIES.find((e) => e.id === 'docusign');
    assert.ok(docusign, 'docusign tile missing — update this control');
    assert.equal(docusign!.status, 'available');
    assert.match(`${docusign!.name} ${docusign!.description}`, /sign/i);
    assert.ok(docusign!.scopes.some((s) => /signature/i.test(s)));
    assert.deepEqual(checkConnectorActionScopes([docusign!]), []);
  });

  it('DELIBERATE FAILURE: fires when a tile sells scheduling with no calendar scope', () => {
    const tile: ConnectorTileLike = {
      id: 'fixture-mail',
      name: 'Fixture Mail',
      description: 'Reads your mail and schedules meetings for you.',
      scopes: ['mail.read', 'mail.readwrite'],
      status: 'available',
    };

    const violations = checkConnectorActionScopes([tile]);
    assert.equal(violations.length, 1, 'checker did not fire on planted drift');
    assert.equal(violations[0].subject, 'fixture-mail:schedule');
    assert.match(violations[0].remedy, /calendar scope/);
  });

  it('CONTROL: the same tile passes once the calendar scope is requested', () => {
    const tile: ConnectorTileLike = {
      id: 'fixture-mail',
      name: 'Fixture Mail',
      description: 'Reads your mail and schedules meetings for you.',
      scopes: ['mail.read', 'Calendars.ReadWrite'],
      status: 'available',
    };
    assert.deepEqual(checkConnectorActionScopes([tile]), []);
  });

  it('CONTROL: a coming-soon tile is not judged — it has no connect flow to be wrong about', () => {
    const tile: ConnectorTileLike = {
      id: 'fixture-soon',
      name: 'Fixture Soon',
      description: 'Will schedule things one day.',
      scopes: [],
      status: 'coming-soon',
    };
    assert.deepEqual(checkConnectorActionScopes([tile]), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Check 3 — readiness manifest vs. registry reachability
// ─────────────────────────────────────────────────────────────────────────

function productionReachabilityViolations() {
  return checkVerticalReachability({
    registrySlugs: VERTICAL_SLUGS,
    onRampSlugs: ON_RAMP_SLUGS,
    signupOnRampAllowlist: SIGNUP_ON_RAMP_ALLOWLIST,
    readiness: resolveVerticalReadiness,
  });
}

describe('claim-vs-code: readiness manifest vs. registry reachability', () => {
  it('the readiness resolver is the only authority on who can reach paid signup', () => {
    const { unaccepted } = applyRatchet(productionReachabilityViolations(), new Date());
    assert.deepEqual(
      unaccepted,
      [],
      `The signup gate and the readiness resolver disagree about which verticals ` +
        `are customer-reachable:\n${formatViolations(unaccepted)}`,
    );
  });

  it('is not vacuous — every published slug is actually resolved', () => {
    const published = [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS];
    assert.ok(published.length >= 11, 'expected the locked ten plus /general');
    for (const slug of published) {
      const verdict = resolveVerticalReadiness(slug);
      assert.equal(verdict.slug, slug);
      assert.equal(typeof verdict.supported, 'boolean');
    }
  });

  it('DELIBERATE FAILURE: fires when the signup hatch names one of the locked ten', () => {
    const violations = checkVerticalReachability({
      registrySlugs: ['real-estate', 'mortgage'],
      onRampSlugs: ['general'],
      // A locked vertical smuggled onto the escape hatch — reaches paid signup
      // whether or not its killer workflow fires.
      signupOnRampAllowlist: ['general', 'mortgage'],
      readiness: (slug) =>
        slug === 'real-estate'
          ? { supported: true, reason: 'supported' }
          : { supported: false, reason: 'no-production-caller' },
    });

    assert.equal(violations.length, 1, 'checker did not fire on planted drift');
    assert.equal(violations[0].subject, 'mortgage:hatch-bypasses-gate');
  });

  it('DELIBERATE FAILURE: fires on a redundant hatch that would mask a readiness flip', () => {
    const violations = checkVerticalReachability({
      registrySlugs: ['real-estate'],
      onRampSlugs: ['general'],
      signupOnRampAllowlist: ['general'],
      // `general` supported AND hatched — the hatch keeps taking money the day
      // support flips off.
      readiness: () => ({ supported: true, reason: 'supported' }),
    });

    assert.equal(violations.length, 1);
    assert.equal(violations[0].subject, 'general:redundant-hatch');
  });

  it('DELIBERATE FAILURE: fires when the resolver throws on a published slug', () => {
    const violations = checkVerticalReachability({
      registrySlugs: ['real-estate'],
      onRampSlugs: [],
      signupOnRampAllowlist: [],
      readiness: () => {
        throw new Error('corrupt registry');
      },
    });

    assert.equal(violations.length, 1);
    assert.match(violations[0].detail, /corrupt registry/);
  });

  it('DELIBERATE FAILURE: fires on a hatch for a slug that is not published at all', () => {
    const violations = checkVerticalReachability({
      registrySlugs: ['real-estate'],
      onRampSlugs: ['general'],
      signupOnRampAllowlist: ['general', 'ghost-vertical'],
      readiness: (slug) => ({
        supported: slug === 'real-estate',
        reason: slug === 'real-estate' ? 'supported' : 'no-killer-workflow-defined',
      }),
    });

    assert.equal(violations.length, 1);
    assert.equal(violations[0].subject, 'ghost-vertical:unpublished-hatch');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Check 4 — consumer agentSlug filters vs. the slugs sinks write
// ─────────────────────────────────────────────────────────────────────────

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Product source only. Tests are excluded on purpose: their fixtures contain
 *  deliberately-wrong slugs, and judging them would make this gate fire on
 *  its own controls. */
function readProductSources(): SourceFileLike[] {
  const out: SourceFileLike[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      if (name === '__tests__') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
      out.push({
        path: relative(REPO_ROOT, full).split(sep).join('/'),
        text: readFileSync(full, 'utf8'),
      });
    }
  };
  walk(join(REPO_ROOT, 'lib'));
  walk(join(REPO_ROOT, 'app'));
  return out;
}

const APPROVAL_SLUG_USAGE = extractApprovalSlugUsage(readProductSources());

describe('claim-vs-code: approval-queue consumers vs. the slugs sinks write', () => {
  it('every agentSlug a consumer filters on is a slug some sink actually writes', () => {
    const { unaccepted } = applyRatchet(
      checkApprovalSlugParity(APPROVAL_SLUG_USAGE),
      new Date(),
    );
    assert.deepEqual(
      unaccepted,
      [],
      `A WorkApprovalQueueItem consumer filters an agentSlug no sink produces. ` +
        `The query returns 0 forever with no error anywhere, and whatever ` +
        `surface renders that count is silently wrong on every ` +
        `workspace:\n${formatViolations(unaccepted)}`,
    );
  });

  it('is not vacuous — real sinks and real consumers were both found', () => {
    // A regex that stopped matching would pass the assertion above forever.
    // These floors are deliberately loose: they prove the extractor is still
    // reading the codebase without pinning a count that churns.
    assert.ok(
      APPROVAL_SLUG_USAGE.producers.length >= 15,
      `expected the extractor to find the sink row builders, found ` +
        `${APPROVAL_SLUG_USAGE.producers.length}`,
    );
    assert.ok(
      APPROVAL_SLUG_USAGE.consumers.length >= 1,
      'expected at least one statically-resolvable agentSlug filter',
    );

    // The two halves of the real defect, both still visible to the extractor:
    // the sink that writes the slug, and the consumer that filters on it.
    const produced = new Set(APPROVAL_SLUG_USAGE.producers.map((p) => p.slug));
    assert.ok(
      produced.has('invoice-chase-general'),
      'invoice-chase-general sink no longer resolves — the producer side of ' +
        'this check has gone blind',
    );
    assert.ok(
      APPROVAL_SLUG_USAGE.consumers.some(
        (c) =>
          c.path === 'lib/skills/finance-pulse-general/activity-snapshot.ts' &&
          c.slug === 'invoice-chase-general',
      ),
      'the finance-pulse invoice-chase counter is no longer seen as a ' +
        'consumer — the site that regressed is unguarded again',
    );
  });

  it('resolves slug constants through imports and barrel re-exports, not by name', () => {
    // `PULSE_AGENT_SLUG` is declared twice with two different values: the
    // sweep's ACTIVATION slug and the sink's ROW slug. Name matching would
    // pick one at random; following the import edge picks the right one.
    const usage = extractApprovalSlugUsage([
      {
        path: 'lib/sweeps/pulse-sweep.ts',
        text: `const PULSE_AGENT_SLUG = 'activation-namespace';`,
      },
      {
        path: 'lib/skills/pulse/types.ts',
        text: `export const PULSE_AGENT_SLUG = 'row-namespace';`,
      },
      {
        path: 'lib/skills/pulse/index.ts',
        text: `export { PULSE_AGENT_SLUG } from './types';`,
      },
      {
        path: 'lib/skills/pulse/sink.ts',
        text:
          `import { PULSE_AGENT_SLUG } from './types';\n` +
          `const row = { agentSlug: PULSE_AGENT_SLUG, refTable: 'X' };`,
      },
      {
        path: 'app/pulse/page.tsx',
        text:
          `import { PULSE_AGENT_SLUG } from '@/lib/skills/pulse';\n` +
          `const q = { where: { agentSlug: PULSE_AGENT_SLUG } };`,
      },
    ]);

    assert.deepEqual(
      usage.producers.map((p) => p.slug),
      ['row-namespace'],
    );
    assert.deepEqual(
      usage.consumers.map((c) => c.slug),
      ['row-namespace'],
      'the barrel re-export edge was not followed',
    );
    assert.deepEqual(checkApprovalSlugParity(usage), []);
  });

  it('DELIBERATE FAILURE: fires on a consumer filtering a slug nothing writes', () => {
    // This is the 2026-08-30 defect in miniature: the sink writes one slug,
    // the consumer counts a different, legal-looking one.
    const usage = extractApprovalSlugUsage([
      {
        path: 'lib/skills/chase/sink.ts',
        text: `const row = { agentSlug: 'chase-general', kind: 'X', refTable: 'D' };`,
      },
      {
        path: 'lib/skills/pulse/snapshot.ts',
        text: `const n = { where: { agentSlug: 'chase-realestate' } };`,
      },
    ]);

    const violations = checkApprovalSlugParity(usage);
    assert.equal(violations.length, 1, 'checker did not fire on planted drift');
    assert.equal(violations[0].check, 'approval-slug-parity');
    assert.equal(
      violations[0].subject,
      'lib/skills/pulse/snapshot.ts:chase-realestate',
    );
    assert.match(violations[0].detail, /NO sink writes/);
  });

  it('CONTROL: the same pair passes once the consumer names the produced slug', () => {
    const usage = extractApprovalSlugUsage([
      {
        path: 'lib/skills/chase/sink.ts',
        text: `const row = { agentSlug: 'chase-general', kind: 'X', refTable: 'D' };`,
      },
      {
        path: 'lib/skills/pulse/snapshot.ts',
        text: `const n = { where: { agentSlug: 'chase-general' } };`,
      },
    ]);
    assert.deepEqual(checkApprovalSlugParity(usage), []);
  });

  it('CONTROL: projections, type members and comments are not filters', () => {
    const usage = extractApprovalSlugUsage([
      {
        path: 'lib/x/reader.ts',
        text:
          `interface Row { agentSlug: string; refTable: string; }\n` +
          `const q = { select: { agentSlug: true, refTable: true } };\n` +
          `// agentSlug: 'ghost-slug' used to be filtered here\n` +
          `const s = "agentSlug: 'other-ghost'";\n` +
          `const out = { agentSlug: row.agentSlug };`,
      },
    ]);

    assert.deepEqual(usage.producers, []);
    assert.deepEqual(usage.consumers, []);
    assert.deepEqual(checkApprovalSlugParity(usage), []);
  });

  it('CONTROL: a runtime-valued filter is carried out as dynamic, not judged', () => {
    const usage = extractApprovalSlugUsage([
      {
        path: 'lib/x/scorecard.ts',
        text: `const q = { where: { agentSlug: args.skillSlug } };`,
      },
    ]);

    assert.deepEqual(usage.consumers, []);
    assert.equal(usage.dynamic.length, 1);
    assert.equal(usage.dynamic[0].role, 'consumer');
    assert.deepEqual(checkApprovalSlugParity(usage), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// The ratchet itself
// ─────────────────────────────────────────────────────────────────────────

describe('claim-drift ratchet', () => {
  it('no accepted drift entry has expired', () => {
    const violations = [
      ...productionRosterViolations(),
      ...checkConnectorActionScopes(MARKETPLACE_ENTRIES),
      ...productionReachabilityViolations(),
      ...checkApprovalSlugParity(APPROVAL_SLUG_USAGE),
    ];
    const { expired } = applyRatchet(violations, new Date());
    assert.deepEqual(
      expired.map((e) => `${e.check}::${e.subject} (expired ${e.expires})`),
      [],
      'Accepted claim drift is past its expiry. Fix it, or re-date the entry with ' +
        'a fresh reason — silently extending it is the failure mode this date exists ' +
        'to prevent.',
    );
  });

  it('no accepted drift entry is stale (the list has not rotted into fiction)', () => {
    const violations = [
      ...productionRosterViolations(),
      ...checkConnectorActionScopes(MARKETPLACE_ENTRIES),
      ...productionReachabilityViolations(),
      ...checkApprovalSlugParity(APPROVAL_SLUG_USAGE),
    ];
    const { stale } = applyRatchet(violations, new Date());
    assert.deepEqual(
      stale.map((e) => `${e.check}::${e.subject}`),
      [],
      'These entries in lib/claims/known-drift.ts no longer match any real ' +
        'violation — the drift was fixed. Delete the entries so the list keeps ' +
        'describing reality.',
    );
  });

  it('DELIBERATE FAILURE: an expired entry fails even when nothing new drifted', () => {
    const known = [
      {
        check: 'roster-capability' as const,
        subject: 'fixture/expired',
        reason: 'fixture',
        expires: '2026-01-01',
      },
    ];
    const violations = [
      {
        check: 'roster-capability' as const,
        subject: 'fixture/expired',
        detail: 'fixture',
        remedy: 'fixture',
      },
    ];
    const result = applyRatchet(violations, new Date('2026-08-11'), known);
    assert.deepEqual(result.unaccepted, [], 'entry should still be accepted');
    assert.equal(result.expired.length, 1, 'expiry did not fire');
  });

  it('DELIBERATE FAILURE: a fixed-but-still-listed entry is reported stale', () => {
    const known = [
      {
        check: 'roster-capability' as const,
        subject: 'fixture/already-fixed',
        reason: 'fixture',
        expires: '2099-01-01',
      },
    ];
    const result = applyRatchet([], new Date('2026-08-11'), known);
    assert.equal(result.stale.length, 1, 'stale-acceptance check did not fire');
  });

  it('DELIBERATE FAILURE: an unaccepted violation is not swallowed by the ratchet', () => {
    const result = applyRatchet(
      [
        {
          check: 'connector-action-scope' as const,
          subject: 'brand-new:schedule',
          detail: 'fixture',
          remedy: 'fixture',
        },
      ],
      new Date('2026-08-11'),
      KNOWN_CLAIM_DRIFT,
    );
    assert.equal(result.unaccepted.length, 1, 'ratchet swallowed a new violation');
  });
});
