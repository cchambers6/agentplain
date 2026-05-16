/**
 * lib/integrations/outlook-mcp/auth.ts
 *
 * Per-workspace OAuth credential resolution for the Outlook MCP server.
 * Structurally identical to `lib/integrations/gmail-mcp/auth.ts`:
 *
 *   1. Loads `IntegrationCredential` for the workspace (provider = M365)
 *      via Prisma (under operator/system RLS context).
 *   2. Decrypts via `lib/security/encryption.ts`. Plaintext lives only
 *      for the duration of one request; never persisted.
 *   3. If the access token is within `REFRESH_THRESHOLD_MS` of expiry,
 *      refreshes via the Microsoft identity platform token endpoint and
 *      writes the new ciphertext back. Other concurrent callers wait on
 *      the same in-flight refresh.
 *   4. Returns the plaintext `DecryptedCredential` bundle for the duration
 *      of one request.
 *
 * Why the refresh logic lives in this file rather than delegating to
 * `lib/integrations/index.ts:getProvider('M365')`: the broader
 * `IntegrationProvider` for M365 (`createSubscription`, webhook signature
 * verification, etc.) hasn't shipped yet — Phase B's scope is the MCP
 * tool surface, not the full webhook integration. The OAuth token
 * endpoint (login.microsoftonline.com) is a distinct seam from the
 * Microsoft Graph API endpoint (graph.microsoft.com); only the LATTER is
 * gated by `feedback_no_silent_vendor_lock.md` as the single Graph SDK
 * import seam (server.ts). When `getProvider('M365')` lands in a later
 * PR, this file's `refreshAndPersist` becomes a thin pass-through to it.
 *
 * Per `feedback_cold_start_safe_agents.md`: this module does NOT cache
 * decrypted credentials across requests. The in-flight-refresh map exists
 * only to coalesce concurrent refreshes within a single process; it
 * stores Promises, not plaintext, and entries clear on settle.
 */

import type { IntegrationCredential } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { decryptCredential, encryptTokenSet } from '@/lib/integrations';
import type { DecryptedCredential, TokenSet } from '@/lib/integrations/types';
import { outlookError, type OutlookMcpResult } from './types';

/** Refresh when an access token expires in less than this many ms. */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Microsoft identity platform v2.0 token endpoint. The `common` tenant
 * accepts personal Microsoft accounts + work/school accounts; tenant-
 * specific endpoints are used when the OAuth grant was issued against
 * a single-tenant app registration. The MCP server is tenant-agnostic
 * at the protocol layer — tenant restriction happens at app-registration
 * configuration time, not in this file.
 *
 * Per https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 * (read 2026-05-16).
 */
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/**
 * In-flight refresh coalescing. Multiple concurrent tool calls within the
 * same Node process should not hammer Microsoft's token endpoint — one
 * refresh, all callers receive the same resolved credential.
 *
 * Map key: `${workspaceId}:${credentialId}`. Value: the in-flight promise.
 * Entries clear on settle (success or failure) via .finally.
 *
 * This is a coalescer, NOT a cache. Plaintext lives only in the resolved
 * promise's value, which the caller consumes and discards within the
 * request's lifetime.
 */
const inFlightRefreshes = new Map<string, Promise<OutlookMcpResult<DecryptedCredential>>>();

export interface ResolveCredentialArgs {
  workspaceId: string;
}

