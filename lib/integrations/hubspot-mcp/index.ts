/**
 * lib/integrations/hubspot-mcp/index.ts
 *
 * Public surface for the HubSpot MCP. Skills + cron sweeps import from
 * here only.
 */

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
