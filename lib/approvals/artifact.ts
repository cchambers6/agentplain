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
//
// THREE THINGS KEEP THAT SHAPE FROM EATING THE CUSTOMER'S OWN WORDS, and all
// three are load-bearing:
//
//  1. Each pattern is keyed to the KINDS WHOSE RENDERER EMITS IT, not to the
//     closed-loop set as a whole. A set-wide gate is not enough: the five are
//     not interchangeable. PORTAL_CLIENT_MESSAGE is the one closed-loop kind
//     that passes arbitrary CUSTOMER PROSE through to `body`, so applying the
//     consent card's sentence to it deleted the customer's own words —
//     "Recording stays off until you approve it here." is chrome on
//     VOICE_RECORDING_CONSENT and is a sentence a contractor may well write
//     to their client on a portal message. DocuSign and connector writes emit
//     no customer prose and so are safe either way, but they are listed
//     explicitly rather than left to that accident.
//  2. The whole set is still gated to CLOSED_LOOP_KINDS, so a kind added to a
//     pattern by mistake fails SAFE (strips nothing) rather than open.
//  3. Each pattern matches the WHOLE sentence — the "only after you approve"
//     clause AND the "Nothing has been/happened" tail — not the opening words.
//
// A bare `/^Awaiting your approval\b/` prefix applied to all 30 kinds is not
// a hypothetical: it shipped, and it silently deleted customer paragraphs. A
// PORTAL_CLIENT_MESSAGE opening "Awaiting your approval on the revised scope,
// we are holding the crew until Friday." lost that paragraph out of the copy,
// the download AND the mailto. Nothing on screen showed the gap, because
// ApprovalHandoff parks the artifact text in an off-screen <textarea>. Silent
// content loss on a customer surface is a worse defect than the chrome it was
// removing. lib/approvals/__tests__/artifact.test.ts pins that exact body.

interface CardChromePattern {
  /** The kinds whose renderer actually emits this shape. A kind absent from
   *  this set keeps the block verbatim, whatever it says. */
  kinds: ReadonlySet<string>;
  re: RegExp;
}

const CARD_CHROME_PATTERNS: readonly CardChromePattern[] = [
  {
    // Three anchors — the opener, the "only after you approve" promise, and
    // the "Nothing has …" tail — so the connector's interpolated app name
    // stays free while customer prose cannot collide. Deliberately NOT
    // dot-all: a paragraph break must not bridge the anchors.
    kinds: new Set([
      "DOCUSIGN_SEND_ENVELOPE",
      "DOCUSIGN_VOID_ENVELOPE",
      "CONNECTOR_WRITE_ACTION",
      "PORTAL_CLIENT_MESSAGE",
    ]),
    re: /^Awaiting your approval\s+—\s.*\bonly after you approve\b.*\bNothing has (?:been|happened)\b/,
  },
  {
    // VOICE_RECORDING_CONSENT states the same pending-state promise in its own
    // words and shares no prefix with the other four, so it gets its own shape.
    // See renderVoiceRecordingConsent: the sentence is emitted as its own block
    // precisely so this can drop it without rewriting the line around it.
    //
    // ONLY that kind. It is a plain English sentence, and on
    // PORTAL_CLIENT_MESSAGE — the one closed-loop kind that carries the
    // customer's own prose — it is something the customer may genuinely have
    // written to their client.
    kinds: new Set(["VOICE_RECORDING_CONSENT"]),
    re: /^Recording stays off until you approve it here\.$/,
  },
];

/** Every kind any chrome pattern is keyed to. Asserted against
 *  CLOSED_LOOP_KINDS by the test suite in both directions. */
export const CARD_CHROME_KINDS: ReadonlySet<string> = new Set<string>(
  CARD_CHROME_PATTERNS.flatMap((p) => [...p.kinds]),
);

/** True when a block describes the approval CARD's pending state rather than
 *  the work the card is about — the class of sentence that is correct under a
 *  pair of approve/reject buttons and FALSE the moment an artifact exists.
 *
 *  `kind` is required, not optional: the per-kind keying is the thing that
 *  stops this from deleting the customer's own prose, so it cannot be
 *  something a caller forgets to pass. */
export function isCardChromeBlock(kind: string, block: string): boolean {
  const k = String(kind);
  if (!CLOSED_LOOP_KINDS.has(k)) return false;
  const trimmed = block.trim();
  return CARD_CHROME_PATTERNS.some((p) => p.kinds.has(k) && p.re.test(trimmed));
}

// Title/recipient fallbacks — not body blocks, but equally not real content.
const EMPTY_SUBJECTS: ReadonlySet<string> = new Set(["(no subject)"]);
const EMPTY_TITLES: ReadonlySet<string> = new Set([
  "Unknown lead",
  "Unknown sender",
]);

