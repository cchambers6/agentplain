/**
 * lib/integrations/kvcore-mcp/auth.ts
 *
 * Resolves the per-workspace kvCORE credential. kvCORE uses a static per-account
 * API key (`Authorization: Bearer <key>`) — no OAuth partner enrollment, no
 * token rotation.
 *
 * The key lives in `IntegrationCredential.accessTokenEncrypted` (encrypted at
 * rest) — the same pattern as SIERRA / FOLLOW_UP_BOSS.
 *
 * Cold-start safe per `feedback_cold_start_safe_agents.md`: every call
 * re-resolves; no secret is cached on the instance.
 */

import {
  resolveApiKeyCredential,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolvedKvcore {
  credential: DecryptedCredential;
}

export async function resolveKvcoreCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedKvcore>> {
  const resolved = await resolveApiKeyCredential({
    workspaceId: args.workspaceId,
    provider: 'KVCORE',
    connectorName: 'kvCORE',
  });
  if (!resolved.ok) return resolved;

  return { ok: true, value: { credential: resolved.value } };
}
