/**
 * lib/integrations/quickbooks-mcp/server.ts
 *
 * Production QuickBooks Online MCP server. Wraps the Accounting API v3 behind
 * the `QuickbooksMcpServer` interface. One instance per `{workspaceId}` per
 * request. This file is the ONLY place that calls the QuickBooks REST API;
 * route handlers + skills speak the MCP interface (per
 * `feedback_no_silent_vendor_lock.md`). Plain `fetch`, no SDK.
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveQuickbooksCredential`; no token is cached on the instance.
 *
 * API base is chosen from the credential's environment:
 *   sandbox    = https://sandbox-quickbooks.api.intuit.com
 *   production = https://quickbooks.api.intuit.com
 * NOTE: sandbox vs production realm IDs differ — a sandbox realmId 401s against
 * the production base and vice versa. The environment recorded at connect time
 * (providerMetadata.environment) is authoritative; see auth.ts.
 *
 * APPROVAL GATE (load-bearing): `recordPayment` moves money and must NOT fire
 * without a non-empty `approvalToken` supplied by a human approval step. The
 * gate returns `APPROVAL_REQUIRED` before any network call.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { quickbooksApiBase } from '@/lib/integrations/quickbooks/oauth';
import { resolveQuickbooksCredential, type ResolvedQuickbooks } from './auth';
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

const DEFAULT_COUNT = 25;
const MAX_COUNT = 100;

export class ProdQuickbooksMcpServer implements QuickbooksMcpServer {
  readonly name = 'quickbooks-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdQuickbooksMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listInvoices(input: ListInvoicesInput): Promise<McpResult<ListInvoicesOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    let where = '';
    if (input.customerId) {
      where = ` where CustomerRef = '${escapeSql(input.customerId)}'`;
    }
    const query = `select * from Invoice${where} maxresults ${count.value}`;
    return this.withApi(async (ctx) => {
      const res = await ctx.query<{ Invoice?: RawInvoice[] }>(query);
      if (!res.ok) return res;
      return mcpOk({ invoices: (res.value.QueryResponse?.Invoice ?? []).map(toInvoiceSummary) });
    });
  }

  async getInvoice(input: GetInvoiceInput): Promise<McpResult<GetInvoiceOutput>> {
    if (!input.invoiceId) return mcpError('INVALID_ARGUMENT', 'getInvoice requires invoiceId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<{ Invoice?: RawInvoice }>('GET', `/invoice/${encodeURIComponent(input.invoiceId)}`);
      if (!res.ok) return res;
      if (!res.value.Invoice) return mcpError('NOT_FOUND', `No invoice ${input.invoiceId}`);
      return mcpOk({ invoice: toInvoiceSummary(res.value.Invoice) });
    });
  }

  async createInvoice(input: CreateInvoiceInput): Promise<McpResult<CreateInvoiceOutput>> {
    // Drafting an invoice does NOT move money, so no approval gate (per
    // project_no_outbound_architecture.md the gate is only for transactions).
    if (!input.customerId) return mcpError('INVALID_ARGUMENT', 'createInvoice requires customerId');
    if (!input.lines || input.lines.length === 0) {
      return mcpError('INVALID_ARGUMENT', 'createInvoice requires at least one line');
    }
    const body: Record<string, unknown> = {
      CustomerRef: { value: input.customerId },
      Line: input.lines.map((l) => {
        const detail: Record<string, unknown> = {};
        if (input.itemId) detail.ItemRef = { value: input.itemId };
        return {
          Amount: l.amount,
          DetailType: 'SalesItemLineDetail',
          ...(l.description ? { Description: l.description } : {}),
          SalesItemLineDetail: detail,
        };
      }),
    };
    return this.withApi(async (ctx) => {
      const res = await ctx.api<{ Invoice?: RawInvoice }>('POST', '/invoice', body);
      if (!res.ok) return res;
      if (!res.value.Invoice) return mcpError('MALFORMED_RESPONSE', 'invoice.create returned no Invoice');
      return mcpOk({ invoice: toInvoiceSummary(res.value.Invoice) });
    });
  }

  async listCustomers(input: ListCustomersInput): Promise<McpResult<ListCustomersOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const query = `select * from Customer maxresults ${count.value}`;
    return this.withApi(async (ctx) => {
      const res = await ctx.query<{ Customer?: RawCustomer[] }>(query);
      if (!res.ok) return res;
      return mcpOk({ customers: (res.value.QueryResponse?.Customer ?? []).map(toCustomerSummary) });
    });
  }

  async recordPayment(input: RecordPaymentInput): Promise<McpResult<RecordPaymentOutput>> {
    // APPROVAL GATE — moving money. agentplain never auto-executes financial
    // transactions; the approvalToken is only ever supplied by a human approval
    // step. Refuse before any network call.
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
    const body = {
      CustomerRef: { value: input.customerId },
      TotalAmt: input.amount,
    };
    return this.withApi(async (ctx) => {
      const res = await ctx.api<{ Payment?: RawPayment }>('POST', '/payment', body);
      if (!res.ok) return res;
      if (!res.value.Payment?.Id) return mcpError('MALFORMED_RESPONSE', 'payment.create returned no Payment id');
      return mcpOk({
        paymentId: res.value.Payment.Id,
        totalAmount: numOrNull(res.value.Payment.TotalAmt),
        customerId: res.value.Payment.CustomerRef?.value ?? null,
      });
    });
  }

  async getProfitAndLoss(input: GetProfitAndLossInput): Promise<McpResult<GetProfitAndLossOutput>> {
    const endDate = input.endDate ?? isoDate(new Date());
    const startDate = input.startDate ?? isoDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    return this.withApi(async (ctx) => {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await ctx.api<RawReport>('GET', `/reports/ProfitAndLoss?${params.toString()}`);
      if (!res.ok) return res;
      return mcpOk({
        startDate,
        endDate,
        currency: res.value.Header?.Currency ?? null,
        rows: flattenReportRows(res.value.Rows),
      });
    });
  }

  async listExpenses(input: ListExpensesInput): Promise<McpResult<ListExpensesOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const query = `select * from Purchase maxresults ${count.value}`;
    return this.withApi(async (ctx) => {
      const res = await ctx.query<{ Purchase?: RawPurchase[] }>(query);
      if (!res.ok) return res;
      return mcpOk({ expenses: (res.value.QueryResponse?.Purchase ?? []).map(toExpenseSummary) });
    });
  }

  // ── internals ─────────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (ctx: { api: ApiFn; query: QueryFn }) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveQuickbooksCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

// ── REST helpers ───────────────────────────────────────────────────────────

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;
type QueryFn = <T>(query: string) => Promise<McpResult<{ QueryResponse?: T }>>;

function makeApiContext(resolved: ResolvedQuickbooks): { api: ApiFn; query: QueryFn } {
  const apiBase = quickbooksApiBase(resolved.environment);
  const base = `${apiBase}/v3/company/${resolved.realmId}`;
  const authHeader = `Bearer ${resolved.credential.accessToken}`;

  const api: ApiFn = async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError('NETWORK', `QuickBooks network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `QuickBooks JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };

  const query: QueryFn = async <T>(sql: string) => {
    const params = new URLSearchParams({ query: sql });
    return api<{ QueryResponse?: T }>('GET', `/query?${params.toString()}`);
  };

  return { api, query };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as {
      Fault?: { Error?: Array<{ Message?: string; Detail?: string; code?: string }> };
    };
    const first = body.Fault?.Error?.[0];
    if (first) {
      detail = first.Detail ?? first.Message ?? detail;
      reference = first.code;
    }
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('TOKEN_EXPIRED', detail, { status: 401, reference });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403, reference });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404, reference });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429, reference });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawRef {
  value?: string;
  name?: string;
}
interface RawInvoice {
  Id?: string;
  DocNumber?: string;
  CustomerRef?: RawRef;
  TotalAmt?: number;
  Balance?: number;
  TxnDate?: string;
  DueDate?: string;
}
interface RawCustomer {
  Id?: string;
  DisplayName?: string;
  PrimaryEmailAddr?: { Address?: string };
  Balance?: number;
  Active?: boolean;
}
interface RawPayment {
  Id?: string;
  TotalAmt?: number;
  CustomerRef?: RawRef;
}
interface RawPurchase {
  Id?: string;
  PaymentType?: string;
  AccountRef?: RawRef;
  TotalAmt?: number;
  TxnDate?: string;
}
interface RawReportRow {
  Header?: { ColData?: Array<{ value?: string }> };
  Summary?: { ColData?: Array<{ value?: string }> };
  ColData?: Array<{ value?: string }>;
  Rows?: { Row?: RawReportRow[] };
  type?: string;
}
interface RawReport {
  Header?: { Currency?: string };
  Rows?: { Row?: RawReportRow[] };
}

function numOrNull(v: number | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function toInvoiceSummary(i: RawInvoice): InvoiceSummary {
  return {
    id: i.Id ?? '',
    docNumber: i.DocNumber ?? null,
    customerId: i.CustomerRef?.value ?? null,
    customerName: i.CustomerRef?.name ?? null,
    totalAmount: numOrNull(i.TotalAmt),
    balance: numOrNull(i.Balance),
    txnDate: i.TxnDate ?? null,
    dueDate: i.DueDate ?? null,
  };
}

function toCustomerSummary(c: RawCustomer): CustomerSummary {
  return {
    id: c.Id ?? '',
    displayName: c.DisplayName ?? null,
    email: c.PrimaryEmailAddr?.Address ?? null,
    balance: numOrNull(c.Balance),
    active: typeof c.Active === 'boolean' ? c.Active : null,
  };
}

function toExpenseSummary(p: RawPurchase): ExpenseSummary {
  return {
    id: p.Id ?? '',
    paymentType: p.PaymentType ?? null,
    accountName: p.AccountRef?.name ?? null,
    totalAmount: numOrNull(p.TotalAmt),
    txnDate: p.TxnDate ?? null,
  };
}

/** Flatten the nested ProfitAndLoss report into (label, amount) leaf rows. */
function flattenReportRows(rows: RawReport['Rows']): Array<{ label: string; amount: number | null }> {
  const out: Array<{ label: string; amount: number | null }> = [];
  const walk = (list: RawReportRow[] | undefined): void => {
    for (const row of list ?? []) {
      const cols = row.ColData ?? row.Summary?.ColData ?? row.Header?.ColData;
      if (cols && cols.length > 0) {
        const label = cols[0]?.value ?? '';
        const last = cols[cols.length - 1]?.value;
        const amount = last !== undefined && last !== '' && !Number.isNaN(Number(last)) ? Number(last) : null;
        if (label) out.push({ label, amount });
      }
      if (row.Rows?.Row) walk(row.Rows.Row);
    }
  };
  walk(rows?.Row);
  return out;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Escape single quotes for QuickBooks query string literals. */
function escapeSql(value: string): string {
  return value.replace(/'/g, "\\'");
}

function clampCount(value: number | undefined): McpResult<number> {
  if (value === undefined) return mcpOk(DEFAULT_COUNT);
  if (!Number.isInteger(value) || value <= 0) return mcpError('INVALID_ARGUMENT', `count must be a positive integer, got ${value}`);
  if (value > MAX_COUNT) return mcpError('INVALID_ARGUMENT', `count must be <= ${MAX_COUNT}, got ${value}`);
  return mcpOk(value);
}
