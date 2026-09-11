/**
 * lib/approvals/stored-artifact.ts
 *
 * The READ side of ARTIFACT_HANDOFF.
 *
 * `executors/artifact-handoff.ts` freezes the artifact onto the approval
 * row's own payload at the moment of approval. Until this module landed
 * NOTHING read it back: `git grep "plainoApprovalArtifact\|ARTIFACT_PAYLOAD_KEY"`
 * returned seven hits -- three in the writer, four in tests, and ZERO in
 * `app/` or `scripts/`. The customer-facing handoff re-derived its artifact at
 * render time instead, which is precisely the re-derivation
 * artifact-handoff.ts:34-37 argues must not happen, because "a re-derivation
 * at read time would quietly change the customer's record underneath them".
 *
 * WHY THE KEY CONSTANTS LIVE HERE AND NOT IN THE WRITER
 * ----------------------------------------------------
 * `artifact-handoff.ts` imports `node:crypto` for its fingerprint. The reader
 * is called from the approvals page, which feeds a client component, so it
 * must stay free of node builtins. The three shared symbols therefore live
 * here and the writer re-exports them -- ONE definition of the payload key
 * rather than a constant on each side that can drift silently. A drifted key
 * would be invisible: the reader would simply find nothing and fall back
 * forever, which reads exactly like "no row has an artifact yet".
 *
 * WHY THIS VALIDATES RATHER THAN CASTS
 * ------------------------------------
 * `payload` is envelope-encrypted `Json`, decrypted at read time, and
 * `lib/approvals/artifact.ts:468-471` is already explicit that the decrypted
 * payload is NOT statically typed. A stored artifact is therefore untrusted
 * SHAPE, not a typed value: it may predate the current schema version, it may
 * have been written by a different revision, and `decryptPayloadForRead`
 * returns `null` outright on a corrupt envelope. Every bad shape degrades to
 * "no stored artifact" -- the caller re-derives -- and nothing here throws
 * inside a render.
 */

import type {
  ApprovalArtifact,
  ApprovalArtifactRef,
  ApprovalHandoffMode,
} from "./artifact";

/** Reserved payload key. Namespaced so it cannot collide with a skill's own
 *  field, and versioned so a future shape change is detectable rather than
 *  ambiguous. */
export const ARTIFACT_PAYLOAD_KEY = "plainoApprovalArtifact" as const;
export const ARTIFACT_SCHEMA_VERSION = 1 as const;

export interface StoredApprovalArtifact {
  v: typeof ARTIFACT_SCHEMA_VERSION;
  fingerprint: string;
  artifact: unknown;
}

/** The mode vocabulary, duplicated as a runtime Set because the union type is
 *  erased at compile time and this function validates untrusted input. */
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
  for (const x of v) if (typeof x !== "string") return null;
  return v as string[];
}

function readRefs(v: unknown): ApprovalArtifactRef[] | null {
  if (!Array.isArray(v)) return null;
  const out: ApprovalArtifactRef[] = [];
  for (const r of v) {
    if (!isRecord(r)) return null;
    if (typeof r.label !== "string") return null;
    if (r.href !== undefined && typeof r.href !== "string") return null;
    out.push(
      typeof r.href === "string" ? { label: r.label, href: r.href } : { label: r.label },
    );
  }
  return out;
}

function readModes(v: unknown): ApprovalHandoffMode[] | null {
  const raw = stringArray(v);
  // An artifact with NO modes offers the customer nothing. Treated as invalid
  // rather than rendered as an empty control strip.
  if (!raw || raw.length === 0) return null;
  for (const m of raw) if (!HANDOFF_MODES.has(m)) return null;
  return raw as ApprovalHandoffMode[];
}

/**
 * Pull the frozen artifact off a DECRYPTED approval payload.
 *
 * Returns null -- meaning "this row carries no usable stored artifact, the
 * caller should re-derive" -- for every one of: not an object, no reserved
 * key, a schema version this build does not understand, or an artifact whose
 * shape does not validate.
 *
 * Takes the ALREADY-DECRYPTED payload rather than the raw column on purpose.
 * The approvals page decrypts once, for `renderApprovalPayload`; this reads
 * the same value. There is deliberately no second decryption route.
 */
export function readStoredApprovalArtifact(
  decryptedPayload: unknown,
): ApprovalArtifact | null {
  if (!isRecord(decryptedPayload)) return null;

  const stored = decryptedPayload[ARTIFACT_PAYLOAD_KEY];
  if (!isRecord(stored)) return null;
  // An unknown version is not "close enough". The version exists so a shape
  // change is DETECTABLE; honouring it loosely would defeat the field.
  if (stored.v !== ARTIFACT_SCHEMA_VERSION) return null;

  const a = stored.artifact;
  if (!isRecord(a)) return null;

  if (typeof a.kind !== "string" || a.kind.length === 0) return null;
  if (typeof a.filename !== "string" || a.filename.length === 0) return null;
  if (a.subject !== undefined && typeof a.subject !== "string") return null;
  if (a.recipient !== undefined && typeof a.recipient !== "string") return null;

  const blocks = stringArray(a.blocks);
  // `buildApprovalArtifact` guarantees at least one block (it pushes
  // ARTIFACT_EMPTY_NOTICE when everything else was dropped), so an empty
  // `blocks` means the stored value did not come from that builder.
  if (!blocks || blocks.length === 0) return null;

  const provenanceBlocks = stringArray(a.provenanceBlocks);
  if (!provenanceBlocks) return null;

  const refs = readRefs(a.refs);
  if (!refs) return null;

  const modes = readModes(a.modes);
  if (!modes) return null;

  return {
    kind: a.kind as ApprovalArtifact["kind"],
    ...(typeof a.subject === "string" ? { subject: a.subject } : {}),
    ...(typeof a.recipient === "string" ? { recipient: a.recipient } : {}),
    refs,
    blocks,
    provenanceBlocks,
    filename: a.filename,
    modes,
  };
}
