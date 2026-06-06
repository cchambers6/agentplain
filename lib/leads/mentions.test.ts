// Pins the Claude-SBM comparison-prospect detection used to tag LeadCapture
// rows. Per project_sbm_wrapper_positioning_2026_06_06 — the operator tracks
// prospects who arrived asking "why not just use Claude". The submit handler
// trusts an explicit widget flag OR infers from the prospect's own words via
// mentionsClaude(); this test locks the matcher so the cohort never silently
// under-counts.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { mentionsClaude } from "./index";

describe("mentionsClaude", () => {
  it("matches Claude / Anthropic mentions, case-insensitively", () => {
    assert.ok(mentionsClaude("why not just use Claude?"));
    assert.ok(mentionsClaude("how is this different from claude for small business"));
    assert.ok(mentionsClaude("we already pay Anthropic"));
    assert.ok(mentionsClaude("ANTHROPIC ships this for free"));
  });

  it("does not match unrelated intent or empty input", () => {
    assert.ok(!mentionsClaude("I want a demo for my brokerage"));
    assert.ok(!mentionsClaude("what does it cost for 5 seats"));
    assert.ok(!mentionsClaude(""));
    assert.ok(!mentionsClaude(null));
    assert.ok(!mentionsClaude(undefined));
  });

  it("requires a word boundary (no false positive on substrings)", () => {
    // "claudette" should not match "claude" mid-word.
    assert.ok(!mentionsClaude("contact claudette in accounting"));
  });
});
