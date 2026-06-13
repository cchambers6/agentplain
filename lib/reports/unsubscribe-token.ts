/**
 * lib/reports/unsubscribe-token.ts
 *
 * One-click unsubscribe tokens for the weekly customer report email.
 *
 * CAN-SPAM requires the opt-out mechanism to work WITHOUT the recipient
 * having to log in. So the footer link carries a self-authenticating token:
 * the workspace id plus an HMAC-SHA256 signature over it, keyed by the
 * server's ENCRYPTION_KEY. The unsubscribe route verifies the signature
 * (constant-time) before flipping `WorkspacePreference.weeklyReportEnabled`.
 *
 * This is standard signed-token construction (the same shape as a stateless
 * unsubscribe link) — NOT novel crypto. We reuse `loadMasterKey` so the
 * secret derives from the one key the app already manages, and there is no
 * new env var and no token table to persist.
 *
 * The token is intentionally NOT expiring: an unsubscribe link must keep
 * working for the life of the inbox, and it only ever grants the power to
 * turn a report OFF — the lowest-stakes action there is.
 */

import { createHmac } from 'node:crypto';
import { loadMasterKey, safeEqualSecret } from '@/lib/security/encryption';

const SEP = '.';

/** Sign a workspace id into a `${workspaceId}.${sig}` unsubscribe token. */
export function signUnsubscribeToken(
  workspaceId: string,
  keyOverride?: Buffer,
): string {
  const sig = computeSignature(workspaceId, keyOverride);
  return `${workspaceId}${SEP}${sig}`;
}

/**
 * Verify a token and return the workspace id it authorizes, or null when the
 * token is malformed or the signature does not match. Never throws.
 */
export function verifyUnsubscribeToken(
  token: string,
  keyOverride?: Buffer,
): string | null {
  if (typeof token !== 'string' || !token.includes(SEP)) return null;
  const idx = token.lastIndexOf(SEP);
  const workspaceId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!workspaceId || !sig) return null;
  let expected: string;
  try {
    expected = computeSignature(workspaceId, keyOverride);
  } catch {
    return null;
  }
  return safeEqualSecret(sig, expected) ? workspaceId : null;
}

function computeSignature(workspaceId: string, keyOverride?: Buffer): string {
  const key = keyOverride ?? loadMasterKey();
  return createHmac('sha256', key)
    .update(`weekly-report-unsubscribe:${workspaceId}`)
    .digest('base64url');
}
