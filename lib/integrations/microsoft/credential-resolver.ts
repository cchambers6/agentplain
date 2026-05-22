/**
 * lib/integrations/microsoft/credential-resolver.ts
 *
 * Per-workspace M365 OAuth credential resolver shared by the three
 * post-Outlook MCP servers (Teams, OneDrive, Excel). Same DB row, same
 * refresh flow, same encryption invariants as
 * `lib/integrations/outlook-mcp/auth.ts` — extracted here so we don't
 * triplicate ~200 lines of token-refresh boilerplate.
 *
 * Lifecycle on every call:
 *   1. Load the active `IntegrationCredential` for the workspace
 *      (provider = M365). One row per workspace serves all four M365
 *      integrations — Outlook, Teams, OneDrive, Excel — because the OAuth
 *      grant is delegated to ONE Microsoft account whose token carries
 *      ALL granted scopes (consent is incremental at the Microsoft side).
 *   2. Decrypt via `lib/security/encryption.ts`.
 *   3. If the access token is within `REFRESH_THRESHOLD_MS` of expiry,
 *      refresh via the Microsoft identity-platform token endpoint and
 *      write the new ciphertext back.
 *   4. Coalesce concurrent refreshes — multiple tool calls within the same
 *      process don't hammer Microsoft.
 *
 * Per `feedback_no_silent_vendor_lock.md`: only ONE place in this folder
 * (this file) hits `login.microsoftonline.com` for the refresh-token grant
 * shared across Teams/OneDrive/Excel. The Graph endpoint
 * (`graph.microsoft.com`) is a different concern — that seam lives in
 * `lib/integrations/microsoft/graph-client.ts`.
 *
 * Per `feedback_cold_start_safe_agents.md`: this module does NOT cache
 * decrypted credentials across requests. The in-flight-refresh map is a
 * promise-coalescer ONLY; entries clear on settle.
 *
 * Why this lives next to `m365-provider.ts` instead of inside `outlook-mcp/`:
 * the OAuth refresh logic is provider-shared, not Outlook-specific. The
 * older outlook-mcp/auth.ts file pre-dates the Teams/OneDrive/Excel build;
 * a future cleanup can collapse it into this resolver once we trust the
 * shape is stable.
 */

import type { IntegrationCredential } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { decryptCredential, encryptTokenSet } from '@/lib/integrations';
import { isEncryptionConfigured } from '@/lib/security/encryption';
import type { DecryptedCredential, TokenSet } from '@/lib/integrations/types';
import { mcpError, type McpResult } from './mcp-common';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Microsoft identity platform v2.0 token endpoint. The `common` tenant
 * accepts work/school accounts + personal Microsoft accounts; tenant-
 * specific endpoints come from the OAuth app's authority configuration.
 * See https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 * (read 2026-05-19).
 */
const MICROSOFT_TOKEN_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/**
 * In-flight refresh coalescing. Map key: `${workspaceId}:${credentialId}`.
 * Value: the in-flight promise. Entries clear on settle via .finally.
 *
 * This is a coalescer, not a cache. Plaintext lives only in the resolved
 * promise's value, which the caller consumes and discards within the
 * request's lifetime.
 */
const inFlightRefreshes = new Map<string, Promise<McpResult<DecryptedCredential>>>();

export interface ResolveM365CredentialArgs {
  workspaceId: string;
  /**
   * Caller-visible scope label used in the GRANT_REVOKED message so the
   * operator UI can show which integration tripped the re-consent error.
   * Free-form — `"Teams"` / `"OneDrive"` / `"Excel"` are conventional.
   */
  integrationLabel: string;
  /**
   * Space-separated scope set requested on refresh. Per Microsoft v2.0
   * protocol, the granted scopes on the refreshed token are the union of
   * what was originally consented; passing the union here keeps Microsoft
   * happy without escalating consent (it can only narrow, never widen).
   *
   * Default is `MICROSOFT_OAUTH_DEFAULT_SCOPES` — broad enough that any
   * of the four M365 MCP integrations can refresh against it without
   * surprising Microsoft when scopes are added incrementally.
   */
  refreshScopes?: readonly string[];
}

/**
 * Default scope set sent to the refresh endpoint when the caller doesn't
 * narrow it. The list mirrors the union of what the four M365 MCP
 * integrations request at consent time:
 *
 *   * `offline_access`        — refresh-token grant (REQUIRED)
 *   * `openid email profile`  — `/me` identity hydration
 *   * `Mail.Read Mail.ReadWrite`               — Outlook
 *   * `Chat.ReadWrite ChannelMessage.Send ChannelMessage.Read.All
 *      OnlineMeetings.ReadWrite OnlineMeetingTranscript.Read.All` — Teams
 *   * `Files.ReadWrite.All Sites.ReadWrite.All`                    — OneDrive + Excel
 *
 * The refresh endpoint will return only the scopes the customer has
 * actually consented to; agentplain reads them back from `response.scope`
 * and persists the granted set.
 */
