/**
 * lib/agents/sentinel/corpus/insurance.test.ts
 *
 * Verifies the insurance compliance corpus (counsel-handoff draft, 2026-06-03):
 *   - each rule's literal trigger flags a positive example and not a safe one
 *   - each regex trigger matches its example and rejects its counter-example
 *   - the DRAFT corpus fires nothing live (the counsel gate holds)
 *   - the wave's new claims-handling / timeline / RCV-vs-ACV rules are wired
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { insuranceCorpus } from "./insurance";
import {
  assertRuleTriggersBehave,
  assertDraftCorpusFiresNothing,
} from "./_corpus-test-helpers";

const SAFE_CONTROL =
  "Thank you for your message. I will review your account and reply with the " +
  "information you requested about your options.";

describe("insurance corpus", () => {
  it("every rule's triggers flag positives and the regexes behave", () => {
    for (const rule of insuranceCorpus.rules) {
      assertRuleTriggersBehave(rule, SAFE_CONTROL);
    }
  });

  it("is DRAFT and fires nothing live (counsel gate holds)", () => {
    assert.equal(insuranceCorpus.metadata.status, "DRAFT");
    assert.equal(insuranceCorpus.metadata.counselReviewer, null);
    assertDraftCorpusFiresNothing(insuranceCorpus);
  });

  it("every rule carries a dated, sourced citation and a severity", () => {
    for (const rule of insuranceCorpus.rules) {
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

  it("ships the claims-handling / timeline / RCV-vs-ACV rules this wave added", () => {
    const ids = new Set(insuranceCorpus.rules.map((r) => r.ruleId));
    for (const id of [
      "unfair-claims-settlement-practices",
      "ga-claim-handling-timelines",
      "replacement-cost-vs-acv",
    ]) {
      assert.ok(ids.has(id), `insurance corpus missing expected rule "${id}"`);
    }
  });

  it("claim-timeline rule is state-scoped to GA and advisory", () => {
    const timelines = insuranceCorpus.rules.find(
      (r) => r.ruleId === "ga-claim-handling-timelines",
    );
    assert.equal(timelines?.severity, "advisory");
    assert.deepEqual(timelines?.scope, { kind: "state", state: "GA" });
  });
});
