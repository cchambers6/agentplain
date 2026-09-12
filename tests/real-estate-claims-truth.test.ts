/**
 * tests/real-estate-claims-truth.test.ts
 *
 * Real estate is the launch vertical. NOTHING pinned its claims or its
 * ROI figures before this file: a search for the published headline
 * numbers across `tests/`, `lib/` and `tools/` returned zero hits, so
 * "50x" could have been edited to "500x", or the deleted unbacked claims
 * quietly re-added, and the whole suite stayed green.
 *
 * THE RULE THIS FILE ENFORCES — stated, because four different answers to
 * "which skills have a production caller" exist in this repo (4 / 16 / 17
 * / 18) and quoting one without its rule is itself the defect:
 *
 *   A capability is BACKED iff its skill slug is
 *     (1) present in SKILL_CATALOG, AND
 *     (2) that entry's `runtime === 'live'`, AND
 *     (3) named by a production caller — the union of
 *         SWEEP_DISPATCH_MANIFEST (sweep callers) and
 *         NON_SWEEP_LIVE_SKILLS (webhook / event callers), both in
 *         lib/skills/sweep-dispatch-manifest.ts.
 *
 *   That union is the 16-skill set. It is DELIBERATELY NOT
 *   SKILLS_WITH_PRODUCTION_CALLER (4), which is the narrower set gating
 *   whether a stranger can BUY a vertical — a different question, and one
 *   this file must not touch.
 *
 * WHAT IS ASSERTED ON. The tests walk the EXPORTED `realEstate` OBJECT,
 * not the source text. That is deliberate: the file's comments discuss
 * the retired claims by name ("CRM hygiene", "production reports",
 * "<2 minutes") in order to explain why they were cut, so a source-text
 * scan would either fail on its own explanation or have to strip
 * comments and risk stripping the wrong thing. Walking the object sees
 * exactly what a customer can see.
 *
 * Coverage is asserted, not assumed: `examined N of M`, failing when N is
 * zero, because a walker that silently yields no strings would make every
 * banned-phrase assertion below vacuously green.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { realEstate } from '@/lib/verticals/real-estate/content';
import { MONTHLY_PRICE_USD_CENTS } from '@/lib/billing/facts';
import { SKILL_CATALOG } from '@/lib/skills/registry';
import {
  SWEEP_DISPATCH_MANIFEST,
  NON_SWEEP_LIVE_SKILLS,
} from '@/lib/skills/sweep-dispatch-manifest';

// ── The backed set, derived rather than hardcoded ────────────────────────

const BACKED_SLUGS: ReadonlySet<string> = new Set([
  ...SWEEP_DISPATCH_MANIFEST.map((e) => e.skillSlug),
  ...Object.keys(NON_SWEEP_LIVE_SKILLS),
]);

/** Collect every customer-visible string in the exported content object. */
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

const ALL_STRINGS = collectStrings(realEstate);
const HAYSTACK = ALL_STRINGS.join('\n').toLowerCase();

/**
 * AFFIRMATIVE surfaces — prose that asserts a capability in the present
 * tense. A retired claim appearing here is a defect, full stop.
 *
 * The FAQ is deliberately NOT in this set, and that distinction is the
 * point rather than a loophole. A good FAQ answer NAMES the things the
 * product does not do ("it does not clean up your CRM records or build
 * your production reports") — that denial is useful to a buyer and is the
 * opposite of an unbacked claim. A flat substring ban cannot tell a
 * denial from an assertion, so the FAQ gets its own negation-aware rule
 * below instead of being exempted.
 */
const AFFIRMATIVE_STRINGS = collectStrings({
  directAnswer: realEstate.directAnswer,
  hero: realEstate.hero,
  metaDescription: realEstate.metaDescription,
  claims: realEstate.claims,
  // Only the "with agentplain" column asserts a capability; `today`
  // describes the customer's current pain and may name anything.
  jtbd: realEstate.jtbdTables.flatMap((t) => t.rows.map((r) => r.withAgentplain)),
  valueLoop: [realEstate.valueLoopExample.after, realEstate.valueLoopExample.outcome],
});
const CLAIM_HAYSTACK = AFFIRMATIVE_STRINGS.join('\n').toLowerCase();

