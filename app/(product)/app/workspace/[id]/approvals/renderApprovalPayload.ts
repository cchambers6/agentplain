import type { WorkApprovalKind } from "@prisma/client";

// Defensive payload renderer. WorkApprovalQueueItem.payload is Prisma `Json` —
// shape varies per kind and isn't statically typed today. This module pulls
// well-known fields out of the payload (subject, body, recipient, etc.) and
// returns a renderable shape; unknown fields are dropped. If nothing
// recognizable is in the payload, falls back to a single line that names what
// the agent proposed without exposing the raw JSON structure (which violates
// design language §4.6: "Rendering raw JSON payload to the user — banned").
//
// When the payload contract for a kind hardens, replace the soft reads here
// with a Zod schema parse and surface validation errors via the audit log.

export interface ProposedSlot {
  day: string;
  startLocal: string;
  endLocal: string;
}

export interface RenderedApproval {
  kindLabel: string;
  recipientLine?: string;
  title?: string;
  body: string[];
  metaLine?: string;
  /** When the inbound message that triggered the draft is in the payload. */
  inboundSummary?: string;
  /** Showing scheduler proposed slots (humanized at render time). */
  proposedSlots?: ProposedSlot[];
  /** Tone the drafter chose, e.g. "warm-direct". Surfaced as a meta tag. */
  tone?: string;
  /** Whether the draft was already persisted to Gmail Drafts (true/false/undefined). */
  persisted?: boolean;
  /** Raw plain-text draft body. Stable contract for the edit sheet to seed from. */
  editableBody?: string;
}

const KIND_LABEL: Record<WorkApprovalKind, string> = {
  COMPLIANCE_FLAG: "compliance flag",
  LISTING_RECOMMENDATION: "listing recommendation",
  BUYER_INQUIRY_REPLY_DRAFT: "draft reply",
  PRICING_RECOMMENDATION: "pricing recommendation",
};

export function renderApprovalPayload(
  kind: WorkApprovalKind,
  payload: unknown,
): RenderedApproval {
  const p = isRecord(payload) ? payload : {};

  switch (kind) {
    case "BUYER_INQUIRY_REPLY_DRAFT":
      return renderReplyDraft(p);
    case "LISTING_RECOMMENDATION":
      return renderListingRecommendation(p);
    case "PRICING_RECOMMENDATION":
      return renderPricingRecommendation(p);
    case "COMPLIANCE_FLAG":
      return renderComplianceFlag(p);
    default:
      return {
        kindLabel: KIND_LABEL[kind] ?? String(kind).toLowerCase(),
        body: ["The fleet surfaced an item for your review."],
      };
  }
}

function renderReplyDraft(p: Record<string, unknown>): RenderedApproval {
  const recipient = pickString(p, ["to", "recipient", "recipientEmail", "buyerEmail"]);
  const subject = pickString(p, ["subject", "re", "thread"]);
  const draft =
    pickString(p, ["draft", "body", "text", "content", "message"]) ?? "";

  const confidence = pickNumber(p, ["confidence", "score"]);
  const threshold = pickString(p, ["threshold", "tier"]);
  const tone = pickString(p, ["tone", "voice"]);
  const inboundSummary = pickString(p, ["inboundSummary", "inbound"]);
  const persisted = pickBool(p, ["persisted"]);
  const proposedSlots = pickSlots(p);

  const recipientLine =
    recipient && subject
      ? `To: ${recipient}    Re: ${subject}`
      : recipient
        ? `To: ${recipient}`
        : subject
          ? `Re: ${subject}`
          : undefined;

  return {
    kindLabel: KIND_LABEL.BUYER_INQUIRY_REPLY_DRAFT,
    recipientLine,
    body: draft ? splitParagraphs(draft) : ["No draft body was attached."],
    metaLine: composeMeta({ threshold, confidence, tone }),
    inboundSummary,
    proposedSlots: proposedSlots.length > 0 ? proposedSlots : undefined,
    tone,
    persisted,
    editableBody: draft || undefined,
  };
}

function renderListingRecommendation(
  p: Record<string, unknown>,
): RenderedApproval {
  const address = pickString(p, ["address", "listingAddress", "subject"]);
  const summary = pickString(p, ["summary", "recommendation", "description"]);
  const rationale = pickString(p, ["rationale", "reason", "why"]);

  return {
    kindLabel: KIND_LABEL.LISTING_RECOMMENDATION,
    title: address,
    body: [
      summary ?? "The fleet recommends a change to this listing.",
      ...(rationale ? [rationale] : []),
    ],
    metaLine: composeMeta({
      confidence: pickNumber(p, ["confidence", "score"]),
      threshold: pickString(p, ["threshold", "tier"]),
    }),
  };
}

function renderPricingRecommendation(
  p: Record<string, unknown>,
): RenderedApproval {
  const address = pickString(p, ["address", "listingAddress", "subject"]);
  const proposed = pickString(p, ["proposed", "proposedPrice", "newPrice"]);
  const current = pickString(p, ["current", "currentPrice"]);
  const rationale = pickString(p, ["rationale", "reason"]);

  const headline =
    proposed && current
      ? `From ${current} to ${proposed}.`
      : proposed
        ? `Proposed: ${proposed}.`
        : "Price adjustment proposed.";

  return {
    kindLabel: KIND_LABEL.PRICING_RECOMMENDATION,
    title: address,
    body: [headline, ...(rationale ? [rationale] : [])],
    metaLine: composeMeta({
      confidence: pickNumber(p, ["confidence", "score"]),
      threshold: pickString(p, ["threshold", "tier"]),
    }),
  };
}

function renderComplianceFlag(p: Record<string, unknown>): RenderedApproval {
  const rule = pickString(p, ["rule", "ruleId", "category"]);
  const summary = pickString(p, ["summary", "reason", "description"]);
  const source = pickString(p, ["source", "where"]);

  return {
    kindLabel: KIND_LABEL.COMPLIANCE_FLAG,
    title: rule,
    body: [
      summary ?? "Compliance flagged an item that needs your eyes.",
      ...(source ? [`Source: ${source}`] : []),
    ],
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(
  rec: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function pickNumber(
  rec: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim().length > 0 && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return undefined;
}

function pickBool(
  rec: Record<string, unknown>,
  keys: string[],
): boolean | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "boolean") return v;
  }
  return undefined;
}

function pickSlots(rec: Record<string, unknown>): ProposedSlot[] {
  const out: ProposedSlot[] = [];
  const sched = rec.scheduledProposal;
  if (!sched || typeof sched !== "object") return out;
  const slots = (sched as Record<string, unknown>).proposedSlots;
  if (!Array.isArray(slots)) return out;
  for (const s of slots) {
    if (s && typeof s === "object") {
      const r = s as Record<string, unknown>;
      if (
        typeof r.day === "string" &&
        typeof r.startLocal === "string" &&
        typeof r.endLocal === "string"
      ) {
        out.push({
          day: r.day,
          startLocal: r.startLocal,
          endLocal: r.endLocal,
        });
      }
    }
  }
  return out;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function composeMeta({
  threshold,
  confidence,
  tone,
}: {
  threshold?: string;
  confidence?: number;
  tone?: string;
}): string | undefined {
  const parts: string[] = [];
  if (threshold) parts.push(`Threshold: ${threshold}`);
  if (typeof confidence === "number") {
    parts.push(`Confidence: ${confidence.toFixed(2)}`);
  }
  if (tone) parts.push(`Tone: ${tone}`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
