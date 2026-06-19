/**
 * lib/integrations/boldtrail-mcp/auth.ts
 *
 * Resolves the per-workspace BoldTrail credential. BoldTrail authenticates with
 * a per-account API key (no OAuth refresh), so — same pattern as SIERRA — the
 * key lives in `IntegrationCredential.accessTokenEncrypted` (encrypted at rest)
 * and is consumed as a Bearer token.
 *
 * Delegates the load/decrypt dance to
 * `lib/integrations/mcp-core/api-key-credential.ts` (mirrors karbon-mcp/auth.ts).
 *
 * SCAFFOLD (2026-06-17): BoldTrail is `coming-soon`. No BOLDTRAIL credential row
 * exists yet, so `resolveApiKeyCredential` returns CREDENTIAL_NOT_FOUND until a
 * key lands — see TODOS-FOR-CONNER.
 *
 * Cold-start safe per `feedback_cold_start_safe_agents.md`: every call
 * re-resolves; no secret is cached on the instance.
 */

import {
  resolveApiKeyCredential,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolvedBoldtrail {
  credential: DecryptedCredential;
}

export async function resolveBoldtrailCredential(args: {
  workspaceId: string;
}): Promise<McpResult<ResolvedBoldtrail>> {
  const resolved = await resolveApiKeyCredential({
    workspaceId: args.workspaceId,
    provider: 'BOLDTRAIL',
    connectorName: 'BoldTrail',
  });
  if (!resolved.ok) return resolved;

  return { ok: true, value: { credential: resolved.value } };
}
