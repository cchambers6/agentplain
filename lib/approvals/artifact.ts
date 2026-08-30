/**
 * lib/approvals/artifact.ts
 *
 * The handoff artifact â€” what the customer walks away with.
 *
 * `decideApproval` (lib/approvals/decisions.ts) closes the DECISION loop: it
 * sets status, writes an audit row, captures a preference signal. For the five
 * redemption kinds (connector writes, the two DocuSign actions, the portal
 * message, the recording consent) that decision also triggers a real
 * execution, so the work loop closes with it.
 *
 * For every OTHER kind â€” ~25 of them â€” approval was the end of the line. The
 * customer read a draft, said yes, and then retyped it by hand into their own
 * tool. This module is the missing half: it turns a rendered approval into a
 * STRUCTURED artifact the customer can carry out of agentplain in one tap.
 *
 * Two hard design rules:
 *
 *  1. STRUCTURE FIRST, TEXT DERIVED. `buildApprovalArtifact` returns typed
 *     fields (subject / recipient / refs / blocks); `renderArtifactText` is a
 *     separate function that flattens them. Never the other way round â€” a
 *     later unit turns an approved item into durable graph nodes for the
 *     customer's business and must consume the typed structure rather than
 *     re-parse a blob.
 *
 *  2. PURE. No db, no React, no JSX, no clock, no I/O. Derived from
 *     `RenderedApproval` (which the exhaustive renderApprovalPayload switch
 *     already produces for every WorkApprovalKind), so kind coverage is
 *     complete by construction rather than by a hand-maintained list.
 *
 * Nothing here sends. `mailto` opens the customer's own mail client with the
 * draft pre-filled and their finger on the send button â€” human-initiated,
 * which is exactly the no-outbound contract.
 */

import type { WorkApprovalKind } from "@prisma/client";
import type { RenderedApproval } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";

/** How the customer can carry this artifact out.
 *  - copy     â†’ clipboard, paste anywhere
 *  - download â†’ a .txt file on their machine
 *  - mailto   â†’ their own mail client, pre-filled, unsent */
export type ApprovalHandoffMode = "copy" | "download" | "mailto";

/** One thing Plaino read, carried through from RenderedApproval.sources. */
export interface ApprovalArtifactRef {
  label: string;
  href?: string;
}

export interface ApprovalArtifact {
  kind: WorkApprovalKind;
  subject?: string;
  recipient?: string;
  /** Structured provenance already present on RenderedApproval.sources. */
  refs: ApprovalArtifactRef[];
  /** Ordered content blocks. The text form is DERIVED from these. */
  blocks: string[];
  filename: string;
  modes: ApprovalHandoffMode[];
}

// â”€â”€ Closed-loop kinds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// These five REDEEM the approval into a real execution: the connector write
// runs, the envelope is sent or voided, the portal message becomes visible,
// recording switches on. They already close the loop, so we do not offer a
// competing handoff â€” copy only, for the customer's own records.

export const CLOSED_LOOP_KINDS: ReadonlySet<string> = new Set<string>([
  "CONNECTOR_WRITE_ACTION",
  "DOCUSIGN_SEND_ENVELOPE",
  "DOCUSIGN_VOID_ENVELOPE",
  "PORTAL_CLIENT_MESSAGE",
  "VOICE_RECORDING_CONSENT",
]);

// â”€â”€ Renderer fallback placeholders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// renderApprovalPayload emits these when a payload carried nothing for a
// field. They are correct on a card ("we have nothing to show you") and
// actively wrong in an artifact â€” a customer who copies "No body attached."
// into their own tool got an empty artifact with a green checkmark on it.
// Stripped here, and asserted against in lib/approvals/__tests__/artifact.test.ts.

export const RENDERER_FALLBACK_BLOCKS: readonly string[] = [
  "No body details were attached.",
  "No draft body was attached.",
  "No invite body was drafted.",
  "No nudge body was attached.",
  "No SOP body was drafted.",
  "No body attached.",
  "No brief body attached.",
  "No calendar entries attached.",
  "No match details attached.",
  "No further detail attached.",
  "(no pulse body attached)",
  "(no instruction text captured)",
  "Proposed to-do item.",
  "Price adjustment proposed.",
  "The fleet recommends a change to this listing.",
  "Compliance flagged an item that needs your eyes.",
  "Classified by the inbox-triage agent.",
  "Plaino is still drafting â€” refresh shortly.",
  "Plaino herded this through for your review.",
  "A caller left a message.",
];

/** Emitted only when every block was a placeholder. Deliberately part of the
 *  rejected set: a test that goes green on THIS line has gone green over an
 *  empty artifact, which is the defect this module exists to prevent. */
