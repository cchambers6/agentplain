/**
 * lib/integrations/quickbooks-mcp/actions/index.ts
 *
 * The QuickBooks WRITE-ACTION surface — the per-action source of truth for the
 * mutating tools gated through the shared connector approval gate
 * (`lib/integrations/approval`). Each descriptor names the action, its approval
 * discipline (`finance` for QuickBooks money/customer writes), and a
 * `summarize` that distills the input into the canonical, secret-free `detail`
 * the gate fingerprints AND the operator sees on the /approvals card.
 *
 * The actual REST lives on `ProdQuickbooksMcpServer` (server.ts); the gate
 * decorator (with-approval.ts) reads these descriptors so the action name +
 * detail used for the fingerprint and the audit row are defined in exactly one
 * place. Nothing here calls QuickBooks — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: `send_invoice` is genuinely
 * OUTBOUND (it emails an invoice to a customer), so the gate is load-bearing —
 * it never fires without a recorded human approval. `create_customer`,
 * `create_invoice`, and `record_payment` mutate the customer's books and are
 * likewise gated.
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const QUICKBOOKS_CONNECTOR = 'quickbooks';

// ── New write-action I/O types ───────────────────────────────────────────────

export interface SendInvoiceInput {
  /** QuickBooks Invoice entity id to email. */
  invoiceId: string;
  /** Optional override recipient; QBO uses the invoice BillEmail when omitted. */
  recipientEmail?: string;
  /** Approval token once the operator has approved this exact send. */
  pendingApprovalId?: string;
}
export interface SendInvoiceOutput {
  invoiceId: string;
  status: 'sent';
}

export interface CreateCustomerInput {
  displayName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  pendingApprovalId?: string;
}
export interface CreateCustomerOutput {
  customerId: string;
}

// ── Gate-facing descriptors ───────────────────────────────────────────────────

/**
 * A write-action descriptor. `summarize` builds the canonical, secret-free
 * `detail` used for BOTH the fingerprint and the operator's approval card.
 */
export interface WriteActionDescriptor<TInput> {
  action: string;
  discipline: string;
  summarize: (input: TInput) => Record<string, unknown>;
}

/** Build the `GatedAction` a decorator method passes to the gate. */
export function quickbooksAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: QUICKBOOKS_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const SEND_INVOICE: WriteActionDescriptor<SendInvoiceInput> = {
  action: 'send_invoice',
  discipline: 'finance',
  summarize: (i) => ({
    invoiceId: i.invoiceId,
    recipientEmail: i.recipientEmail ?? null,
  }),
};

export const CREATE_CUSTOMER: WriteActionDescriptor<CreateCustomerInput> = {
  action: 'create_customer',
  discipline: 'finance',
  summarize: (i) => ({
    displayName: i.displayName,
    email: i.email ?? null,
    phone: i.phone ?? null,
    companyName: i.companyName ?? null,
  }),
};
