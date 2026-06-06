/**
 * lib/agents/sentinel/corpus/_corpus-test-helpers.ts
 *
 * Shared assertions for per-vertical corpus tests. Not a test file itself
 * (no `.test.ts` suffix) — imported by `mortgage.test.ts` /
 * `insurance.test.ts` so both verticals verify their trigger patterns the
 * same way.
 *
 * The literal-match scanner skips `unverified` rules, so to exercise a
 * DRAFT candidate rule's triggers we clone it as a verified single-rule
 * corpus and scan against it. This tests the PATTERN, not the live gate —
 * the live gate is honesty-checked separately (a real DRAFT corpus must
 * flag nothing).
 */

import assert from "node:assert/strict";

import { scanCorpus } from "../scanner";
import type { ComplianceRule, CorpusBundle } from "../types";

function verifiedSingleRuleCorpus(rule: ComplianceRule): CorpusBundle {
  return {
    verticalSlug: "test-clone",
    metadata: {
      verticalSlug: "test-clone",
      lastReviewedAt: "2026-06-03",
      counselReviewer: "TEST",
      status: "COUNSEL_REVIEWED",
      openQuestions: [],
    },
    rules: [
      {
        ...rule,
        purpose: "literal-match",
        unverified: false,
        counselReviewStatus: "reviewed",
      },
    ],
  };
}

/**
 * For a single rule, assert every literal trigger flags a positive example
 * that embeds it, and that a benign control string flags nothing. Also
 * compile and exercise every regex trigger against its worked
 * example / counter-example.
 */
export function assertRuleTriggersBehave(rule: ComplianceRule, safeControl: string): void {
  const triggers = rule.triggers ?? [];
  if (triggers.length > 0) {
    const corpus = verifiedSingleRuleCorpus(rule);

    for (const phrase of triggers) {
      assert.equal(
        phrase,
        phrase.toLowerCase(),
        `${rule.ruleId}: trigger "${phrase}" must be lowercase`,
      );
      const positive = `Note to client: ${phrase} here, please advise.`;
      const res = scanCorpus({ subject: "", body: positive, corpus });
      assert.ok(
        res.flags.some((f) => f.matchedPhrase === phrase),
        `${rule.ruleId}: trigger "${phrase}" failed to flag its own positive example`,
      );
    }

    // Benign control: this rule must not fire on neutral copy.
    const control = scanCorpus({ subject: "", body: safeControl, corpus });
    assert.equal(
      control.flags.length,
      0,
      `${rule.ruleId}: fired on the safe control text "${safeControl}" — matched: ${control.flags
        .map((f) => f.matchedPhrase)
        .join(", ")}`,
    );
  }

  for (const rx of rule.triggerRegexes ?? []) {
    const re = new RegExp(rx.pattern, rx.flags ?? "i");
    assert.ok(
      re.test(rx.example),
      `${rule.ruleId}: regex /${rx.pattern}/${rx.flags ?? "i"} did NOT match its example "${rx.example}"`,
    );
    // Recompile (RegExp with global-ish flags is stateful via lastIndex).
    const re2 = new RegExp(rx.pattern, rx.flags ?? "i");
    assert.equal(
      re2.test(rx.counterExample),
      false,
      `${rule.ruleId}: regex /${rx.pattern}/${rx.flags ?? "i"} wrongly matched its counter-example "${rx.counterExample}"`,
    );
  }
}

/**
 * Honesty guard: a DRAFT corpus (no counsel-reviewed rules) must flag
 * NOTHING even when the draft body contains a candidate trigger phrase.
 * Confirms the `unverified` gate keeps the vertical advisory-only.
 */
export function assertDraftCorpusFiresNothing(corpus: CorpusBundle): void {
  const phrases: string[] = [];
  for (const rule of corpus.rules) {
    for (const p of rule.triggers ?? []) phrases.push(p);
  }
  const body = phrases.join(". ");
  const res = scanCorpus({ subject: "", body, corpus });
  assert.equal(
    res.flags.length,
    0,
    `${corpus.verticalSlug}: DRAFT corpus fired ${res.flags.length} flag(s) — candidate triggers must NOT fire until counsel-reviewed`,
  );
}
