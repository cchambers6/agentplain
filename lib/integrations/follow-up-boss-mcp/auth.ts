/**
 * lib/integrations/follow-up-boss-mcp/auth.ts
 *
 * Resolves the per-workspace FUB credential. Unlike QuickBooks / Google /
 * M365 (OAuth with refresh), FUB authenticates with a per-account API
 * key the customer pastes in once — the key does not expire, so there
 * is no refresh path. We store the key in `accessTokenEncrypted` (the
 * existing AES-256-GCM v1 envelope) and use a sentinel far-future
 * `expiresAt` so the cred resolver does not try to refresh.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the only place that
 * names the FUB credential row shape. Skills + sweeps call
 * `resolveFollowUpBossCredential` and never touch Prisma directly.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every tool
 * call. The decrypted API key never lives on a server instance.
 */

import { mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import { withSystemContext } from '@/lib/db';
import { isEncryptionConfigured, decrypt } from '@/lib/security/encryption';

export interface ResolvedFollowUpBoss {
  /** Plaintext API key — only lives on the call stack, never on instance. */
  apiKey: string;
  /** FUB account id stamped at connect time. */
  accountId: string;
  /** Whatever email FUB returned as the account contact when the key
   *  was minted. Used for the operator-UI label only. */
  accountEmail: string;
}

export async function resolveFollowUpBossCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedFollowUpBoss>> {
  if (!isEncryptionConfigured()) {
    return mcpError(
      'UPSTREAM_ERROR',
      'Cannot decrypt Follow Up Boss credential: ENCRYPTION_KEY is not configured in this environment.',
    );
  }
  const row = await withSystemContext((tx) =>
    tx.integrationCredential.findFirst({
      where: {
        workspaceId: args.workspaceId,
        provider: 'FOLLOW_UP_BOSS',
        status: 'ACTIVE',
      },
      orderBy: { updatedAt: 'desc' },
    }),
  );
  if (!row) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      `No active Follow Up Boss credential for workspace ${args.workspaceId}. Connect Follow Up Boss first via the integrations page.`,
    );
  }
  try {
    const apiKey = decrypt(row.accessTokenEncrypted);
    return {
      ok: true,
      value: {
        apiKey,
        accountId: row.accountId,
        accountEmail: row.accountEmail,
      },
    };
  } catch (err) {
    return mcpError(
      'UPSTREAM_ERROR',
      `Failed to decrypt Follow Up Boss credential: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
