/**
 * lib/storage/counsel-artifact.ts
 *
 * pfd-5 — the storage seam for the signed counsel artifact (the PDF a lawyer
 * signs off the corpus with). This is the abstraction boundary required by
 * `feedback_no_silent_vendor_lock.md`: the operator action stores an artifact
 * REFERENCE through this port, never a raw `@vercel/blob` call.
 *
 * ── why a ref, not an upload in this PR ─────────────────────────────────────
 * The codebase has no `@vercel/blob` dependency wired today, and the
 * established convention for delivered artifacts (CreatorBrief.delivery) is to
 * store a Blob URL/path STRING that the operator obtains out-of-band. We follow
 * that precedent: the operator uploads the signed PDF to Vercel Blob (or the
 * counsel-handoff packet store) and provides the resulting URL/ref. This module
 * VALIDATES + NORMALIZES that ref so a malformed value can't be stored, and is
 * the single place a real `put()` upload plugs in later (the `CounselArtifactStore`
 * port below) without changing any caller.
 *
 * Per the two-implementation rule, the port has a `RefOnlyCounselArtifactStore`
 * (the shipped default) and is shaped so a `BlobCounselArtifactStore` upload
 * impl drops in behind it.
 */

export interface CounselArtifactRef {
  /** The normalized reference string persisted on ComplianceCounselSignoff. */
  ref: string;
}

/**
 * Storage port for the signed counsel artifact. `store` takes whatever the
 * operator provided (a URL today; a File/Buffer when the upload impl lands)
 * and returns the durable ref to persist.
 */
export interface CounselArtifactStore {
  readonly name: string;
  /** Validate + normalize an artifact reference the operator provided. Throws
   *  on an unacceptable ref so the sign-off action fails loudly rather than
   *  storing garbage. */
  storeRef(rawRef: string): Promise<CounselArtifactRef>;
}

/** Accepted artifact ref shapes. We are deliberately permissive about the
 *  destination (Vercel Blob, an https URL, or a `blob://` packet pointer) but
 *  strict that SOMETHING resolvable is present. */
const ACCEPTED_PREFIXES = ["https://", "http://", "blob://"];

export function normalizeCounselArtifactRef(rawRef: string): string {
  const ref = (rawRef ?? "").trim();
  if (!ref) {
    throw new Error(
      "Counsel artifact reference is required — upload the signed PDF and " +
        "paste its URL before recording sign-off.",
    );
  }
  const lower = ref.toLowerCase();
  if (!ACCEPTED_PREFIXES.some((p) => lower.startsWith(p))) {
    throw new Error(
      "Counsel artifact reference must be an https URL or a blob:// pointer " +
        `(got: "${ref.slice(0, 40)}").`,
    );
  }
  return ref;
}

/**
 * The shipped default: the operator uploads the PDF out-of-band and provides
 * the URL/ref. This impl validates + normalizes it. A future
 * `BlobCounselArtifactStore` that accepts the file bytes and calls
 * `@vercel/blob`'s `put()` plugs in behind the same port.
 */
export class RefOnlyCounselArtifactStore implements CounselArtifactStore {
  readonly name = "ref-only" as const;
  async storeRef(rawRef: string): Promise<CounselArtifactRef> {
    return { ref: normalizeCounselArtifactRef(rawRef) };
  }
}

/** Default store instance for callers that don't inject one. */
export const defaultCounselArtifactStore: CounselArtifactStore =
  new RefOnlyCounselArtifactStore();
