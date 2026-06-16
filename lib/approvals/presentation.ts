/**
 * lib/approvals/presentation.ts
 *
 * Pure presentation logic for the approval queue surface — the things the
 * customer scans before deciding: how confident Plaino is, how long the
 * decision will take, whether it is safe to clear in a batch, and what a
 * swipe gesture means. Extracted from the React tree so every rule is
 * unit-testable without a DOM (tests/approval-presentation.test.ts) and so
 * web + mobile read the SAME thresholds.
 *
 * Confidence colour contract (Conner, customer-value brief):
 *   high   → moss  (forest)   — clear to approve at a glance
 *   medium → clay             — worth a read
 *   low    → mute             — Plaino actively asks for your eyes
 */

import type { RenderedApproval } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";

export type ConfidenceTier = "high" | "medium" | "low";

export interface ConfidenceView {
  tier: ConfidenceTier;
  /** Short chip label — mono, lowercase. */
  label: string;
  /** Brand colour token the chip + rail render in. */
  tone: "moss" | "clay" | "mute";
  /** 0–100 when a numeric score is known; omitted for tier-only sources. */
  percent?: number;
  /** A first-person line Plaino shows on low confidence, asking for review. */
  nudge?: string;
}

const TIER_TONE: Record<ConfidenceTier, ConfidenceView["tone"]> = {
  high: "moss",
  medium: "clay",
  low: "mute",
};

const TIER_LABEL: Record<ConfidenceTier, string> = {
  high: "high confidence",
  medium: "worth a read",
  low: "needs your eyes",
};

const LOW_CONFIDENCE_NUDGE =
  "I'd appreciate your eyes on this one — I wasn't fully sure I got it right.";

