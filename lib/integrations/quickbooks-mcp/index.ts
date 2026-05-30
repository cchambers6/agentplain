/**
 * lib/integrations/quickbooks-mcp/index.ts
 *
 * Builder + barrel for the QuickBooks MCP server. `buildQuickbooksMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test` (parity with the registry switch in
 * `lib/integrations/index.ts`).
 */

import { QUICKBOOKS_NAMESPACE, type QuickbooksMcpServer } from './types';
import { ProdQuickbooksMcpServer } from './server';
import { TestQuickbooksMcpServer } from './test-server';
import { QUICKBOOKS_TOOLS } from './tools';

export function buildQuickbooksMcpServer(args: { workspaceId: string }): QuickbooksMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestQuickbooksMcpServer(args);
  }
  return new ProdQuickbooksMcpServer(args);
}

export { QUICKBOOKS_TOOLS, QUICKBOOKS_NAMESPACE };
export type {
  CreateInvoiceInput,
  CreateInvoiceOutput,
  CustomerSummary,
  ExpenseSummary,
  GetInvoiceInput,
  GetInvoiceOutput,
  GetProfitAndLossInput,
  GetProfitAndLossOutput,
  InvoiceSummary,
  ListCustomersInput,
  ListCustomersOutput,
  ListExpensesInput,
  ListExpensesOutput,
  ListInvoicesInput,
  ListInvoicesOutput,
  QuickbooksMcpServer,
  RecordPaymentInput,
  RecordPaymentOutput,
} from './types';
export { ProdQuickbooksMcpServer } from './server';
export { TestQuickbooksMcpServer } from './test-server';