export const ARTIFACT_EMPTY_NOTICE = "No content was attached to this item.";

const FALLBACK_SET: ReadonlySet<string> = new Set([
  ...RENDERER_FALLBACK_BLOCKS,
  ARTIFACT_EMPTY_NOTICE,
]);

/** True when a block is nothing but a renderer fallback line. */
export function isRendererFallbackBlock(block: string): boolean {
  return FALLBACK_SET.has(block.trim());
}

// Title/recipient fallbacks â€” not body blocks, but equally not real content.
const EMPTY_SUBJECTS: ReadonlySet<string> = new Set(["(no subject)"]);
const EMPTY_TITLES: ReadonlySet<string> = new Set([
  "Unknown lead",
  "Unknown sender",
]);

// â”€â”€ Recipient + subject extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RenderedApproval carries a humanized `recipientLine` ("To: jane@buyer.com
// Re: 142 Peachtree", "To your client: sam@acme.com") rather than discrete
// fields. The artifact needs them apart: `recipient` decides whether mailto
// is offered at all, and `subject` seeds the filename and the mail subject.

const EMAIL_RE = /[^\s,;:<>"'()[\]]+@[^\s,;:<>"'()[\]]+\.[A-Za-z]{2,}/g;

/** Every syntactically-real address in a recipient line, deduped, in order. */
export function extractRecipients(recipientLine?: string): string[] {
  if (!recipientLine) return [];
  const found = recipientLine.match(EMAIL_RE);
  if (!found) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of found) {
    const addr = raw.replace(/[.,;]+$/, "");
    if (seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}

/** The "Re: â€¦" tail of a recipient line, when the renderer put one there. */
function subjectFromRecipientLine(recipientLine?: string): string | undefined {
  if (!recipientLine) return undefined;
  const m = /\bRe:\s*(.+)$/.exec(recipientLine);
  const value = m?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function meaningfulSubject(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v || v.length === 0) return undefined;
  if (EMPTY_SUBJECTS.has(v)) return undefined;
  return v;
}

function meaningfulTitle(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v || v.length === 0) return undefined;
  if (EMPTY_TITLES.has(v)) return undefined;
  return v;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

// â”€â”€ Filename â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Deterministic (no clock â€” this module stays pure and therefore testable).
// "plaino-buyer-inquiry-reply-draft-142-peachtree-ave.txt"

const FILENAME_SLUG_MAX = 48;

function slug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, FILENAME_SLUG_MAX)
    .replace(/-+$/g, "");
}

/** Always non-empty: the kind alone is enough to name a file. */
export function artifactFilename(kind: string, label?: string): string {
  const kindPart = slug(String(kind)) || "approval";
  const labelPart = label ? slug(label) : "";
  const stem = labelPart ? `${kindPart}-${labelPart}` : kindPart;
  return `plaino-${stem}.txt`;
}

// ── Build ────────────────────────────────────────────────────────────────

/**
 * Turn one rendered approval into a structured, carryable artifact.
 *
 * Derived from `RenderedApproval` — NOT from the raw payload — because the
 * exhaustive switch in renderApprovalPayload.ts already normalizes all 30
 * WorkApprovalKind values into that one shape. Coverage of a newly-added kind
 * therefore arrives here for free the moment the renderer handles it.
 */