export async function resolveCredential(
  args: ResolveCredentialArgs,
): Promise<OutlookMcpResult<DecryptedCredential>> {
  const row = await prisma.integrationCredential.findFirst({
    where: {
      workspaceId: args.workspaceId,
      provider: 'M365',
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!row) {
    return outlookError(
      'CREDENTIAL_NOT_FOUND',
      `No active M365 IntegrationCredential for workspace ${args.workspaceId}. Connect Outlook at /operator/integrations.`,
    );
  }

  const now = Date.now();
  const expiresAtMs = row.expiresAt.getTime();
  const needsRefresh = expiresAtMs - now < REFRESH_THRESHOLD_MS;

  if (!needsRefresh) {
    return { ok: true, value: decryptCredential(row) };
  }

  if (!row.refreshTokenEncrypted) {
    return outlookError(
      'GRANT_REVOKED',
      `IntegrationCredential ${row.id} has no refresh token — Outlook consent must be re-granted with offline_access scope.`,
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
): Promise<OutlookMcpResult<DecryptedCredential>> {
  const decrypted = decryptCredential(row);
  if (!decrypted.refreshToken) {
    return outlookError(
      'GRANT_REVOKED',
      `IntegrationCredential ${row.id} decrypted without refresh token`,
    );
  }
  const refreshed = await refreshWithMicrosoft({
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
      return refreshed;
    }
    await prisma.integrationCredential.update({
      where: { id: row.id },
      data: { status: 'ERROR' },
    });
    return refreshed;
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

interface MicrosoftTokenResponse {
  token_type?: string;
  scope?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
}

interface MicrosoftErrorResponse {
  error?: string;
  error_description?: string;
  error_codes?: number[];
  trace_id?: string;
}

/**
 * Exchange a refresh_token for a fresh access_token via the Microsoft
 * identity platform v2.0 token endpoint. The Microsoft contract:
 *
 *   POST https://login.microsoftonline.com/common/oauth2/v2.0/token
 *   Content-Type: application/x-www-form-urlencoded
 *
 *   grant_type=refresh_token
 *   refresh_token=<existing>
 *   client_id=<app>
 *   client_secret=<app>           (confidential clients only)
 *   scope=Mail.Read Mail.ReadWrite Mail.Send offline_access
 *
 * Response body is JSON. `refresh_token` MAY rotate — when it comes back,
 * persist it; when absent, keep the prior stored value.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the SOLE seam in the
 * outlook-mcp folder that hits a Microsoft endpoint outside of
 * `./server.ts`. It hits the OAuth endpoint, NOT the Graph endpoint, so
 * it doesn't violate the Graph-SDK seam rule.
 */
async function refreshWithMicrosoft(args: {
  refreshToken: string;
  accountEmail: string;
  accountId: string;
}): Promise<OutlookMcpResult<TokenSet>> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return outlookError(
      'NOT_IMPLEMENTED',
      'Microsoft OAuth refresh requires MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET in env.',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: args.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    // Mirrors `lib/integrations/marketplace.ts` outlook entry. We do NOT
    // request `Mail.Send` per `project_no_outbound_architecture.md`.
    scope: 'Mail.Read Mail.ReadWrite offline_access',
  });

  let res: Response;
  try {
    res = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return outlookError('NETWORK', `Microsoft token endpoint network error: ${message}`);
  }

  if (!res.ok) {
    let parsed: MicrosoftErrorResponse | null = null;
    try {
      parsed = (await res.json()) as MicrosoftErrorResponse;
    } catch {
      parsed = null;
    }
    const reference = parsed?.error ?? `http_${res.status}`;
    const description = parsed?.error_description ?? `HTTP ${res.status}`;
    // AADSTS70000 = "Provided value for the input parameter 'refresh_token'
    // is not valid." This is Microsoft's analogue of Google's invalid_grant.
    const aadCode = parsed?.error_codes?.[0];
    const isGrantInvalid =
      parsed?.error === 'invalid_grant' ||
      aadCode === 70000 ||
      aadCode === 700016 ||
      aadCode === 9002313 ||
      /invalid_grant|AADSTS70000|AADSTS700016/i.test(description);
    if (isGrantInvalid) {
      return outlookError(
        'GRANT_REVOKED',
        `Microsoft returned invalid_grant on refresh for ${args.accountEmail} — credential will be marked REVOKED.`,
        { status: res.status, reference },
      );
    }
    if (res.status === 429) {
      return outlookError('RATE_LIMITED', description, { status: res.status, reference });
    }
    return outlookError('UPSTREAM_ERROR', `Microsoft token refresh failed: ${description}`, {
      status: res.status,
      reference,
    });
  }

  let parsed: MicrosoftTokenResponse;
  try {
    parsed = (await res.json()) as MicrosoftTokenResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return outlookError('MALFORMED_RESPONSE', `Microsoft token JSON parse: ${message}`);
  }

  if (!parsed.access_token) {
    return outlookError('MALFORMED_RESPONSE', 'Microsoft token response missing access_token');
  }

  const expiresInSec = typeof parsed.expires_in === 'number' ? parsed.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  const scopes = (parsed.scope ?? '').split(/\s+/).filter(Boolean);

  return {
    ok: true,
    value: {
      accessToken: parsed.access_token,
      // Microsoft may omit refresh_token on refresh; preserve the old one.
      refreshToken: parsed.refresh_token ?? args.refreshToken,
      expiresAt,
      scopes: scopes.length > 0 ? scopes : ['Mail.Read', 'Mail.ReadWrite', 'offline_access'],
      accountId: args.accountId,
      accountEmail: args.accountEmail,
    },
  };
}

// ── Test seam ───────────────────────────────────────────────────────────

/**
 * Clear in-flight refresh coalescer state. Tests call this between cases.
 * Not exported for production callers — the coalescer is internal.
 */
export function __resetInFlightRefreshesForTests(): void {
  inFlightRefreshes.clear();
}
