/**
 * lib/security/payload-crypto.ts
 *
 * Envelope encryption for Prisma `Json` columns that carry customer
 * content at rest:
 *
 *   - `WorkApprovalQueueItem.payload` (prisma/schema.prisma:416) —
 *     draft replies, admin notices, compliance flags, chief-of-staff
 *     proposals. Hits the customer's approvals queue.
 *   - `HandoffLogEntry.payload` (prisma/schema.prisma:436) — per-step
 *     skill output (read summary, draft body, schedule slots) + the
 *     `owner-request` body the broker-owner types into Talk-to-the-Fleet.
 *
 * Closes the deferred half of the data-privacy audit (§4 / §2.5) that
 * PR #95 carved out explicitly (lib/knowledge/body-crypto.ts:27-29).
 *
 * Why envelope-in-Json rather than a new String column:
 *   - The `Json` shape already supports any future fields without a
 *     migration. Substituting `{ enc: 'v1:...' }` at write keeps the
 *     column type unchanged — zero schema churn, zero adapter shim.
 *   - Idempotent: writing an already-enveloped value is a no-op so the
 *     ingest path + back-fill script share the same seam without
 *     double-encrypting.
 *   - Graceful-degrade on read: an unenveloped row is returned as-is
 *     (legacy plaintext during the back-fill window); a corrupt
 *     envelope (key rotated, ciphertext tampered, malformed) returns
 *     `null` so the approvals UI / activity feed renders a calm
 *     fallback rather than 500-ing the surface.
 *
 * Reuses the SAME AES-256-GCM codec (`lib/security/encryption.ts`)
 * that encrypts OAuth tokens (lib/integrations/index.ts:142-181) and
 * KnowledgeDocument.body (lib/knowledge/body-crypto.ts). One key to
 * rotate, one wire format to debug, one audit story.
 */

import type { Prisma } from '@prisma/client';
import {
  EncryptionError,
  InvalidCiphertextError,
  decrypt,
  encrypt,
  isEncrypted,
  isEncryptionConfigured,
} from './encryption';

/**
 * Single-key envelope marker. Picked over a free-form ciphertext string
 * because Prisma `Json` columns can hold any shape — a plain string
 * would collide with payloads that legitimately serialize to strings.
 * An object with exactly one known key is unambiguous and keeps the
 * read-side detection cheap.
 */
const ENVELOPE_KEY = 'enc' as const;

export interface EncryptedEnvelope {
  /** Ciphertext in the same `v1:iv:tag:ct` wire format as `encrypt()`. */
  [ENVELOPE_KEY]: string;
}

/**
 * Detect an envelope. We require:
 *   1. plain object (not array, not null),
 *   2. exactly one key `enc`,
 *   3. value is a v1-marker ciphertext string.
 *
 * The strict shape check is what prevents collision with legitimate
 * payloads that happen to contain an `enc` field (none today, but we
 * are guarding against future drift).
 */
export function isEncryptedPayload(value: unknown): value is EncryptedEnvelope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== ENVELOPE_KEY) return false;
  const v = (value as Record<string, unknown>)[ENVELOPE_KEY];
  return typeof v === 'string' && isEncrypted(v);
}

/**
 * Encrypt a payload for persistence as a Prisma `Json` value.
 *
 * Idempotent: an already-enveloped value passes through unchanged so
 * the producer paths (skill artifacts, chief-of-staff sink, fleet
 * request, edit-approval action) and the back-fill script can all call
 * through this one seam.
 *
 * Throws `MissingKeyError` / `InvalidKeyError` when `ENCRYPTION_KEY` is
 * absent or malformed — write paths MUST fail loudly rather than land a
 * plaintext row.
 *
 * `null` / `undefined` pass through to allow optional payloads (none
 * today; defensive against schema drift). Anything else is serialized
 * with `JSON.stringify` and the resulting string is encrypted.
 */
export function encryptPayloadForWrite(
  payload: unknown,
): Prisma.InputJsonValue {
  if (payload === null || payload === undefined) {
    // Prisma.InputJsonValue does not include null, but the field is
    // not nullable in schema.prisma anyway — guard against accidental
    // call sites by collapsing to an empty object.
    return {};
  }
  if (isEncryptedPayload(payload)) return payload;
  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new EncryptionError(`payload is not JSON-serializable: ${message}`);
  }
  // JSON.stringify can return `undefined` for values like raw `undefined`
  // or a function — encrypting that would land an opaque "undefined"
  // string. Guard explicitly so the failure surfaces at the producer,
  // not the reader.
  if (typeof serialized !== 'string') {
    throw new EncryptionError('payload serialized to non-string');
  }
  return { [ENVELOPE_KEY]: encrypt(serialized) };
}

/**
 * Decrypt a payload read from the database. Three cases mirror
 * `decryptBodyForRead` in lib/knowledge/body-crypto.ts:
 *
 *   1. Envelope present + decrypt succeeds + JSON.parse succeeds →
 *      original payload returned (object/array/string/number/bool).
 *   2. Envelope absent → row predates encryption rollout; return as-is.
 *      The back-fill encrypts these in place but until it runs (or for
 *      a row it skipped due to error) the surface must still render.
 *   3. Envelope present + decrypt fails or parse fails → return `null`.
 *      We do NOT throw because a single corrupt row should not crash
 *      the approvals page render or the activity feed. Operators see
 *      the row meta (kind, agentSlug, occurredAt) and can debug from
 *      there.
 *
 * Returning `unknown` is deliberate: every read site already wraps the
 * Prisma `Json` value in `isRecord(payload)` / typeof checks before
 * picking fields out (see `renderApprovalPayload`, the activity-page
 * `summarizePayload`, the fleet-page `titleFromApproval`). The contract
 * is unchanged — graceful-degrade returns `null`, callers handle it
 * the same way they handle a missing field today.
 */
export function decryptPayloadForRead(stored: unknown): unknown {
  if (!isEncryptedPayload(stored)) return stored;
  if (!isEncryptionConfigured()) {
    // Honesty seam: key disappeared mid-rollout. Return null instead of
    // 500-ing the surface — callers already handle null payload (the
    // renderer falls back to a generic "item for review" line).
    return null;
  }
  try {
    const plaintext = decrypt(stored[ENVELOPE_KEY]);
    return JSON.parse(plaintext);
  } catch (err) {
    if (err instanceof InvalidCiphertextError) return null;
    if (err instanceof EncryptionError) return null;
    if (err instanceof SyntaxError) return null;
    return null;
  }
}

export { isEncrypted, isEncryptionConfigured } from './encryption';
