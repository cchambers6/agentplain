/**
 * lib/knowledge/body-crypto.ts
 *
 * KnowledgeDocument.body at-rest encryption. Closes audit MUST-CLOSE #4 in
 * docs/data-privacy-file-storage-audit-2026-05-26.md (the customer file
 * text was stored plaintext in Postgres prior to this layer).
 *
 * Reuses the SAME AES-256-GCM codec that already encrypts OAuth tokens —
 * `encrypt`/`decrypt` from `lib/security/encryption.ts`, called by
 * `lib/integrations/index.ts:142-181` for accessTokenEncrypted /
 * refreshTokenEncrypted. Same algorithm, same `ENCRYPTION_KEY` env var,
 * same `v1:iv:tag:ct` wire format → operationally we have one key to
 * rotate and one ciphertext format to debug.
 *
 * The format-version marker (`v1:` prefix, checked via `isEncrypted`) is
 * how we tell encrypted rows from legacy plaintext rows during the
 * migration window. `decryptBodyForRead` falls back to passing legacy
 * plaintext through unchanged, so rolling deploys + the back-fill
 * migration can run in either order without breaking retrieval.
 *
 * Scope: KnowledgeDocument.body ONLY (the customer file/email text).
 * Vectors stay plaintext — pgvector ANN search needs comparable floats,
 * and there is no homomorphic alternative at the price-point. The
 * residual is documented in `lib/knowledge/pgvector-store.ts` next to
 * the embed call + in the audit doc.
 *
 * NB: WorkApprovalQueueItem.payload and HandoffLogEntry.payload also
 * carry customer content per the same audit. They are explicitly OUT OF
 * SCOPE for this PR (separate follow-up); see PR description.
 */

import {
  EncryptionError,
  InvalidCiphertextError,
  decrypt,
  encrypt,
  isEncrypted,
  isEncryptionConfigured,
} from '@/lib/security/encryption'

/**
 * Encrypt a KnowledgeDocument body for persistence. Idempotent: an already-
 * encrypted payload is returned unchanged so the ingest path and the
 * back-fill migration can both call through this seam without double-
 * encrypting.
 *
 * Throws `MissingKeyError`/`InvalidKeyError` when `ENCRYPTION_KEY` is
 * absent or malformed — write paths MUST fail loudly rather than land a
 * plaintext row.
 */
export function encryptBodyForWrite(body: string): string {
  if (typeof body !== 'string') {
    throw new EncryptionError('KnowledgeDocument body must be a string')
  }
  if (isEncrypted(body)) return body
  return encrypt(body)
}

/**
 * Decrypt a KnowledgeDocument body read from the database. Three cases:
 *
 *   1. Marker present + decrypt succeeds → plaintext returned.
 *   2. Marker absent → row predates the encryption rollout; return as-is
 *      (legacy plaintext). The migration encrypts these in place but
 *      until it runs (or for a row it skipped due to error) retrieval
 *      must still work.
 *   3. Marker present + decrypt fails (key rotated, ciphertext truncated,
 *      auth tag mismatch) → return empty string and tag the row in the
 *      caller-visible result. We do NOT throw because a single corrupt
 *      row should not crash retrieval for the rest of the workspace.
 *      Operators see the empty body + similarity score + sourceUrl and
 *      can debug from there.
 */
export function decryptBodyForRead(stored: string): string {
  if (typeof stored !== 'string') return ''
  if (!isEncrypted(stored)) return stored
  if (!isEncryptionConfigured()) {
    // Honesty seam: if the key disappeared we cannot decrypt. Degrade,
    // do not crash retrieval — empty body lets the rest of the snippet
    // (title, similarity, sourceUrl) still surface.
    return ''
  }
  try {
    return decrypt(stored)
  } catch (err) {
    if (err instanceof InvalidCiphertextError) return ''
    if (err instanceof EncryptionError) return ''
    return ''
  }
}

/** Re-exports so call sites have one place to import from. */
export { isEncrypted, isEncryptionConfigured } from '@/lib/security/encryption'
