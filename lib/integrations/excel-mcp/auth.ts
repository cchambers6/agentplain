/**
 * lib/integrations/excel-mcp/auth.ts
 *
 * Thin shim — delegates per-workspace M365 credential resolution to
 * `lib/integrations/microsoft/credential-resolver.ts`. Same M365
 * IntegrationCredential row as Outlook / Teams / OneDrive.
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
    integrationLabel: 'Excel',
  });
}

export { __resetM365InFlightRefreshesForTests as __resetInFlightRefreshesForTests };
