/**
 * lib/integrations/salesforce-mcp/index.ts
 *
 * Builder + barrel for the Salesforce MCP. `buildSalesforceMcpServer` returns
 * the prod server, or the in-memory recording server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`). Skills + cron sweeps + the HTTP route import
 * from here only.
 */

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { ProdSalesforceMcpServer } from './server';
import { RecordingSalesforceMcpServer } from './test-server';
import { withSalesforceApproval } from './with-approval';
import type { SalesforceMcpServer } from './types';

/**
 * Build the Salesforce MCP server. Every mutating method is approval-gated at
 * this seam — an ungated server can't be obtained. Tests inject `deps` carrying
 * an in-memory gate + audit sink so they can seed grants deterministically.
 */
export function buildSalesforceMcpServer(args: {
  workspaceId: string;
  deps?: ConnectorApprovalDeps;
}): SalesforceMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return withSalesforceApproval(new RecordingSalesforceMcpServer(args), deps);
  }
  return withSalesforceApproval(new ProdSalesforceMcpServer(args), deps);
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
  CreateOpportunityInput,
  CreateOpportunityOutput,
  UpdateRecordInput,
  UpdateRecordOutput,
  SendEmailTemplateInput,
  SendEmailTemplateOutput,
  LogCallInput,
  LogCallOutput,
} from './types';
