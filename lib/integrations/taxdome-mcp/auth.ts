/**
 * lib/integrations/taxdome-mcp/auth.ts
 *
 * Resolves the per-workspace TaxDome API-key credential. TaxDome keys do
 * not refresh — they are static keys created under Account → API Keys in
 * the firm's TaxDome dashboard. We persist the key encrypted at rest +
 * read it on every call (`feedback_cold_start_safe_agents.md`).
 *
 * The resolved value carries the firm's portal subdomain (from
 * `providerMetadata.portalSubdomain`) so `server.ts` can pick the right
 * REST base URL (`https://<subdomain>.taxdome.com/api/v1`).
 */

import {
  resolveApiKeyCredential,
  mcpError,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolvedTaxdome {
  credential: DecryptedCredential;
  /** Firm's TaxDome portal subdomain — e.g. `acme` for
   *  `https://acme.taxdome.com`. Required to route REST calls. */
  portalSubdomain: string;
}

export async function resolveTaxdomeCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedTaxdome>> {
  const resolved = await resolveApiKeyCredential({
    workspaceId: args.workspaceId,
    provider: 'TAXDOME',
    connectorName: 'TaxDome',
  });
  if (!resolved.ok) return resolved;

  const meta = resolved.value.providerMetadata;
  const portalSubdomain =
    typeof meta?.portalSubdomain === 'string' && meta.portalSubdomain.length > 0
      ? meta.portalSubdomain
      : null;
  if (!portalSubdomain) {
    return mcpError(
      'CREDENTIAL_NOT_FOUND',
      'TaxDome credential is missing its portalSubdomain (providerMetadata.portalSubdomain). Reconnect TaxDome.',
    );
  }
  return { ok: true, value: { credential: resolved.value, portalSubdomain } };
}

export function taxdomeApiBase(portalSubdomain: string): string {
  return `https://${portalSubdomain}.taxdome.com/api/v1`;
}
