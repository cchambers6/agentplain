import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSeedAssembly } from "@/lib/knowledge/seed-data";
import {
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
  CARD_REQUIRED_AT_SIGNUP,
  PARTNER_SUPPORT,
  trialPeriodDaysForVertical,
} from "@/lib/billing/facts";

// ─────────────────────────────────────────────────────────────────────────
// Claim-truth gate for the KNOWLEDGE CORPUS.
//
// WHY THIS FILE EXISTS
// --------------------
// `tests/marketing-banned-strings.test.ts` structurally COULD NOT catch the
// corpus zombies found in the 2026-08-31 Lane C audit, for two reasons:
//
//   1. SCOPE. Its `SURFACE_FILES` list covers `app/(marketing)/**`, six named
//      `components/` files, `components/brand/**`, `components/vertical/**`,
//      and `lib/verticals/*/content.ts`. It does NOT include
//      `lib/knowledge/seed-data.ts` — yet `seed-data.ts:382` splices every
//      vertical's `roi.citation` VERBATIM into a `VERTICAL`-kind knowledge
//      row, and `app/api/chat/route.ts:331` puts `VERTICAL` in the customer
//      chat's retrieval set. `roi.citation` renders on no page, which is
//      exactly why every page-oriented sweep missed it.
//
//   2. COMMENT-BLINDNESS. That test runs `stripComments()` over the SOURCE
//      before asserting, so any drift living in a comment is invisible to it
//      by construction.
//
// This gate closes both holes by reading the ASSEMBLED ROWS rather than the
// source text. `buildSeedAssembly()` is a pure function (no DB, no network —
// it is already invoked at module load for `SEED_COUNTS`), and the strings it
// returns are post-interpolation: they are the exact bytes that reach the
// retrieval index and can therefore be quoted back to a customer. Reading the
// object instead of the file also makes comment-stripping irrelevant.
//
// ASSERTIONS ARE DERIVED FROM `lib/billing/facts.ts`, NOT FROM A LITERAL LIST.
// A banned-literal list loses to paraphrase — "4 hrs/mo" and "reserved hours
// each month" are the same false claim in two spellings. Every rule below
// resolves against the facts module, so when policy changes there, this gate
// follows automatically.
//
// COVERAGE IS ASSERTED, NOT ASSUMED. See the final test in this file: it
// pins a floor on rows/fields/characters examined so that "the corpus is
// clean" can never be confused with "the corpus was never read". A green
// check that cannot distinguish those two states is not evidence.
// ─────────────────────────────────────────────────────────────────────────

const assembly = buildSeedAssembly();

/** Kinds in the customer chat's retrieval set (`app/api/chat/route.ts:331`). */
const CUSTOMER_REACHABLE = [
  ...assembly.skill,
  ...assembly.vertical,
  ...assembly.compliance,
] as const;

/**
 * `CROSS_CUSTOMER` is EXCLUDED from the customer chat's `contextKinds` but IS
 * listed among the queryable kinds of `app/api/knowledge/mcp/route.ts:52-56`.
 * So these rows are reachable by any agent querying the substrate over MCP —
 * a narrower blast radius than the chat box, gated all the same.
 */
const AGENT_REACHABLE = [...assembly.crossCustomer] as const;

const ALL_ROWS = [...CUSTOMER_REACHABLE, ...AGENT_REACHABLE];

interface Row {
  title: string;
  body: string;
  sourceId: string;
  verticalSlug?: string | null;
}

function asRow(r: (typeof ALL_ROWS)[number]): Row {
  return {
    title: r.title,
    body: r.body,
    sourceId: r.sourceId,
    verticalSlug: r.verticalSlug ?? null,
  };
}

/**
 * Cues that mean a following phrase is being DOCUMENTED AS RETIRED rather
 * than asserted. The corpus legitimately records superseded framings ("this
 * SUPERSEDES the retired 'first month free' framing") and the negation itself
 * ("NO reserved human hours"), and those must not trip the gate.
 */
const NEGATION_CUES =
  /\b(no|not|never|without|nor|retired|retires|superseded|supersedes|superseding|deprecated|banned|killed|dropped|no longer|instead of|rather than)\b/i;

/** A match counts only when it is NOT inside a negation/retirement window. */
function unnegatedMatches(text: string, pattern: RegExp): string[] {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
  );
  const hits: string[] = [];
  for (const m of text.matchAll(global)) {
    const start = m.index ?? 0;
    const window = text.slice(Math.max(0, start - 70), start);
    if (NEGATION_CUES.test(window)) continue;
    hits.push(m[0]);
  }
  return hits;
}