export const MICROSOFT_OAUTH_DEFAULT_SCOPES = [
  'offline_access',
  'openid',
  'email',
  'profile',
  'Mail.Read',
  'Mail.ReadWrite',
  'Chat.ReadWrite',
  'ChannelMessage.Send',
  'ChannelMessage.Read.All',
  'OnlineMeetings.ReadWrite',
  'OnlineMeetingTranscript.Read.All',
  'Files.ReadWrite.All',
  'Sites.ReadWrite.All',
] as const;

export async function resolveM365Credential(
  args: ResolveM365CredentialArgs,
): Promise<McpResult<DecryptedCredential>> {
  const row = await prisma.integrationCredential.findFirst({
    where: {
      workspaceId: args.workspaceId,
      provider: 'M365',
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!row) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      `No active M365 IntegrationCredential for workspace ${args.workspaceId}. ` +
        `Connect ${args.integrationLabel} at /app/workspace/${args.workspaceId}/integrations.`,
    );
  }

  // Fail clearly (not a raw MissingKeyError crash) when the master key is
  // absent — the credential exists but cannot be decrypted in this env.
  if (!isEncryptionConfigured()) {
    return mcpError(
      'UPSTREAM_ERROR',
      `Cannot decrypt the ${args.integrationLabel} credential for workspace ${args.workspaceId}: ENCRYPTION_KEY is not configured in this environment. The connection is intact; access resumes once the key is restored.`,
    );
  }

  const now = Date.now();
  const expiresAtMs = row.expiresAt.getTime();
  const needsRefresh = expiresAtMs - now < REFRESH_THRESHOLD_MS;

  if (!needsRefresh) {
    return { ok: true, value: decryptCredential(row) };
  }

  if (!row.refreshTokenEncrypted) {
    return mcpError(
      'GRANT_REVOKED',
      `IntegrationCredential ${row.id} has no refresh token — re-grant ${args.integrationLabel} with offline_access scope.`,
    );
  }

  const key = `${row.workspaceId}:${row.id}`;
  const existing = inFlightRefreshes.get(key);
  if (existing) return existing;

  const promise = refreshAndPersist(row, args).finally(() => {
    inFlightRefreshes.delete(key);
  });
  inFlightRefreshes.set(key, promise);
  return promise;
}

async function refreshAndPersist(
  row: IntegrationCredential,
  args: ResolveM365CredentialArgs,
): Promise<McpResult<DecryptedCredential>> {
  const decrypted = decryptCredential(row);
  if (!decrypted.refreshToken) {
    return mcpError(
      'GRANT_REVOKED',
      `IntegrationCredential ${row.id} decrypted without refresh token`,
    );
  }
  const refreshed = await refreshWithMicrosoft({
    refreshToken: decrypted.refreshToken,
    accountEmail: decrypted.accountEmail,
    accountId: decrypted.accountId,
    scopes: args.refreshScopes ?? MICROSOFT_OAUTH_DEFAULT_SCOPES,
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

async function refreshWithMicrosoft(args: {
  refreshToken: string;
  accountEmail: string;
  accountId: string;
  scopes: readonly string[];
}): Promise<McpResult<TokenSet>> {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return mcpError(
      'NOT_IMPLEMENTED',
      'Microsoft OAuth refresh requires MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET in env.',
    );
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: args.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    scope: args.scopes.join(' '),
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
    return mcpError('NETWORK', `Microsoft token endpoint network error: ${message}`);
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
    // is not valid." Microsoft's analogue of Google's invalid_grant.
    const aadCode = parsed?.error_codes?.[0];
    const isGrantInvalid =
      parsed?.error === 'invalid_grant' ||
      aadCode === 70000 ||
      aadCode === 700016 ||
      aadCode === 9002313 ||
      /invalid_grant|AADSTS70000|AADSTS700016/i.test(description);
    if (isGrantInvalid) {
      return mcpError(
        'GRANT_REVOKED',
        `Microsoft returned invalid_grant on refresh for ${args.accountEmail} — credential will be marked REVOKED.`,
        { status: res.status, reference },
      );
    }
    if (res.status === 429) {
      return mcpError('RATE_LIMITED', description, { status: res.status, reference });
    }
    return mcpError('UPSTREAM_ERROR', `Microsoft token refresh failed: ${description}`, {
      status: res.status,
      reference,
    });
  }

  let parsed: MicrosoftTokenResponse;
  try {
    parsed = (await res.json()) as MicrosoftTokenResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return mcpError('MALFORMED_RESPONSE', `Microsoft token JSON parse: ${message}`);
  }

  if (!parsed.access_token) {
    return mcpError(
      'MALFORMED_RESPONSE',
      'Microsoft token response missing access_token',
    );
  }

  const expiresInSec = typeof parsed.expires_in === 'number' ? parsed.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  const scopes = (parsed.scope ?? '').split(/\s+/).filter(Boolean);

  return {
    ok: true,
    value: {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token ?? args.refreshToken,
      expiresAt,
      scopes: scopes.length > 0 ? scopes : Array.from(args.scopes),
      accountId: args.accountId,
      accountEmail: args.accountEmail,
    },
  };
}

/** Reset coalescer state between tests. Not exported for prod callers. */
export function __resetM365InFlightRefreshesForTests(): void {
  inFlightRefreshes.clear();
}
