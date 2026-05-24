/**
 * lib/agents/sentinel/scanner.test.ts
 *
 * Pins the literal-match scanner's behavior. Sentinel goes LIVE on the
 * back of these guarantees: deterministic, word-boundary, case-insensitive,
 * never fires on counsel-reference rules, never fires on `unverified` rules,
 * scans subject + body independently, and is idempotent across re-runs.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { scanCorpus } from "./scanner";
import type { ComplianceRule, CorpusBundle } from "./types";

function corpus(rules: ComplianceRule[]): CorpusBundle {
  return {
    verticalSlug: "test-vertical",
    metadata: {
      verticalSlug: "test-vertical",
      lastReviewedAt: "2026-05-22",
      counselReviewer: null,
      status: "DRAFT",
      openQuestions: ["test corpus"],
    },
    rules,
  };
}

function literalRule(overrides: Partial<ComplianceRule> = {}): ComplianceRule {
  return {
    ruleId: "test-fha-familial",
    title: "Familial-status trigger phrases",
    summary: "Phrases HUD has called out as discriminatory on familial-status grounds.",
    jurisdiction: "federal-regulation",
    scope: { kind: "federal" },
    citation: {
      source: "24 CFR § 100.75",
      url: "https://www.ecfr.gov/current/title-24/section-100.75",
      accessedAt: "2026-05-22",
    },
    literalText: "Examples include phrases like 'no children', 'adults only'…",
    purpose: "literal-match",
    triggers: ["no children", "adults only", "great for families"],
    category: "familial-status",
    ...overrides,
  };
}

describe("sentinel scanner — literal-match", () => {
  it("flags every literal trigger occurrence in body", () => {
    const res = scanCorpus({
      subject: "New listing",
      body: "Quiet community — great for families and adults only.",
      corpus: corpus([literalRule()]),
    });
    const phrases = res.flags.map((f) => f.matchedPhrase).sort();
    assert.deepEqual(phrases, ["adults only", "great for families"]);
    for (const flag of res.flags) {
      assert.equal(flag.source, "body");
      assert.equal(flag.category, "familial-status");
      assert.equal(flag.ruleId, "test-fha-familial");
      assert.ok(flag.excerpt.includes(flag.matchedText));
    }
  });

  it("is case-insensitive but preserves the matched source text", () => {
    const res = scanCorpus({
      subject: "Open house",
      body: "ADULTS ONLY building.",
      corpus: corpus([literalRule()]),
    });
    assert.equal(res.flags.length, 1);
    assert.equal(res.flags[0].matchedText, "ADULTS ONLY");
    assert.equal(res.flags[0].matchedPhrase, "adults only");
  });

  it("respects word boundaries — does not fire on substrings", () => {
    const res = scanCorpus({
      subject: "x",
      body: "coupletop coupley couplecouple", // none of these are "couple"
      corpus: corpus([
        literalRule({
          ruleId: "test-couple",
          triggers: ["couple"],
        }),
      ]),
    });
    assert.equal(res.flags.length, 0);
  });

  it("DOES fire on a punctuation-bounded match (real-world copy)", () => {
    const res = scanCorpus({
      subject: "x",
      body: "Suits a couple, no roommates.",
      corpus: corpus([
        literalRule({
          ruleId: "test-couple",
          triggers: ["couple"],
        }),
      ]),
    });
    assert.equal(res.flags.length, 1);
    assert.equal(res.flags[0].matchedText, "couple");
  });

  it("scans subject and body independently", () => {
    const res = scanCorpus({
      subject: "Great for families — open Sunday",
      body: "Open house Sunday from 1–3pm.",
      corpus: corpus([literalRule()]),
    });
    assert.equal(res.flags.length, 1);
    assert.equal(res.flags[0].source, "subject");
    assert.equal(res.flags[0].matchedPhrase, "great for families");
  });

  it("flags multiple occurrences of the same phrase", () => {
    const res = scanCorpus({
      subject: "",
      body: "No children allowed. Strictly no children.",
      corpus: corpus([literalRule()]),
    });
    const matches = res.flags.filter((f) => f.matchedPhrase === "no children");
    assert.equal(matches.length, 2);
    assert.ok(matches[0].start < matches[1].start);
  });

  it("ignores counsel-reference rules entirely (no auto-flagging)", () => {
    const res = scanCorpus({
      subject: "x",
      body: "great for families",
      corpus: corpus([
        literalRule({ purpose: "counsel-reference", triggers: ["great for families"] }),
      ]),
    });
    assert.equal(res.flags.length, 0);
    assert.equal(res.rulesScanned.length, 0);
  });

  it("ignores unverified rules (counsel red-line gate)", () => {
    const res = scanCorpus({
      subject: "x",
      body: "great for families",
      corpus: corpus([literalRule({ unverified: true })]),
    });
    assert.equal(res.flags.length, 0);
  });

  it("emits sorted results and a deterministic flagId per offset", () => {
    const c = corpus([literalRule()]);
    const a = scanCorpus({
      subject: "",
      body: "Adults only — great for families.",
      corpus: c,
    });
    const b = scanCorpus({
      subject: "",
      body: "Adults only — great for families.",
      corpus: c,
    });
    assert.deepEqual(
      a.flags.map((f) => f.flagId),
      b.flags.map((f) => f.flagId),
      "scan must be deterministic",
    );
    for (let i = 1; i < a.flags.length; i++) {
      assert.ok(
        a.flags[i].start >= a.flags[i - 1].start,
        "flags must be sorted by offset",
      );
    }
  });

  it("handles empty input cleanly", () => {
    const res = scanCorpus({
      subject: "",
      body: "",
      corpus: corpus([literalRule()]),
    });
    assert.equal(res.flags.length, 0);
    assert.equal(res.rulesScanned[0], "test-fha-familial");
    assert.ok(res.phrasesChecked > 0);
  });
});