export function buildApprovalArtifact(
  kind: WorkApprovalKind,
  rendered: RenderedApproval,
): ApprovalArtifact {
  const recipients = extractRecipients(rendered.recipientLine);
  const recipient = recipients.length > 0 ? recipients.join(", ") : undefined;

  const title = meaningfulTitle(rendered.title);
  const subject =
    meaningfulSubject(rendered.admin?.subject) ??
    subjectFromRecipientLine(rendered.recipientLine) ??
    title;

  const blocks: string[] = [];

  // A title that the Subject header does not already carry.
  if (title && title !== subject) blocks.push(title);

  // Office-admin cards carry their substance in structured fields rather
  // than in `body` — a verification code, a reset link, a renewal amount.
  // Losing those would hand the customer an empty artifact.
  const admin = rendered.admin;
  if (admin) {
    const from = meaningfulTitle(admin.fromDisplay);
    if (from) blocks.push(`From: ${from}`);
    if (admin.verificationCode) {
      blocks.push(`Verification code: ${admin.verificationCode}`);
    }
    if (admin.primaryUrl) blocks.push(`Link: ${admin.primaryUrl}`);
    if (admin.amount) blocks.push(`Amount: ${admin.amount}`);
    if (admin.expiresAt) blocks.push(`Ends: ${admin.expiresAt}`);
  }

  // The work product itself. Spacer lines and renderer fallbacks are dropped:
  // blocks are re-joined with blank lines downstream, and a fallback line in
  // an artifact is an empty artifact wearing a checkmark.
  for (const raw of rendered.body) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim().length === 0) continue;
    if (isRendererFallbackBlock(line)) continue;
    blocks.push(line);
  }

  if (rendered.proposedSlots && rendered.proposedSlots.length > 0) {
    blocks.push(
      [
        "Proposed times:",
        ...rendered.proposedSlots.map(
          (s) => `· ${capitalize(s.day)} ${s.startLocal}–${s.endLocal}`,
        ),
      ].join("\n"),
    );
  }

  // Provenance last, and only when the body did not already say it — several
  // renderers put the rationale in BOTH `body` and `reasoning`.
  const already = (s: string) => blocks.some((b) => b === s);
  if (rendered.reasoning && !already(rendered.reasoning)) {
    blocks.push(`Why this was drafted: ${rendered.reasoning}`);
  }
  if (
    rendered.inboundSummary &&
    rendered.inboundSummary !== rendered.reasoning &&
    !already(rendered.inboundSummary)
  ) {
    blocks.push(`In reply to: ${rendered.inboundSummary}`);
  }

  // Defensive only. Deliberately a rejected placeholder so a test can never
  // go green over an artifact with nothing in it.
  if (blocks.length === 0) blocks.push(ARTIFACT_EMPTY_NOTICE);

  const refs: ApprovalArtifactRef[] = (rendered.sources ?? []).map((s) =>
    s.href ? { label: s.label, href: s.href } : { label: s.label },
  );

  return {
    kind,
    subject,
    recipient,
    refs,
    blocks,
    filename: artifactFilename(kind, subject),
    modes: handoffModes(kind, recipient),
  };
}

/**
 * Which handoff affordances this kind gets.
 *
 *  - The five closed-loop kinds redeem into a real execution on approval, so
 *    they get `copy` only — no competing handoff next to an action that
 *    already happened.
 *  - `mailto` is offered only when a real address was parsed out. It opens
 *    the customer's own mail client with their finger on send; nothing here
 *    sends anything.
 *  - Everything else gets copy + download at minimum.
 */
export function handoffModes(
  kind: WorkApprovalKind,
  recipient?: string,
): ApprovalHandoffMode[] {
  if (CLOSED_LOOP_KINDS.has(String(kind))) return ["copy"];
  const modes: ApprovalHandoffMode[] = ["copy", "download"];
  if (recipient && recipient.length > 0) modes.push("mailto");
  return modes;
}

// ── Text derivation ──────────────────────────────────────────────────────

/**
 * Flatten an artifact to plain text — the clipboard payload, the .txt file
 * body, and the mailto body.
 *
 * Strictly downstream of the structure. Nothing computes text first and reads
 * fields back out of it.
 *
 * Note on model-vendor scrubbing: none of the strings THIS module composes
 * name a model vendor, and lib/approvals/__tests__/artifact.test.ts holds
 * that line for every kind. We deliberately do not scrub the customer's own
 * content — silently rewriting a lawyer's paragraph about an AI vendor would
 * be a worse defect than the one we are guarding against.
 */
export function renderArtifactText(a: ApprovalArtifact): string {
  const sections: string[] = [];

  const header: string[] = [];
  if (a.subject) header.push(`Subject: ${a.subject}`);
  if (a.recipient) header.push(`To: ${a.recipient}`);
  if (header.length > 0) sections.push(header.join("\n"));

  sections.push(...a.blocks);

  if (a.refs.length > 0) {
    sections.push(
      [
        "Based on:",
        ...a.refs.map((r) => (r.href ? `· ${r.label} — ${r.href}` : `· ${r.label}`)),
      ].join("\n"),
    );
  }

  return `${sections.join("\n\n").trimEnd()}\n`;
}

/**
 * A `mailto:` href for the artifact — the customer's own mail client, opened
 * by their own click, with the draft pre-filled and unsent. Returns null when
 * the kind has no mailto mode or no address was parsed.
 */
export function artifactMailtoHref(a: ApprovalArtifact): string | null {
  if (!a.modes.includes("mailto") || !a.recipient) return null;
  const params: string[] = [];
  if (a.subject) params.push(`subject=${encodeURIComponent(a.subject)}`);
  params.push(`body=${encodeURIComponent(a.blocks.join("\n\n"))}`);
  const to = a.recipient
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => encodeURIComponent(s))
    .join(",");
  return `mailto:${to}?${params.join("&")}`;
}
