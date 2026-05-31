/**
 * lib/integrations/hubspot-mcp/auth.ts
 *
 * Resolves the per-workspace HubSpot credential, refreshing via the OAuth
 * adapter when near expiry. Delegates the load/decrypt/refresh/persist
 * dance to `lib/integrations/mcp-core/credential.ts`; supplies the
 * HubSpot-specific `RefreshFn`.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every tool
 * call; no decrypted token lives on the server instance.
 *
 * The resolved value carries `hubId` (the HubSpot portal id, also the
 * credential.accountId).
 */

import { env } from '@/lib/env';
import { HubspotOAuth } from '@/lib/integrations/hubspot/oauth';
import { resolveWorkspaceCredential, mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import type { DecryptedCredential, IntegrationResult, TokenSet } from '@/lib/integrations/types';

export interface ResolvedHubspot {
  credential: DecryptedCredential;
  /** HubSpot portal/hub id — the per-customer account identifier. */
  hubId: string;
}

export async function resolveHubspotCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedHubspot>> {
  const clientId = env.hubspotOAuthClientId();
  const clientSecret = env.hubspotOAuthClientSecret();

  const refresh = async (cred: DecryptedCredential): Promise<IntegrationResult<TokenSet>> => {
    if (!clientId || !clientSecret) {
      return { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'HubSpot OAuth not configured (HUBSPOT_OAUTH_CLIENT_ID/SECRET).' } };
    }
    if (!cred.refreshToken) {
      return { ok: false, error: { code: 'GRANT_REVOKED', message: 'HubSpot credential has no refresh token.' } };
    }
    const oauth = new HubspotOAuth({
      clientId,
      clientSecret,
      redirectUri: `${env.appPublicOrigin()}/api/integrations/hubspot/oauth/callback`,
    });
    return oauth.refreshTokens({
      refreshToken: cred.refreshToken,
      accountId: cred.accountId,
      accountEmail: cred.accountEmail,
    });
  };

  const resolved = await resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'HUBSPOT',
    connectorName: 'HubSpot',
    refresh,
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const hubId =
    typeof meta?.hubId === 'string' && meta.hubId.length > 0
      ? meta.hubId
      : resolved.value.accountId;
  if (!hubId) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'HubSpot credential is missing its hubId (providerMetadata.hubId / accountId). Reconnect HubSpot.',
    );
  }
  return {
    ok: true,
    value: { credential: resolved.value, hubId },
  };
}
