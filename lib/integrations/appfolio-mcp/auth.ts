/**
 * lib/integrations/appfolio-mcp/auth.ts
 *
 * Resolves the per-workspace AppFolio credential. AppFolio authenticates with
 * an HTTP BASIC client-id + client-secret pair scoped to the customer's
 * per-tenant subdomain — neither rotates, so there is no refresh path (same
 * shape as Buildium / TaxDome / Karbon / FUB).
 *
 * AppFolio API access requires partner-program approval (~2 month review) —
 * see TODOS-FOR-CONNER. Highest priority for the PM vertical.
 *
 * Storage (mirrors the established API-key precedent):
 *   accessTokenEncrypted          = the SECRET (BASIC password / client secret)
 *   providerMetadata.clientId     = the non-secret BASIC user / client id
 *   providerMetadata.subdomain    = the customer's AppFolio account host label
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves on every call; the
 * decrypted secret never lives on a server instance.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the only place that names the
 * AppFolio credential row shape. The server + adapter call
 * `resolveAppfolioCredential` and never touch Prisma directly.
 */

import {
  resolveApiKeyCredential,
  mcpError,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolvedAppfolio {
  credential: DecryptedCredential;
  /** Non-secret BASIC user / client id. */
  clientId: string;
  /** Secret BASIC password (the decrypted token). */
  clientSecret: string;
  /** Customer's AppFolio account host label, e.g. `acme` in `acme.appfolio.com`. */
  subdomain: string;
}

export async function resolveAppfolioCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedAppfolio>> {
  const resolved = await resolveApiKeyCredential({
    workspaceId: args.workspaceId,
    provider: 'APPFOLIO',
    connectorName: 'AppFolio',
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
      'AppFolio credential is missing its clientId (providerMetadata.clientId). Reconnect AppFolio.',
    );
  }
  // subdomain is non-secret; default to '' when absent (the per-tenant host is
  // set at connect time alongside the client id + secret).
  const subdomain =
    typeof meta?.subdomain === 'string' && meta.subdomain.length > 0
      ? meta.subdomain
      : '';

  return {
    ok: true,
    value: {
      credential: resolved.value,
      clientId,
      clientSecret: resolved.value.accessToken,
      subdomain,
    },
  };
}
