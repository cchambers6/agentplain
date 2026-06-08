/**
 * lib/agents/sentinel/rewrite.test.ts
 *
 * Pins rewrite-and-stage (pride-audit theme #9) + the counsel-feedback
 * redline loop (theme #14):
 *
 *   1. A known violating sentence → a flagged match WITH a compliant
 *      `suggestedReplacement` + the rule citation.
 *   2. The no-LLM path degrades to a deterministic compliant fallback
 *      (never loses the flag).
 *   3. The redline loop surfaces learned counsel language ONLY after the
 *      threshold (5) agreeing red-lines, and uses it verbatim over the LLM.
 *   4. The go-live gate withholds the suggestion (but not the flag) for a
 *      vertical counsel hasn't cleared.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { scanCorpus } from "./scanner";
import { stageRewrites } from "./rewrite";
import {
  InMemoryRedlineStore,
  reduceLearnedLanguage,
  LEARNED_LANGUAGE_THRESHOLD,
  type CounselRedline,
} from "./redline-store";
import type { ComplianceRule, CorpusBundle } from "./types";
import type { LlmProvider, LlmResult, LlmCompletion } from "../../llm/types";

// ── fixtures ─────────────────────────────────────────────────────────────

const RULE_ID = "fha-hud-literal-triggers";

function corpus(overrides: Partial<ComplianceRule> = {}): CorpusBundle {
  const rule: ComplianceRule = {
    ruleId: RULE_ID,
    title: "Fair Housing Act — HUD-literal advertising trigger phrases",
    summary: "HUD-enumerated phrases indicating protected-class preference.",
    jurisdiction: "federal-regulation",
    scope: { kind: "federal" },
    citation: {
      source: "24 CFR § 100.75 (implementing 42 USC § 3604(c))",
      url: "https://www.ecfr.gov/current/title-24/section-100.75",
      accessedAt: "2026-05-22",
    },
    literalText: "24 CFR § 100.75(c): no preference based on familial status…",
    purpose: "literal-match",
    category: "fair-housing",
    triggers: ["adults only", "no children"],
    ...overrides,
  };
  return {
    verticalSlug: "real-estate",
    metadata: {
      verticalSlug: "real-estate",
      lastReviewedAt: "2026-05-22",
      counselReviewer: null,
      status: "DRAFT",
    },
    rules: [rule],
  };
}

/** Test LlmProvider that returns a fixed compliant rewrite for every call. */
function fakeLlm(reply: string): LlmProvider & { calls: number } {
  return {
    name: "test" as const,
    calls: 0,
    async complete(): Promise<LlmResult<LlmCompletion>> {
      (this as { calls: number }).calls += 1;
      return {
        ok: true,
        value: {
          text: reply,
          stopReason: "end_turn",
          usage: null,
          model: "test-stub",
        },
      };
    },
  };
}

/** Test LlmProvider that always errors — exercises the fallback path. */
function erroringLlm(): LlmProvider {
  return {
    name: "test" as const,
    async complete(): Promise<LlmResult<LlmCompletion>> {
      return { ok: false, error: { code: "UPSTREAM_ERROR", message: "boom" } };
    },
  };
}

// Real-estate is baseline-live; clear the env gate so other verticals are gated.
const ORIGINAL_GATE = process.env.COMPLIANCE_CORPUS_COUNSEL_REVIEWED;
beforeEach(() => {
  delete process.env.COMPLIANCE_CORPUS_COUNSEL_REVIEWED;
});
afterEach(() => {
  if (ORIGINAL_GATE === undefined) {
    delete process.env.COMPLIANCE_CORPUS_COUNSEL_REVIEWED;
  } else {
    process.env.COMPLIANCE_CORPUS_COUNSEL_REVIEWED = ORIGINAL_GATE;
  }
});

// ── 1. violating sentence → flag + suggestedReplacement + citation ─────────

