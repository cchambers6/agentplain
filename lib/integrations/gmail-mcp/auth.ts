/**
 * lib/integrations/gmail-mcp/auth.ts
 *
 * Per-workspace OAuth credential resolution for the Gmail MCP server. On
 * every tool call, the prod server invokes `resolveCredential(workspaceId)`
 * which:
 *
 *   1. Loads `IntegrationCredential` for the workspace via Prisma (under
 *      the operator/system RLS context — this code path runs as the
 *      operator on behalf of the workspace).
 *   2. Decrypts via `lib/security/encryption.ts` (one-way at write time —
 *      we never persist plaintext, per the encryption-at-rest invariant
 *      called out in `lib/integrations/README.md`).
 *   3. If the access token is within `REFRESH_THRESHOLD_MS` of expiry,
 *      refreshes via `lib/integrations/google/oauth.ts` and writes the
 *      new ciphertext back. Other concurrent callers wait on the same
 *      in-flight refresh.
 *   4. Returns the plaintext `DecryptedCredential` bundle for the duration
 *      of one request.
 *
 * Per `feedback_cold_start_safe_agents.md`: this module does NOT cache
 * decrypted credentials across requests. The in-flight-refresh map exists
 * only to coalesce concurrent refreshes within a single process; it
 * stores Promises, not plaintext, and entries clear on settle.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the only file outside
 * `lib/integrations/google/` that knows the refresh seam exists, and even
 * here it speaks the `IntegrationProvider` abstraction.
 */

import type { IntegrationCredential } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { decryptCredential, encryptTokenSet, getProvider } from '@/lib/integrations';
import { isEncryptionConfigured } from '@/lib/security/encryption';
import type { DecryptedCredential } from '@/lib/integrations/types';
import { gmailError, type GmailMcpResult } from './types';

/** Refresh when an access token expires in less than this many ms. */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * In-flight refresh coalescing. Multiple concurrent tool calls within the
 * same Node process should not hammer Google's token endpoint — one
 * refresh, all callers receive the same resolved credential.
 *
 * Map key: `${workspaceId}:${credentialId}`. Value: the in-flight promise.
 * Entries clear on settle (success or failure) via .finally.
 *
 * This is a coalescer, NOT a cache. Plaintext lives only in the resolved
 * promise's value, which the caller consumes and discards within the
 * request's lifetime.
 */
const inFlightRefreshes = new Map<string, Promise<GmailMcpResult<DecryptedCredential>>>();

export interface ResolveCredentialArgs {
  workspaceId: string;
}

export async function resolveCredential(
  args: ResolveCredentialArgs,
): Promise<GmailMcpResult<DecryptedCredential>> {
  const row = await prisma.integrationCredential.findFirst({
    where: {
      workspaceId: args.workspaceId,
      provider: 'GOOGLE',
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!row) {
    return gmailError(
      'CREDENTIAL_NOT_FOUND',
      `No active GOOGLE IntegrationCredential for workspace ${args.workspaceId}. Connect Gmail at /operator/integrations.`,
    );
  }

  // Fail clearly (not a raw MissingKeyError crash) when the master key is
  // absent — the credential exists but cannot be decrypted in this env.
  if (!isEncryptionConfigured()) {
    return gmailError(
      'UPSTREAM_ERROR',
      `Cannot decrypt the Gmail credential for workspace ${args.workspaceId}: ENCRYPTION_KEY is not configured in this environment. The connection is intact; renewal resumes once the key is restored.`,
    );
  }

  const now = Date.now();
  const expiresAtMs = row.expiresAt.getTime();
  const needsRefresh = expiresAtMs - now < REFRESH_THRESHOLD_MS;

  if (!needsRefresh) {
    return { ok: true, value: decryptCredential(row) };
  }

  if (!row.refreshTokenEncrypted) {
    return gmailError(
      'GRANT_REVOKED',
      `IntegrationCredential ${row.id} has no refresh token — Gmail consent must be re-granted with prompt=consent.`,
    );
  }

  const key = `${row.workspaceId}:${row.id}`;
  const existing = inFlightRefreshes.get(key);
  if (existing) return existing;

  const promise = refreshAndPersist(row).finally(() => {
    inFlightRefreshes.delete(key);
  });
  inFlightRefreshes.set(key, promise);
  return promise;
}

async function refreshAndPersist(
  row: IntegrationCredential,
): Promise<GmailMcpResult<DecryptedCredential>> {
  const decrypted = decryptCredential(row);
  if (!decrypted.refreshToken) {
    return gmailError(
      'GRANT_REVOKED',
      `IntegrationCredential ${row.id} decrypted without refresh token`,
    );
  }
  const provider = getProvider('GOOGLE');
  const refreshed = await provider.refreshTokens({
    refreshToken: decrypted.refreshToken,
    accountEmail: decrypted.accountEmail,
    accountId: decrypted.accountId,
  });
  if (!refreshed.ok) {
    if (refreshed.error.code === 'GRANT_REVOKED') {
      await prisma.integrationCredential.update({
        where: { id: row.id },
        data: { status: 'REVOKED' },
      });
      return gmailError(
        'GRANT_REVOKED',
        `Gmail returned invalid_grant on refresh for ${decrypted.accountEmail} — credential marked REVOKED.`,
        { status: refreshed.error.status, reference: refreshed.error.reference },
      );
    }
    await prisma.integrationCredential.update({
      where: { id: row.id },
      data: { status: 'ERROR' },
    });
    return gmailError(
      mapIntegrationErrorCode(refreshed.error.code),
      `Refresh failed: ${refreshed.error.message}`,
      { status: refreshed.error.status, reference: refreshed.error.reference },
    );
  }

  const enc = encryptTokenSet(refreshed.value);
  const updated = await prisma.integrationCredential.update({
    where: { id: row.id },
    data: {
      accessTokenEncrypted: enc.accessTokenEncrypted,
      refreshTokenEncrypted: enc.refreshTokenEncrypted,
      scopes: enc.scopes,
      expiresAt: enc.expiresAt,
      lastRefreshedAt: new Date(),
      status: 'ACTIVE',
    },
  });
  return { ok: true, value: decryptCredential(updated) };
}

function mapIntegrationErrorCode(
  code: import('@/lib/integrations/types').IntegrationErrorCode,
): import('./types').GmailMcpErrorCode {
  switch (code) {
    case 'NOT_FOUND':
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
    case 'RATE_LIMITED':
    case 'NETWORK':
    case 'MALFORMED_RESPONSE':
    case 'INVALID_ARGUMENT':
    case 'UPSTREAM_ERROR':
    case 'TOKEN_EXPIRED':
    case 'GRANT_REVOKED':
    case 'NOT_IMPLEMENTED':
      return code;
    case 'SIGNATURE_INVALID':
      return 'UPSTREAM_ERROR';
    default:
      return 'UPSTREAM_ERROR';
  }
}

// ── Test seam ───────────────────────────────────────────────────────────

/**
 * Clear in-flight refresh coalescer state. Tests call this between cases.
 * Not exported for production callers — the coalescer is internal.
 */
export function __resetInFlightRefreshesForTests(): void {
  inFlightRefreshes.clear();
}
