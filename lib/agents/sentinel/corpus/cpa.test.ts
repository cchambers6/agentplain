/**
 * lib/agents/sentinel/corpus/cpa.test.ts
 *
 * Verifies the CPA compliance corpus (counsel-handoff draft, 2026-06-06):
 *   - each rule's literal trigger flags a positive example and not a safe one
 *   - each regex trigger matches its example and rejects its counter-example
 *   - the DRAFT corpus fires nothing live (the counsel gate holds)
 *   - structural invariants counsel relies on (citations, severities)
 *   - the rules this wave added are present
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cpaCorpus } from "./cpa";
import {
  assertRuleTriggersBehave,
  assertDraftCorpusFiresNothing,
} from "./_corpus-test-helpers";

const SAFE_CONTROL =
  "Thanks for reaching out. I will follow up with the documents we need to " +
  "prepare your return and walk you through each step before anything is filed.";

describe("cpa corpus", () => {
  it("every rule's triggers flag positives and the regexes behave", () => {
    for (const rule of cpaCorpus.rules) {
      assertRuleTriggersBehave(rule, SAFE_CONTROL);
    }
  });

  it("is DRAFT and fires nothing live (counsel gate holds)", () => {
    assert.equal(cpaCorpus.metadata.status, "DRAFT");
    assert.equal(cpaCorpus.metadata.counselReviewer, null);
    assertDraftCorpusFiresNothing(cpaCorpus);
  });

  it("every rule carries a dated, sourced citation and a severity", () => {
    for (const rule of cpaCorpus.rules) {
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
    const ids = new Set(cpaCorpus.rules.map((r) => r.ruleId));
    for (const id of [
      "irc-6694-preparer-penalty",
      "irc-7216-disclosure",
      "pcaob-as-1015-due-professional-care",
    ]) {
      assert.ok(ids.has(id), `cpa corpus missing expected rule "${id}"`);
    }
  });
});
