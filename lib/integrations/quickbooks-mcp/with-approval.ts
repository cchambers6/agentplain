/**
 * lib/integrations/quickbooks-mcp/with-approval.ts
 *
 * The QuickBooks approval gate — the connector-specific decorator that forces
 * EVERY mutating QuickBooks method through the shared connector approval gate
 * (`lib/integrations/approval`) before the REST API is touched. Mirrors
 * `hubspot-mcp/with-approval.ts`, built on the generic gate so the connectors
 * share one fingerprint/persistence/audit core.
 *
 * Read methods (list/get) pass straight through. Mutations — the two
 * pre-existing money/books writes (`createInvoice` / `recordPayment`) AND the
 * two write-action-depth additions (`sendInvoice` / `createCustomer`) — are
 * intercepted: a missing/invalid/expired grant returns APPROVAL_REQUIRED and
 * the QuickBooks call never happens; a valid grant lets the call run and is
 * audit-logged.
 *
 * Installed at the factory seam (`buildQuickbooksMcpServer`), so an ungated
 * QuickBooks server cannot be obtained. Per `project_no_outbound_architecture.md`,
 * `sendInvoice` is OUTBOUND (it emails a customer), so the gate is load-bearing.
 *
 * NOTE: `gateAndRun` returns `McpResult`, which `QuickbooksMcpResult<T>` aliases
 * exactly — so the gated results are returned directly with no casting.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  gateAndRun,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import type { GatedAction } from '@/lib/integrations/approval';
import type {
  CreateInvoiceInput,
  CreateInvoiceOutput,
  GetEstimateInput,
  GetEstimateOutput,
  GetInvoiceInput,
  GetInvoiceOutput,
  GetProfitAndLossInput,
  GetProfitAndLossOutput,
  ListCustomersInput,
  ListCustomersOutput,
  ListEstimatesInput,
  ListEstimatesOutput,
  ListExpensesInput,
  ListExpensesOutput,
  ListInvoicesInput,
  ListInvoicesOutput,
  QuickbooksMcpResult,
  QuickbooksMcpServer,
  RecordPaymentInput,
  RecordPaymentOutput,
} from './types';
import {
  CREATE_CUSTOMER,
  QUICKBOOKS_CONNECTOR,
  SEND_INVOICE,
  quickbooksAction,
  type CreateCustomerInput,
  type CreateCustomerOutput,
  type SendInvoiceInput,
  type SendInvoiceOutput,
  type WriteActionDescriptor,
} from './actions';

/** Wrap a QuickBooks server so all mutating methods require an approved grant. */
export function withQuickbooksApproval(
  inner: QuickbooksMcpServer,
  deps: ConnectorApprovalDeps,
): QuickbooksMcpServer {
  return new GatedQuickbooksMcpServer(inner, deps);
}

class GatedQuickbooksMcpServer implements QuickbooksMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: QuickbooksMcpServer,
    private readonly deps: ConnectorApprovalDeps,
  ) {
    this.name = inner.name;
    this.workspaceId = inner.workspaceId;
  }

  private gate<T>(action: GatedAction, execute: () => Promise<McpResult<T>>) {
    return gateAndRun({
      gate: this.deps.gate,
      audit: this.deps.audit,
      workspaceId: this.workspaceId,
      action,
      execute,
    });
  }

  // ── Reads: straight pass-through ───────────────────────────────────────

  listInvoices(input: ListInvoicesInput): Promise<QuickbooksMcpResult<ListInvoicesOutput>> {
    return this.inner.listInvoices(input);
  }
  getInvoice(input: GetInvoiceInput): Promise<QuickbooksMcpResult<GetInvoiceOutput>> {
    return this.inner.getInvoice(input);
  }
  listCustomers(input: ListCustomersInput): Promise<QuickbooksMcpResult<ListCustomersOutput>> {
    return this.inner.listCustomers(input);
  }
  getProfitAndLoss(
    input: GetProfitAndLossInput,
  ): Promise<QuickbooksMcpResult<GetProfitAndLossOutput>> {
    return this.inner.getProfitAndLoss(input);
  }
  listExpenses(input: ListExpensesInput): Promise<QuickbooksMcpResult<ListExpensesOutput>> {
    return this.inner.listExpenses(input);
  }
  listEstimates(input: ListEstimatesInput): Promise<QuickbooksMcpResult<ListEstimatesOutput>> {
    return this.inner.listEstimates(input);
  }
  getEstimate(input: GetEstimateInput): Promise<QuickbooksMcpResult<GetEstimateOutput>> {
    return this.inner.getEstimate(input);
  }

  // ── Pre-existing money/books writes: now gated at the shared seam ──────

  createInvoice(input: CreateInvoiceInput): Promise<QuickbooksMcpResult<CreateInvoiceOutput>> {
    const action: GatedAction = {
      connector: QUICKBOOKS_CONNECTOR,
      action: 'create_invoice',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'finance',
      detail: {
        customerId: input.customerId,
        lines: input.lines,
        itemId: input.itemId ?? null,
      },
    };
    return this.gate(action, () => this.inner.createInvoice(input));
  }

  recordPayment(input: RecordPaymentInput): Promise<QuickbooksMcpResult<RecordPaymentOutput>> {
    const action: GatedAction = {
      connector: QUICKBOOKS_CONNECTOR,
      action: 'record_payment',
      pendingApprovalId: input.pendingApprovalId,
      discipline: 'finance',
      detail: { customerId: input.customerId, amount: input.amount },
    };
    return this.gate(action, () => this.inner.recordPayment(input));
  }

  // ── Write-action-depth mutations ───────────────────────────────────────

  sendInvoice(input: SendInvoiceInput): Promise<QuickbooksMcpResult<SendInvoiceOutput>> {
    return this.gate(quickbooksAction(SEND_INVOICE, input), () => this.inner.sendInvoice(input));
  }
  createCustomer(
    input: CreateCustomerInput,
  ): Promise<QuickbooksMcpResult<CreateCustomerOutput>> {
    return this.gate(quickbooksAction(CREATE_CUSTOMER, input), () =>
      this.inner.createCustomer(input),
    );
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
