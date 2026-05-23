import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WorkApprovalKind } from "@prisma/client";

import {
  renderApprovalPayload,
  type RenderedApproval,
} from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";

// Approvals is the customer trust-stake screen — every WorkApprovalKind
// must render via an explicit handler that pulls structured fields out of
// payload, never the raw JSON. The renderer's switch is exhausted at the
// type layer (`_exhaustive: never` in the default branch); these tests
// pin the per-kind output so a renderer regression fails CI.

const ALL_KINDS: WorkApprovalKind[] = [
  "COMPLIANCE_FLAG",
  "LISTING_RECOMMENDATION",
  "BUYER_INQUIRY_REPLY_DRAFT",
  "PRICING_RECOMMENDATION",
  "ADMIN_VERIFICATION_CODE",
  "ADMIN_PASSWORD_RESET",
  "ADMIN_TRIAL_ENDING",
  "ADMIN_BILLING_NOTICE",
  "ADMIN_SECURITY_ALERT",
];

describe("approvals payload renderer", () => {
  it("every WorkApprovalKind produces a renderable shape with a kind label", () => {
    for (const kind of ALL_KINDS) {
      const out = renderApprovalPayload(kind, {});
      assert.ok(
        out.kindLabel && out.kindLabel.length > 0,
        `${kind} produced no kindLabel`,
      );
      assert.ok(Array.isArray(out.body), `${kind} body must be an array`);
      assert.ok(out.body.length > 0, `${kind} body must be non-empty`);
    }
  });

  it("BUYER_INQUIRY_REPLY_DRAFT pulls structured from/to/subject/body out of payload", () => {
    const out = renderApprovalPayload("BUYER_INQUIRY_REPLY_DRAFT", {
      to: "sarah@example.com",
      subject: "142 Oak St showing",
      body: "Hi Sarah,\n\nThanks for the note.\n\nBest,\nMarcus",
      confidence: 0.83,
      tone: "warm-direct",
      threshold: "Regular",
      persisted: true,
      inboundSummary: "Sarah asked about Saturday morning showing slots.",
    });
    assert.equal(out.kindLabel, "draft reply");
    assert.equal(out.recipientLine, "To: sarah@example.com    Re: 142 Oak St showing");
    assert.deepEqual(out.body, ["Hi Sarah,", "Thanks for the note.", "Best,\nMarcus"]);
    assert.equal(out.tone, "warm-direct");
    assert.equal(out.persisted, true);
    assert.equal(out.inboundSummary, "Sarah asked about Saturday morning showing slots.");
    assert.equal(
      out.metaLine,
      "Threshold: Regular · Confidence: 0.83 · Tone: warm-direct",
    );
    assert.equal(out.editableBody, "Hi Sarah,\n\nThanks for the note.\n\nBest,\nMarcus");
  });

  it("BUYER_INQUIRY_REPLY_DRAFT surfaces proposed slots from scheduledProposal", () => {
    const out = renderApprovalPayload("BUYER_INQUIRY_REPLY_DRAFT", {
      to: "sarah@example.com",
      body: "Slots below.",
      scheduledProposal: {
        proposedSlots: [
          { day: "saturday", startLocal: "10:00", endLocal: "10:45" },
          { day: "saturday", startLocal: "11:00", endLocal: "11:45" },
        ],
      },
    });
    assert.equal(out.proposedSlots?.length, 2);
    assert.equal(out.proposedSlots?.[0].day, "saturday");
    assert.equal(out.proposedSlots?.[1].startLocal, "11:00");
  });

  it("ADMIN_VERIFICATION_CODE renders the code prominently from signals.verificationCode", () => {
    const out = renderApprovalPayload("ADMIN_VERIFICATION_CODE", {
      category: "verification-code",
      priority: "critical",
      fromDisplay: "Microsoft account team",
      subject: "Verify your Microsoft account",
      confidence: 0.97,
      signals: { verificationCode: "482913", serviceName: "Microsoft" },
    });
    assert.equal(out.admin?.category, "verification-code");
    assert.equal(out.admin?.verificationCode, "482913");
    assert.equal(out.admin?.fromDisplay, "Microsoft account team");
    assert.equal(out.admin?.subject, "Verify your Microsoft account");
    assert.equal(out.admin?.priority, "critical");
    assert.equal(out.kindLabel, "verification code · microsoft");
  });

  it("ADMIN_PASSWORD_RESET surfaces the primaryUrl as an actionable link", () => {
    const out = renderApprovalPayload("ADMIN_PASSWORD_RESET", {
      category: "password-reset",
      priority: "normal",
      fromDisplay: "Slack",
      subject: "Reset your Slack password",
      confidence: 0.92,
      signals: { primaryUrl: "https://slack.com/reset/abc123" },
    });
    assert.equal(out.admin?.primaryUrl, "https://slack.com/reset/abc123");
    assert.equal(out.admin?.category, "password-reset");
  });

  it("ADMIN_TRIAL_ENDING surfaces expiry + amount from signals", () => {
    const out = renderApprovalPayload("ADMIN_TRIAL_ENDING", {
      category: "trial-expiration",
      priority: "normal",
      fromDisplay: "Notion",
      subject: "Your trial ends in 3 days",
      confidence: 0.88,
      signals: { expiresAt: "2026-06-03T00:00:00Z", amount: "$12.00" },
    });
    assert.equal(out.admin?.expiresAt, "2026-06-03T00:00:00Z");
    assert.equal(out.admin?.amount, "$12.00");
    assert.ok(out.metaLine?.includes("Amount: $12.00"));
    assert.ok(out.metaLine?.includes("Ends:"));
  });

  it("ADMIN_SECURITY_ALERT defaults priority to normal when payload omits it", () => {
    const out = renderApprovalPayload("ADMIN_SECURITY_ALERT", {
      fromDisplay: "Google",
      subject: "Unusual sign-in attempt",
      confidence: 0.74,
    });
    assert.equal(out.admin?.category, "account-suspension");
    assert.equal(out.admin?.priority, "normal");
  });

  it("LISTING_RECOMMENDATION pulls address as title + summary + rationale into body", () => {
    const out = renderApprovalPayload("LISTING_RECOMMENDATION", {
      address: "142 Oak St, Atlanta GA",
      summary: "Recommend updating the third photo.",
      rationale: "Buyer click-through on listing dropped 22% week-over-week.",
      confidence: 0.81,
      threshold: "Regular",
    });
    assert.equal(out.title, "142 Oak St, Atlanta GA");
    assert.deepEqual(out.body, [
      "Recommend updating the third photo.",
      "Buyer click-through on listing dropped 22% week-over-week.",
    ]);
    assert.equal(out.metaLine, "Threshold: Regular · Confidence: 0.81");
  });

  it("PRICING_RECOMMENDATION composes a from/to headline when both prices are present", () => {
    const out = renderApprovalPayload("PRICING_RECOMMENDATION", {
      address: "142 Oak St",
      current: "$535,000",
      proposed: "$519,000",
      rationale: "Three comps within 0.5mi closed below ask.",
      confidence: 0.79,
    });
    assert.equal(out.body[0], "From $535,000 to $519,000.");
    assert.equal(out.body[1], "Three comps within 0.5mi closed below ask.");
  });

  it("COMPLIANCE_FLAG uses ruleId/category as title and surfaces source", () => {
    const out = renderApprovalPayload("COMPLIANCE_FLAG", {
      rule: "FHA-protected-classes",
      summary: "Draft references neighborhood demographics — likely protected-class language.",
      source: "draft body line 4",
    });
    assert.equal(out.title, "FHA-protected-classes");
    assert.deepEqual(out.body, [
      "Draft references neighborhood demographics — likely protected-class language.",
      "Source: draft body line 4",
    ]);
  });

  it("never returns body containing raw JSON.stringify of the payload", () => {
    // Hardens against accidental fallthrough to raw payload rendering.
    // A payload with a unique magic string should NOT appear verbatim in
    // body — the renderer reads named fields, never the whole object.
    const magic = "MAGIC-DO-NOT-RENDER-RAW-7be19f";
    const out: RenderedApproval = renderApprovalPayload("BUYER_INQUIRY_REPLY_DRAFT", {
      unrecognizedField: magic,
    });
    for (const line of out.body) {
      assert.ok(
        !line.includes(magic),
        "renderer must not pass-through unknown payload fields verbatim",
      );
    }
  });
});
