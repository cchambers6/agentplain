/**
 * lib/integrations/teams-mcp/auth.ts
 *
 * Thin shim — delegates per-workspace M365 credential resolution to the
 * shared `lib/integrations/microsoft/credential-resolver.ts`. The Teams
 * MCP, the OneDrive MCP, and the Excel MCP all share the same M365
 * IntegrationCredential row per workspace (one consented Microsoft
 * account per workspace, scope-union of everything the customer granted),
 * so the resolver lives once and these auth.ts files are 5-line wrappers.
 *
 * Mirrors `lib/integrations/outlook-mcp/auth.ts` in spirit; that older
 * file pre-dates the shared resolver and stays as-is (don't refactor
 * shipped code outside scope). A future cleanup can collapse them.
 */

import {
  resolveM365Credential,
  __resetM365InFlightRefreshesForTests,
} from '@/lib/integrations/microsoft/credential-resolver';
import type { McpResult } from '@/lib/integrations/microsoft/mcp-common';
import type { DecryptedCredential } from '@/lib/integrations/types';

export interface ResolveCredentialArgs {
  workspaceId: string;
}

export async function resolveCredential(
  args: ResolveCredentialArgs,
): Promise<McpResult<DecryptedCredential>> {
  return resolveM365Credential({
    workspaceId: args.workspaceId,
    integrationLabel: 'Teams',
  });
}

export { __resetM365InFlightRefreshesForTests as __resetInFlightRefreshesForTests };
