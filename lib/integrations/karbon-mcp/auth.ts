/**
 * lib/integrations/karbon-mcp/auth.ts
 *
 * Resolves the per-workspace Karbon credential. Karbon API v3 uses two
 * static headers (Authorization: Bearer + AccessKey) per the developer
 * docs at developers.karbonhq.com (read 2026-05-29). Neither key rotates.
 *
 * `accessToken` lives in `IntegrationCredential.accessTokenEncrypted`
 * (encrypted at rest); `accessKey` lives in
 * `providerMetadata.accessKey` (non-secret routing per the existing
 * `providerMetadata` convention).
 *
 * Cold-start safe per `feedback_cold_start_safe_agents.md`: every call
 * re-resolves; no secret is cached on the instance.
 */

import {
  resolveApiKeyCredential,
  mcpError,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolvedKarbon {
  credential: DecryptedCredential;
  /** Karbon's per-firm AccessKey header value. */
  accessKey: string;
}

export async function resolveKarbonCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedKarbon>> {
  const resolved = await resolveApiKeyCredential({
    workspaceId: args.workspaceId,
    provider: 'KARBON',
    connectorName: 'Karbon',
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const accessKey =
    typeof meta?.accessKey === 'string' && meta.accessKey.length > 0
      ? meta.accessKey
      : null;
  if (!accessKey) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'Karbon credential is missing its accessKey (providerMetadata.accessKey). Reconnect Karbon.',
    );
  }
  return { ok: true, value: { credential: resolved.value, accessKey } };
}

export function karbonApiBase(): string {
  return 'https://api.karbonhq.com/v3';
}
