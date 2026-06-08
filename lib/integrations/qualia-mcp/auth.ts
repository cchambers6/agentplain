/**
 * lib/integrations/qualia-mcp/auth.ts
 *
 * Resolves the per-workspace Qualia credential. Qualia authenticates with
 * HTTP Basic auth: the organization id is the username and an API key is
 * the password — the customer creates the key under their Qualia account.
 * Neither rotates, so there is no refresh path (same API-key pattern as
 * Buildium / TaxDome / Karbon / FUB).
 *
 * Storage (mirrors the established API-key precedent):
 *   accessTokenEncrypted    = the API KEY (Basic password)
 *   providerMetadata.orgId  = the non-secret org id (Basic username + host)
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every call; the
 * decrypted secret never lives on a server instance.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the only place that names the
 * Qualia credential row shape. The server + adapter call
 * `resolveQualiaCredential` and never touch Prisma directly.
 */

import {
  resolveApiKeyCredential,
  mcpError,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolvedQualia {
  credential: DecryptedCredential;
  /** Non-secret org id — Basic username AND the {org} host segment. */
  orgId: string;
  /** Secret Basic password (the decrypted API key). */
  apiKey: string;
}

export async function resolveQualiaCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedQualia>> {
  const resolved = await resolveApiKeyCredential({
    workspaceId: args.workspaceId,
    provider: 'QUALIA',
    connectorName: 'Qualia',
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const orgId =
    typeof meta?.orgId === 'string' && meta.orgId.length > 0 ? meta.orgId : null;
  if (!orgId) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'Qualia credential is missing its orgId (providerMetadata.orgId). Reconnect Qualia.',
    );
  }
  return {
    ok: true,
    value: {
      credential: resolved.value,
      orgId,
      apiKey: resolved.value.accessToken,
    },
  };
}
