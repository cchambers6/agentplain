/**
 * lib/integrations/quickbooks-mcp/tools.ts
 *
 * The QuickBooks tool registry — zod arg schemas + descriptions + wiring to the
 * `QuickbooksMcpServer` interface. Shared by the HTTP route and the smoke test
 * via `lib/integrations/mcp-core/dispatch.ts`.
 *
 * `record_payment` carries a required `approvalToken` and a description that
 * states the approval gate: agentplain never moves money without a human
 * approval step (see project_no_outbound_architecture.md + server.ts).
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { QUICKBOOKS_NAMESPACE, type QboEstimateStatus, type QuickbooksMcpServer } from './types';

const QBO_ESTIMATE_STATUSES: [QboEstimateStatus, ...QboEstimateStatus[]] = [
  'Pending',
  'Accepted',
  'Rejected',
  'Closed',
];

const listInvoicesSchema = z.object({
  customerId: z.string().optional(),
  count: z.number().int().positive().max(100).optional(),
});

const invoiceIdSchema = z.object({ invoiceId: z.string().min(1) });

const invoiceLineSchema = z.object({
  amount: z.number(),
  description: z.string().optional(),
});
const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  lines: z.array(invoiceLineSchema).min(1),
  itemId: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const listCustomersSchema = z.object({
  count: z.number().int().positive().max(100).optional(),
});

const recordPaymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive(),
  approvalToken: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

// ── Write-action-depth schemas (all approval-gated) ────────────────────────

const sendInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  recipientEmail: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const createCustomerSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  pendingApprovalId: z.string().optional(),
});

const profitAndLossSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const listExpensesSchema = z.object({
  count: z.number().int().positive().max(100).optional(),
});

const listEstimatesSchema = z.object({
  status: z.enum(QBO_ESTIMATE_STATUSES).optional(),
  customerId: z.string().optional(),
  count: z.number().int().positive().max(100).optional(),
});

const estimateIdSchema = z.object({ estimateId: z.string().min(1) });

export const QUICKBOOKS_TOOLS: ReadonlyArray<ToolRegistration<QuickbooksMcpServer>> = [
  {
    name: `${QUICKBOOKS_NAMESPACE}.list_invoices`,
    description: 'List invoices, optionally filtered by customerId. count is 1..100 (default 25).',
    schema: listInvoicesSchema,
    invoke: (s, a) => s.listInvoices(listInvoicesSchema.parse(a)),
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.get_invoice`,
    description: 'Get a single invoice by its QuickBooks id.',
    schema: invoiceIdSchema,
    invoke: (s, a) => s.getInvoice(invoiceIdSchema.parse(a)),
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.create_invoice`,
    description:
      'Draft an invoice for a customer (customerId) with one or more line items [{amount, description?}], optional itemId. Drafting does not move money, so no approval is required.',
    schema: createInvoiceSchema,
    invoke: (s, a) => s.createInvoice(createInvoiceSchema.parse(a)),
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.list_customers`,
    description: 'List customers. count is 1..100 (default 25).',
    schema: listCustomersSchema,
    invoke: (s, a) => s.listCustomers(listCustomersSchema.parse(a)),
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.record_payment`,
    description:
      'Record a customer payment (MOVES MONEY). GATED: requires a non-empty approvalToken from the human approval queue. Without it the call returns APPROVAL_REQUIRED and does nothing. agentplain never auto-executes financial transactions.',
    schema: recordPaymentSchema,
    invoke: (s, a) => {
      const parsed = recordPaymentSchema.parse(a);
      return s.recordPayment({
        customerId: parsed.customerId,
        amount: parsed.amount,
        approvalToken: parsed.approvalToken ?? '',
        pendingApprovalId: parsed.pendingApprovalId,
      });
    },
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.get_profit_and_loss`,
    description: 'Pull a ProfitAndLoss report between startDate and endDate (ISO YYYY-MM-DD). Defaults to the last 90 days.',
    schema: profitAndLossSchema,
    invoke: (s, a) => s.getProfitAndLoss(profitAndLossSchema.parse(a)),
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.list_expenses`,
    description: 'List recorded expenses (Purchase entities). count is 1..100 (default 25).',
    schema: listExpensesSchema,
    invoke: (s, a) => s.listExpenses(listExpensesSchema.parse(a)),
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.list_estimates`,
    description:
      'List Estimate objects (quotes/proposals). Pass status="Pending" to return only open estimates awaiting customer acceptance. Optionally filter by customerId. count is 1..100 (default 25). Read-only — no money moves.',
    schema: listEstimatesSchema,
    invoke: (s, a) => s.listEstimates(listEstimatesSchema.parse(a)),
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.get_estimate`,
    description: 'Get a single Estimate by its QuickBooks entity id. Read-only — no money moves.',
    schema: estimateIdSchema,
    invoke: (s, a) => s.getEstimate(estimateIdSchema.parse(a)),
  },
  // ── Write-action-depth tools (approval-gated mutations) ──────────────────
  {
    name: `${QUICKBOOKS_NAMESPACE}.send_invoice`,
    description:
      'Email an existing invoice to the customer (invoiceId; optional recipientEmail override). OUTBOUND — approval-gated.',
    schema: sendInvoiceSchema,
    invoke: (s, a) => s.sendInvoice(sendInvoiceSchema.parse(a)),
  },
  {
    name: `${QUICKBOOKS_NAMESPACE}.create_customer`,
    description:
      'Create a new customer (displayName required; email/phone/companyName optional). Approval-gated.',
    schema: createCustomerSchema,
    invoke: (s, a) => s.createCustomer(createCustomerSchema.parse(a)),
  },
];
