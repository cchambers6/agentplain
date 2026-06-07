/**
 * lib/agents/sentinel/go-live-gate.test.ts
 *
 * Pins the per-vertical production go-live gate
 * (`COMPLIANCE_CORPUS_COUNSEL_REVIEWED`) and the scanner's refusal to fire
 * a counsel-`rejected` rule.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";

import { isVerticalLiveAllowed } from "./index";
import { scanCorpus } from "./scanner";
import type { ComplianceRule, CorpusBundle } from "./types";

const ENV_KEY = "COMPLIANCE_CORPUS_COUNSEL_REVIEWED";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("compliance corpus go-live gate", () => {
  it("real-estate is baseline-live without the env flag", () => {
    delete process.env[ENV_KEY];
    assert.equal(isVerticalLiveAllowed("real-estate"), true);
  });

  it("mortgage / insurance are NOT live until the env flag lists them", () => {
    delete process.env[ENV_KEY];
    assert.equal(isVerticalLiveAllowed("mortgage"), false);
    assert.equal(isVerticalLiveAllowed("insurance"), false);

    process.env[ENV_KEY] = "mortgage, insurance";
    assert.equal(isVerticalLiveAllowed("mortgage"), true);
    assert.equal(isVerticalLiveAllowed("insurance"), true);
    assert.equal(isVerticalLiveAllowed("cpa"), false);
  });

  it("is case- and whitespace-insensitive on the slug list", () => {
    process.env[ENV_KEY] = "  MORTGAGE ,, insurance ";
    assert.equal(isVerticalLiveAllowed("mortgage"), true);
    assert.equal(isVerticalLiveAllowed("insurance"), true);
  });

  it("scanner never fires a counsel-rejected rule even if not unverified", () => {
    const rejected: ComplianceRule = {
      ruleId: "rejected-rule",
      title: "Rejected rule",
      summary: "counsel struck this",
      jurisdiction: "federal-regulation",
      scope: { kind: "federal" },
      citation: { source: "X", url: "https://example.com", accessedAt: "2026-06-03" },
      literalText: "rejected",
      purpose: "literal-match",
      unverified: false,
      counselReviewStatus: "rejected",
      triggers: ["struck phrase"],
    };
    const corpus: CorpusBundle = {
      verticalSlug: "test",
      metadata: {
        verticalSlug: "test",
        lastReviewedAt: "2026-06-03",
        counselReviewer: "T",
        status: "COUNSEL_REVIEWED",
        openQuestions: [],
      },
      rules: [rejected],
    };
    const res = scanCorpus({ subject: "", body: "the struck phrase here", corpus });
    assert.equal(res.flags.length, 0);
  });
});
