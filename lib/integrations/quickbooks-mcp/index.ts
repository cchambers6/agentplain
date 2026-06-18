/**
 * lib/integrations/quickbooks-mcp/index.ts
 *
 * Builder + barrel for the QuickBooks MCP server. `buildQuickbooksMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`).
 */

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { QUICKBOOKS_NAMESPACE, type QuickbooksMcpServer } from './types';
import { ProdQuickbooksMcpServer } from './server';
import { TestQuickbooksMcpServer } from './test-server';
import { withQuickbooksApproval } from './with-approval';
import { QUICKBOOKS_TOOLS } from './tools';

/**
 * Build the QuickBooks MCP server. Every mutating method is approval-gated at
 * this seam — an ungated server can't be obtained. Tests inject `deps` carrying
 * an in-memory gate + audit sink so they can seed grants deterministically.
 */
export function buildQuickbooksMcpServer(args: {
  workspaceId: string;
  deps?: ConnectorApprovalDeps;
}): QuickbooksMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return withQuickbooksApproval(new TestQuickbooksMcpServer(args), deps);
  }
  return withQuickbooksApproval(new ProdQuickbooksMcpServer(args), deps);
}

export { QUICKBOOKS_TOOLS, QUICKBOOKS_NAMESPACE };
export type {
  CreateInvoiceInput,
  CreateInvoiceOutput,
  CustomerSummary,
  EstimateSummary,
  ExpenseSummary,
  GetEstimateInput,
  GetEstimateOutput,
  GetInvoiceInput,
  GetInvoiceOutput,
  GetProfitAndLossInput,
  GetProfitAndLossOutput,
  InvoiceSummary,
  ListCustomersInput,
  ListCustomersOutput,
  ListEstimatesInput,
  ListEstimatesOutput,
  ListExpensesInput,
  ListExpensesOutput,
  ListInvoicesInput,
  ListInvoicesOutput,
  QboEstimateStatus,
  QuickbooksMcpServer,
  RecordPaymentInput,
  RecordPaymentOutput,
} from './types';
export { ProdQuickbooksMcpServer } from './server';
export { TestQuickbooksMcpServer } from './test-server';
