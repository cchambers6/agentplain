/**
 * lib/integrations/ezlynx-mcp/auth.ts
 *
 * Resolves the per-workspace EZLynx credential, refreshing via EZLynx's
 * OAuth2 token endpoint when near expiry. Delegates load/decrypt/refresh/
 * persist to `lib/integrations/mcp-core/credential.ts`; supplies the
 * EZLynx-specific `RefreshFn`.
 *
 * EZLynx is an OAuth2 vendor whose API is partner-gated: the agency enrolls
 * in the EZLynx developer program to obtain the app-level client id +
 * secret (read from env), and the per-agency refresh token is persisted on
 * the credential. The refresh is a plain `fetch` to EZLynx's token endpoint
 * so this MCP carries no vendor SDK dependency
 * (`feedback_no_silent_vendor_lock.md`).
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every call; no
 * decrypted secret is cached on the instance.
 */

import { env } from '@/lib/env';
import {
  resolveWorkspaceCredential,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type {
  DecryptedCredential,
  IntegrationResult,
  TokenSet,
} from '@/lib/integrations/types';

export interface ResolvedEzlynx {
  credential: DecryptedCredential;
  /** Bearer access token for the EZLynx REST API. */
  accessToken: string;
}

/** EZLynx OAuth2 refresh-token grant. Returns the new token bundle to
 *  persist. A 400 `invalid_grant` surfaces GRANT_REVOKED so the shared
 *  resolver marks the credential REVOKED and prompts a reconnect. */
async function refreshEzlynx(cred: DecryptedCredential): Promise<IntegrationResult<TokenSet>> {
  const clientId = env.ezlynxOAuthClientId();
  const clientSecret = env.ezlynxOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'EZLynx OAuth not configured (EZLYNX_OAUTH_CLIENT_ID/SECRET).',
      },
    };
  }
  if (!cred.refreshToken) {
    return { ok: false, error: { code: 'GRANT_REVOKED', message: 'EZLynx credential has no refresh token.' } };
  }

  let res: Response;
  try {
    res = await fetch(`${env.ezlynxTokenHost()}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cred.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
  } catch (err) {
    return { ok: false, error: { code: 'UPSTREAM_ERROR', message: `EZLynx token network error: ${err instanceof Error ? err.message : String(err)}` } };
  }

  const text = await res.text();
  if (!res.ok) {
    const isInvalidGrant = res.status === 400 && /invalid_grant/i.test(text);
    return {
      ok: false,
      error: {
        code: isInvalidGrant ? 'GRANT_REVOKED' : 'UPSTREAM_ERROR',
        message: `EZLynx token refresh failed (${res.status}): ${text.slice(0, 240)}`,
        status: res.status,
      },
    };
  }

  let body: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  try {
    body = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: { code: 'UPSTREAM_ERROR', message: `EZLynx token parse failed: ${err instanceof Error ? err.message : String(err)}` } };
  }
  if (!body.access_token) {
    return { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'EZLynx token response missing access_token.' } };
  }

  const expiresInMs = (body.expires_in ?? 3600) * 1000;
  return {
    ok: true,
    value: {
      accessToken: body.access_token,
      // EZLynx may or may not rotate the refresh token — keep the old one
      // when none is returned.
      refreshToken: body.refresh_token ?? cred.refreshToken,
      expiresAt: new Date(Date.now() + expiresInMs),
      scopes: body.scope ? body.scope.split(' ') : cred.scopes,
      accountId: cred.accountId,
      accountEmail: cred.accountEmail,
    },
  };
}

export async function resolveEzlynxCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedEzlynx>> {
  const resolved = await resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'EZLYNX',
    connectorName: 'EZLynx',
    refresh: refreshEzlynx,
  });
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    value: { credential: resolved.value, accessToken: resolved.value.accessToken },
  };
}