interface Rule {
  id: string;
  description: string;
  /** Returns the offending substrings found in `text`, or [] when clean. */
  run: (text: string, row: Row) => string[];
}

const RULES: Rule[] = [
  {
    id: "partner-reserved-human-time",
    description: `Partner tier must not claim reserved/dedicated human time. \`PARTNER_SUPPORT.includesConnerTime\` is ${PARTNER_SUPPORT.includesConnerTime}; named human hours are a Max-only benefit (CONNER_TIME_TIERS).`,
    run: (text) =>
      PARTNER_SUPPORT.includesConnerTime
        ? []
        : [
            ...unnegatedMatches(
              text,
              /\b(reserved|dedicated)\s+(human\s+|conner\s+|partner\s+)?(hours?|time)\b/i,
            ),
            ...unnegatedMatches(
              text,
              /\bnamed[-\s]service[-\s]partner\s+(hours?|time)\b/i,
            ),
            ...unnegatedMatches(text, /\bhours?\s+each\s+month\b/i),
            // The exact "4 hrs/mo" abbreviation shape. Legitimate ROI math in
            // this corpus always spells "hours" ("6 hours/week"), so the
            // abbreviated per-month form is unambiguous drift.
            ...unnegatedMatches(text, /\b\d+(\.\d+)?\s*hrs?\s*\/\s*mo\b/i),
          ],
  },
  {
    id: "retired-first-month-free",
    description:
      'The "first month free / $0 charged month 1" billing mechanic was retired 2026-06-14 and replaced by the trial + card-at-signup + money-back model in `lib/billing/facts.ts`.',
    run: (text) => [
      ...unnegatedMatches(text, /\bfirst\s+month\s+free\b/i),
      ...unnegatedMatches(text, /\$0\s+charged\s+month\s*1\b/i),
      ...unnegatedMatches(text, /\bmonth\s*1\s+free\b/i),
    ],
  },
  {
    id: "trial-length-matches-facts",
    description: `Every "<N>-day trial" in the corpus must equal a ratified trial length (${TRIAL_PERIOD_DAYS} default, ${TRIAL_PERIOD_DAYS_EXTENDED} for CPA + Law) and, on a vertical-scoped row, must equal \`trialPeriodDaysForVertical(slug)\`.`,
    run: (text, row) => {
      const bad: string[] = [];
      const pattern = /(\d+)[-\s]days?\s+(free\s+)?trial\b/gi;
      for (const m of text.matchAll(pattern)) {
        const days = Number(m[1]);
        const allowed =
          days === TRIAL_PERIOD_DAYS || days === TRIAL_PERIOD_DAYS_EXTENDED;
        if (!allowed) {
          bad.push(`${m[0]} (not a ratified trial length)`);
          continue;
        }
        if (row.verticalSlug) {
          const expected = trialPeriodDaysForVertical(row.verticalSlug);
          if (days !== expected) {
            bad.push(
              `${m[0]} on vertical "${row.verticalSlug}" (facts.ts says ${expected})`,
            );
          }
        }
      }
      return bad;
    },
  },
  {
    id: "free-signup-must-disclose-card",
    description: `\`CARD_REQUIRED_AT_SIGNUP\` is ${CARD_REQUIRED_AT_SIGNUP}, so any "sign up free" / "start free" framing must disclose the card capture in the same row. This is the negative-option rule with FTC weight.`,
    run: (text) => {
      if (!CARD_REQUIRED_AT_SIGNUP) return [];
      const claims = [
        ...unnegatedMatches(text, /\b(sign\s*up|signup|start)\s+free\b/i),
        ...unnegatedMatches(text, /\bfree\s+to\s+(sign\s*up|signup|start)\b/i),
      ];
      if (claims.length === 0) return [];
      const disclosesCard =
        /card\s+(is\s+)?(captured|collected|required|taken)?\s*(at|on)\s+signup|card\s+on\s+file|card\s+at\s+signup/i.test(
          text,
        );
      return disclosesCard
        ? []
        : claims.map((c) => `${c} (no card-at-signup disclosure in this row)`);
    },
  },
  {
    id: "model-vendor-invisible",
    description:
      "Ratified constraint: the model vendor is invisible on customer-reachable surfaces. The knowledge corpus is retrievable, so it is one.",
    run: (text) =>
      unnegatedMatches(
        text,
        /\b(Claude|Anthropic|OpenAI|ChatGPT|GPT-[0-9]|Gemini)\b/i,
      ),
  },
];

// ── The gate ──────────────────────────────────────────────────────────────

const examined = {
  rows: 0,
  fields: 0,
  characters: 0,
  ruleEvaluations: 0,
};

const violations: string[] = [];