describe("rewrite-and-stage — LLM path", () => {
  it("turns a known violating sentence into a flagged match with a compliant suggestedReplacement + citation", async () => {
    const c = corpus();
    const scan = scanCorpus({
      subject: "Charming unit",
      body: "Quiet building — adults only, no children.",
      corpus: c,
    });
    assert.ok(scan.flags.length >= 2, "scanner should flag both triggers");

    const llm = fakeLlm("Quiet building suited to a range of households.");
    const staged = await stageRewrites({
      verticalSlug: "real-estate",
      flags: scan.flags,
      corpus: c,
      workspaceId: "ws-1",
      llm,
    });

    assert.equal(staged.length, scan.flags.length);
    for (const s of staged) {
      assert.equal(s.source, "llm");
      assert.equal(s.gated, false);
      assert.equal(
        s.suggestedReplacement,
        "Quiet building suited to a range of households.",
      );
      // The citation rides with the staged fix, grounded in the rule.
      assert.equal(
        s.ruleCitation.source,
        "24 CFR § 100.75 (implementing 42 USC § 3604(c))",
      );
      assert.equal(s.flag.ruleId, RULE_ID);
    }
    assert.ok(llm.calls >= 2, "one grounded LLM call per flag");
  });

  it("strips stray quoting / fencing the model adds", async () => {
    const c = corpus();
    const scan = scanCorpus({ subject: "", body: "adults only", corpus: c });
    const llm = fakeLlm('```\n"A welcoming community for all."\n```');
    const staged = await stageRewrites({
      verticalSlug: "real-estate",
      flags: scan.flags,
      corpus: c,
      workspaceId: "ws-1",
      llm,
    });
    assert.equal(staged[0].suggestedReplacement, "A welcoming community for all.");
  });
});

// ── 2. no-LLM deterministic fallback ───────────────────────────────────────

describe("rewrite-and-stage — deterministic fallback (no-LLM safe)", () => {
  it("produces a compliant flag-only-grade fallback when no LLM is wired", async () => {
    const c = corpus();
    const scan = scanCorpus({ subject: "", body: "adults only", corpus: c });
    const staged = await stageRewrites({
      verticalSlug: "real-estate",
      flags: scan.flags,
      corpus: c,
      workspaceId: "ws-1",
      // no llm
    });
    assert.equal(staged.length, 1);
    assert.equal(staged[0].source, "fallback");
    assert.equal(staged[0].gated, false);
    // fair-housing category → neutral redaction guidance, never legal invention.
    assert.match(staged[0].suggestedReplacement, /protected class/i);
  });

  it("falls back deterministically when the LLM call errors", async () => {
    const c = corpus();
    const scan = scanCorpus({ subject: "", body: "no children", corpus: c });
    const staged = await stageRewrites({
      verticalSlug: "real-estate",
      flags: scan.flags,
      corpus: c,
      workspaceId: "ws-1",
      llm: erroringLlm(),
    });
    assert.equal(staged[0].source, "fallback");
    assert.ok(staged[0].suggestedReplacement.length > 0);
  });

  it("prefers a rule's drafter safeRewrite guidance in the fallback", async () => {
    const c = corpus({ safeRewrite: "Describe amenities, not occupants." });
    const scan = scanCorpus({ subject: "", body: "adults only", corpus: c });
    const staged = await stageRewrites({
      verticalSlug: "real-estate",
      flags: scan.flags,
      corpus: c,
      workspaceId: "ws-1",
    });
    assert.equal(staged[0].suggestedReplacement, "Describe amenities, not occupants.");
  });
});

// ── 3. counsel-feedback redline loop ───────────────────────────────────────