/** Map a 0–1 score to a tier using the same cut-points the drafters target. */
export function tierFromScore(score: number): ConfidenceTier {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/**
 * Resolve the confidence chip for a rendered approval. Prefers an explicit
 * tier (the support handler reports "high"/"medium"/"placeholder" strings);
 * otherwise derives a tier from the numeric score. Returns null when the
 * draft carried no confidence signal at all — the chip is simply omitted
 * rather than faked.
 */
export function resolveConfidence(
  rendered: Pick<RenderedApproval, "confidence" | "confidenceTier">,
): ConfidenceView | null {
  let tier: ConfidenceTier | null = null;
  let percent: number | undefined;

  if (rendered.confidenceTier) {
    tier = rendered.confidenceTier;
  } else if (typeof rendered.confidence === "number") {
    const clamped = Math.min(1, Math.max(0, rendered.confidence));
    tier = tierFromScore(clamped);
    percent = Math.round(clamped * 100);
  }

  if (!tier) return null;

  return {
    tier,
    label: TIER_LABEL[tier],
    tone: TIER_TONE[tier],
    percent,
    nudge: tier === "low" ? LOW_CONFIDENCE_NUDGE : undefined,
  };
}

// ── Time-to-approve estimate ─────────────────────────────────────────────
// A grounded, honest read of how long this decision takes — so an owner
// scanning over coffee knows "this is a 15-second yes" vs "set aside two
// minutes". Driven by kind (some cards are a glance) + body length.

/** Kinds that are a near-instant read — confirm a code, accept a nudge. */
const GLANCE_KINDS = new Set<string>([
  "ADMIN_VERIFICATION_CODE",
  "ADMIN_PASSWORD_RESET",
  "CHIEF_OF_STAFF_TODO",
  "FOLLOW_UP_NUDGE",
]);

/** Kinds that are a longer read by nature — weekly digests, briefs. */
const LONG_READ_KINDS = new Set<string>([
  "ANALYTICS_PULSE",
  "FINANCE_PULSE",
  "RESEARCH_BRIEF",
  "CONTENT_CALENDAR",
  "COMPLIANCE_DIGEST",
]);

function wordCount(rendered: Pick<RenderedApproval, "body">): number {
  return rendered.body
    .join(" ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * A human time-to-approve estimate ("~15 sec", "~1 min", "~2 min"). Honest,
 * not aspirational — long digests read as ~2 min, a verification code as a
 * glance.
 */
export function estimateTimeToApprove(
  kind: string,
  rendered: Pick<RenderedApproval, "body">,
): string {
  if (GLANCE_KINDS.has(kind)) return "~15 sec";
  if (LONG_READ_KINDS.has(kind)) return "~2 min";

  const words = wordCount(rendered);
  if (words <= 60) return "~30 sec";
  if (words <= 180) return "~1 min";
  return "~2 min";
}

// ── Batch eligibility ────────────────────────────────────────────────────
// Only routine, low-stakes work may be cleared without opening each item
// ("approve all 12 chase emails"). Anything with stakes — money, listings,
// compliance, anything Plaino flagged critical, anything it's unsure about —
// always demands an individual look.

/** Kinds with real stakes — never batch-clearable, even at high confidence. */
const STAKES_KINDS = new Set<string>([
  "COMPLIANCE_FLAG",
  "COMPLIANCE_DIGEST",
  "PRICING_RECOMMENDATION",
  "LISTING_RECOMMENDATION",
  "ADMIN_SECURITY_ALERT",
  "ADMIN_BILLING_NOTICE",
  "ADMIN_TRIAL_ENDING",
  "CHIEF_OF_STAFF_MEETING",
  // DocuSign send/void are the highest-stakes actions we gate — mailing or
  // cancelling a legal document. Never sweep them up in a batch approve.
  "DOCUSIGN_SEND_ENVELOPE",
  "DOCUSIGN_VOID_ENVELOPE",
]);

/** Routine kinds that are always safe to batch when not flagged critical. */
const ALWAYS_BATCHABLE_KINDS = new Set<string>(["FOLLOW_UP_NUDGE"]);

/** Draft kinds that are batchable only when Plaino is highly confident. */
const HIGH_CONFIDENCE_BATCHABLE_KINDS = new Set<string>([
  "BUYER_INQUIRY_REPLY_DRAFT",
  "CHIEF_OF_STAFF_REPLY_DRAFT",
  "SUPPORT_HANDLER_REPLY_DRAFT",
  "INBOX_TRIAGE",
]);

/**
 * Whether an item is safe to clear in a batch approve. Conservative by
 * design: a "yes to all" should never sweep up something with stakes or
 * something Plaino itself was unsure about.
 */
export function isBatchEligible(
  kind: string,
  rendered: Pick<RenderedApproval, "confidence" | "confidenceTier" | "admin">,
): boolean {
  if (rendered.admin?.priority === "critical") return false;
  if (STAKES_KINDS.has(kind)) return false;
  if (ALWAYS_BATCHABLE_KINDS.has(kind)) return true;

  if (HIGH_CONFIDENCE_BATCHABLE_KINDS.has(kind)) {
    const conf = resolveConfidence(rendered);
    return conf?.tier === "high";
  }
  return false;
}

// ── Swipe gesture ────────────────────────────────────────────────────────
// Mobile-first: swipe right to approve, swipe left to reject. The threshold
// is a fraction of the row width with a floor, so it feels the same on a
// phone and a tablet. Pure so the touch handler stays dumb + testable.

export type SwipeOutcome = "approve" | "reject" | "none";

/** Resolve a horizontal drag delta (px) into an action given the row width. */
export function swipeOutcome(deltaX: number, rowWidthPx: number): SwipeOutcome {
  const threshold = Math.max(72, rowWidthPx * 0.3);
  if (deltaX >= threshold) return "approve";
  if (deltaX <= -threshold) return "reject";
  return "none";
}

// ── Customer-friendly title ──────────────────────────────────────────────

/**
 * The one line that names what this is, for the scannable list row:
 * "Lease renewal letter for 123 Main St". Prefers the rendered title, then
 * the recipient line, then the kind label — never raw JSON, never a slug.
 */
export function friendlyTitle(
  rendered: Pick<RenderedApproval, "title" | "recipientLine" | "kindLabel">,
): string {
  const candidate = rendered.title?.trim() || rendered.recipientLine?.trim();
  if (candidate && candidate.length > 0) return candidate;
  return rendered.kindLabel;
}
