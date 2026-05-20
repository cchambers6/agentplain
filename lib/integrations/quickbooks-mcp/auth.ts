/**
 * lib/integrations/quickbooks-mcp/auth.ts
 *
 * Resolves the per-workspace QuickBooks credential, refreshing via the OAuth
 * adapter when near expiry. Delegates the load/decrypt/persist dance to
 * `lib/integrations/mcp-core/credential.ts`; supplies the Intuit-specific
 * `RefreshFn`.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every tool call;
 * no decrypted token lives on the server instance.
 *
 * The resolved value carries `realmId` (the company id) and `environment`,
 * read from the credential's `providerMetadata`. NOTE: sandbox and production
 * realm IDs are NOT interchangeable — a sandbox realmId 401s against the
 * production API base and vice versa — so the environment recorded at connect
 * time is what server.ts uses to pick the API base (falling back to the
 * process-level `env.quickbooksEnvironment()` only if metadata is missing).
 */

import { env } from '@/lib/env';
import { QuickbooksOAuth, type QuickbooksEnvironment } from '@/lib/integrations/quickbooks/oauth';
import { resolveWorkspaceCredential, mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import type { DecryptedCredential, IntegrationResult, TokenSet } from '@/lib/integrations/types';

export interface ResolvedQuickbooks {
  credential: DecryptedCredential;
  /** Intuit company id (also the credential.accountId). */
  realmId: string;
  /** Which Intuit host the company file lives on. */
  environment: QuickbooksEnvironment;
}

function readEnvironment(meta: Record<string, unknown> | null): QuickbooksEnvironment {
  const fromMeta = meta?.environment;
  if (fromMeta === 'production' || fromMeta === 'sandbox') return fromMeta;
  return env.quickbooksEnvironment();
}

export async function resolveQuickbooksCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedQuickbooks>> {
  const clientId = env.quickbooksOAuthClientId();
  const clientSecret = env.quickbooksOAuthClientSecret();

  const refresh = async (cred: DecryptedCredential): Promise<IntegrationResult<TokenSet>> => {
    if (!clientId || !clientSecret) {
      return { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'QuickBooks OAuth not configured (QUICKBOOKS_OAUTH_CLIENT_ID/SECRET).' } };
    }
    if (!cred.refreshToken) {
      return { ok: false, error: { code: 'GRANT_REVOKED', message: 'QuickBooks credential has no refresh token.' } };
    }
    // redirectUri is unused on refresh (Intuit only requires it on code
    // exchange), but the adapter constructor wants a non-empty value.
    const oauth = new QuickbooksOAuth({
      clientId,
      clientSecret,
      environment: readEnvironment(cred.providerMetadata),
      redirectUri: `${env.appPublicOrigin()}/api/integrations/quickbooks/oauth/callback`,
    });
    return oauth.refreshTokens({
      refreshToken: cred.refreshToken,
      accountId: cred.accountId,
      accountEmail: cred.accountEmail,
    });
  };

  const resolved = await resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'QUICKBOOKS',
    connectorName: 'QuickBooks',
    refresh,
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const realmId =
    typeof meta?.realmId === 'string' && meta.realmId.length > 0
      ? meta.realmId
      : resolved.value.accountId;
  if (!realmId) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'QuickBooks credential is missing its realmId (providerMetadata.realmId / accountId). Reconnect QuickBooks.',
    );
  }
  return {
    ok: true,
    value: { credential: resolved.value, realmId, environment: readEnvironment(meta) },
  };
}