/** FAQ answers, split into sentences for the negation-aware check. */
const FAQ_SENTENCES = realEstate.verticalFaq
  .flatMap((f) => f.a.split(/(?<=[.!?])\s+/))
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const NEGATION = /\b(no|not|does not|doesn't|isn't|is not|never|without)\b/i;

// ── Coverage first: a blind walker must not look like a clean result ─────

describe('real-estate claims — coverage', () => {
  it('reports examined N of M and fails when N is zero', () => {
    assert.ok(
      ALL_STRINGS.length > 0,
      `examined ${ALL_STRINGS.length} strings — the content walker returned nothing`,
    );
    assert.ok(
      AFFIRMATIVE_STRINGS.length > 0,
      `examined ${AFFIRMATIVE_STRINGS.length} affirmative-claim strings — nothing to assert on`,
    );
    assert.ok(
      FAQ_SENTENCES.length > 0,
      `examined ${FAQ_SENTENCES.length} FAQ sentences — nothing to assert on`,
    );
    // A floor, not just ">0": the object has ~100 strings, so a walker
    // that silently degraded to one field would still be caught.
    assert.ok(
      ALL_STRINGS.length >= 60,
      `examined ${ALL_STRINGS.length} of an expected >=60 strings — walker looks degraded`,
    );
    assert.ok(
      BACKED_SLUGS.size > 0,
      `examined ${BACKED_SLUGS.size} backed skills — manifest read returned nothing`,
    );
  });
});

// ── The backing rule itself ──────────────────────────────────────────────

describe('real-estate claims — the backed set is real', () => {
  it('every skill named by a production caller is catalog-live', () => {
    const problems: string[] = [];
    let examined = 0;
    for (const slug of BACKED_SLUGS) {
      examined += 1;
      const entry = SKILL_CATALOG.find((s) => s.slug === slug);
      if (!entry) {
        problems.push(`${slug}: named by a caller but absent from SKILL_CATALOG`);
      } else if (entry.runtime !== 'live') {
        problems.push(`${slug}: caller-named but runtime=${entry.runtime ?? 'schema-only'}`);
      }
    }
    assert.ok(examined > 0, `examined ${examined} of ${BACKED_SLUGS.size} — nothing checked`);
    assert.deepEqual(problems, [], problems.join('\n'));
    assert.equal(examined, BACKED_SLUGS.size, `examined ${examined} of ${BACKED_SLUGS.size} skills`);
  });

  it('the two capabilities real estate still claims are in the backed set', () => {
    // Buyer-inquiry triage and showing scheduling are the ONLY two
    // capabilities the rewritten claims assert. If either loses its
    // caller, the copy above becomes false and this fails.
    const required = ['lead-triage-realestate', 'chief-of-staff-scheduler'];
    const missing = required.filter((s) => !BACKED_SLUGS.has(s));
    assert.deepEqual(
      missing,
      [],
      `real-estate copy claims capabilities with no production caller: ${missing.join(', ')}`,
    );
    assert.equal(required.length, 2, 'examined 2 of 2 claimed capabilities');
  });

  it('the compliance claim maps to a skill that is a DAILY sweep', () => {
    assert.ok(
      BACKED_SLUGS.has('compliance-watch-general'),
      'the compliance claim has no production caller',
    );
    const row = SWEEP_DISPATCH_MANIFEST.find(
      (e) => e.skillSlug === 'compliance-watch-general',
    );
    assert.ok(
      row,
      'compliance-watch-general must be a SWEEP (not an event caller) — the copy says "daily"',
    );
  });
});

// ── Claims that were cut must stay cut ───────────────────────────────────

