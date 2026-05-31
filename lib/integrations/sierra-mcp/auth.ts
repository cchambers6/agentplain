/**
 * lib/integrations/sierra-mcp/auth.ts
 *
 * Resolves the per-workspace Sierra Interactive credential. Same shape
 * as the FUB resolver — Sierra authenticates with a per-account API
 * key (no OAuth refresh), so we store it in `accessTokenEncrypted` (v1
 * AES-256-GCM envelope) and stamp a sentinel far-future `expiresAt`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the ONLY place that
 * names Sierra's credential row shape.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every tool
 * call; the decrypted key never lives on a server instance.
 */

import { mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import { withSystemContext } from '@/lib/db';
import { isEncryptionConfigured, decrypt } from '@/lib/security/encryption';

export interface ResolvedSierra {
  /** Plaintext API key — only lives on the call stack. */
  apiKey: string;
  /** Sierra account id stamped at connect time. */
  accountId: string;
  /** Account email (operator-UI label only). */
  accountEmail: string;
}

export async function resolveSierraCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedSierra>> {
  if (!isEncryptionConfigured()) {
    return mcpError(
      'UPSTREAM_ERROR',
      'Cannot decrypt Sierra Interactive credential: ENCRYPTION_KEY is not configured in this environment.',
    );
  }
  const row = await withSystemContext((tx) =>
    tx.integrationCredential.findFirst({
      where: {
        workspaceId: args.workspaceId,
        provider: 'SIERRA_INTERACTIVE',
        status: 'ACTIVE',
      },
      orderBy: { updatedAt: 'desc' },
    }),
  );
  if (!row) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      `No active Sierra Interactive credential for workspace ${args.workspaceId}. Connect Sierra first via the integrations page.`,
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
      `Failed to decrypt Sierra Interactive credential: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
