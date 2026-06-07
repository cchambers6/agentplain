/**
 * lib/agents/sentinel/corpus/law.test.ts
 *
 * Verifies the law (law-firm) compliance corpus (counsel-handoff draft,
 * 2026-06-06):
 *   - each rule's literal trigger flags a positive example and not a safe one
 *   - each regex trigger matches its example and rejects its counter-example
 *   - the DRAFT corpus fires nothing live (the counsel gate holds)
 *   - structural invariants counsel relies on (citations, severities)
 *   - the rules this wave added are present
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { lawCorpus } from "./law";
import {
  assertRuleTriggersBehave,
  assertDraftCorpusFiresNothing,
} from "./_corpus-test-helpers";

// Benign control that contains NONE of any rule's trigger phrases.
const SAFE_CONTROL =
  "Thank you for reaching out to the firm. A member of our team will review " +
  "your message and follow up with the next steps for your matter.";

describe("law corpus", () => {
  it("every rule's triggers flag positives and the regexes behave", () => {
    for (const rule of lawCorpus.rules) {
      assertRuleTriggersBehave(rule, SAFE_CONTROL);
    }
  });

  it("is DRAFT and fires nothing live (counsel gate holds)", () => {
    assert.equal(lawCorpus.metadata.status, "DRAFT");
    assert.equal(lawCorpus.metadata.counselReviewer, null);
    assertDraftCorpusFiresNothing(lawCorpus);
  });

  it("every rule carries a dated, sourced citation and a severity", () => {
    for (const rule of lawCorpus.rules) {
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

  it("ships the rules this wave added (1.7 conflicts, 1.15 trust, 7.3 solicitation)", () => {
    const ids = new Set(lawCorpus.rules.map((r) => r.ruleId));
    for (const id of [
      "mrpc-1-7-conflict-current-clients",
      "mrpc-1-15-trust-account",
      "mrpc-7-3-solicitation",
    ]) {
      assert.ok(ids.has(id), `law corpus missing expected rule "${id}"`);
    }
  });
});
