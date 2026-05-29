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
  CHIEF_OF_STAFF_MEETING: "proposed meeting time",
  CHIEF_OF_STAFF_REPLY_DRAFT: "draft reply",
  CHIEF_OF_STAFF_TODO: "proposed to-do",
  INBOX_TRIAGE: "inbox triage",
  FOLLOW_UP_NUDGE: "follow-up nudge",
  PROCESS_DOC_DRAFT: "process doc draft",
  SUPPORT_HANDLER_REPLY_DRAFT: "support reply draft",
  PLAINO_INSTRUCTION: "Plaino instruction",
};

export function renderApprovalPayload(
  kind: WorkApprovalKind,
  payload: unknown,
): RenderedApproval {
  const p = isRecord(payload) ? payload : {};

  // Exhaustive switch — every WorkApprovalKind enum value gets an explicit
  // renderer. Adding a new kind without updating this switch produces a
  // TypeScript error via `_exhaustive: never` rather than silently falling
  // through to a generic "item for review" line. Approvals is the customer
  // trust-stake surface — never render unknown JSON shape to the user.
  switch (kind) {
    case "ADMIN_VERIFICATION_CODE":
    case "ADMIN_PASSWORD_RESET":
    case "ADMIN_TRIAL_ENDING":
    case "ADMIN_BILLING_NOTICE":
    case "ADMIN_SECURITY_ALERT":
      return renderAdmin(kind, p);
    case "BUYER_INQUIRY_REPLY_DRAFT":
      return renderReplyDraft(p);
    case "LISTING_RECOMMENDATION":
      return renderListingRecommendation(p);
    case "PRICING_RECOMMENDATION":
      return renderPricingRecommendation(p);
    case "COMPLIANCE_FLAG":
      return renderComplianceFlag(p);
    case "CHIEF_OF_STAFF_MEETING":
      return renderChiefOfStaffMeeting(p);
    case "CHIEF_OF_STAFF_REPLY_DRAFT":
      return renderChiefOfStaffReplyDraft(p);
    case "CHIEF_OF_STAFF_TODO":
      return renderChiefOfStaffTodo(p);
    case "INBOX_TRIAGE":
      return renderInboxTriage(p);
    case "FOLLOW_UP_NUDGE":
      return renderFollowUpNudge(p);
    case "PROCESS_DOC_DRAFT":
      return renderProcessDocDraft(p);
    case "SUPPORT_HANDLER_REPLY_DRAFT":
      return renderSupportHandlerReplyDraft(p);
    case "PLAINO_INSTRUCTION":
      return renderPlainoInstruction(p);
    default: {
      const _exhaustive: never = kind;
      // Runtime safety: if a new enum value reaches production before the
      // renderer ships, log + render a calm fallback rather than crash
      // the approvals screen. The compile-time check above is the primary
      // defense; this is the belt to its suspenders.
      // eslint-disable-next-line no-console
      console.warn(`[approvals] unhandled WorkApprovalKind: ${String(_exhaustive)}`);
      return {
        kindLabel: String(kind).toLowerCase().replace(/_/g, " "),
        body: ["Plaino herded this through for your review."],
      };
    }
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

/**
 * Chief-of-staff meeting proposal — surfaces the proposed invite subject
 * + body + candidate slots. The customer's own calendar performs any
 * booking; the renderer is read-only on the proposal.
 */
function renderChiefOfStaffMeeting(p: Record<string, unknown>): RenderedApproval {
  const subject = pickString(p, ["subject"]);
  const inviteBody = pickString(p, ["inviteBody", "body"]) ?? "";
  const confidence = pickNumber(p, ["confidence"]);
  const reasoning = pickString(p, ["reasoning"]);
  const attendeeLine = pickAttendeeLine(p);
  const slots = pickChiefOfStaffSlots(p);

  return {
    kindLabel: KIND_LABEL.CHIEF_OF_STAFF_MEETING,
    title: subject ?? "Proposed meeting time",
    recipientLine: attendeeLine,
    body: inviteBody
      ? splitParagraphs(inviteBody)
      : ["No invite body was drafted."],
    metaLine: composeMeta({ confidence, tone: undefined }),
    inboundSummary: reasoning,
    proposedSlots: slots.length > 0 ? slots : undefined,
    editableBody: inviteBody || undefined,
  };
}

/**
 * Chief-of-staff reply draft — same shape as BUYER_INQUIRY_REPLY_DRAFT
 * but attributed to the chief-of-staff slug. Substantive content is
 * deferred to operator merge fields by the skill itself.
 */
function renderChiefOfStaffReplyDraft(
  p: Record<string, unknown>,
): RenderedApproval {
  const subject = pickString(p, ["subject"]);
  const body = pickString(p, ["body"]) ?? "";
  const tone = pickString(p, ["tone"]);
  const confidence = pickNumber(p, ["confidence"]);
  const reasoning = pickString(p, ["reasoning"]);
  const recipient = pickRecipientFromToEmails(p);
  const recipientLine =
    recipient && subject
      ? `To: ${recipient}    Re: ${subject}`
      : recipient
        ? `To: ${recipient}`
        : subject
          ? `Re: ${subject}`
          : undefined;

  return {
    kindLabel: KIND_LABEL.CHIEF_OF_STAFF_REPLY_DRAFT,
    recipientLine,
    body: body ? splitParagraphs(body) : ["No draft body was attached."],
    metaLine: composeMeta({ confidence, tone }),
    inboundSummary: reasoning,
    tone,
    persisted: false,
    editableBody: body || undefined,
  };
}

/**
 * Chief-of-staff to-do — single-line title + context. The customer's
 * own task system writes the row when the operator approves.
 */
function renderChiefOfStaffTodo(p: Record<string, unknown>): RenderedApproval {
  const title = pickString(p, ["title"]);
  const context = pickString(p, ["contextText", "context"]);
  const due = pickString(p, ["suggestedDueLocal", "due"]);
  const confidence = pickNumber(p, ["confidence"]);
  const reasoning = pickString(p, ["reasoning"]);
  const lines: string[] = [];
  if (context) lines.push(context);
  if (due) lines.push(`Suggested due: ${due}`);
  if (lines.length === 0) lines.push("Proposed to-do item.");

  return {
    kindLabel: KIND_LABEL.CHIEF_OF_STAFF_TODO,
    title: title ?? "Proposed to-do",
    body: lines,
    metaLine: composeMeta({ confidence, tone: undefined }),
    inboundSummary: reasoning,
  };
}

/**
 * /general inbox-triage proposal — surfaces a priority bucket, the
 * classifier's reasoning, and (for customer-active and vendor-pending
 * only) the drafted ack body. urgent / needs-decision / noise do not
 * carry a draft.
 */
function renderInboxTriage(p: Record<string, unknown>): RenderedApproval {
  const priority = pickString(p, ["priority"]) ?? "noise";
  const reasoning = pickString(p, ["reasoning"]);
  const confidence = pickNumber(p, ["confidence"]);
  const ackDraft = isRecord(p.ackDraft) ? p.ackDraft : null;
  const draftBody = ackDraft
    ? (pickString(ackDraft, ["body"]) ?? undefined)
    : undefined;
  const draftSubject = ackDraft
    ? pickString(ackDraft, ["subject"])
    : undefined;
  const recipient = ackDraft ? pickRecipientFromToEmails(ackDraft) : undefined;
  const recipientLine =
    recipient && draftSubject
      ? `To: ${recipient}    Re: ${draftSubject}`
      : recipient
        ? `To: ${recipient}`
        : draftSubject
          ? `Re: ${draftSubject}`
          : undefined;
  const tone = ackDraft ? pickString(ackDraft, ["tone"]) : undefined;
  const bodyLines = draftBody
    ? splitParagraphs(draftBody)
    : [
        `Priority: ${priority}`,
        reasoning ?? "Classified by the inbox-triage agent.",
      ];

  return {
    kindLabel: `${KIND_LABEL.INBOX_TRIAGE} — ${priority}`,
    recipientLine,
    body: bodyLines,
    metaLine: composeMeta({ confidence, tone }),
    inboundSummary: reasoning,
    tone,
    editableBody: draftBody,
  };
}

/**
 * /general follow-up nudge — drafted reply quoting the operator's
 * previous send. Always carries body + recipient.
 */
function renderFollowUpNudge(p: Record<string, unknown>): RenderedApproval {
  const subject = pickString(p, ["subject"]);
  const body = pickString(p, ["body"]) ?? "";
  const confidence = pickNumber(p, ["confidence"]);
  const reasoning = pickString(p, ["reasoning"]);
  const stage = pickString(p, ["stage"]);
  const ageDays = pickNumber(p, ["ageDays"]);
  const recipient = pickRecipientFromToEmails(p);
  const recipientLine =
    recipient && subject
      ? `To: ${recipient}    Re: ${subject}`
      : recipient
        ? `To: ${recipient}`
        : subject
          ? `Re: ${subject}`
          : undefined;
  const meta = composeMeta({ confidence, tone: stage ?? undefined });
  const ageLabel =
    typeof ageDays === "number"
      ? `${ageDays}d stale${stage ? ` · ${stage} nudge` : ""}`
      : undefined;
  const metaLine = ageLabel ? `${meta ?? ""}${meta ? " · " : ""}${ageLabel}` : meta;

  return {
    kindLabel: KIND_LABEL.FOLLOW_UP_NUDGE,
    recipientLine,
    body: body ? splitParagraphs(body) : ["No nudge body was attached."],
    metaLine,
    inboundSummary: reasoning,
    persisted: false,
    editableBody: body || undefined,
  };
}

/**
 * /general process-doc-draft — drafted SOP markdown body for the
 * operator to copy into their own documentation system. No recipient,
 * no send affordance.
 */
function renderProcessDocDraft(p: Record<string, unknown>): RenderedApproval {
  const title = pickString(p, ["title"]) ?? "Drafted SOP";
  const body = pickString(p, ["body"]) ?? "";
  const occurrenceCount = pickNumber(p, ["occurrenceCount"]);
  const confidence = pickNumber(p, ["confidence"]);
  const reasoning = pickString(p, ["reasoning"]);
  const occurrenceLine =
    typeof occurrenceCount === "number"
      ? `${occurrenceCount} repeats observed`
      : undefined;
  const meta = composeMeta({ confidence, tone: undefined });
  const metaLine = occurrenceLine
    ? `${meta ?? ""}${meta ? " · " : ""}${occurrenceLine}`
    : meta;

  return {
    kindLabel: KIND_LABEL.PROCESS_DOC_DRAFT,
    title,
    body: body ? splitParagraphs(body) : ["No SOP body was drafted."],
    metaLine,
    inboundSummary: reasoning,
    editableBody: body || undefined,
  };
}

/**
 * Support-handler reply draft — a first-touch reply drafted by
 * lib/skills/support-handler in response to a customer-submitted
 * SupportRequest. Surfaces:
 *   - the draft subject + body (editable)
 *   - the cited substrate snippets (operator can verify before approving)
 *   - the confidence tier + suggested operator action
 *
 * Operator approves / edits / escalates; the customer's existing
 * operator email path performs the send. Never auto-sent.
 */
function renderSupportHandlerReplyDraft(
  p: Record<string, unknown>,
): RenderedApproval {
  const subject = pickString(p, ["subject"]);
  const body = pickString(p, ["body"]) ?? "";
  // The skill writes confidence as a tier-string ("high" / "medium" /
  // "placeholder") and there's no numeric tone here. We expose the tier
  // through the meta line so the operator sees the routing hint.
  const confidenceTier = pickString(p, ["confidence"]);
  const suggestedAction = pickString(p, ["suggestedAction"]);
  const reasoning = pickString(p, ["reasoning"]);
  const citations = pickCitations(p);
  const citationLines =
    citations.length > 0
      ? citations.map(
          (c) =>
            `· ${c.title}${c.similarity !== null ? ` (similarity ${c.similarity.toFixed(2)})` : ""}`,
        )
      : [];
  const metaParts: string[] = [];
  if (confidenceTier) metaParts.push(`confidence: ${confidenceTier}`);
  if (suggestedAction) metaParts.push(`suggested: ${suggestedAction}`);
  const metaLine = metaParts.length > 0 ? metaParts.join(" · ") : undefined;
  const bodyLines = body ? splitParagraphs(body) : ["No draft body was attached."];
  const fullBody =
    citationLines.length > 0
      ? [...bodyLines, "", "Cited snippets:", ...citationLines]
      : bodyLines;

  return {
    kindLabel: KIND_LABEL.SUPPORT_HANDLER_REPLY_DRAFT,
    recipientLine: subject ? `Re: ${subject}` : undefined,
    body: fullBody,
    metaLine,
    inboundSummary: reasoning,
    persisted: false,
    editableBody: body || undefined,
  };
}

/**
 * Render a PLAINO_INSTRUCTION approval queue item — the customer
 * asked the fleet (via /talk) to do concrete work, and the Inngest
 * instruction-handler drafted the artifact into the payload. While
 * the handler is still drafting, payload.status='drafting' and the
 * body shows "still drafting"; once draftBody lands the operator
 * sees the actual work product.
 */
function renderPlainoInstruction(
  p: Record<string, unknown>,
): RenderedApproval {
  const status = pickString(p, ["status"]) ?? "drafting";
  const discipline = pickString(p, ["targetDiscipline"]) ?? "—";
  const instructionText = pickString(p, ["instructionText"]) ?? "";
  const draftBody = pickString(p, ["draftBody"]);
  const draftReasoning = pickString(p, ["draftReasoning"]);
  const honoredRules = pickHonoredRules(p);

  const metaParts: string[] = [`discipline: ${discipline}`];
  if (status) metaParts.push(`status: ${status}`);
  if (honoredRules.length > 0) {
    metaParts.push(`honored ${honoredRules.length} preference rule${honoredRules.length === 1 ? "" : "s"}`);
  }
  const metaLine = metaParts.join(" · ");

  const lines: string[] = [];
  lines.push("Customer instruction:");
  lines.push(instructionText || "(no instruction text captured)");
  lines.push("");
  if (draftBody) {
    lines.push("Drafted by Plaino:");
    lines.push(...splitParagraphs(draftBody));
  } else {
    lines.push("Plaino is still drafting — refresh shortly.");
  }
  if (honoredRules.length > 0) {
    lines.push("");
    lines.push("Customer rules honored:");
    for (const r of honoredRules) {
      lines.push(`· [${r.scope}] ${r.rule}`);
    }
  }

  return {
    kindLabel: KIND_LABEL.PLAINO_INSTRUCTION,
    body: lines,
    metaLine,
    inboundSummary: draftReasoning,
    persisted: false,
    editableBody: draftBody ?? undefined,
  };
}

interface HonoredRule {
  scope: string;
  rule: string;
}

function pickHonoredRules(p: Record<string, unknown>): HonoredRule[] {
  const raw = p.honoredRules;
  if (!Array.isArray(raw)) return [];
  const out: HonoredRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const scope = typeof obj.scope === "string" ? obj.scope : null;
    const rule = typeof obj.rule === "string" ? obj.rule : null;
    if (scope && rule) out.push({ scope, rule });
  }
  return out;
}

interface SupportCitation {
  title: string;
  similarity: number | null;
}

function pickCitations(p: Record<string, unknown>): SupportCitation[] {
  const raw = p.citations;
  if (!Array.isArray(raw)) return [];
  const out: SupportCitation[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const title = pickString(item, ["title"]);
    if (!title) continue;
    const similarity = pickNumber(item, ["similarity"]);
    out.push({ title, similarity: similarity ?? null });
  }
  return out;
}

function pickAttendeeLine(p: Record<string, unknown>): string | undefined {
  const raw = p.attendees;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const emails: string[] = [];
  for (const a of raw) {
    if (a && typeof a === "object") {
      const r = a as Record<string, unknown>;
      const email = typeof r.email === "string" ? r.email : null;
      if (email) emails.push(email);
    }
  }
  if (emails.length === 0) return undefined;
  return `To: ${emails.join(", ")}`;
}

function pickRecipientFromToEmails(
  p: Record<string, unknown>,
): string | undefined {
  const raw = p.toEmails;
  if (!Array.isArray(raw) || raw.length === 0) {
    return pickString(p, ["to", "recipient"]);
  }
  const emails = raw.filter((e): e is string => typeof e === "string");
  if (emails.length === 0) return undefined;
  return emails.join(", ");
}

function pickChiefOfStaffSlots(p: Record<string, unknown>): ProposedSlot[] {
  const raw = p.candidateSlots;
  if (!Array.isArray(raw)) return [];
  const out: ProposedSlot[] = [];
  for (const s of raw) {
    if (s && typeof s === "object") {
      const r = s as Record<string, unknown>;
      const day =
        typeof r.day === "string"
          ? r.day
          : typeof r.dayOfWeek === "string"
            ? r.dayOfWeek
            : null;
      if (
        day &&
        typeof r.startLocal === "string" &&
        typeof r.endLocal === "string"
      ) {
        out.push({
          day,
          startLocal: r.startLocal,
          endLocal: r.endLocal,
        });
      }
    }
  }
  return out;
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
