/**
 * lib/agents/sentinel/corpus/mortgage.test.ts
 *
 * Verifies the mortgage compliance corpus (counsel-handoff draft, 2026-06-03):
 *   - each rule's literal trigger flags a positive example and not a safe one
 *   - each regex trigger matches its example and rejects its counter-example
 *   - the DRAFT corpus fires nothing live (the counsel gate holds)
 *   - structural invariants counsel relies on (citations, severities)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { mortgageCorpus } from "./mortgage";
import {
  assertRuleTriggersBehave,
  assertDraftCorpusFiresNothing,
} from "./_corpus-test-helpers";

const SAFE_CONTROL =
  "Thanks for reaching out. I will follow up with details about your application " +
  "and walk you through the next steps in our review.";

describe("mortgage corpus", () => {
  it("every rule's triggers flag positives and the regexes behave", () => {
    for (const rule of mortgageCorpus.rules) {
      assertRuleTriggersBehave(rule, SAFE_CONTROL);
    }
  });

  it("is DRAFT and fires nothing live (counsel gate holds)", () => {
    assert.equal(mortgageCorpus.metadata.status, "DRAFT");
    assert.equal(mortgageCorpus.metadata.counselReviewer, null);
    assertDraftCorpusFiresNothing(mortgageCorpus);
  });

  it("every rule carries a dated, sourced citation and a severity", () => {
    for (const rule of mortgageCorpus.rules) {
      assert.ok(rule.citation.source, `${rule.ruleId}: missing citation.source`);
      assert.ok(rule.citation.url.startsWith("http"), `${rule.ruleId}: bad citation URL`);
      assert.match(
        rule.citation.accessedAt,
        /^\d{4}-\d{2}-\d{2}$/,
        `${rule.ruleId}: bad accessedAt`,
      );
      assert.ok(
        ["blocking", "advisory", "info"].includes(rule.severity ?? "advisory"),
        `${rule.ruleId}: invalid severity`,
      );
    }
  });

  it("ships the fair-lending + redisclosure + split-advertising rules this wave added", () => {
    const ids = new Set(mortgageCorpus.rules.map((r) => r.ruleId));
    for (const id of [
      "ecoa-reg-b-fair-lending",
      "hmda-reg-c-reporting",
      "trid-redisclosure-three-day-reset",
      "reg-z-mortgage-advertising-prohibited",
      "reg-z-mortgage-advertising-triggering-terms",
    ]) {
      assert.ok(ids.has(id), `mortgage corpus missing expected rule "${id}"`);
    }
    // The combined advertising rule was split — its old id must be gone.
    assert.equal(ids.has("reg-z-mortgage-advertising-candidates"), false);
  });

  it("prohibited advertising is blocking; triggering-terms is advisory", () => {
    const prohibited = mortgageCorpus.rules.find(
      (r) => r.ruleId === "reg-z-mortgage-advertising-prohibited",
    );
    const triggering = mortgageCorpus.rules.find(
      (r) => r.ruleId === "reg-z-mortgage-advertising-triggering-terms",
    );
    assert.equal(prohibited?.severity, "blocking");
    assert.equal(triggering?.severity, "advisory");
  });
});
