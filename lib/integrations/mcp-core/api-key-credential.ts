/**
 * lib/integrations/mcp-core/api-key-credential.ts
 *
 * Per-workspace credential resolver for API-key-style providers (no OAuth
 * refresh, no rotated tokens). Used by TaxDome + Karbon today; future
 * API-key vendors plug in via the same seam.
 *
 * Mirrors `resolveWorkspaceCredential` but skips the refresh dance —
 * API-key credentials have `refreshTokenEncrypted = NULL` and
 * `expiresAt` pinned far in the future. If the row is somehow set up
 * incorrectly (a stale `expiresAt` past `now`), we still return the
 * credential — the upstream call will 401, the connector will be marked
 * ERROR, and the operator gets a clear "reconnect" prompt. We do NOT
 * try to refresh — there is nothing to refresh.
 *
 * Per `feedback_cold_start_safe_agents.md`: the credential is read
 * fresh on every fire. No decrypted secret is cached on the instance.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this module speaks the
 * `IntegrationProvider` enum + the decrypted credential shape. It never
 * imports a vendor SDK.
 */

import type { IntegrationProvider as DbProvider } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { decryptCredential } from '@/lib/integrations';
import { isEncryptionConfigured } from '@/lib/security/encryption';
import type { DecryptedCredential } from '@/lib/integrations/types';
import { mcpError, type McpResult } from './types';

export interface ResolveApiKeyArgs {
  workspaceId: string;
  provider: DbProvider;
  /** Display name used in the not-connected error message. */
  connectorName: string;
}

export async function resolveApiKeyCredential(
  args: ResolveApiKeyArgs,
): Promise<McpResult<DecryptedCredential>> {
  const row = await withSystemContext((tx) =>
    tx.integrationCredential.findFirst({
      where: { workspaceId: args.workspaceId, provider: args.provider, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    }),
  );
  if (!row) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      `No active ${args.provider} credential for workspace ${args.workspaceId}. Connect ${args.connectorName} first.`,
    );
  }

  if (!isEncryptionConfigured()) {
    return mcpError(
      'UPSTREAM_ERROR',
      `Cannot decrypt the ${args.connectorName} credential for workspace ${args.workspaceId}: ENCRYPTION_KEY is not configured in this environment. The connection is intact; access resumes once the key is restored.`,
    );
  }

  return { ok: true, value: decryptCredential(row) };
}
