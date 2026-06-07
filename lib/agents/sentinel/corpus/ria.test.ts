/**
 * lib/agents/sentinel/corpus/ria.test.ts
 *
 * Verifies the RIA (registered investment adviser) compliance corpus
 * (counsel-handoff draft, 2026-06-06):
 *   - each rule's literal trigger flags a positive example and not a safe one
 *   - each regex trigger matches its example and rejects its counter-example
 *   - the DRAFT corpus fires nothing live (the counsel gate holds)
 *   - structural invariants counsel relies on (citations, severities)
 *   - the new rules this wave added are present
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { riaCorpus } from "./ria";
import {
  assertRuleTriggersBehave,
  assertDraftCorpusFiresNothing,
} from "./_corpus-test-helpers";

const SAFE_CONTROL =
  "Thank you for your interest in our advisory services. I will follow up with " +
  "a copy of our disclosure brochure and walk you through how we work with clients.";

describe("ria corpus", () => {
  it("every rule's triggers flag positives and the regexes behave", () => {
    for (const rule of riaCorpus.rules) {
      assertRuleTriggersBehave(rule, SAFE_CONTROL);
    }
  });

  it("is DRAFT and fires nothing live (counsel gate holds)", () => {
    assert.equal(riaCorpus.metadata.status, "DRAFT");
    assert.equal(riaCorpus.metadata.counselReviewer, null);
    assertDraftCorpusFiresNothing(riaCorpus);
  });

  it("every rule carries a dated, sourced citation and a severity", () => {
    for (const rule of riaCorpus.rules) {
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

  it("ships the rules this wave added", () => {
    const ids = new Set(riaCorpus.rules.map((r) => r.ruleId));
    for (const id of [
      "ria-soft-dollar-section-28e",
      "ria-marketing-testimonials-endorsements",
      "form-adv-part-2-brochure-disclosure",
    ]) {
      assert.ok(ids.has(id), `ria corpus missing expected rule "${id}"`);
    }
    // The form-adv rule was re-scoped to Part 2 disclosure — its old id is gone.
    assert.equal(ids.has("form-adv-disclosure-framework"), false);
  });
});
