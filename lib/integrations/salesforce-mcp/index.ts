/**
 * lib/integrations/salesforce-mcp/index.ts
 *
 * Builder + barrel for the Salesforce MCP. `buildSalesforceMcpServer` returns
 * the prod server, or the in-memory recording server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`). Skills + cron sweeps + the HTTP route import
 * from here only.
 */

import { ProdSalesforceMcpServer } from './server';
import { RecordingSalesforceMcpServer } from './test-server';
import type { SalesforceMcpServer } from './types';

export function buildSalesforceMcpServer(args: { workspaceId: string }): SalesforceMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new RecordingSalesforceMcpServer(args);
  }
  return new ProdSalesforceMcpServer(args);
}

export { SALESFORCE_TOOLS, SALESFORCE_NAMESPACE } from './tools';
export { ProdSalesforceMcpServer } from './server';
export { RecordingSalesforceMcpServer } from './test-server';
export { SalesforceLeadFetcher } from './salesforce-lead-fetcher';
export { toLeadRecord } from './to-lead-record';
export { resolveSalesforceCredential, type ResolvedSalesforce } from './auth';
export type {
  SalesforceMcpServer,
  SalesforceLeadSummary,
  SalesforceOpportunitySummary,
  SalesforceAccountSummary,
  SalesforceContactSummary,
  ListLeadsInput,
  ListLeadsOutput,
  GetLeadInput,
  GetLeadOutput,
  ListOpportunitiesInput,
  ListOpportunitiesOutput,
  GetOpportunityInput,
  GetOpportunityOutput,
  ListAccountsInput,
  ListAccountsOutput,
  GetAccountInput,
  GetAccountOutput,
  ListContactsInput,
  ListContactsOutput,
  CreateTaskInput,
  CreateTaskOutput,
} from './types';
