/**
 * lib/approvals/stored-artifact.ts
 *
 * The READER for the artifact that ARTIFACT_HANDOFF captured at approval time.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * lib/approvals/executors/artifact-handoff.ts has written a durable artifact
 * onto every accepted approval row since it shipped. Until this module, it had
 * NO production reader: the only code anywhere that read the key back was an
 * assertion in lib/support/prisma-resolve-store.test.ts. The spine was built
 * and terminated in a `WHERE` clause -- the approvals page queried
 * `status: "PENDING"` only, so approving an item removed the card carrying the
 * copy / download / mailto handoff and nothing rendered the stored artifact
 * that was written to replace it. Approving was the act that took the work
 * away.
 *
 * This is the other end of that spine.
 *
 * THE STORED ARTIFACT WINS. ALWAYS.
 * ---------------------------------
 * `buildApprovalArtifact` is pure and could be re-run at read time, and that
 * is precisely what must NOT happen for an accepted row. The stored artifact
 * is frozen at the moment of approval, so it records WHAT THE HUMAN APPROVED.
 * A re-derivation records what the payload happens to render to NOW -- and the
 * payload is mutable (the edit-before-approve path rewrites it, and the
 * renderer itself changes between releases). For a record whose entire purpose
 * is to say "this is the thing you said yes to", a re-derivation is worse than
 * useless: it carries the full authority of the real record and can silently
 * drift from it.
 *
 * So callers use `readStoredApprovalArtifact` first and only fall back to
 * re-deriving for rows written BEFORE the executor existed. That fallback is
 * marked as a legacy path at every call site.
 *
 * VALIDATION, NOT TRUST
 * ---------------------
 * `StoredApprovalArtifact.artifact` is typed `unknown` by its writer, and the
 * value arrives here from a decrypted JSON column -- so it is parsed, not
 * cast. A row whose stored value is absent, a different schema version, or
 * structurally wrong yields `null`, which routes the caller to the legacy
 * re-derivation rather than to a crash or to a half-populated artifact. The
 * failure mode of a bad read is "you get the older, weaker artifact", never
 * "the page 500s" and never "the customer sees an empty box".
 *
 * PURE. No db, no React, no clock, no I/O -- so it is unit-testable and so the
 * page's server component stays the only thing that touches Prisma.
 */

import type { ApprovalArtifact, ApprovalHandoffMode } from "./artifact";
import {
  ARTIFACT_PAYLOAD_KEY,
  ARTIFACT_SCHEMA_VERSION,
} from "./executors/artifact-handoff";

/** Where a rendered artifact came from. Carried to the UI so the surface can
 *  be honest about which record it is showing, and asserted by the tests so a
 *  regression to live re-derivation is VISIBLE rather than silent. */
export type ApprovalArtifactSource = "stored" | "legacy-rederived";

const HANDOFF_MODES: ReadonlySet<string> = new Set<ApprovalHandoffMode>([
  "copy",
  "download",
  "mailto",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
}

/** `refs` round-trips through JSON as `{label, href?}`. A ref whose label is
 *  not a string is dropped rather than rendered as `undefined`. */
function refs(v: unknown): ApprovalArtifact["refs"] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return null;
  const out: ApprovalArtifact["refs"] = [];
  for (const item of v) {
    if (!isRecord(item)) return null;
    const label = item.label;
    if (typeof label !== "string") return null;
    const href = item.href;
    out.push(typeof href === "string" ? { label, href } : { label });
  }
  return out;
}

function modes(v: unknown): ApprovalHandoffMode[] | null {
  const raw = stringArray(v);
  if (raw === null) return null;
  const out: ApprovalHandoffMode[] = [];
  for (const m of raw) {
    if (!HANDOFF_MODES.has(m)) return null;
    out.push(m as ApprovalHandoffMode);
  }
  return out;
}

/**
 * Read the artifact ARTIFACT_HANDOFF froze onto this row's payload.
 *
 * Returns `null` -- meaning "no usable stored artifact, use the legacy path"
 * -- when the row predates the executor, carries a different schema version,
 * or carries something structurally wrong. Never throws.
 *
 * @param payload the DECRYPTED approval payload. Callers must have run it
 *        through `decryptPayloadForRead` first; this module never sees
 *        ciphertext, exactly as executors never do.
 */
export function readStoredApprovalArtifact(
  payload: unknown,
): ApprovalArtifact | null {
  if (!isRecord(payload)) return null;

  const envelope = payload[ARTIFACT_PAYLOAD_KEY];
  if (!isRecord(envelope)) return null;

  // A version mismatch routes to the legacy path deliberately. A future v2
  // shape is DETECTABLE rather than ambiguous -- which is the whole reason the
  // writer versions the envelope -- and silently reading a v2 body with v1
  // expectations is how a "successful" read returns a plausible wrong answer.
  if (envelope.v !== ARTIFACT_SCHEMA_VERSION) return null;

  const stored = envelope.artifact;
  if (!isRecord(stored)) return null;

  // `blocks` is the load-bearing field: it is the customer's work product and
  // the thing renderArtifactText flattens. An artifact without it is not a
  // weaker artifact, it is an empty box wearing a checkmark.
  const blocks = stringArray(stored.blocks);
  if (blocks === null || blocks.length === 0) return null;

  const provenanceBlocks = stringArray(stored.provenanceBlocks ?? []);
  if (provenanceBlocks === null) return null;

  const parsedRefs = refs(stored.refs);
  if (parsedRefs === null) return null;

  const parsedModes = modes(stored.modes);
  if (parsedModes === null || parsedModes.length === 0) return null;

  if (typeof stored.kind !== "string") return null;
  if (typeof stored.filename !== "string" || stored.filename.length === 0) {
    return null;
  }

  const subject = stored.subject;
  const recipient = stored.recipient;
  if (subject !== undefined && typeof subject !== "string") return null;
  if (recipient !== undefined && typeof recipient !== "string") return null;

  return {
    kind: stored.kind as ApprovalArtifact["kind"],
    subject: subject === undefined ? undefined : subject,
    recipient: recipient === undefined ? undefined : recipient,
    refs: parsedRefs,
    blocks,
    provenanceBlocks,
    filename: stored.filename,
    modes: parsedModes,
  };
}