describe("counsel-feedback redline loop", () => {
  it("does NOT surface learned language below the threshold", async () => {
    const store = new InMemoryRedlineStore();
    for (let i = 0; i < LEARNED_LANGUAGE_THRESHOLD - 1; i++) {
      await store.record({
        workspaceId: "ws-1",
        verticalSlug: "real-estate",
        ruleId: RULE_ID,
        clausePattern: "adults only",
        preferredLanguage: "A community welcoming to all ages.",
      });
    }
    const learned = await store.learnedLanguageForRule({
      workspaceId: "ws-1",
      verticalSlug: "real-estate",
      ruleId: RULE_ID,
    });
    assert.equal(learned.length, 0, "4 red-lines is below the bar of 5");
  });

  it("surfaces learned language verbatim after 5 agreeing red-lines, over the LLM", async () => {
    const store = new InMemoryRedlineStore();
    const COUNSEL_LANGUAGE = "A community welcoming to households of all ages.";
    for (let i = 0; i < LEARNED_LANGUAGE_THRESHOLD; i++) {
      await store.record({
        workspaceId: "ws-1",
        verticalSlug: "real-estate",
        ruleId: RULE_ID,
        clausePattern: "Adults Only", // mixed case — normalization must bucket it
        preferredLanguage: COUNSEL_LANGUAGE,
        recordedBy: "counsel:bar#12345",
      });
    }

    const c = corpus();
    const scan = scanCorpus({ subject: "", body: "adults only", corpus: c });
    // Wire an LLM that would return something else — learned must win.
    const llm = fakeLlm("SOME OTHER LLM TEXT");
    const staged = await stageRewrites({
      verticalSlug: "real-estate",
      flags: scan.flags,
      corpus: c,
      workspaceId: "ws-1",
      llm,
      redlineStore: store,
    });

    assert.equal(staged[0].source, "learned");
    assert.equal(staged[0].suggestedReplacement, COUNSEL_LANGUAGE);
    assert.equal(llm.calls, 0, "learned language must short-circuit the LLM");
  });

  it("reduceLearnedLanguage requires convergence, not just volume", () => {
    // 5 red-lines, all DIFFERENT preferred language → no convergence.
    const rows: CounselRedline[] = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      workspaceId: "ws-1",
      verticalSlug: "real-estate",
      ruleId: RULE_ID,
      clausePattern: "adults only",
      preferredLanguage: `variant ${i}`,
      rationale: null,
      recordedBy: null,
      createdAt: new Date(),
    }));
    assert.equal(reduceLearnedLanguage(rows).length, 0);

    // Now 5 that agree → converges.
    const agreeing = rows.map((r) => ({ ...r, preferredLanguage: "agreed copy" }));
    const learned = reduceLearnedLanguage(agreeing);
    assert.equal(learned.length, 1);
    assert.equal(learned[0].language, "agreed copy");
    assert.equal(learned[0].supportingRedlineCount, 5);
  });
});

// ── 4. go-live gate ────────────────────────────────────────────────────────

describe("rewrite-and-stage — go-live gate", () => {
  it("withholds the suggestion (but keeps the flag) for a counsel-gated vertical", async () => {
    const c: CorpusBundle = {
      ...corpus(),
      verticalSlug: "mortgage",
      metadata: { ...corpus().metadata, verticalSlug: "mortgage" },
    };
    const scan = scanCorpus({ subject: "", body: "adults only", corpus: c });
    const staged = await stageRewrites({
      verticalSlug: "mortgage", // not in COMPLIANCE_CORPUS_COUNSEL_REVIEWED
      flags: scan.flags,
      corpus: c,
      workspaceId: "ws-1",
      llm: fakeLlm("would-be rewrite"),
    });
    assert.equal(staged[0].source, "gated");
    assert.equal(staged[0].gated, true);
    assert.equal(staged[0].suggestedReplacement, "");
    assert.ok(staged[0].gateNote?.includes("COMPLIANCE_CORPUS_COUNSEL_REVIEWED"));
    // The flag itself is preserved — gating withholds the FIX, not the alert.
    assert.equal(staged[0].flag.ruleId, RULE_ID);
  });

  it("produces suggestions for a gated vertical once the env flag clears it", async () => {
    process.env.COMPLIANCE_CORPUS_COUNSEL_REVIEWED = "mortgage";
    const c: CorpusBundle = {
      ...corpus(),
      verticalSlug: "mortgage",
      metadata: { ...corpus().metadata, verticalSlug: "mortgage" },
    };
    const scan = scanCorpus({ subject: "", body: "adults only", corpus: c });
    const staged = await stageRewrites({
      verticalSlug: "mortgage",
      flags: scan.flags,
      corpus: c,
      workspaceId: "ws-1",
      llm: fakeLlm("cleared rewrite"),
    });
    assert.equal(staged[0].source, "llm");
    assert.equal(staged[0].gated, false);
    assert.equal(staged[0].suggestedReplacement, "cleared rewrite");
  });
});
