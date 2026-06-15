/**
 * lib/integrations/hubspot-mcp/index.ts
 *
 * Builder + barrel for the HubSpot MCP. `buildHubspotMcpServer` returns the
 * prod server, or the in-memory recording server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`). Skills + cron sweeps + the HTTP route import
 * from here only.
 */

import { ProdHubspotMcpServer } from './server';
import { RecordingHubspotMcpServer } from './test-server';
import type { HubspotMcpServer } from './types';

export function buildHubspotMcpServer(args: { workspaceId: string }): HubspotMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new RecordingHubspotMcpServer(args);
  }
  return new ProdHubspotMcpServer(args);
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
