/**
 * lib/integrations/salesforce-mcp/auth.ts
 *
 * Resolves the per-workspace Salesforce credential, refreshing via the
 * OAuth adapter when near expiry. Delegates load/decrypt/refresh/persist
 * to `lib/integrations/mcp-core/credential.ts`; supplies the
 * Salesforce-specific `RefreshFn`.
 *
 * The resolved value carries `instanceUrl` (the per-org REST host),
 * read from `providerMetadata.instanceUrl`. CRITICAL: every API call
 * goes to {instanceUrl}/services/data/v60.0/... — there is no
 * environment-independent host.
 */

import { env } from '@/lib/env';
import { SalesforceOAuth } from '@/lib/integrations/salesforce/oauth';
import { resolveWorkspaceCredential, mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import type { DecryptedCredential, IntegrationResult, TokenSet } from '@/lib/integrations/types';

export interface ResolvedSalesforce {
  credential: DecryptedCredential;
  /** Per-org REST host returned by Salesforce on connect. */
  instanceUrl: string;
  /** Salesforce org id (also the credential.accountId). */
  orgId: string;
}

export async function resolveSalesforceCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedSalesforce>> {
  const clientId = env.salesforceOAuthClientId();
  const clientSecret = env.salesforceOAuthClientSecret();
  const loginHost = env.salesforceLoginHost();

  const refresh = async (cred: DecryptedCredential): Promise<IntegrationResult<TokenSet>> => {
    if (!clientId || !clientSecret) {
      return { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Salesforce OAuth not configured (SALESFORCE_OAUTH_CLIENT_ID/SECRET).' } };
    }
    if (!cred.refreshToken) {
      return { ok: false, error: { code: 'GRANT_REVOKED', message: 'Salesforce credential has no refresh token.' } };
    }
    const oauth = new SalesforceOAuth({
      clientId,
      clientSecret,
      loginHost,
      redirectUri: `${env.appPublicOrigin()}/api/integrations/salesforce/oauth/callback`,
    });
    return oauth.refreshTokens({
      refreshToken: cred.refreshToken,
      accountId: cred.accountId,
      accountEmail: cred.accountEmail,
    });
  };

  const resolved = await resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'SALESFORCE',
    connectorName: 'Salesforce',
    refresh,
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const instanceUrl = typeof meta?.instanceUrl === 'string' && meta.instanceUrl.length > 0
    ? meta.instanceUrl
    : null;
  if (!instanceUrl) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'Salesforce credential is missing its instanceUrl (providerMetadata.instanceUrl). Reconnect Salesforce.',
    );
  }
  const orgId = resolved.value.accountId;
  return {
    ok: true,
    value: { credential: resolved.value, instanceUrl, orgId },
  };
}
