/**
 * lib/agents/sentinel/corpus/title-escrow.test.ts
 *
 * Verifies the title & escrow compliance corpus (counsel-handoff draft,
 * 2026-06-06):
 *   - each rule's literal trigger flags a positive example and not a safe one
 *   - each regex trigger matches its example and rejects its counter-example
 *   - the DRAFT corpus fires nothing live (the counsel gate holds)
 *   - structural invariants counsel relies on (citations, severities)
 *   - the rules this wave added ship
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { titleEscrowCorpus } from "./title-escrow";
import {
  assertRuleTriggersBehave,
  assertDraftCorpusFiresNothing,
} from "./_corpus-test-helpers";

const SAFE_CONTROL =
  "Thanks for reaching out. I will follow up with details about your closing " +
  "and walk you through the next steps once the file is ready for review.";

describe("title-escrow corpus", () => {
  it("every rule's triggers flag positives and the regexes behave", () => {
    for (const rule of titleEscrowCorpus.rules) {
      assertRuleTriggersBehave(rule, SAFE_CONTROL);
    }
  });

  it("is DRAFT and fires nothing live (counsel gate holds)", () => {
    assert.equal(titleEscrowCorpus.metadata.status, "DRAFT");
    assert.equal(titleEscrowCorpus.metadata.counselReviewer, null);
    assertDraftCorpusFiresNothing(titleEscrowCorpus);
  });

  it("every rule carries a dated, sourced citation and a severity", () => {
    for (const rule of titleEscrowCorpus.rules) {
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
    const ids = new Set(titleEscrowCorpus.rules.map((r) => r.ruleId));
    for (const id of ["wire-fraud-instructions", "cfpb-title-respa-enforcement"]) {
      assert.ok(ids.has(id), `title-escrow corpus missing expected rule "${id}"`);
    }
  });
});
