/**
 * lib/approvals/artifact.ts
 *
 * The handoff artifact — what the customer walks away with.
 *
 * `decideApproval` (lib/approvals/decisions.ts) closes the DECISION loop: it
 * sets status, writes an audit row, captures a preference signal. For the five
 * redemption kinds (connector writes, the two DocuSign actions, the portal
 * message, the recording consent) that decision also triggers a real
 * execution, so the work loop closes with it.
 *
 * For every OTHER kind — ~25 of them — approval was the end of the line. The
 * customer read a draft, said yes, and then retyped it by hand into their own
 * tool. This module is the missing half: it turns a rendered approval into a
 * STRUCTURED artifact the customer can carry out of agentplain in one tap.
 *
 * Three hard design rules:
 *
 *  1. STRUCTURE FIRST, TEXT DERIVED. `buildApprovalArtifact` returns typed
 *     fields (subject / recipient / refs / blocks); `renderArtifactText` is a
 *     separate function that flattens them. Never the other way round — a
 *     later unit turns an approved item into durable graph nodes for the
 *     customer's business and must consume the typed structure rather than
 *     re-parse a blob.
 *
 *  2. PURE. No db, no React, no JSX, no clock, no I/O. Derived from
 *     `RenderedApproval` (which the exhaustive renderApprovalPayload switch
 *     already produces for every WorkApprovalKind), so kind coverage is
 *     complete by construction rather than by a hand-maintained list.
 *
 *  3. AUDIENCE-AWARE. Copy and download go to the CUSTOMER; a mailto body
 *     goes to a THIRD PARTY. Plaino's own rationale is useful in the first
 *     and is a leak in the second, so the two paths are separated rather
 *     than sharing one flattened string. See `provenanceBlocks`.
 *
 * Nothing here sends. `mailto` opens the customer's own mail client with the
 * draft pre-filled and their finger on the send button — human-initiated,
 * which is exactly the no-outbound contract.
 */

import type { WorkApprovalKind } from "@prisma/client";
import type { RenderedApproval } from "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload";

/** How the customer can carry this artifact out.
 *  - copy     → clipboard, paste anywhere
 *  - download → a .txt file on their machine
 *  - mailto   → their own mail client, pre-filled, unsent */
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
  /** The subset of `blocks` that is Plaino's INTERNAL rationale rather than
   *  work product ("Why this was drafted: …", "In reply to: …"). Kept in
   *  `blocks` so copy and download carry it — the customer's own record
   *  should say why the fleet drafted a thing — and excluded from the mailto
   *  body, which is addressed to a third party who has no business reading
   *  the customer's internal justification. */
  provenanceBlocks: string[];
  filename: string;
  modes: ApprovalHandoffMode[];
}

// ── Closed-loop kinds ────────────────────────────────────────────────────
// These five REDEEM the approval into a real execution: the connector write
// runs, the envelope is sent or voided, the portal message becomes visible,
// recording switches on. They already close the loop, so we do not offer a
// competing handoff — copy only, for the customer's own records.

export const CLOSED_LOOP_KINDS: ReadonlySet<string> = new Set<string>([
  "CONNECTOR_WRITE_ACTION",
  "DOCUSIGN_SEND_ENVELOPE",
  "DOCUSIGN_VOID_ENVELOPE",
  "PORTAL_CLIENT_MESSAGE",
  "VOICE_RECORDING_CONSENT",
]);

// ── Renderer fallback placeholders ───────────────────────────────────────
// renderApprovalPayload emits these when a payload carried nothing for a
// field. They are correct on a card ("we have nothing to show you") and
// actively wrong in an artifact — a customer who copies "No body attached."
// into their own tool got an empty artifact with a green checkmark on it.
//
// Stripped here. lib/approvals/__tests__/artifact.test.ts anchors this list
// to the PRODUCER in both directions: every line the renderer emits for an
// empty payload must be recognised here, and every entry here must exist
// verbatim in renderApprovalPayload.ts. A stale or mistyped entry (this list
// carried a mojibake em dash for exactly one release, so the "still drafting"
// placeholder sailed through into customer artifacts) fails the suite.

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
  "Plaino is still drafting — refresh shortly.",
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

// ── Card chrome ──────────────────────────────────────────────────────────
// The five closed-loop kinds open their body with a promise about the CARD's
// state: "Awaiting your approval — Plaino will send this envelope … Nothing
// has been sent." That is exactly right under a pair of approve/reject
// buttons and worthless — worse, false — in an artifact the customer copies
// AFTER approving, at which point the envelope has in fact been sent.
//
// Matched by shape rather than by literal, because the connector variant
// interpolates the app name ("… will run this in Follow Up Boss …") and a
// literal set would silently stop matching the day a new connector lands.

