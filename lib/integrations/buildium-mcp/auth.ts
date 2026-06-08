/**
 * lib/integrations/buildium-mcp/auth.ts
 *
 * Resolves the per-workspace Buildium credential. Buildium authenticates
 * with a client-id + client-secret pair the customer creates under
 * Settings → API Settings in their Buildium account — neither rotates, so
 * there is no refresh path (same shape as TaxDome / Karbon / FUB).
 *
 * Storage (mirrors the established API-key precedent):
 *   accessTokenEncrypted        = the SECRET (x-buildium-client-secret)
 *   providerMetadata.clientId   = the non-secret id (x-buildium-client-id)
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every call; the
 * decrypted secret never lives on a server instance.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the only place that names the
 * Buildium credential row shape. The server + adapter call
 * `resolveBuildiumCredential` and never touch Prisma directly.
 */

import {
  resolveApiKeyCredential,
  mcpError,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolvedBuildium {
  credential: DecryptedCredential;
  /** Non-secret API client id sent as `x-buildium-client-id`. */
  clientId: string;
  /** Secret sent as `x-buildium-client-secret` (the decrypted token). */
  clientSecret: string;
}

export async function resolveBuildiumCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedBuildium>> {
  const resolved = await resolveApiKeyCredential({
    workspaceId: args.workspaceId,
    provider: 'BUILDIUM',
    connectorName: 'Buildium',
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const clientId =
    typeof meta?.clientId === 'string' && meta.clientId.length > 0
      ? meta.clientId
      : null;
  if (!clientId) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'Buildium credential is missing its clientId (providerMetadata.clientId). Reconnect Buildium.',
    );
  }
  return {
    ok: true,
    value: {
      credential: resolved.value,
      clientId,
      clientSecret: resolved.value.accessToken,
    },
  };
}
