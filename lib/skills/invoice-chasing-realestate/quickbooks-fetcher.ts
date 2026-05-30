/**
 * lib/skills/invoice-chasing-realestate/quickbooks-fetcher.ts
 *
 * Third implementation of `InvoiceFetcher` — the production wiring that
 * speaks to QuickBooks Online via the workspace-scoped QuickBooks MCP
 * (`lib/integrations/quickbooks-mcp`). The skill code does not change
 * — per `feedback_runner_portability.md`'s two-implementation rule the
 * port is real, so adding a third impl is purely additive.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the ONLY place
 * the invoice-chasing skill touches QuickBooks. The skill itself sees
 * `InvoiceFetcher` only.
 *
 * Per `project_no_outbound_architecture.md`: read-only. We list invoices
 * + customers; we never call `createInvoice` or `recordPayment` from this
 * adapter.
 *
 * Honesty seam — when QuickBooks isn't connected, the adapter returns a
 * NOT_CONFIGURED skill error with a calm "QuickBooks not yet connected"
 * message rather than throwing. The runner surfaces that as a degraded-
 * mode notice; nothing in the approval queue gets faked.
 *
 * Per `feedback_cold_start_safe_agents.md`: nothing is cached on the
 * instance — every fetch goes back through the MCP, which re-resolves
 * credentials per call.
 */

import { buildQuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import type { QuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ContactRecord,
  InvoiceFetcher,
  InvoiceRecord,
} from './types';

/** Honest message when QuickBooks isn't connected yet for this workspace.
 *  Surfaces verbatim into the skill error so the operator notice on the
 *  /approvals page reads as a calm "connect QuickBooks" prompt, not a
 *  scary upstream error. */
export const QUICKBOOKS_NOT_CONNECTED_MESSAGE =
  'QuickBooks is not yet connected for this workspace. Connect it from /integrations and Plaino will pick up unpaid commission invoices on the next fire.';

export interface QuickBooksInvoiceFetcherOptions {
  /** Override the MCP server — tests pass a TestQuickbooksMcpServer.
   *  Production omits this and the adapter builds the prod server. */
  mcp?: QuickbooksMcpServer;
  /** Cap on invoices pulled per fire. Defaults to 100 (the MCP's max). */
  invoiceCount?: number;
  /** Cap on customers pulled per fire. Defaults to 100. */
  customerCount?: number;
}

const DEFAULT_INVOICE_COUNT = 100;
const DEFAULT_CUSTOMER_COUNT = 100;

export class QuickBooksInvoiceFetcher implements InvoiceFetcher {
  readonly name = 'quickbooks' as const;
  private readonly workspaceId: string;
  private readonly opts: Required<
    Pick<QuickBooksInvoiceFetcherOptions, 'invoiceCount' | 'customerCount'>
  > & { mcp?: QuickbooksMcpServer };

  constructor(args: { workspaceId: string } & QuickBooksInvoiceFetcherOptions) {
    if (!args.workspaceId) {
      throw new Error('QuickBooksInvoiceFetcher: workspaceId is required');
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

  async fetchOpenInvoices(args: {
    workspaceId: string;
  }): Promise<SkillResult<InvoiceRecord[]>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `QuickBooksInvoiceFetcher bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    const res = await this.mcp().listInvoices({ count: this.opts.invoiceCount });
    if (!res.ok) return translateMcpError(res.error.code, res.error.message);
    const records: InvoiceRecord[] = [];
    for (const inv of res.value.invoices) {
      const mapped = toInvoiceRecord(inv);
      if (mapped) records.push(mapped);
    }
    return skillOk(records);
  }

  async fetchContactsByIds(args: {
    workspaceId: string;
    contactIds: string[];
  }): Promise<SkillResult<Record<string, ContactRecord>>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `QuickBooksInvoiceFetcher bound to ${this.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    if (args.contactIds.length === 0) return skillOk({});
    const res = await this.mcp().listCustomers({ count: this.opts.customerCount });
    if (!res.ok) return translateMcpError(res.error.code, res.error.message);
    const wanted = new Set(args.contactIds);
    const out: Record<string, ContactRecord> = {};
    for (const c of res.value.customers) {
      if (!wanted.has(c.id)) continue;
      const mapped = toContactRecord(c);
      if (mapped) out[c.id] = mapped;
    }
    return skillOk(out);
  }
}

/** Translate the QuickBooks MCP error code into a skill error. The
 *  AUTH-class codes surface as NOT_CONFIGURED with the honesty message
 *  so the operator notice on /approvals reads cleanly; everything else
 *  surfaces as UPSTREAM_GMAIL_ERROR (the existing port-level error code
 *  the skill speaks — it covers ANY upstream fetch failure, not just
 *  Gmail; renaming the code is a follow-up). */
function translateMcpError(
  code: string,
  message: string,
): SkillResult<never> {
  // Codes that mean "QuickBooks is not yet usable for this workspace" —
  // surface the calm honesty notice; everything else surfaces the raw
  // upstream message for ops triage.
  if (
    code === 'CREDENTIAL_NOT_FOUND' ||
    code === 'TOKEN_EXPIRED' ||
    code === 'GRANT_REVOKED' ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN'
  ) {
    return skillError('NOT_CONFIGURED', QUICKBOOKS_NOT_CONNECTED_MESSAGE, code);
  }
  return skillError(
    'UPSTREAM_GMAIL_ERROR',
    `QuickBooks: ${message}`,
    code,
  );
}

/** Map one QuickBooks `InvoiceSummary` to the skill's `InvoiceRecord`.
 *  Returns null when the row lacks load-bearing fields (no id, no
 *  customer ref, missing dates) so the skill never sees a half-built
 *  record. */
function toInvoiceRecord(
  inv: import('@/lib/integrations/quickbooks-mcp').InvoiceSummary,
): InvoiceRecord | null {
  if (!inv.id || !inv.customerId || !inv.txnDate || !inv.dueDate) return null;
  const totalDollars = inv.totalAmount ?? 0;
  const balanceDollars = inv.balance ?? 0;
  return {
    id: inv.id,
    invoiceNumber: inv.docNumber ?? inv.id,
    contactId: inv.customerId,
    // QuickBooks invoices don't carry a closing-reference field — the
    // skill template falls back to its `{{operator: closing reference}}`
    // merge field when this is empty. Honest: we don't fabricate one.
    closingReference: '',
    amountCents: Math.round(totalDollars * 100),
    currency: 'USD',
    issuedAt: parseDateOrNow(inv.txnDate),
    dueAt: parseDateOrNow(inv.dueDate),
    status: deriveStatus({
      total: totalDollars,
      balance: balanceDollars,
    }),
    lastActivityAt: null,
    // QB has no "negotiated extension" concept — the broker tracks that
    // in their CRM. Null here means the skill bucket-bys cleanly using
    // dueAt only, which is the right default.
    negotiatedExtensionUntil: null,
  };
}

function deriveStatus(args: { total: number; balance: number }): InvoiceRecord['status'] {
  if (args.balance <= 0) return 'paid';
  if (args.balance < args.total) return 'partial';
  return 'open';
}

function parseDateOrNow(raw: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

/** Map one QuickBooks `CustomerSummary` to the skill's `ContactRecord`.
 *  Returns null when the contact lacks an email (the skill can't draft a
 *  reminder without one). QB doesn't carry the title-company /
 *  cooperating-broker / attorney distinction — we default to `client`
 *  so the templates pick a relationship-soft tone. The broker corrects
 *  via Follow Up Boss when that MCP lands. */
function toContactRecord(
  c: import('@/lib/integrations/quickbooks-mcp').CustomerSummary,
): ContactRecord | null {
  if (!c.email || c.email.trim().length === 0) return null;
  return {
    id: c.id,
    name: c.displayName ?? c.email,
    email: c.email,
    kind: 'client',
    phone: null,
  };
}
