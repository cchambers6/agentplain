/**
 * lib/integrations/hubspot-mcp/index.ts
 *
 * Builder + barrel for the HubSpot MCP. `buildHubspotMcpServer` returns the
 * prod server, or the in-memory recording server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`). Skills + cron sweeps + the HTTP route import
 * from here only.
 */

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { ProdHubspotMcpServer } from './server';
import { RecordingHubspotMcpServer } from './test-server';
import { withHubspotApproval } from './with-approval';
import type { HubspotMcpServer } from './types';

/**
 * Build the HubSpot MCP server. Every mutating method is approval-gated at this
 * seam — an ungated server can't be obtained. Tests inject `deps` carrying an
 * in-memory gate + audit sink so they can seed grants deterministically.
 */
export function buildHubspotMcpServer(args: {
  workspaceId: string;
  deps?: ConnectorApprovalDeps;
}): HubspotMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return withHubspotApproval(new RecordingHubspotMcpServer(args), deps);
  }
  return withHubspotApproval(new ProdHubspotMcpServer(args), deps);
}

export { HUBSPOT_TOOLS, HUBSPOT_NAMESPACE } from './tools';
export { ProdHubspotMcpServer } from './server';
export { RecordingHubspotMcpServer } from './test-server';
export { HubspotLeadFetcher } from './hubspot-lead-fetcher';
export { toLeadRecord } from './to-lead-record';
export { resolveHubspotCredential, type ResolvedHubspot } from './auth';
export type {
  HubspotMcpServer,
  HubspotContactSummary,
  HubspotDealSummary,
  HubspotCompanySummary,
  ListContactsInput,
  ListContactsOutput,
  GetContactInput,
  GetContactOutput,
  UpdateContactInput,
  UpdateContactOutput,
  ListDealsInput,
  ListDealsOutput,
  GetDealInput,
  GetDealOutput,
  UpdateDealInput,
  UpdateDealOutput,
  ListCompaniesInput,
  ListCompaniesOutput,
  GetCompanyInput,
  GetCompanyOutput,
  CreateNoteInput,
  CreateNoteOutput,
} from './types';
