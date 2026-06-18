/**
 * lib/integrations/mycase-mcp/auth.ts
 *
 * Resolves the per-workspace MyCase credential. MyCase authenticates with a
 * static per-workspace API token (NOT OAuth), so there is no refresh dance —
 * the token is loaded + decrypted on every call.
 *
 * The token lives in `IntegrationCredential.accessTokenEncrypted` (encrypted
 * at rest), the same pattern FOLLOW_UP_BOSS / SIERRA use for their API keys.
 *
 * Cold-start safe per `feedback_cold_start_safe_agents.md`: every call
 * re-resolves; no secret is cached on the instance.
 */

import {
  resolveApiKeyCredential,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolvedMyCase {
  credential: DecryptedCredential;
}

export async function resolveMyCaseCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedMyCase>> {
  const resolved = await resolveApiKeyCredential({
    workspaceId: args.workspaceId,
    provider: 'MYCASE',
    connectorName: 'MyCase',
  });
  if (!resolved.ok) return resolved;

  return { ok: true, value: { credential: resolved.value } };
}
