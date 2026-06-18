/**
 * lib/integrations/quickbooks-mcp/types.ts
 *
 * QuickBooks Online MCP server tool surface. One instance per `{workspaceId}`
 * per request (never reused across workspaces). Built on
 * `lib/integrations/mcp-core` — the vendor-neutral JSON-RPC envelope + result
 * shapes — so the wire format matches the shipped Gmail/Outlook/DocuSign
 * servers.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: the bar is a real
 * read+act surface — list/read invoices, list customers, draft an invoice,
 * pull a P&L, list expenses — not just OAuth plumbing.
 *
 * Per `project_no_outbound_architecture.md` + the platform prohibited-actions
 * rule: agentplain NEVER auto-executes financial transactions.
 * `recordPayment` (moving money) is GATED behind a human `approvalToken` and
 * must NOT fire without one. Drafting an invoice (`createInvoice`) is fine —
 * it does not move money — and is NOT gated.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type QuickbooksMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface InvoiceSummary {
  id: string;
  docNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  totalAmount: number | null;
  balance: number | null;
  txnDate: string | null;
  dueDate: string | null;
}

export interface ListInvoicesInput {
  /** Optional CustomerRef filter. */
  customerId?: string;
  /** 1..100, default 25. */
  count?: number;
}

export interface ListInvoicesOutput {
  invoices: InvoiceSummary[];
}

export interface GetInvoiceInput {
  invoiceId: string;
}

export interface GetInvoiceOutput {
  invoice: InvoiceSummary;
}

/** One line on a drafted invoice. Mapped to a SalesItemLineDetail. */
export interface InvoiceLineInput {
  amount: number;
  description?: string;
}

export interface CreateInvoiceInput {
  /** CustomerRef value (the customer's QuickBooks id). */
  customerId: string;
  lines: InvoiceLineInput[];
  /** Optional ItemRef value applied to each SalesItemLineDetail. */
  itemId?: string;
  /** Approval token once the operator has approved this exact invoice draft. */
  pendingApprovalId?: string;
}

export interface CreateInvoiceOutput {
  invoice: InvoiceSummary;
}

export interface CustomerSummary {
  id: string;
  displayName: string | null;
  email: string | null;
  balance: number | null;
  active: boolean | null;
}

export interface ListCustomersInput {
  /** 1..100, default 25. */
  count?: number;
}

export interface ListCustomersOutput {
  customers: CustomerSummary[];
}

export interface RecordPaymentInput {
  /** CustomerRef value the payment is applied to. */
  customerId: string;
  amount: number;
  /** Human-approval token from the approval queue. REQUIRED — moving money. */
  approvalToken: string;
  /** Shared-gate approval token once the operator has approved this exact payment. */
  pendingApprovalId?: string;
}

export interface RecordPaymentOutput {
  paymentId: string;
  totalAmount: number | null;
  customerId: string | null;
}

export interface GetProfitAndLossInput {
  /** ISO date (YYYY-MM-DD). Defaults to 90 days ago. */
  startDate?: string;
  /** ISO date (YYYY-MM-DD). Defaults to today. */
  endDate?: string;
}

export interface GetProfitAndLossOutput {
  startDate: string;
  endDate: string;
  /** Raw report header currency, e.g. USD. */
  currency: string | null;
  /** Flattened (label, amount) rows from the report. */
  rows: Array<{ label: string; amount: number | null }>;
}

export interface ExpenseSummary {
  id: string;
  paymentType: string | null;
  accountName: string | null;
  totalAmount: number | null;
  txnDate: string | null;
}

export interface ListExpensesInput {
  /** 1..100, default 25. */
  count?: number;
}

export interface ListExpensesOutput {
  expenses: ExpenseSummary[];
}

