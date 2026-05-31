/**
 * lib/integrations/notion-mcp/auth.ts
 *
 * Resolves the per-workspace Notion credential. Notion access tokens
 * are workspace-scoped and DO NOT EXPIRE — there is no refresh path, so
 * we resolve directly via the IntegrationCredential read without going
 * through the OAuth-refresh dance in `mcp-core/credential.ts`.
 *
 * Pattern parallels `lib/integrations/follow-up-boss-mcp/auth.ts` (also
 * an API-key-style credential with no refresh).
 */

import { mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import { withSystemContext } from '@/lib/db';
import { isEncryptionConfigured, decrypt } from '@/lib/security/encryption';

export interface ResolvedNotion {
  /** Plaintext access token — only lives on the call stack. */
  accessToken: string;
  /** Notion workspace id the grant covers. */
  notionWorkspaceId: string;
  /** Customer-friendly workspace label. */
  workspaceName: string;
  /** Notion bot id (the integration installation id). */
  botId: string;
}

export async function resolveNotionCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedNotion>> {
  if (!isEncryptionConfigured()) {
    return mcpError(
      'UPSTREAM_ERROR',
      'Cannot decrypt Notion credential: ENCRYPTION_KEY is not configured in this environment.',
    );
  }
  const row = await withSystemContext((tx) =>
    tx.integrationCredential.findFirst({
      where: {
        workspaceId: args.workspaceId,
        provider: 'NOTION',
        status: 'ACTIVE',
      },
      orderBy: { updatedAt: 'desc' },
    }),
  );
  if (!row) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      `No active Notion credential for workspace ${args.workspaceId}. Connect Notion first via the integrations page.`,
    );
  }
  try {
    const accessToken = decrypt(row.accessTokenEncrypted);
    const meta = (row.providerMetadata ?? null) as Record<string, unknown> | null;
    const botId = typeof meta?.botId === 'string' && meta.botId.length > 0
      ? meta.botId
      : 'unknown-bot';
    const workspaceName = typeof meta?.workspaceName === 'string' && meta.workspaceName.length > 0
      ? meta.workspaceName
      : row.accountEmail;
    return {
      ok: true,
      value: {
        accessToken,
        notionWorkspaceId: row.accountId,
        workspaceName,
        botId,
      },
    };
  } catch (err) {
    return mcpError(
      'UPSTREAM_ERROR',
      `Failed to decrypt Notion credential: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
