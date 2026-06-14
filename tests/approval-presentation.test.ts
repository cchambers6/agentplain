import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveConfidence,
  tierFromScore,
  estimateTimeToApprove,
  isBatchEligible,
  swipeOutcome,
  friendlyTitle,
} from "@/lib/approvals/presentation";

// Pure presentation logic for the approval queue — the rules an owner relies
// on when scanning over coffee. No DOM; just the math + thresholds.

test("tierFromScore: cut-points at 0.8 / 0.5", () => {
  assert.equal(tierFromScore(0.95), "high");
  assert.equal(tierFromScore(0.8), "high");
  assert.equal(tierFromScore(0.79), "medium");
  assert.equal(tierFromScore(0.5), "medium");
  assert.equal(tierFromScore(0.49), "low");
  assert.equal(tierFromScore(0), "low");
});

test("resolveConfidence: numeric score → tier + tone + percent", () => {
  const high = resolveConfidence({ confidence: 0.9 });
  assert.equal(high?.tier, "high");
  assert.equal(high?.tone, "moss");
  assert.equal(high?.percent, 90);
  assert.equal(high?.nudge, undefined);

  const med = resolveConfidence({ confidence: 0.6 });
  assert.equal(med?.tier, "medium");
  assert.equal(med?.tone, "clay");

  const low = resolveConfidence({ confidence: 0.2 });
  assert.equal(low?.tier, "low");
  assert.equal(low?.tone, "mute");
  assert.match(low?.nudge ?? "", /eyes on this/i);
});

test("resolveConfidence: tier string wins over no score, no percent", () => {
  const v = resolveConfidence({ confidenceTier: "high" });
  assert.equal(v?.tier, "high");
  assert.equal(v?.percent, undefined);
});

test("resolveConfidence: no signal → null (chip is omitted, never faked)", () => {
  assert.equal(resolveConfidence({}), null);
});

test("estimateTimeToApprove: glance / long-read / by-length", () => {
  assert.equal(estimateTimeToApprove("ADMIN_VERIFICATION_CODE", { body: ["x"] }), "~15 sec");
  assert.equal(estimateTimeToApprove("ANALYTICS_PULSE", { body: ["x"] }), "~2 min");
  assert.equal(
    estimateTimeToApprove("BUYER_INQUIRY_REPLY_DRAFT", { body: ["short reply here"] }),
    "~30 sec",
  );
  const long = Array.from({ length: 70 }, () => "word word word").join(" ");
  assert.equal(
    estimateTimeToApprove("BUYER_INQUIRY_REPLY_DRAFT", { body: [long] }),
    "~2 min",
  );
});

test("isBatchEligible: routine yes, stakes/critical/low-confidence no", () => {
  // Always-batchable routine kind.
  assert.equal(isBatchEligible("FOLLOW_UP_NUDGE", {}), true);
  // Critical priority overrides everything.
  assert.equal(
    isBatchEligible("FOLLOW_UP_NUDGE", { admin: { priority: "critical" } as never }),
    false,
  );
  // Stakes kinds never batch.
  assert.equal(isBatchEligible("COMPLIANCE_FLAG", {}), false);
  assert.equal(isBatchEligible("PRICING_RECOMMENDATION", { confidence: 0.99 }), false);
  // Draft kinds batch only at high confidence.
  assert.equal(isBatchEligible("BUYER_INQUIRY_REPLY_DRAFT", { confidence: 0.9 }), true);
  assert.equal(isBatchEligible("BUYER_INQUIRY_REPLY_DRAFT", { confidence: 0.6 }), false);
  assert.equal(
    isBatchEligible("SUPPORT_HANDLER_REPLY_DRAFT", { confidenceTier: "high" }),
    true,
  );
  assert.equal(
    isBatchEligible("SUPPORT_HANDLER_REPLY_DRAFT", { confidenceTier: "low" }),
    false,
  );
});

test("swipeOutcome: threshold is a floor + a fraction of width", () => {
  // Wide row: 30% of 300 = 90 px threshold.
  assert.equal(swipeOutcome(100, 300), "approve");
  assert.equal(swipeOutcome(-100, 300), "reject");
  assert.equal(swipeOutcome(50, 300), "none");
  // Narrow row: floor of 72 px applies.
  assert.equal(swipeOutcome(80, 100), "approve");
  assert.equal(swipeOutcome(60, 100), "none");
});

test("friendlyTitle: title → recipient → kind label, never empty", () => {
  assert.equal(friendlyTitle({ title: "Lease renewal for 123 Main St", body: [], kindLabel: "draft reply" } as never), "Lease renewal for 123 Main St");
  assert.equal(friendlyTitle({ recipientLine: "To: jane@buyer.com", body: [], kindLabel: "draft reply" } as never), "To: jane@buyer.com");
  assert.equal(friendlyTitle({ kindLabel: "draft reply", body: [] } as never), "draft reply");
});
