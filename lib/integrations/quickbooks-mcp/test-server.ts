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
  type EstimateSummary,
  type ExpenseSummary,
  type GetEstimateInput,
  type GetEstimateOutput,
  type GetInvoiceInput,
  type GetInvoiceOutput,
  type GetProfitAndLossInput,
  type GetProfitAndLossOutput,
  type InvoiceSummary,
  type ListCustomersInput,
  type ListCustomersOutput,
  type ListEstimatesInput,
  type ListEstimatesOutput,
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

// Fixture estimates represent realistic home-services scenarios:
//   EST-401 — a $6,200 roofing quote sent 4 days ago (Pending, needs soft-nudge)
//   EST-402 — a $3,800 HVAC estimate sent 8 days ago (Pending, needs check-in)
//   EST-403 — a $950 plumbing estimate that was accepted (should not appear in
//             Pending filter — validates the status filter works)
export const FIXTURE_ESTIMATES: EstimateSummary[] = [
  {
    id: 'EST-401',
    docNumber: 'EST-2026-0401',
    customerId: '1',
    customerName: 'Jamie Carter',
    customerEmail: 'jamie@homeowner.example',
    totalAmount: 6200.0,
    txnDate: '2026-05-20',
    expiryDate: '2026-06-20',
    txnStatus: 'Pending',
    customerMemo: 'Full roof replacement — dimensional shingles',
  },
  {
    id: 'EST-402',
    docNumber: 'EST-2026-0402',
    customerId: '2',
    customerName: 'Morgan Ellis',
    customerEmail: 'morgan@homeowner.example',
    totalAmount: 3800.0,
    txnDate: '2026-05-16',
    expiryDate: null,
    txnStatus: 'Pending',
    customerMemo: 'HVAC system replacement — 3-ton Carrier',
  },
  {
    id: 'EST-403',
    docNumber: 'EST-2026-0403',
    customerId: '3',
    customerName: 'Riley Park',
    customerEmail: 'riley@homeowner.example',
    totalAmount: 950.0,
    txnDate: '2026-05-10',
    expiryDate: null,
    txnStatus: 'Accepted',
    customerMemo: 'Water heater replacement',
  },
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

  async listEstimates(input: ListEstimatesInput): Promise<McpResult<ListEstimatesOutput>> {
    let estimates = FIXTURE_ESTIMATES;
    if (input.status) {
      estimates = estimates.filter((e) => e.txnStatus === input.status);
    }
    if (input.customerId) {
      estimates = estimates.filter((e) => e.customerId === input.customerId);
    }
    const count = input.count ?? 25;
    return mcpOk({ estimates: estimates.slice(0, count) });
  }

  async getEstimate(input: GetEstimateInput): Promise<McpResult<GetEstimateOutput>> {
    const estimate = FIXTURE_ESTIMATES.find((e) => e.id === input.estimateId);
    if (!estimate) return mcpError('NOT_FOUND', `No estimate ${input.estimateId}`);
    return mcpOk({ estimate });
  }
}
