/**
 * lib/integrations/google-drive-mcp/auth.ts
 *
 * Resolves the per-workspace Google credential for Drive, refreshing via the
 * shared `GoogleOAuth` adapter when near expiry. Delegates the
 * load/decrypt/persist dance to `lib/integrations/mcp-core/credential.ts`;
 * supplies the Google-specific `RefreshFn`.
 *
 * Drive reuses the SAME `GOOGLE` `IntegrationCredential` row as Gmail (same
 * Google account; Drive + Gmail scopes merge via `include_granted_scopes`).
 * We deliberately do NOT call `getProvider('GOOGLE')` here — that path
 * requires Gmail Pub/Sub env vars (GOOGLE_PUBSUB_TOPIC,
 * GMAIL_WEBHOOK_OIDC_AUDIENCE, …) that a Drive-only grant does not need.
 * Instead we construct `GoogleOAuth` directly from the OAuth client env vars.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every tool call;
 * no decrypted token lives on the server instance.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file speaks only the
 * `GoogleOAuth` adapter + the `IntegrationProvider` enum. The `googleapis`
 * Drive SDK is confined to `./server.ts`.
 */

import { env } from '@/lib/env';
import { GoogleOAuth } from '@/lib/integrations/google/oauth';
import { resolveWorkspaceCredential, type McpResult } from '@/lib/integrations/mcp-core';
import type { DecryptedCredential, IntegrationResult, TokenSet } from '@/lib/integrations/types';

export async function resolveDriveCredential(args: {
  workspaceId: string;
}): Promise<McpResult<DecryptedCredential>> {
  const clientId = env.googleOAuthClientId();
  const clientSecret = env.googleOAuthClientSecret();

  const refresh = async (cred: DecryptedCredential): Promise<IntegrationResult<TokenSet>> => {
    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Google OAuth not configured (GOOGLE_OAUTH_CLIENT_ID/SECRET).',
        },
      };
    }
    if (!cred.refreshToken) {
      return {
        ok: false,
        error: { code: 'GRANT_REVOKED', message: 'Google credential has no refresh token.' },
      };
    }
    const oauth = new GoogleOAuth({ clientId, clientSecret });
    return oauth.refreshTokens({
      refreshToken: cred.refreshToken,
      accountEmail: cred.accountEmail,
      accountId: cred.accountId,
    });
  };

  return resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'GOOGLE',
    connectorName: 'Google Drive',
    refresh,
  });
}
