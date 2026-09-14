/**
 * tests/cpa-claims-truth.test.ts
 *
 * CPA is ON SALE: `resolveVerticalReadiness('cpa')` returns `supported`, so a
 * stranger can pay and start a 14-day trial against this copy. Nothing pinned
 * the CPA claims before this file. `tests/real-estate-claims-truth.test.ts`
 * exists and does exactly this job for the launch vertical; CPA had no
 * sibling, which is how two claims survived the ROI remediation that had
 * already written down, in `roi.math` in the same file, that neither
 * capability exists.
 *
 * THE RULE THIS FILE ENFORCES. Stated explicitly, because four different
 * answers to "which skills have a production caller" live in this repo and
 * quoting one without its rule is itself the defect:
 *
 *   A capability is BACKED iff its skill slug is
 *     (1) present in SKILL_CATALOG, AND
 *     (2) that entry's `runtime === 'live'`, AND
 *     (3) named by a production caller - the union of
 *         SWEEP_DISPATCH_MANIFEST and NON_SWEEP_LIVE_SKILLS.
 *
 *   An `agentRoster` card is NOT backing. A `rooting` card is a roadmap
 *   item, and six of the eight CPA cards are `rooting`.
 *
 * WHAT IS ASSERTED ON. The tests walk the EXPORTED `cpa` object, not the
 * source text, so they see exactly what a customer sees. The file's own
 * comments discuss the retired capabilities by name in order to explain why
 * they were cut; a source scan would fail on its own explanation.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT COVER - read this before trusting a
 * green run. `jtbdTables` is EXCLUDED from the affirmative set. Those tables
 * name ~11 agents ("Onboarding agent", "Books agent", "Roll-forward agent",
 * "Analytical agent", "ML agent", "CSM agent", "Prep agent", "Billing
 * agent", "Signature agent" ...), and most have no SKILL_CATALOG entry at
 * all. That is a real, larger truth problem, tracked separately; it is NOT
 * fixed here and this file must not be read as clearing it. The count is
 * asserted below so the hole cannot quietly grow.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { cpa } from '@/lib/verticals/cpa/content';
import { SKILL_CATALOG } from '@/lib/skills/registry';
import {
  SWEEP_DISPATCH_MANIFEST,
  NON_SWEEP_LIVE_SKILLS,
} from '@/lib/skills/sweep-dispatch-manifest';

const BACKED_SLUGS: ReadonlySet<string> = new Set([
  ...SWEEP_DISPATCH_MANIFEST.map((e) => e.skillSlug),
  ...Object.keys(NON_SWEEP_LIVE_SKILLS),
]);

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const v of node) collectStrings(v, out);
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) collectStrings(v, out);
  }
  return out;
}

const ALL_STRINGS = collectStrings(cpa);

/** Surfaces that ASSERT a capability. jtbdTables excluded - see header. */
const AFFIRMATIVE_STRINGS = collectStrings({
  directAnswer: cpa.directAnswer,
  hero: cpa.hero,
  metaDescription: cpa.metaDescription,
  claims: cpa.claims,
  valueLoop: [cpa.valueLoopExample.after, cpa.valueLoopExample.outcome],
});

/**
 * Sentence-level, negation-aware. Unlike the real-estate sibling, the
 * negation rule applies to EVERY affirmative surface, not just the FAQ:
 * the rewritten `directAnswer` names the four absent capabilities in order
 * to say they are not running, and a flat substring ban reads that denial
 * and an assertion identically.
 */
const AFFIRMATIVE_SENTENCES = AFFIRMATIVE_STRINGS.flatMap((s) =>
  s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean),
);
const FAQ_SENTENCES = cpa.verticalFaq
  .flatMap((f) => f.a.split(/(?<=[.!?])\s+/))
  .map((s) => s.trim())
  .filter(Boolean);

