/**
 * lib/integrations/quickbooks-mcp/test-server.ts
 *
 * Fixture-backed QuickBooks MCP server — the second implementation that
 * satisfies the two-implementation rule (`feedback_runner_portability.md`).
 * Deterministic, no network, no credential resolution. Used by the smoke test
 * + by `INTEGRATIONS_PROVIDER=test` previews.
 *
 * It honors the SAME approval gate as prod: `recordPayment` refuses without a
 * non-empty `approvalToken`.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type CreateInvoiceInput,
  type CreateInvoiceOutput,
  type CustomerSummary,
  type ExpenseSummary,
  type GetInvoiceInput,
  type GetInvoiceOutput,
  type GetProfitAndLossInput,
  type GetProfitAndLossOutput,
  type InvoiceSummary,
  type ListCustomersInput,
  type ListCustomersOutput,
  type ListExpensesInput,
  type ListExpensesOutput,
  type ListInvoicesInput,
  type ListInvoicesOutput,
  type QuickbooksMcpServer,
  type RecordPaymentInput,
  type RecordPaymentOutput,
} from './types';

const FIXTURE_INVOICES: InvoiceSummary[] = [
  {
    id: '101',
    docNumber: '1001',
    customerId: '1',
    customerName: 'Acme Roofing',
    totalAmount: 4500.0,
    balance: 4500.0,
    txnDate: '2026-05-01',
    dueDate: '2026-05-31',
  },
  {
    id: '102',
    docNumber: '1002',
    customerId: '2',
    customerName: 'Buckhead HVAC',
    totalAmount: 1200.0,
    balance: 0,
    txnDate: '2026-05-10',
    dueDate: '2026-05-25',
  },
];

const FIXTURE_CUSTOMERS: CustomerSummary[] = [
  { id: '1', displayName: 'Acme Roofing', email: 'ar@example.com', balance: 4500.0, active: true },
  { id: '2', displayName: 'Buckhead HVAC', email: 'bh@example.com', balance: 0, active: true },
];

const FIXTURE_EXPENSES: ExpenseSummary[] = [
  { id: '301', paymentType: 'CreditCard', accountName: 'Job Materials', totalAmount: 820.5, txnDate: '2026-05-03' },
];

export class TestQuickbooksMcpServer implements QuickbooksMcpServer {
  readonly name = 'quickbooks-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listInvoices(input: ListInvoicesInput): Promise<McpResult<ListInvoicesOutput>> {
    const invoices = input.customerId
      ? FIXTURE_INVOICES.filter((i) => i.customerId === input.customerId)
      : FIXTURE_INVOICES;
    return mcpOk({ invoices });
  }

  async getInvoice(input: GetInvoiceInput): Promise<McpResult<GetInvoiceOutput>> {
    const invoice = FIXTURE_INVOICES.find((i) => i.id === input.invoiceId);
    if (!invoice) return mcpError('NOT_FOUND', `No invoice ${input.invoiceId}`);
    return mcpOk({ invoice });
  }

  async createInvoice(input: CreateInvoiceInput): Promise<McpResult<CreateInvoiceOutput>> {
    if (!input.customerId) return mcpError('INVALID_ARGUMENT', 'createInvoice requires customerId');
    if (!input.lines || input.lines.length === 0) {
      return mcpError('INVALID_ARGUMENT', 'createInvoice requires at least one line');
    }
    const total = input.lines.reduce((sum, l) => sum + l.amount, 0);
    const customer = FIXTURE_CUSTOMERS.find((c) => c.id === input.customerId);
    return mcpOk({
      invoice: {
        id: '999',
        docNumber: '2001',
        customerId: input.customerId,
        customerName: customer?.displayName ?? null,
        totalAmount: total,
        balance: total,
        txnDate: '2026-05-20',
        dueDate: null,
      },
    });
  }

  async listCustomers(_input: ListCustomersInput): Promise<McpResult<ListCustomersOutput>> {
    return mcpOk({ customers: FIXTURE_CUSTOMERS });
  }

  async recordPayment(input: RecordPaymentInput): Promise<McpResult<RecordPaymentOutput>> {
    // Same gate as prod — refuse without a human approval token.
    if (!input.approvalToken || input.approvalToken.trim().length === 0) {
      return mcpError(
        'APPROVAL_REQUIRED',
        'record_payment requires human approval; pass approvalToken from the approval queue. agentplain never moves money without an explicit human approval step.',
      );
    }
    if (!input.customerId) return mcpError('INVALID_ARGUMENT', 'recordPayment requires customerId');
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return mcpError('INVALID_ARGUMENT', `recordPayment requires a positive amount, got ${input.amount}`);
    }
    return mcpOk({ paymentId: 'pay-555', totalAmount: input.amount, customerId: input.customerId });
  }

  async getProfitAndLoss(input: GetProfitAndLossInput): Promise<McpResult<GetProfitAndLossOutput>> {
    return mcpOk({
      startDate: input.startDate ?? '2026-02-19',
      endDate: input.endDate ?? '2026-05-20',
      currency: 'USD',
      rows: [
        { label: 'Total Income', amount: 5700.0 },
        { label: 'Total Expenses', amount: 820.5 },
        { label: 'Net Income', amount: 4879.5 },
      ],
    });
  }

  async listExpenses(_input: ListExpensesInput): Promise<McpResult<ListExpensesOutput>> {
    return mcpOk({ expenses: FIXTURE_EXPENSES });
  }
}