for (const raw of ALL_ROWS) {
  const row = asRow(raw);
  examined.rows += 1;
  for (const [field, value] of [
    ["title", row.title],
    ["body", row.body],
  ] as const) {
    if (!value) continue;
    examined.fields += 1;
    examined.characters += value.length;
    for (const rule of RULES) {
      examined.ruleEvaluations += 1;
      for (const hit of rule.run(value, row)) {
        violations.push(
          `[${rule.id}] ${row.sourceId} .${field} — found ${JSON.stringify(hit)}\n    ${rule.description}`,
        );
      }
    }
  }
}

for (const rule of RULES) {
  test(`corpus claim-truth :: ${rule.id}`, () => {
    const mine = violations.filter((v) => v.startsWith(`[${rule.id}]`));
    assert.deepEqual(
      mine,
      [],
      `Corpus claim-truth violation(s):\n${mine.join("\n")}\n\nAuthority: lib/billing/facts.ts. Fix the corpus, not this test.`,
    );
  });
}

// ── Coverage, asserted ────────────────────────────────────────────────────
//
// Without this, an upstream change that made `buildSeedAssembly()` return
// empty arrays would turn every test above green while examining nothing —
// the exact defect the 2026-08-31 audit filed against the three existing
// claim checkers (§5.2: "neither reports coverage"). The floors below are
// set well under the current values so ordinary corpus edits don't trip
// them, but a collapse to zero (or near it) fails loudly.

test("corpus claim-truth :: coverage floor (found-nothing must not look like examined-nothing)", () => {
  assert.ok(
    examined.rows >= 100,
    `Corpus coverage collapsed: only ${examined.rows} rows examined. The gate above is meaningless without input.`,
  );
  assert.ok(
    CUSTOMER_REACHABLE.length >= 80,
    `Only ${CUSTOMER_REACHABLE.length} customer-reachable rows examined.`,
  );
  assert.ok(
    AGENT_REACHABLE.length >= 5,
    `Only ${AGENT_REACHABLE.length} CROSS_CUSTOMER rows examined.`,
  );
  assert.ok(
    examined.characters >= 100_000,
    `Only ${examined.characters} characters examined across the corpus.`,
  );
  assert.equal(
    examined.ruleEvaluations,
    examined.fields * RULES.length,
    "Every rule must be evaluated against every field.",
  );

  // Printed so a green run still states its denominator.
  console.log(
    `[corpus-claim-truth] COVERAGE: ${examined.rows} rows ` +
      `(${CUSTOMER_REACHABLE.length} customer-reachable via chat contextKinds, ` +
      `${AGENT_REACHABLE.length} CROSS_CUSTOMER via the knowledge MCP route), ` +
      `${examined.fields} fields, ${examined.characters} characters, ` +
      `${RULES.length} rules, ${examined.ruleEvaluations} rule-evaluations, ` +
      `${violations.length} violations.`,
  );
});

// ── Declared blind spots ──────────────────────────────────────────────────
//
// Stated explicitly so this gate's silence is never mistaken for coverage it
// does not have:
//
//  1. FIELDS. Only `title` and `body` of assembled rows are read. `metadata`
//     is not asserted on.
//  2. KINDS. `CUSTOMER`-kind rows are per-workspace and built at runtime from
//     customer data, not by `buildSeedAssembly()`. They are in the chat's
//     retrieval set and are NOT covered here.
//  3. UNSOURCED DOLLAR FIGURES. The retired "$2,900–$10,600/mo" value anchor
//     (removed from the homepage per `lib/marketing/home-content.ts:110-113`
//     as having no source in the repo) still appears in the corpus and in six
//     `lib/verticals/*/content.ts` ROI fields. Deliberately NOT gated here —
//     whether that band is sourced is a ratification question for Conner, not
//     a fact derivable from `lib/billing/facts.ts`. Filed, not fixed.
//  4. INTERNAL MEMORY FILENAMES. Every `roi.citation` still names internal
//     memory files (`project_stripe_both_surfaces.md`, etc.) and ships them
//     into a retrievable row — the same leak already fixed for `proof.cite`
//     on the homepage. Removing them also removes provenance, so the
//     disposition is Conner's. Filed, not fixed.
//  5. PARAPHRASE BEYOND THESE FIVE RULES. These rules are derived from
//     `facts.ts`, which makes them robust to respelling of the SAME claim,
//     but they do not constitute a general falsehood detector.
//  6. RUNTIME RETRIEVAL. This asserts over the assembled rows, not over a
//     live query against the vector store. The path
//     `seed-data.ts:382 → VERTICAL → chat route contextKinds` is verified by
//     reading, not by observing a retrieval.