describe('real-estate claims — deleted claims do not come back', () => {
  const BANNED: ReadonlyArray<[RegExp, string]> = [
    [/crm hygiene/, 'CRM hygiene — no CRM-hygiene skill exists'],
    [/hygiene drift/, 'CRM hygiene drift — no CRM-hygiene skill exists'],
    [/production report/, 'production reporting — no production-reporter skill exists'],
    [/production-reporter/, 'production-reporter — not a catalog skill'],
    [/recruiting outreach/, 'recruiting outreach — no recruiting skill is catalog-live'],
    [/listing description/, 'listing-description drafting — no producer'],
    [/listing intake/, 'listing intake — no listing-intake skill exists'],
    [/<\s*2 minutes/, '"<2 minutes" — CRM-sourced leads wait on an hourly sync'],
    [/pre-check/, 'pre-check — the sweep is retrospective, not a pre-send gate'],
    [/pre-checks every/, 'pre-checks every draft — false in direction'],
    [/never reaches a portal/, 'the sweep cannot promise this'],
  ];

  for (const [pattern, why] of BANNED) {
    it(`does not claim: ${why}`, () => {
      const offenders = AFFIRMATIVE_STRINGS.filter((s) => pattern.test(s.toLowerCase()));
      assert.deepEqual(
        offenders,
        [],
        `unbacked claim re-introduced (${why}):\n  ` + offenders.join('\n  '),
      );
    });
  }

  it('the FAQ may name a retired capability ONLY to deny it', () => {
    // Negation-aware, because "it does not build your production reports"
    // is honest and "it builds your production reports" is not, and a
    // substring ban reads them identically.
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
    // Not a coverage floor — zero mentions is a legitimate state. Recorded
    // so a reader can see whether this test looked at anything.
    assert.ok(
      FAQ_SENTENCES.length > 0,
      `examined ${FAQ_SENTENCES.length} FAQ sentences — the FAQ split returned nothing`,
    );
    console.log(
      `  examined ${examined} retired-capability mentions across ${FAQ_SENTENCES.length} FAQ sentences`,
    );
  });

  it('examined every banned pattern against a non-empty corpus', () => {
    assert.ok(BANNED.length >= 10, `examined ${BANNED.length} banned patterns`);
    assert.ok(
      CLAIM_HAYSTACK.length > 500,
      `examined ${CLAIM_HAYSTACK.length} chars of affirmative claim text — corpus looks empty`,
    );
    assert.ok(
      AFFIRMATIVE_STRINGS.length >= 15,
      `examined ${AFFIRMATIVE_STRINGS.length} affirmative strings — walker looks degraded`,
    );
  });
});

// ── ROI pinned to its inputs, not to a remembered number ─────────────────

describe('real-estate ROI — derived, not asserted', () => {
  // The published figure must follow from THESE inputs. Changing the
  // headline without changing an input fails here; changing an input
  // without changing the headline also fails.
  const COORDINATION_HOURS_LOW = 8;
  const COORDINATION_HOURS_HIGH = 12;
  const ACTIVITIES_TOTAL = 5;
  const ACTIVITIES_BACKED = 2;
  const DRAFTING_LEG_SHARE = 0.5;
  const OWNER_HOURLY_USD = 120;
  const WEEKS_PER_MONTH = 4.3;

  function monthlyValue(hours: number): number {
    return (
      hours *
      (ACTIVITIES_BACKED / ACTIVITIES_TOTAL) *
      DRAFTING_LEG_SHARE *
      OWNER_HOURLY_USD *
      WEEKS_PER_MONTH
    );
  }

  const low = monthlyValue(COORDINATION_HOURS_LOW);
  const high = monthlyValue(COORDINATION_HOURS_HIGH);
  const mid = (low + high) / 2;
  const priceUsd = MONTHLY_PRICE_USD_CENTS / 100;
  const multiple = mid / priceUsd;

  it('the arithmetic lands where the copy says it does', () => {
    assert.ok(Math.abs(low - 825.6) < 0.5, `low=${low}`);
    assert.ok(Math.abs(high - 1238.4) < 0.5, `high=${high}`);
    assert.ok(Math.abs(mid - 1032) < 1, `midpoint=${mid}`);
    assert.ok(multiple > 9 && multiple < 11, `multiple=${multiple} is not ~10x`);
  });

  it('the published multiplier matches the derived multiple', () => {
    const m = /~?(\d+)x/.exec(realEstate.roi.multiplier);
    assert.ok(m, `roi.multiplier has no Nx figure: ${realEstate.roi.multiplier}`);
    const published = Number(m[1]);
    assert.ok(
      Math.abs(published - multiple) < 1.5,
      `published ${published}x but inputs derive ${multiple.toFixed(1)}x`,
    );
  });

  it('the published output value matches the derived midpoint', () => {
    const m = /\$([\d,]+)/.exec(realEstate.roi.outputValue);
    assert.ok(m, `roi.outputValue has no dollar figure: ${realEstate.roi.outputValue}`);
    const published = Number(m[1].replace(/,/g, ''));
    assert.ok(
      Math.abs(published - mid) <= 25,
      `published $${published}/mo but inputs derive $${mid.toFixed(0)}/mo — ` +
        'this is exactly the drift that let $5,300 sit on top of a $5,160 derivation',
    );
  });

  it('the math string states the same midpoint as outputValue', () => {
    // The old copy published $5,300 while its own math derived $5,160.
    // Nothing caught it. This does.
    const fromOutput = /\$([\d,]+)/.exec(realEstate.roi.outputValue);
    assert.ok(fromOutput);
    const headline = fromOutput[1].replace(/,/g, '');
    const rounded = Math.round(Number(headline) / 10) * 10;
    const mathHasIt = /\$([\d,]+)/g;
    const figures = [...realEstate.roi.math.matchAll(mathHasIt)].map((x) =>
      Number(x[1].replace(/,/g, '')),
    );
    const near = figures.some((f) => Math.abs(f - rounded) <= 25);
    assert.ok(
      near,
      `roi.outputValue says $${headline} but roi.math contains no figure within $25 of it: ` +
        figures.join(', '),
    );
  });

  it('price comes from lib/billing/facts.ts, not a hardcoded string', () => {
    assert.ok(
      realEstate.roi.inputCost.includes(`$${priceUsd}`),
      `inputCost must render MONTHLY_PRICE_USD_CENTS ($${priceUsd}): ${realEstate.roi.inputCost}`,
    );
  });

  it('the citation discloses that nothing here is sourced', () => {
    const c = realEstate.roi.citation.toLowerCase();
    assert.match(
      c,
      /not primary research|no component of this figure is sourced/,
      'the citation must say plainly that the ROI is operator-modeled, not sourced',
    );
    assert.match(
      c,
      /operator assumption|internal assumption/,
      'the citation must name the unvalidated assumptions',
    );
  });

  it('the multiplier does not claim a sourced figure', () => {
    assert.match(
      realEstate.roi.multiplier.toLowerCase(),
      /modeled/,
      'real estate has no sourced ROI input; the multiplier must say "modeled"',
    );
  });
});

