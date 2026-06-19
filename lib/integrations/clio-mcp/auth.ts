/**
 * lib/integrations/clio-mcp/auth.ts
 *
 * Resolves the per-workspace Clio credential, refreshing via the OAuth seam
 * when near expiry. Clio API v4 uses OAuth2 with rotating refresh tokens
 * (app.clio.com/api/v4/documentation). Delegates the load/decrypt/refresh/
 * persist dance to `lib/integrations/mcp-core/credential.ts`; supplies the
 * Clio-specific `RefreshFn`.
 *
 * SCAFFOLD (2026-06-17): Clio is `coming-soon`. No CLIO credential row exists
 * yet, so `resolveWorkspaceCredential` returns CREDENTIAL_NOT_FOUND before the
 * refresh path is ever exercised. The refresh stub is the documented drop-in:
 * when Conner registers the OAuth app and adds a Clio token-exchange adapter
 * (mirroring `lib/integrations/hubspot/oauth.ts`) plus the connect/callback
 * routes, the refresh wires through. Until then it returns a clear
 * "not configured" error rather than silently failing.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every tool call;
 * no decrypted token lives on the server instance.
 *
 * Storage: the OAuth tokens live in the encrypted columns; the non-secret
 * region host (US `app.clio.com` / EU `eu.app.clio.com`) is carried on
 * `providerMetadata.regionHost`.
 */

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

export interface ResolvedClio {
  credential: DecryptedCredential;
  /** Clio region host without scheme, e.g. `app.clio.com`. */
  regionHost: string;
}

export async function resolveClioCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedClio>> {
  const clientId = process.env.CLIO_OAUTH_CLIENT_ID;
  const clientSecret = process.env.CLIO_OAUTH_CLIENT_SECRET;

  const refresh = async (
    cred: DecryptedCredential,
  ): Promise<IntegrationResult<TokenSet>> => {
    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error: {
          code: 'UPSTREAM_ERROR',
          message:
            'Clio OAuth not configured (CLIO_OAUTH_CLIENT_ID/SECRET). ' +
            'Register the app at app.clio.com — see TODOS-FOR-CONNER.',
        },
      };
    }
    if (!cred.refreshToken) {
      return {
        ok: false,
        error: { code: 'GRANT_REVOKED', message: 'Clio credential has no refresh token.' },
      };
    }
    // Drop-in: instantiate a ClioOAuth adapter (mirror hubspot/oauth.ts) and
    // call refreshTokens here once the app is registered.
    return {
      ok: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message:
          'Clio token refresh adapter not yet wired. The credential path opens ' +
          'with OAuth app registration — see TODOS-FOR-CONNER.',
      },
    };
  };

  const resolved = await resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'CLIO',
    connectorName: 'Clio',
    refresh,
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const regionHost =
    typeof meta?.regionHost === 'string' && meta.regionHost.length > 0
      ? meta.regionHost
      : 'app.clio.com';

  return { ok: true, value: { credential: resolved.value, regionHost } };
}