const CARD_CHROME_RE = /^Awaiting your approval\b/;

/** True when a block describes the approval card's state rather than the
 *  work the card is about. */
export function isCardChromeBlock(block: string): boolean {
  return CARD_CHROME_RE.test(block.trim());
}

// Title/recipient fallbacks — not body blocks, but equally not real content.
const EMPTY_SUBJECTS: ReadonlySet<string> = new Set(["(no subject)"]);
const EMPTY_TITLES: ReadonlySet<string> = new Set([
  "Unknown lead",
  "Unknown sender",
]);

// ── Recipient + subject extraction ───────────────────────────────────────
// `RenderedApproval.recipients` is the discrete, authoritative list and is
// what we use. `recipientLine` is a HUMANIZED DISPLAY STRING that also
// carries the subject ("To: jane@buyer.com    Re: 142 Peachtree"), and on
// every reply-draft kind that subject came from an inbound email a stranger
// sent. Scanning the whole line for addresses therefore let a stranger put
// themselves on the customer's To: header by writing an address into their
// subject line — no encoding trick required. `extractRecipients` survives
// only as the fallback for a rendered approval that predates the discrete
// field, and it now reads the addressee segment ALONE.

/** Anchored: a whole token must be an address. No whitespace, no CR/LF, no
 *  header separator can survive into a To: line through this. */
