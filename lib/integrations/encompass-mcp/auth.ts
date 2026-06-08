/**
 * lib/integrations/encompass-mcp/auth.ts
 *
 * Resolves the per-workspace Encompass credential, refreshing via ICE
 * Mortgage Technology's OAuth2 token endpoint when near expiry. Delegates
 * load/decrypt/refresh/persist to `lib/integrations/mcp-core/credential.ts`;
 * supplies the Encompass-specific `RefreshFn`.
 *
 * Encompass is an OAuth2 vendor whose API is partner-gated: the lender
 * enrolls via ICE Developer Connect to obtain the app-level client id +
 * secret (read from env), and the per-instance refresh token is persisted on
 * the credential. The refresh is a plain `fetch` to the ICE token endpoint
 * so this MCP carries no vendor SDK dependency
 * (`feedback_no_silent_vendor_lock.md`).
 *
 * The resolved value carries `instanceId` (the Encompass instance the loan
 * file lives in), read from providerMetadata.instanceId.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every call; no
 * decrypted secret is cached on the instance.
 */

import { env } from '@/lib/env';
import {
  resolveWorkspaceCredential,
  mcpError,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type {
  DecryptedCredential,
  IntegrationResult,
  TokenSet,
} from '@/lib/integrations/types';

export interface ResolvedEncompass {
  credential: DecryptedCredential;
  /** Bearer access token for the Encompass REST API. */
  accessToken: string;
  /** Encompass instance id (sent as the smart-client instance header). */
  instanceId: string;
}

async function refreshEncompass(cred: DecryptedCredential): Promise<IntegrationResult<TokenSet>> {
  const clientId = env.encompassOAuthClientId();
  const clientSecret = env.encompassOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'Encompass OAuth not configured (ENCOMPASS_OAUTH_CLIENT_ID/SECRET).',
      },
    };
  }
  if (!cred.refreshToken) {
    return { ok: false, error: { code: 'GRANT_REVOKED', message: 'Encompass credential has no refresh token.' } };
  }

  let res: Response;
  try {
    res = await fetch(`${env.encompassTokenHost()}/oauth2/v1/token`, {
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
    return { ok: false, error: { code: 'UPSTREAM_ERROR', message: `Encompass token network error: ${err instanceof Error ? err.message : String(err)}` } };
  }

  const text = await res.text();
  if (!res.ok) {
    const isInvalidGrant = res.status === 400 && /invalid_grant/i.test(text);
    return {
      ok: false,
      error: {
        code: isInvalidGrant ? 'GRANT_REVOKED' : 'UPSTREAM_ERROR',
        message: `Encompass token refresh failed (${res.status}): ${text.slice(0, 240)}`,
        status: res.status,
      },
    };
  }

  let body: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  try {
    body = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: { code: 'UPSTREAM_ERROR', message: `Encompass token parse failed: ${err instanceof Error ? err.message : String(err)}` } };
  }
  if (!body.access_token) {
    return { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Encompass token response missing access_token.' } };
  }

  const expiresInMs = (body.expires_in ?? 3600) * 1000;
  return {
    ok: true,
    value: {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? cred.refreshToken,
      expiresAt: new Date(Date.now() + expiresInMs),
      scopes: body.scope ? body.scope.split(' ') : cred.scopes,
      accountId: cred.accountId,
      accountEmail: cred.accountEmail,
    },
  };
}

export async function resolveEncompassCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedEncompass>> {
  const resolved = await resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'ENCOMPASS',
    connectorName: 'Encompass',
    refresh: refreshEncompass,
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const instanceId =
    typeof meta?.instanceId === 'string' && meta.instanceId.length > 0
      ? meta.instanceId
      : null;
  if (!instanceId) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'Encompass credential is missing its instanceId (providerMetadata.instanceId). Reconnect Encompass.',
    );
  }
  return {
    ok: true,
    value: { credential: resolved.value, accessToken: resolved.value.accessToken, instanceId },
  };
}
