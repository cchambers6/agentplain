/**
 * lib/integrations/docusign-mcp/auth.ts
 *
 * Resolves the per-workspace DocuSign credential, refreshing via the OAuth
 * adapter when near expiry. Delegates the load/decrypt/persist dance to
 * `lib/integrations/mcp-core/credential.ts`; supplies the DocuSign-specific
 * `RefreshFn`.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every tool call;
 * no decrypted token lives on the server instance.
 */

import { env } from '@/lib/env';
import { DocuSignOAuth } from '@/lib/integrations/docusign/oauth';
import { resolveWorkspaceCredential, mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import type { DecryptedCredential, IntegrationResult, TokenSet } from '@/lib/integrations/types';

export interface ResolvedDocuSign {
  credential: DecryptedCredential;
  /** REST API base for this account, e.g. https://demo.docusign.net */
  apiBaseUri: string;
  /** DocuSign API account id (also the credential.accountId). */
  accountId: string;
}

export async function resolveDocuSignCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedDocuSign>> {
  const clientId = env.docusignOAuthClientId();
  const clientSecret = env.docusignOAuthClientSecret();

  const refresh = async (cred: DecryptedCredential): Promise<IntegrationResult<TokenSet>> => {
    if (!clientId || !clientSecret) {
      return { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'DocuSign OAuth not configured (DOCUSIGN_OAUTH_CLIENT_ID/SECRET).' } };
    }
    if (!cred.refreshToken) {
      return { ok: false, error: { code: 'GRANT_REVOKED', message: 'DocuSign credential has no refresh token.' } };
    }
    const oauth = new DocuSignOAuth({ clientId, clientSecret, baseUri: env.docusignOAuthBaseUri() });
    return oauth.refreshTokens({
      refreshToken: cred.refreshToken,
      accountId: cred.accountId,
      accountEmail: cred.accountEmail,
    });
  };

  const resolved = await resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'DOCUSIGN',
    connectorName: 'DocuSign',
    refresh,
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const apiBaseUri = typeof meta?.apiBaseUri === 'string' ? meta.apiBaseUri : null;
  if (!apiBaseUri) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'DocuSign credential is missing its REST base_uri (providerMetadata.apiBaseUri). Reconnect DocuSign.',
    );
  }
  return {
    ok: true,
    value: { credential: resolved.value, apiBaseUri, accountId: resolved.value.accountId },
  };
}