// ── Roster and prose must agree ──────────────────────────────────────────

describe('real-estate claims — roster and prose agree', () => {
  it('no capability of a "rooting" agent is claimed in the present tense', () => {
    const rooting = realEstate.agentRoster.filter((a) => a.runtime === 'rooting');
    assert.ok(rooting.length > 0, `examined ${rooting.length} rooting agents — expected some`);

    // Each rooting agent's distinguishing noun. If the prose names it,
    // the page is promising an agent the roster admits is not live.
    const NOUNS: Record<string, RegExp> = {
      'realty-listing-coordinator': /listing intake/,
      'realty-crm-hygiene': /crm hygiene|hygiene drift/,
      'realty-production-reporter': /production report/,
      'realty-recruiter-assistant': /recruiting outreach/,
    };

    const problems: string[] = [];
    let examined = 0;
    for (const agent of rooting) {
      const pattern = NOUNS[agent.slug];
      if (!pattern) continue;
      examined += 1;
      if (pattern.test(CLAIM_HAYSTACK)) {
        problems.push(`${agent.slug} is "rooting" but its capability is claimed in the copy`);
      }
    }
    assert.ok(examined > 0, `examined ${examined} rooting agents against the copy`);
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  it('every "live" roster agent maps to a backed skill or declares its binding', () => {
    const live = realEstate.agentRoster.filter((a) => a.runtime === 'live');
    assert.ok(live.length > 0, `examined ${live.length} live roster agents`);
    // The roster binds by `boundSkill` or by `owns` capability tags. Only
    // the explicitly bound ones can be checked against the catalog here;
    // assert that the ones which DO declare a binding declare a backed one.
    let checked = 0;
    for (const agent of live) {
      const bound = (agent as { boundSkill?: string }).boundSkill;
      if (!bound) continue;
      checked += 1;
      assert.ok(
        BACKED_SLUGS.has(bound),
        `${agent.slug} is live and bound to ${bound}, which has no production caller`,
      );
    }
    assert.ok(checked > 0, `examined ${checked} explicitly-bound live agents`);
  });
});