const NEGATION =
  /\b(no|not|never|without|isn't|aren't|doesn't|don't|cannot|can't)\b|\bnot (yet )?running\b|\bsetting up\b|\bwill\b|\bonce\b|\bcomes? online\b|\bactivat/i;

// -- Coverage first: a blind walker must not look like a clean result -------

describe('cpa claims - coverage', () => {
  it('reports examined N of M and fails when N is zero', () => {
    assert.ok(ALL_STRINGS.length >= 60, `examined ${ALL_STRINGS.length} of an expected >=60 strings - walker looks degraded`);
    assert.ok(AFFIRMATIVE_STRINGS.length > 0, `examined ${AFFIRMATIVE_STRINGS.length} affirmative strings - nothing to assert on`);
    assert.ok(AFFIRMATIVE_SENTENCES.length >= 10, `examined ${AFFIRMATIVE_SENTENCES.length} affirmative sentences - split looks degraded`);
    assert.ok(FAQ_SENTENCES.length > 0, `examined ${FAQ_SENTENCES.length} FAQ sentences - nothing to assert on`);
    assert.ok(BACKED_SLUGS.size > 0, `examined ${BACKED_SLUGS.size} backed skills - manifest read returned nothing`);
  });

  it('the excluded jtbd surface is measured, not ignored', () => {
    const cells = cpa.jtbdTables.flatMap((t) => t.rows.map((r) => r.withAgentplain));
    // Named so the known hole cannot silently grow. If this number moves,
    // someone edited the tables and should either fix them or restate it.
    assert.ok(cells.length > 0, `examined ${cells.length} jtbd cells - table read returned nothing`);
    assert.equal(cells.length, 15, `examined ${cells.length} of 15 jtbd 'with agentplain' cells - these are NOT covered by the bans below`);
  });
});

// -- The backing rule itself -----------------------------------------------

describe('cpa claims - the backed set is real', () => {
  it('the one capability CPA copy still asserts has a production caller', () => {
    // The rewritten copy asserts exactly one CPA-vertical capability: the
    // month-end close document chase. If it loses its caller the copy
    // becomes false and this fails.
    assert.ok(
      BACKED_SLUGS.has('month-end-close-cpa'),
      'cpa copy asserts the month-end close chase, which has no production caller',
    );
    const entry = SKILL_CATALOG.find((s) => s.slug === 'month-end-close-cpa');
    assert.ok(entry, 'month-end-close-cpa is absent from SKILL_CATALOG');
    assert.equal(entry?.runtime, 'live', 'month-end-close-cpa is not catalog-live');
  });

  it('the aged-AR claim maps to a live, caller-named skill', () => {
    assert.ok(
      BACKED_SLUGS.has('invoice-chase-general'),
      'the 30/60/90 aged-AR claim has no production caller',
    );
  });

  it('CPA has exactly one vertical-scoped catalog skill - the copy may not outrun it', () => {
    const cpaSkills = SKILL_CATALOG.filter((s) => s.vertical === 'cpa');
    assert.deepEqual(
      cpaSkills.map((s) => s.slug),
      ['month-end-close-cpa'],
      `examined ${SKILL_CATALOG.length} catalog entries; cpa-vertical set changed - re-read the claims above before shipping`,
    );
  });
});

// -- Retired capabilities may be NAMED, but only to deny or defer them ------

describe('cpa claims - deleted claims do not come back', () => {
  /**
   * Each pattern names a capability with NO SKILL_CATALOG entry. Matching a
   * pattern is not itself a failure: the sentence must hedge (deny it, or
   * put it in the future/"setting up" tense the agentRoster already uses).
   * An unhedged assertion is the defect.
   */
  const BANNED: ReadonlyArray<[RegExp, string]> = [
    [/books?\s+reconcil/, 'books reconciliation - no books-recon skill exists'],
    [/reconcil\w*\s+(the\s+|client\s+|your\s+)?books/, 'books reconciliation - no books-recon skill exists'],
    [/bank[- ]feed/, 'bank-feed reconciliation - nothing reads a bank feed'],
    [/\bjournal entr|\bje drafting/, 'JE drafting - no producer'],
    [/engagement[- ]letter (customi|drafting|language)|drafts? the engagement letter/, 'engagement-letter drafting - no onboarding skill exists'],
    [/doc-checklist customi|checklist customi/, 'doc-checklist customization - no onboarding skill exists'],
    [/milestone billing|invoice on (each |every )?milestone/, 'milestone billing - no billing skill exists'],
    [/federal[- ](plus[- ]|and )?state checklist|federal \+ state checklist|federal-plus-state/, 'federal+state compliance checklist - no compliance skill exists'],
  ];

  for (const [pattern, why] of BANNED) {
    it(`asserts only with a hedge: ${why}`, () => {
      const offenders = AFFIRMATIVE_SENTENCES.filter(
        (s) => pattern.test(s.toLowerCase()) && !NEGATION.test(s),
      );
      assert.deepEqual(
        offenders,
        [],
        `unbacked capability asserted in the present tense (${why}):\n  ` + offenders.join('\n  '),
      );
    });
  }

  it('the FAQ may name a retired capability ONLY to deny or defer it', () => {
    const problems: string[] = [];
    let examined = 0;
    for (const sentence of FAQ_SENTENCES) {
      const lower = sentence.toLowerCase();
      for (const [pattern, why] of BANNED) {
        if (!pattern.test(lower)) continue;
        examined += 1;
        if (!NEGATION.test(sentence)) {
          problems.push(`FAQ asserts a retired capability (${why}): "${sentence}"`);
        }
      }
    }
    assert.deepEqual(problems, [], problems.join('\n'));
    assert.ok(examined >= 0, `examined ${examined} FAQ sentence/pattern pairs of ${FAQ_SENTENCES.length} sentences`);
  });

  it('KNOWN-POSITIVE CONTROL: the bans would actually fire', () => {
    // Guards against a ban list that passes because the walker or the
    // sentence split silently yields nothing to test. Plant, assert caught.
    const planted = 'The fleet reconciles books against bank feeds every month.';
    const caught = BANNED.filter(([p]) => p.test(planted.toLowerCase()) && !NEGATION.test(planted));
    assert.ok(caught.length > 0, 'ban list did not catch a planted unbacked claim - the instrument is broken');
    const hedged = 'Books reconciliation is not running yet.';
    assert.ok(
      BANNED.some(([p]) => p.test(hedged.toLowerCase())) && NEGATION.test(hedged),
      'the hedge exemption does not work - honest copy would be rejected',
    );
  });
});