const STRICT_EMAIL_RE =
  /^[^\s@,;:<>"'()[\]]+@[^\s@,;:<>"'()[\]]+\.[A-Za-z]{2,}$/;

/** The addressee segment of a humanized recipient line: the text after a
 *  leading "To…:" label and before the " Re: " that introduces the subject.
 *  Returns null when the line has no addressee label at all — a bare
 *  "Re: <subject>" line addresses nobody. */
function addresseeSegment(recipientLine: string): string | null {
  const labelled = /^\s*To\b[^:]*:\s*(.*)$/i.exec(recipientLine);
  if (!labelled) return null;
  const rest = labelled[1] ?? "";
  const subjectAt = rest.search(/\s+Re:\s/i);
  return subjectAt >= 0 ? rest.slice(0, subjectAt) : rest;
}

/** Every syntactically-real address in the ADDRESSEE SEGMENT of a recipient
 *  line, deduped, in order. Never scans the subject. */
export function extractRecipients(recipientLine?: string): string[] {
  if (!recipientLine) return [];
  const segment = addresseeSegment(recipientLine);
  if (segment === null) return [];
  return sanitizeRecipients(segment.split(/[,\s]+/));
}

/** Keep only whole, syntactically-real addresses, deduped, in order. Applied
 *  to the renderer's discrete list too — the artifact is the last stop before
 *  a To: header, so it validates rather than trusts. */
export function sanitizeRecipients(candidates: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidates) {
    const addr = raw.trim().replace(/[.,;]+$/, "");
    if (!STRICT_EMAIL_RE.test(addr)) continue;
    if (seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}

/** The "Re: …" tail of a recipient line, when the renderer put one there. */
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

// ── Refs ─────────────────────────────────────────────────────────────────
// The support handler labels its citations with the retrieval score it came
// back with ("Owner statements — export path (similarity 0.91)"). That is a
// reasonable debugging affordance on screen and it is machine exhaust on a
// surface the customer pastes into a client email. Stripped here only; the
// on-screen renderer keeps its label.

const SIMILARITY_SUFFIX_RE = /\s*\(similarity\s+[0-9]*\.?[0-9]+\)\s*$/i;

export function refLabelForArtifact(label: string): string {
  return label.replace(SIMILARITY_SUFFIX_RE, "").trim();
}

// ── Filename ─────────────────────────────────────────────────────────────
// Deterministic (no clock — this module stays pure and therefore testable).
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
  // The discrete field is authoritative. Parsing the humanized line is the
  // legacy path only, and it reads the addressee segment alone — see the
  // note above `extractRecipients`.
  const recipients = rendered.recipients
    ? sanitizeRecipients(rendered.recipients)
    : extractRecipients(rendered.recipientLine);
  const recipient = recipients.length > 0 ? recipients.join(", ") : undefined;

  const title = meaningfulTitle(rendered.title);
  const subject =
    meaningfulSubject(rendered.admin?.subject) ??
    subjectFromRecipientLine(rendered.recipientLine) ??
    title;

  const blocks: string[] = [];

  // A closed-loop artifact is a record of an ACTION, not of a card. The
  // renderer's own kind label is the honest one-liner for what was
  // authorized; the card's "Awaiting your approval …" promise is dropped
  // below because by the time this is copied it is no longer true.
  if (CLOSED_LOOP_KINDS.has(String(kind)) && rendered.kindLabel) {
    blocks.push(`Action: ${capitalize(rendered.kindLabel.trim())}`);
  }

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

  // The work product itself. Spacer lines, renderer fallbacks and card chrome
  // are dropped: blocks are re-joined with blank lines downstream, a fallback
  // line in an artifact is an empty artifact wearing a checkmark, and a card
  // promise ("Nothing has been sent") is a false statement once it has.
  for (const raw of rendered.body) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim().length === 0) continue;
    if (isRendererFallbackBlock(line)) continue;
    if (isCardChromeBlock(line)) continue;
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
  // renderers put the rationale in BOTH `body` and `reasoning`. Tracked
  // separately so the outbound (mailto) path can leave it behind.
  const provenanceBlocks: string[] = [];
  const already = (s: string) => blocks.some((b) => b === s);
  if (rendered.reasoning && !already(rendered.reasoning)) {
    provenanceBlocks.push(`Why this was drafted: ${rendered.reasoning}`);
  }
  if (
    rendered.inboundSummary &&
    rendered.inboundSummary !== rendered.reasoning &&
    !already(rendered.inboundSummary)
  ) {
    provenanceBlocks.push(`In reply to: ${rendered.inboundSummary}`);
  }
  blocks.push(...provenanceBlocks);

  // Defensive only. Deliberately a rejected placeholder so a test can never
  // go green over an artifact with nothing in it.
  if (blocks.length === 0) blocks.push(ARTIFACT_EMPTY_NOTICE);

  const refs: ApprovalArtifactRef[] = (rendered.sources ?? []).map((s) => {
    const label = refLabelForArtifact(s.label);
    return s.href ? { label, href: s.href } : { label };
  });

  return {
    kind,
    subject,
    recipient,
    refs,
    blocks,
    provenanceBlocks,
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
 *  - `mailto` is offered only when a real address was parsed. It opens
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

export interface ArtifactTextOptions {
  /** Include Plaino's internal rationale blocks. True for the customer's own
   *  copy and .txt download; FALSE for the mailto body, which is addressed to
   *  a third party. Defaults to true. */
  includeProvenance?: boolean;
}

/**
 * Flatten an artifact to plain text — the clipboard payload, the .txt file
 * body, and (with provenance omitted) the mailto body.
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
export function renderArtifactText(
  a: ApprovalArtifact,
  opts: ArtifactTextOptions = {},
): string {
  const includeProvenance = opts.includeProvenance ?? true;
  const sections: string[] = [];

  const header: string[] = [];
  if (a.subject) header.push(`Subject: ${a.subject}`);
  if (a.recipient) header.push(`To: ${a.recipient}`);
  if (header.length > 0) sections.push(header.join("\n"));

  sections.push(...artifactBodyBlocks(a, includeProvenance));

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

/** `blocks`, optionally with the internal-rationale blocks removed. */
export function artifactBodyBlocks(
  a: ApprovalArtifact,
  includeProvenance: boolean,
): string[] {
  if (includeProvenance || a.provenanceBlocks.length === 0) return [...a.blocks];
  const drop = new Set(a.provenanceBlocks);
  const kept = a.blocks.filter((b) => !drop.has(b));
  // Never hand back a silently empty body: an artifact whose only content was
  // provenance has nothing to say to a third party, and the empty notice is
  // the honest thing to put there.
  return kept.length > 0 ? kept : [ARTIFACT_EMPTY_NOTICE];
}

/**
 * A `mailto:` href for the artifact — the customer's own mail client, opened
 * by their own click, with the draft pre-filled and unsent. Returns null when
 * the kind has no mailto mode or no address was parsed.
 *
 * The body deliberately omits `provenanceBlocks`. This message is addressed
 * to the customer's counterparty; "Why this was drafted: the vendor asked for
 * a renewal decision by end of week" is the fleet's internal note about that
 * counterparty and has no business in a pre-filled email to them.
 */
export function artifactMailtoHref(a: ApprovalArtifact): string | null {
  if (!a.modes.includes("mailto") || !a.recipient) return null;
  const params: string[] = [];
  if (a.subject) params.push(`subject=${encodeURIComponent(a.subject)}`);
  const body = artifactBodyBlocks(a, false).join("\n\n");
  params.push(`body=${encodeURIComponent(body)}`);
  const to = a.recipient
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => encodeURIComponent(s))
    .join(",");
  return `mailto:${to}?${params.join("&")}`;
}
