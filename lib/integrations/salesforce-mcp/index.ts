/**
 * lib/integrations/salesforce-mcp/index.ts
 *
 * Public surface for the Salesforce MCP. Skills + cron sweeps import
 * from here only.
 */

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
