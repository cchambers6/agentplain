/**
 * lib/integrations/mcp-core/credential.ts
 *
 * Generic per-workspace OAuth credential resolution for MCP servers built on
 * the core. Mirrors the shipped `lib/integrations/gmail-mcp/auth.ts` flow —
 * load → decrypt → refresh-if-near-expiry → persist → return — but the
 * refresh step is pluggable so each vendor supplies its own token-refresh
 * adapter (DocuSign rotates, QuickBooks rotates, Slack never refreshes).
 *
 * Per `feedback_cold_start_safe_agents.md`: no decrypted credential is cached
 * across requests. The in-flight map coalesces concurrent refreshes within a
 * single process and stores Promises, not plaintext; entries clear on settle.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this module speaks the
 * `IntegrationProvider` enum + the vendor's `RefreshFn` abstraction. It never
 * imports a vendor SDK.
 */

import type { IntegrationProvider as DbProvider } from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';
import { decryptCredential, encryptTokenSet } from '@/lib/integrations';
import { isEncryptionConfigured } from '@/lib/security/encryption';
import type { DecryptedCredential, IntegrationResult, TokenSet } from '@/lib/integrations/types';
import { mcpError, type McpResult } from './types';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/** Vendor-supplied token refresh. Returns the new bundle to persist. */
export type RefreshFn = (cred: DecryptedCredential) => Promise<IntegrationResult<TokenSet>>;

const inFlight = new Map<string, Promise<McpResult<DecryptedCredential>>>();

export interface ResolveArgs {
  workspaceId: string;
  provider: DbProvider;
  /** Display name used in the not-connected error message. */
  connectorName: string;
  refresh: RefreshFn;
}

export async function resolveWorkspaceCredential(
  args: ResolveArgs,
): Promise<McpResult<DecryptedCredential>> {
  // IntegrationCredential is workspace-scoped RLS — MCP auth runs as the
  // operator on behalf of the workspace, so withSystemContext seeds the
  // operator GUC for the read.
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

  // Fail clearly (not a raw MissingKeyError crash) when the master key is
  // absent — the credential exists but cannot be decrypted in this env.
  if (!isEncryptionConfigured()) {
    return mcpError(
      'UPSTREAM_ERROR',
      `Cannot decrypt the ${args.connectorName} credential for workspace ${args.workspaceId}: ENCRYPTION_KEY is not configured in this environment. The connection is intact; access resumes once the key is restored.`,
    );
  }

  const needsRefresh = row.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS;
  if (!needsRefresh) {
    return { ok: true, value: decryptCredential(row) };
  }
  if (!row.refreshTokenEncrypted) {
    // No refresh token (e.g. Slack user tokens that don't expire shouldn't
    // land here, but if a short-lived token has no refresh, surface it).
    return mcpError(
      'GRANT_REVOKED',
      `Credential ${row.id} for ${args.provider} has no refresh token — reconnect ${args.connectorName}.`,
    );
  }

  const key = `${row.provider}:${row.workspaceId}:${row.id}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = refreshAndPersist(row.id, args.refresh).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function refreshAndPersist(
  credentialId: string,
  refresh: RefreshFn,
): Promise<McpResult<DecryptedCredential>> {
  const row = await withSystemContext((tx) =>
    tx.integrationCredential.findUnique({ where: { id: credentialId } }),
  );
  if (!row) return mcpError('CREDENTIAL_NOT_FOUND', `Credential ${credentialId} vanished mid-refresh`);
  const decrypted = decryptCredential(row);

  const refreshed = await refresh(decrypted);
  if (!refreshed.ok) {
    if (refreshed.error.code === 'GRANT_REVOKED') {
      await withSystemContext((tx) =>
        tx.integrationCredential.update({ where: { id: row.id }, data: { status: 'REVOKED' } }),
      );
      return mcpError('GRANT_REVOKED', `Refresh returned invalid_grant — credential marked REVOKED. ${refreshed.error.message}`, {
        status: refreshed.error.status,
        reference: refreshed.error.reference,
      });
    }
    await withSystemContext((tx) =>
      tx.integrationCredential.update({ where: { id: row.id }, data: { status: 'ERROR' } }),
    );
    return mcpError('UPSTREAM_ERROR', `Refresh failed: ${refreshed.error.message}`, {
      status: refreshed.error.status,
      reference: refreshed.error.reference,
    });
  }

  const enc = encryptTokenSet(refreshed.value);
  const updated = await withSystemContext((tx) =>
    tx.integrationCredential.update({
      where: { id: row.id },
      data: {
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: enc.refreshTokenEncrypted,
        scopes: enc.scopes,
        expiresAt: enc.expiresAt,
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
        // providerMetadata deliberately untouched — refresh never rewrites
        // per-account routing data.
      },
    }),
  );
  return { ok: true, value: decryptCredential(updated) };
}

/** Tests call this between cases. */
export function __resetCredentialCoalescerForTests(): void {
  inFlight.clear();
}
