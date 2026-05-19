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
  /** Office-admin extension — see renderAdmin* helpers below. */
  admin?: AdminRenderExtension;
}

/** Office-admin render fields. Distinct from the legacy draft fields so
 *  the renderer can switch on `admin !== undefined` to pick the admin
 *  card layout. */
export interface AdminRenderExtension {
  category:
    | 'email-verification'
    | 'verification-code'
    | 'password-reset'
    | 'trial-expiration'
    | 'billing-notice'
    | 'subscription-confirmation'
    | 'service-status'
    | 'email-preferences'
    | 'account-suspension';
  priority: 'critical' | 'normal' | 'low';
  fromDisplay: string;
  subject: string;
  /** 4–8 digit code, displayed prominently for the verification-code kind. */
  verificationCode?: string;
  /** Primary URL for password-reset / verify-email kinds. Rendered as a
   *  "Open" button — the user opens it in their own browser. */
  primaryUrl?: string;
  /** ISO date for trial expirations. */
  expiresAt?: string;
  /** Service name (Stripe, Microsoft, etc.) — shown in the eyebrow. */
  serviceName?: string;
  /** Money amount in a billing notice ("$12.99"). */
  amount?: string;
  /** Suggested draft body — only for billing notices + trial reminders. */
  draftBody?: string;
  /** Confidence the classifier reported (0–1). */
  confidence: number;
}

const KIND_LABEL: Record<WorkApprovalKind, string> = {
  COMPLIANCE_FLAG: "compliance flag",
  LISTING_RECOMMENDATION: "listing recommendation",
  BUYER_INQUIRY_REPLY_DRAFT: "draft reply",
  PRICING_RECOMMENDATION: "pricing recommendation",
  ADMIN_VERIFICATION_CODE: "verification code",
  ADMIN_PASSWORD_RESET: "password reset",
  ADMIN_TRIAL_ENDING: "trial ending",
  ADMIN_BILLING_NOTICE: "billing notice",
  ADMIN_SECURITY_ALERT: "security alert",
};

const ADMIN_KINDS: ReadonlyArray<WorkApprovalKind> = [
  "ADMIN_VERIFICATION_CODE",
  "ADMIN_PASSWORD_RESET",
  "ADMIN_TRIAL_ENDING",
  "ADMIN_BILLING_NOTICE",
  "ADMIN_SECURITY_ALERT",
];

export function renderApprovalPayload(
  kind: WorkApprovalKind,
  payload: unknown,
): RenderedApproval {
  const p = isRecord(payload) ? payload : {};

  if (ADMIN_KINDS.includes(kind)) {
    return renderAdmin(kind, p);
  }

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

const ADMIN_CATEGORY_VALUES = [
  "email-verification",
  "verification-code",
  "password-reset",
  "trial-expiration",
  "billing-notice",
  "subscription-confirmation",
  "service-status",
  "email-preferences",
  "account-suspension",
] as const;

type AdminCategoryValue = (typeof ADMIN_CATEGORY_VALUES)[number];

const ADMIN_PRIORITY_VALUES = ["critical", "normal", "low"] as const;
type AdminPriorityValue = (typeof ADMIN_PRIORITY_VALUES)[number];

function renderAdmin(
  kind: WorkApprovalKind,
  p: Record<string, unknown>,
): RenderedApproval {
  const title = pickString(p, ["title"]);
  const category = pickAdminCategory(p) ?? defaultCategoryFor(kind);
  const priority = pickAdminPriority(p) ?? "normal";
  const fromDisplay = pickString(p, ["fromDisplay", "from"]) ?? "Unknown sender";
  const subject = pickString(p, ["subject"]) ?? "(no subject)";
  const confidence = pickNumber(p, ["confidence"]) ?? 0;
  const signals = isRecord(p.signals) ? (p.signals as Record<string, unknown>) : {};
  const verificationCode = pickString(signals, ["verificationCode"]);
  const primaryUrl = pickString(signals, ["primaryUrl"]);
  const expiresAt = pickString(signals, ["expiresAt"]);
  const serviceName = pickString(signals, ["serviceName"]);
  const amount = pickString(signals, ["amount"]);
  const draftBody = pickString(p, ["draftBody"]);
  const body = pickStringArray(p, ["body"]);

  const eyebrowParts = [KIND_LABEL[kind]];
  if (serviceName) eyebrowParts.push(serviceName.toLowerCase());

  return {
    kindLabel: eyebrowParts.join(" · "),
    title: title ?? KIND_LABEL[kind],
    body: body.length > 0 ? body : ["No body details were attached."],
    metaLine: composeAdminMeta({ confidence, expiresAt, amount, priority }),
    editableBody: draftBody && draftBody.trim().length > 0 ? draftBody : undefined,
    admin: {
      category,
      priority,
      fromDisplay,
      subject,
      verificationCode,
      primaryUrl,
      expiresAt,
      serviceName,
      amount,
      draftBody: draftBody && draftBody.trim().length > 0 ? draftBody : undefined,
      confidence,
    },
  };
}

function defaultCategoryFor(kind: WorkApprovalKind): AdminCategoryValue {
  switch (kind) {
    case "ADMIN_VERIFICATION_CODE":
      return "verification-code";
    case "ADMIN_PASSWORD_RESET":
      return "password-reset";
    case "ADMIN_TRIAL_ENDING":
      return "trial-expiration";
    case "ADMIN_SECURITY_ALERT":
      return "account-suspension";
    case "ADMIN_BILLING_NOTICE":
      return "billing-notice";
    default:
      return "billing-notice";
  }
}

function pickAdminCategory(
  p: Record<string, unknown>,
): AdminCategoryValue | undefined {
  const raw = p.category;
  if (typeof raw === "string" && (ADMIN_CATEGORY_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as AdminCategoryValue;
  }
  return undefined;
}

function pickAdminPriority(
  p: Record<string, unknown>,
): AdminPriorityValue | undefined {
  const raw = p.priority;
  if (typeof raw === "string" && (ADMIN_PRIORITY_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as AdminPriorityValue;
  }
  return undefined;
}

function pickStringArray(
  rec: Record<string, unknown>,
  keys: string[],
): string[] {
  for (const k of keys) {
    const v = rec[k];
    if (Array.isArray(v)) {
      return v.filter((s): s is string => typeof s === "string" && s.length > 0);
    }
  }
  return [];
}

function composeAdminMeta({
  confidence,
  expiresAt,
  amount,
  priority,
}: {
  confidence: number;
  expiresAt?: string;
  amount?: string;
  priority: AdminPriorityValue;
}): string | undefined {
  const parts: string[] = [];
  parts.push(`Priority: ${priority}`);
  parts.push(`Confidence: ${confidence.toFixed(2)}`);
  if (amount) parts.push(`Amount: ${amount}`);
  if (expiresAt) {
    const formatted = formatExpiresAt(expiresAt);
    if (formatted) parts.push(`Ends: ${formatted}`);
  }
  return parts.join(" · ");
}

function formatExpiresAt(iso: string): string | null {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return null;
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
