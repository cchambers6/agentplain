/**
 * lib/integrations/slack-mcp/auth.ts
 *
 * Resolves the per-workspace Slack credential. Slack user tokens (rotation
 * disabled) never expire, so the credential resolver never reaches the refresh
 * path — but the seam requires a `RefreshFn`, so we supply one that returns
 * GRANT_REVOKED (it is never actually invoked given the far-future expiry).
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every tool call; no
 * decrypted token lives on the server instance.
 */

import { resolveWorkspaceCredential, type McpResult } from '@/lib/integrations/mcp-core';
import type { DecryptedCredential, IntegrationResult, TokenSet } from '@/lib/integrations/types';

export interface ResolvedSlack {
  credential: DecryptedCredential;
  /** Slack team id (workspace), from providerMetadata. */
  teamId: string | null;
}

export async function resolveSlackCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedSlack>> {
  const refresh = async (): Promise<IntegrationResult<TokenSet>> => {
    return {
      ok: false,
      error: { code: 'GRANT_REVOKED', message: 'Slack user tokens do not refresh; reconnect Slack.' },
    };
  };

  const resolved = await resolveWorkspaceCredential({
    workspaceId: args.workspaceId,
    provider: 'SLACK',
    connectorName: 'Slack',
    refresh,
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const teamId = typeof meta?.teamId === 'string' ? meta.teamId : null;
  return { ok: true, value: { credential: resolved.value, teamId } };
}
