/**
 * lib/integrations/salesforce-mcp/server.ts
 *
 * Production Salesforce MCP server. Wraps Salesforce's REST API v60.0
 * behind the `SalesforceMcpServer` interface. One instance per
 * `{workspaceId}` per request. This file is the ONLY place that calls
 * the Salesforce REST API; route handlers + skills speak the MCP
 * interface (per `feedback_no_silent_vendor_lock.md`). Plain `fetch`,
 * no SDK.
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveSalesforceCredential`; no token is cached on the instance.
 *
 * API base: `{instanceUrl}/services/data/v60.0/...`
 * Auth: `Authorization: Bearer <accessToken>`.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { SALESFORCE_API_VERSION } from '@/lib/integrations/salesforce/oauth';
import { resolveSalesforceCredential, type ResolvedSalesforce } from './auth';
import type {
  CreateTaskInput,
  CreateTaskOutput,
  GetAccountInput,
  GetAccountOutput,
  GetLeadInput,
  GetLeadOutput,
  GetOpportunityInput,
  GetOpportunityOutput,
  ListAccountsInput,
  ListAccountsOutput,
  ListContactsInput,
  ListContactsOutput,
  ListLeadsInput,
  ListLeadsOutput,
  ListOpportunitiesInput,
  ListOpportunitiesOutput,
  SalesforceAccountSummary,
  SalesforceContactSummary,
  SalesforceLeadSummary,
  SalesforceMcpServer,
  SalesforceOpportunitySummary,
} from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

export class ProdSalesforceMcpServer implements SalesforceMcpServer {
  readonly name = 'salesforce-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdSalesforceMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    const limit = clampLimit(input.limit);
    const where = input.modifiedSince
      ? ` WHERE LastModifiedDate >= ${formatSoqlDateTime(input.modifiedSince)}`
      : '';
    const soql = `SELECT Id, FirstName, LastName, Email, Phone, Company, Status, LeadSource, Rating, CreatedDate, LastModifiedDate FROM Lead${where} ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
    return this.withApi(async (ctx) => {
      const res = await ctx.query<RawLead>(soql);
      if (!res.ok) return res;
      return mcpOk({ leads: (res.value.records ?? []).map(toLeadSummary) });
    });
  }

  async getLead(input: GetLeadInput): Promise<McpResult<GetLeadOutput>> {
    if (!input.leadId) return mcpError('INVALID_ARGUMENT', 'getLead requires leadId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawLead>('GET', `/sobjects/Lead/${encodeURIComponent(input.leadId)}`);
      if (!res.ok) return res;
      return mcpOk({ lead: toLeadSummary(res.value) });
    });
  }

  async listOpportunities(input: ListOpportunitiesInput): Promise<McpResult<ListOpportunitiesOutput>> {
    const limit = clampLimit(input.limit);
    let where = '';
    if (input.accountId) {
      where = ` WHERE AccountId = '${escapeSoql(input.accountId)}'`;
    }
    const soql = `SELECT Id, Name, Amount, StageName, CloseDate, AccountId, Probability, CreatedDate, LastModifiedDate FROM Opportunity${where} ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
    return this.withApi(async (ctx) => {
      const res = await ctx.query<RawOpportunity>(soql);
      if (!res.ok) return res;
      return mcpOk({ opportunities: (res.value.records ?? []).map(toOpportunitySummary) });
    });
  }

  async getOpportunity(input: GetOpportunityInput): Promise<McpResult<GetOpportunityOutput>> {
    if (!input.opportunityId) return mcpError('INVALID_ARGUMENT', 'getOpportunity requires opportunityId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawOpportunity>(
        'GET',
        `/sobjects/Opportunity/${encodeURIComponent(input.opportunityId)}`,
      );
      if (!res.ok) return res;
      return mcpOk({ opportunity: toOpportunitySummary(res.value) });
    });
  }

  async listAccounts(input: ListAccountsInput): Promise<McpResult<ListAccountsOutput>> {
    const limit = clampLimit(input.limit);
    const soql = `SELECT Id, Name, Industry, Website, Phone, CreatedDate, LastModifiedDate FROM Account ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
    return this.withApi(async (ctx) => {
      const res = await ctx.query<RawAccount>(soql);
      if (!res.ok) return res;
      return mcpOk({ accounts: (res.value.records ?? []).map(toAccountSummary) });
    });
  }

  async getAccount(input: GetAccountInput): Promise<McpResult<GetAccountOutput>> {
    if (!input.accountId) return mcpError('INVALID_ARGUMENT', 'getAccount requires accountId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawAccount>('GET', `/sobjects/Account/${encodeURIComponent(input.accountId)}`);
      if (!res.ok) return res;
      return mcpOk({ account: toAccountSummary(res.value) });
    });
  }

  async listContacts(input: ListContactsInput): Promise<McpResult<ListContactsOutput>> {
    const limit = clampLimit(input.limit);
    let where = '';
    if (input.accountId) {
      where = ` WHERE AccountId = '${escapeSoql(input.accountId)}'`;
    }
    const soql = `SELECT Id, FirstName, LastName, Email, Phone, AccountId, Title, CreatedDate, LastModifiedDate FROM Contact${where} ORDER BY LastModifiedDate DESC LIMIT ${limit}`;
    return this.withApi(async (ctx) => {
      const res = await ctx.query<RawContact>(soql);
      if (!res.ok) return res;
      return mcpOk({ contacts: (res.value.records ?? []).map(toContactSummary) });
    });
  }

  async createTask(input: CreateTaskInput): Promise<McpResult<CreateTaskOutput>> {
    if (!input.subject || input.subject.trim().length === 0) {
      return mcpError('INVALID_ARGUMENT', 'createTask requires a non-empty subject');
    }
    const body: Record<string, unknown> = {
      Subject: input.subject,
      Status: input.status ?? 'Not Started',
      Priority: input.priority ?? 'Normal',
    };
    if (input.description) body.Description = input.description;
    if (input.whoId) body.WhoId = input.whoId;
    if (input.whatId) body.WhatId = input.whatId;
    return this.withApi(async (ctx) => {
      const res = await ctx.api<{ id?: string; success?: boolean }>('POST', '/sobjects/Task', body);
      if (!res.ok) return res;
      if (!res.value.id) return mcpError('MALFORMED_RESPONSE', 'Salesforce Task create returned no id');
      return mcpOk({ taskId: res.value.id });
    });
  }

  // ── internals ───────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (ctx: { api: ApiFn; query: QueryFn }) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveSalesforceCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;
type QueryFn = <T>(soql: string) => Promise<McpResult<{ records?: T[]; totalSize?: number }>>;

function makeApiContext(resolved: ResolvedSalesforce): { api: ApiFn; query: QueryFn } {
  const base = `${resolved.instanceUrl.replace(/\/$/, '')}/services/data/${SALESFORCE_API_VERSION}`;
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
      return mcpError('NETWORK', `Salesforce network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `Salesforce JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };

  const query: QueryFn = async <T>(soql: string) => {
    const params = new URLSearchParams({ q: soql });
    return api<{ records?: T[]; totalSize?: number }>('GET', `/query?${params.toString()}`);
  };

  return { api, query };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    // Salesforce returns an ARRAY of error objects: [{ message, errorCode }]
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as { message?: string; errorCode?: string };
      detail = first.message ?? detail;
      reference = first.errorCode;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const body = parsed as { message?: string; errorCode?: string };
      detail = body.message ?? detail;
      reference = body.errorCode;
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

// ── Raw → DTO mappers ───────────────────────────────────────────────────

interface RawLead {
  Id?: string;
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Company?: string | null;
  Status?: string | null;
  LeadSource?: string | null;
  Rating?: string | null;
  CreatedDate?: string | null;
  LastModifiedDate?: string | null;
}

interface RawOpportunity {
  Id?: string;
  Name?: string | null;
  Amount?: number | null;
  StageName?: string | null;
  CloseDate?: string | null;
  AccountId?: string | null;
  Probability?: number | null;
  CreatedDate?: string | null;
  LastModifiedDate?: string | null;
}

interface RawAccount {
  Id?: string;
  Name?: string | null;
  Industry?: string | null;
  Website?: string | null;
  Phone?: string | null;
  CreatedDate?: string | null;
  LastModifiedDate?: string | null;
}

interface RawContact {
  Id?: string;
  FirstName?: string | null;
  LastName?: string | null;
  Email?: string | null;
  Phone?: string | null;
  AccountId?: string | null;
  Title?: string | null;
  CreatedDate?: string | null;
  LastModifiedDate?: string | null;
}

function toLeadSummary(l: RawLead): SalesforceLeadSummary {
  return {
    id: l.Id ?? '',
    firstName: l.FirstName ?? null,
    lastName: l.LastName ?? null,
    email: l.Email ?? null,
    phone: l.Phone ?? null,
    company: l.Company ?? null,
    status: l.Status ?? null,
    leadSource: l.LeadSource ?? null,
    rating: l.Rating ?? null,
    createdAt: l.CreatedDate ?? null,
    modifiedAt: l.LastModifiedDate ?? null,
  };
}

function toOpportunitySummary(o: RawOpportunity): SalesforceOpportunitySummary {
  return {
    id: o.Id ?? '',
    name: o.Name ?? null,
    amount: typeof o.Amount === 'number' && Number.isFinite(o.Amount) ? o.Amount : null,
    stage: o.StageName ?? null,
    closeDate: o.CloseDate ?? null,
    accountId: o.AccountId ?? null,
    probability: typeof o.Probability === 'number' && Number.isFinite(o.Probability) ? o.Probability : null,
    createdAt: o.CreatedDate ?? null,
    modifiedAt: o.LastModifiedDate ?? null,
  };
}

function toAccountSummary(a: RawAccount): SalesforceAccountSummary {
  return {
    id: a.Id ?? '',
    name: a.Name ?? null,
    industry: a.Industry ?? null,
    website: a.Website ?? null,
    phone: a.Phone ?? null,
    createdAt: a.CreatedDate ?? null,
    modifiedAt: a.LastModifiedDate ?? null,
  };
}

function toContactSummary(c: RawContact): SalesforceContactSummary {
  return {
    id: c.Id ?? '',
    firstName: c.FirstName ?? null,
    lastName: c.LastName ?? null,
    email: c.Email ?? null,
    phone: c.Phone ?? null,
    accountId: c.AccountId ?? null,
    title: c.Title ?? null,
    createdAt: c.CreatedDate ?? null,
    modifiedAt: c.LastModifiedDate ?? null,
  };
}

/** Escape single quotes for SOQL string literals. */
function escapeSoql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Format an ISO timestamp as the SOQL DateTime literal Salesforce expects.
 *  SOQL accepts `2024-01-01T00:00:00Z` directly — we just normalize to that. */
function formatSoqlDateTime(raw: string): string {
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return raw;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function clampLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  if (value < 1) return 1;
  if (value > MAX_LIMIT) return MAX_LIMIT;
  return Math.floor(value);
}