// ── Estimate DTOs ─────────────────────────────────────────────────────────
//
// QuickBooks Online Estimate objects represent quotes/proposals sent to a
// customer before work is performed. The QBO API exposes Estimate as a
// first-class transaction type on the same OAuth connection as invoices.
//
// TxnStatus values from QBO:
//   Accepted  — customer signed/accepted
//   Rejected  — customer declined
//   Closed    — operator manually closed (converted to invoice or voided)
//   Pending   — sent but awaiting customer action  ← the "open" state
//   (blank)   — draft not yet sent
//
// The follow-up skill cares only about the Pending + unsent states — those
// are money on the table that needs a nudge.

export type QboEstimateStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Closed';

export interface EstimateSummary {
  /** QuickBooks Estimate entity id. */
  id: string;
  /** Human-visible estimate number (DocNumber). */
  docNumber: string | null;
  /** Customer ref id. */
  customerId: string | null;
  /** Customer display name. */
  customerName: string | null;
  /** Customer primary email — sourced from the CustomerRef.name field or
   *  the related Customer object. May be null if the customer has no
   *  email on file. */
  customerEmail: string | null;
  /** Total estimate amount in the workspace currency (USD for US companies). */
  totalAmount: number | null;
  /** Transaction date (ISO date string YYYY-MM-DD). */
  txnDate: string | null;
  /** Expiry date (ISO date string YYYY-MM-DD). Null when not set. */
  expiryDate: string | null;
  /** QBO TxnStatus value. */
  txnStatus: QboEstimateStatus | null;
  /** Customer-facing memo / description on the estimate. */
  customerMemo: string | null;
}

export interface ListEstimatesInput {
  /** Filter by QBO TxnStatus. Omit to return all statuses. */
  status?: QboEstimateStatus;
  /** Optional CustomerRef filter. */
  customerId?: string;
  /** 1..100, default 25. */
  count?: number;
}

export interface ListEstimatesOutput {
  estimates: EstimateSummary[];
}

export interface GetEstimateInput {
  estimateId: string;
}

export interface GetEstimateOutput {
  estimate: EstimateSummary;
}

// New write-action I/O types live in ./actions (the gate-facing source of
// truth); imported here so the server interface can reference them.
import type {
  SendInvoiceInput,
  SendInvoiceOutput,
  CreateCustomerInput,
  CreateCustomerOutput,
} from './actions';

// ── Interface every implementation honors ──────────────────────────────────

export interface QuickbooksMcpServer extends McpServerBase {
  listInvoices(input: ListInvoicesInput): Promise<QuickbooksMcpResult<ListInvoicesOutput>>;
  getInvoice(input: GetInvoiceInput): Promise<QuickbooksMcpResult<GetInvoiceOutput>>;
  createInvoice(input: CreateInvoiceInput): Promise<QuickbooksMcpResult<CreateInvoiceOutput>>;
  listCustomers(input: ListCustomersInput): Promise<QuickbooksMcpResult<ListCustomersOutput>>;
  recordPayment(input: RecordPaymentInput): Promise<QuickbooksMcpResult<RecordPaymentOutput>>;
  getProfitAndLoss(input: GetProfitAndLossInput): Promise<QuickbooksMcpResult<GetProfitAndLossOutput>>;
  listExpenses(input: ListExpensesInput): Promise<QuickbooksMcpResult<ListExpensesOutput>>;
  /** List Estimate objects. Pass `status: 'Pending'` to get only open
   *  estimates that need a follow-up nudge. */
  listEstimates(input: ListEstimatesInput): Promise<QuickbooksMcpResult<ListEstimatesOutput>>;
  /** Fetch a single Estimate by its QBO entity id. */
  getEstimate(input: GetEstimateInput): Promise<QuickbooksMcpResult<GetEstimateOutput>>;

  // ── Write-action-depth mutations (all approval-gated at the factory) ──
  /** Email an existing invoice to the customer (OUTBOUND). Approval-gated. */
  sendInvoice(input: SendInvoiceInput): Promise<QuickbooksMcpResult<SendInvoiceOutput>>;
  /** Create a new customer in the books. Approval-gated. */
  createCustomer(input: CreateCustomerInput): Promise<QuickbooksMcpResult<CreateCustomerOutput>>;
}

export const QUICKBOOKS_NAMESPACE = 'quickbooks';
