/**
 * lib/skills/invoice-chase-general/quickbooks-ar-fetcher.ts
 *
 * Production `ArAgingFetcher` backed by the QuickBooks MCP. Lists open
 * invoices via `listInvoices`, cross-references customer emails via
 * `listCustomers`, and returns only invoices with a non-zero balance
 * that are past their due date as of `asOf`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the ONLY file in the
 * invoice-chase-general skill that touches QuickBooks. The skill itself
 * speaks `ArAgingFetcher` only.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We list invoices
 * + customers; we never call `createInvoice` or `recordPayment`.
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing cached on the
 * instance — every fetch re-resolves credentials through the MCP.
 *
 * Honesty seam: when QuickBooks isn't connected, we return NOT_CONFIGURED
 * with a calm "connect QuickBooks" message (same pattern as the real-
 * estate invoice-chasing skill's QuickBooksInvoiceFetcher).
 */

import { buildQuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import type {
  CustomerSummary,
  InvoiceSummary,
  QuickbooksMcpServer,
} from '@/lib/integrations/quickbooks-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import { chaseEscalationTier } from './types';
import type { ArAgingFetcher, ArInvoiceRecord } from './types';

export const QUICKBOOKS_NOT_CONNECTED_MESSAGE =
  'QuickBooks is not yet connected for this workspace. Connect it from /integrations and Plaino will start chasing overdue invoices on the next daily run.';

const DEFAULT_INVOICE_COUNT = 100;
const DEFAULT_CUSTOMER_COUNT = 100;

export interface QuickBooksArFetcherOptions {
  /** Override the MCP server — tests pass a TestQuickbooksMcpServer. */
  mcp?: QuickbooksMcpServer;
  invoiceCount?: number;
  customerCount?: number;
}

export class QuickBooksArFetcher implements ArAgingFetcher {
  readonly name = 'quickbooks-ar' as const;
  private readonly workspaceId: string;
  private readonly opts: Required<
    Pick<QuickBooksArFetcherOptions, 'invoiceCount' | 'customerCount'>
  > & { mcp?: QuickbooksMcpServer };

  constructor(
    args: { workspaceId: string } & QuickBooksArFetcherOptions,
  ) {
    if (!args.workspaceId) {
      throw new Error('QuickBooksArFetcher: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.opts = {
      mcp: args.mcp,
      invoiceCount: args.invoiceCount ?? DEFAULT_INVOICE_COUNT,
      customerCount: args.customerCount ?? DEFAULT_CUSTOMER_COUNT,
    };
  }

  private mcp(): QuickbooksMcpServer {
    return (
      this.opts.mcp ??
      buildQuickbooksMcpServer({ workspaceId: this.workspaceId })
    );
  }

  async fetchOverdueInvoices(args: {
    workspaceId: string;
    asOf: Date;
    count?: number;
  }): Promise<SkillResult<ArInvoiceRecord[]>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `QuickBooksArFetcher bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    const invoiceCount = args.count ?? this.opts.invoiceCount;
    const mcp = this.mcp();

    // Parallel fetch: invoices + customers (for email look-up).
    const [invRes, custRes] = await Promise.all([
      mcp.listInvoices({ count: invoiceCount }),
      mcp.listCustomers({ count: this.opts.customerCount }),
    ]);

    if (!invRes.ok) return translateMcpError(invRes.error.code, invRes.error.message);
    if (!custRes.ok) return translateMcpError(custRes.error.code, custRes.error.message);

    // Build a customer email map so each invoice can carry the email.
    const emailByCustomerId = buildEmailMap(custRes.value.customers);

    const overdue: ArInvoiceRecord[] = [];
    for (const inv of invRes.value.invoices) {
      const record = toArRecord(inv, emailByCustomerId, args.asOf);
      if (record !== null) overdue.push(record);
    }

    // Sort oldest overdue first — operator sees the most urgent at the top.
    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return skillOk(overdue);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEmailMap(
  customers: CustomerSummary[],
): Map<string, { displayName: string | null; email: string | null }> {
  const m = new Map<
    string,
    { displayName: string | null; email: string | null }
  >();
  for (const c of customers) {
    m.set(c.id, { displayName: c.displayName ?? null, email: c.email ?? null });
  }
  return m;
}

/**
 * Map one QB InvoiceSummary → ArInvoiceRecord, or null when:
 *   - The invoice lacks id / customerId / dueDate (can't process).
 *   - Balance is zero or negative (already paid).
 *   - Due date is in the future relative to `asOf` (not yet overdue).
 */
function toArRecord(
  inv: InvoiceSummary,
  emailMap: Map<string, { displayName: string | null; email: string | null }>,
  asOf: Date,
): ArInvoiceRecord | null {
  if (!inv.id || !inv.customerId || !inv.dueDate) return null;
  const balance = inv.balance ?? 0;
  if (balance <= 0) return null; // paid / overpaid
  const due = new Date(inv.dueDate + 'T00:00:00Z');
  if (Number.isNaN(due.getTime())) return null;
  if (due.getTime() > asOf.getTime()) return null; // not yet overdue

  const MS_PER_DAY = 86_400_000;
  const daysOverdue = Math.max(
    0,
    Math.floor((asOf.getTime() - due.getTime()) / MS_PER_DAY),
  );
  const customer = emailMap.get(inv.customerId) ?? {
    displayName: inv.customerName ?? null,
    email: null,
  };

  return {
    invoiceId: inv.id,
    docNumber: inv.docNumber ?? null,
    customerId: inv.customerId,
    customerName: customer.displayName ?? inv.customerName ?? null,
    customerEmail: customer.email,
    totalAmountUsd: inv.totalAmount ?? 0,
    balanceUsd: balance,
    txnDate: inv.txnDate ?? '',
    dueDate: inv.dueDate,
    daysOverdue,
    tier: chaseEscalationTier(daysOverdue),
  };
}

/** Auth-class errors surface as NOT_CONFIGURED (calm prompt); others as
 *  UPSTREAM_GMAIL_ERROR (ops-facing). Same mapping as QuickBooksInvoiceFetcher
 *  in invoice-chasing-realestate. */
function translateMcpError(code: string, message: string): SkillResult<never> {
  if (
    code === 'CREDENTIAL_NOT_FOUND' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'GRANT_REVOKED' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN'
  ) {
    return skillError('NOT_CONFIGURED', QUICKBOOKS_NOT_CONNECTED_MESSAGE, code);
  }
  return skillError('UPSTREAM_GMAIL_ERROR', `QuickBooks AR: ${message}`, code);
}