// ── Recipient + subject extraction ───────────────────────────────────────
// `RenderedApproval.recipients` is the discrete, authoritative list and is
// the ONLY source of an addressee. `recipientLine` is a HUMANIZED DISPLAY
// STRING that also carries the subject ("To: jane@buyer.com    Re: 142
// Peachtree"), and on every reply-draft kind that subject came from an
// inbound email a stranger sent. Scanning that line for addresses let a
// stranger put themselves on the customer's To: header by writing an address
// into their subject line — no encoding trick required.
//
// There used to be an `extractRecipients` fallback here for "a RenderedApproval
// that predates the discrete field". It has been DELETED, for three reasons:
//
//  • No such value can exist. `recipients` shipped in the same commit as its
//    consumer, and RenderedApproval is a RENDER-TIME type — it is built fresh
//    from the payload on every request and is never persisted, so there is no
//    stored older shape to be compatible with.
//  • It was unreachable and still injectable. Every one of the 9 render sites
//    that shows an addressee sets `recipients`, so the branch never ran — but
//    the exported function still handed a stranger's address back from lines
//    like "To:    Re: hello mallory@evil.example.com" (empty addressee
//    segment) and "To: jane@b.example.com    Re:hello mallory@evil.example.com"
//    (no space after "Re:", so the subject was read as addressee).
//  • Dead code that re-opens a HIGH defect the moment someone adds a 31st
//    kind and forgets the field is worse than no code at all.
//
// The absence is deliberately LOUD rather than silently permissive: a kind
// whose renderer omits `recipients` now yields no recipient, therefore no
// mailto and no To: line, and the test suite asserts both that behaviour and
// that every kind showing an addressee exposes it discretely.

/** Anchored: a whole token must be an address. No whitespace, no CR/LF, no
 *  header separator can survive into a To: line through this. */
const STRICT_EMAIL_RE =
  /^[^\s@,;:<>"'()[\]]+@[^\s@,;:<>"'()[\]]+\.[A-Za-z]{2,}$/;

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
  // The discrete field is the ONLY source of an addressee. There is no parse
  // fallback: a rendered approval that does not state its recipients does not
  // have any, and the artifact fails closed to no To: line and no mailto
  // rather than guessing from a display string that carries a stranger's
  // subject. Still sanitized — the artifact is the last stop before a To:
  // header, so it validates the renderer rather than trusting it.
  const recipients = sanitizeRecipients(rendered.recipients ?? []);
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
    if (isCardChromeBlock(String(kind), line)) continue;
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
    modes: handoffModes(kind, recipient, hasDraft(rendered)),
  };
}

/** True when the renderer stated, discretely, that it produced a DRAFT — a
 *  message written to be sent to someone — rather than only a card body.
 *
 *  `editableBody` is that statement: it is what ApprovalsList puts in the
 *  edit-before-approve textarea, and every renderer sets it exactly when it
 *  has a real drafted message. It is the same discrete-field discipline this
 *  module already applies to recipients, moved to the body. */
function hasDraft(rendered: RenderedApproval): boolean {
  const draft = rendered.editableBody;
  return typeof draft === "string" && draft.trim().length > 0;
}

/**
 * Which handoff affordances this kind gets.
 *
 *  - The five closed-loop kinds redeem into a real execution on approval, so
 *    they get `copy` only — no competing handoff next to an action that
 *    already happened.
 *  - `mailto` needs BOTH a real address AND a real draft. It opens the
 *    customer's own mail client with their finger on send; nothing here
 *    sends anything.
 *  - Everything else gets copy + download at minimum.
 *
 * WHY `hasDraft` IS NOT OPTIONAL
 * -----------------------------
 * An addressee alone does not mean there is a message for that addressee.
 * renderInboxTriage takes its recipient from `ackDraft.toEmails` but falls
 * back to `body = ["Priority: <bucket>", reasoning]` whenever the draft body
 * is missing — and `pickString` counts "", "   " and "\n" as missing. That
 * pair is the fleet's INTERNAL verdict on the sender, and the addressee IS
 * the sender, so the mailto offered to pre-fill an email to a vendor reading
 *
 *     Priority: noise
 *
 *     Low-value vendor solicitation; the sender has been ignored twice before.
 *
 * None of the provenance guards catch it: the labelled "Why this was drafted:"
 * block is suppressed by the `already()` dedupe precisely BECAUSE the
 * reasoning is sitting verbatim in `body`, so `provenanceBlocks` is empty and
 * `artifactBodyBlocks(a, false)` has nothing to drop.
 *
 * Labelling the reasoning as provenance would not close this: "Priority:
 * noise" is an internal verdict too and would still go out. Requiring a draft
 * removes the outbound affordance entirely, which is the honest answer — there
 * is no message to send, so there is nothing to open a mail client over. The
 * customer keeps copy and download; the classification is theirs to read.
 *
 * Latent as of this commit — inbox-triage-general always populates a real
 * body — but the payload is decrypted `Json` read back at render time and the
 * renderer is explicit that it is not statically typed, so the producer's
 * shape is not a guarantee the consumer holds. This fails closed instead.
 */
export function handoffModes(
  kind: WorkApprovalKind,
  recipient: string | undefined,
  hasDraftBody: boolean,
): ApprovalHandoffMode[] {
  if (CLOSED_LOOP_KINDS.has(String(kind))) return ["copy"];
  const modes: ApprovalHandoffMode[] = ["copy", "download"];
  if (recipient && recipient.length > 0 && hasDraftBody) modes.push("mailto");
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
