/**
 * lib/integrations/encompass-mcp/server.ts
 *
 * Production Encompass MCP server. Wraps ICE Mortgage's Encompass Developer
 * Connect REST API behind the `EncompassMcpServer` interface so the
 * mortgage doc-chase skill never sees a `fetch` call. Plain `fetch`.
 *
 * Cold-start safe: re-resolves (and refreshes if near expiry) the credential
 * on every method via `resolveEncompassCredential`; no token is cached.
 *
 * Per `project_no_outbound_architecture.md`: READ-ONLY. We read the loan
 * file header + outstanding underwriting conditions; we never upload a
 * document, clear a condition, or advance the loan.
 *
 * Encompass REST:
 *   auth   Authorization: Bearer <access_token>
 *   base   https://api.elliemae.com/encompass/v3
 *   loan   GET /loans/{id}?entities=applications,contacts
 *   conds  GET /loans/{id}/conditions/underwriting
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveEncompassCredential, type ResolvedEncompass } from './auth';
import {
  ENCOMPASS_API_BASE,
  type EncompassContact,
  type EncompassDocCategory,
  type EncompassLoanSummary,
  type EncompassMcpServer,
  type EncompassOutstandingDoc,
  type GetLoanFileInput,
  type GetLoanFileOutput,
  type ListOutstandingDocsInput,
  type ListOutstandingDocsOutput,
} from './types';

export class ProdEncompassMcpServer implements EncompassMcpServer {
  readonly name = 'encompass-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdEncompassMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async getLoanFile(input: GetLoanFileInput): Promise<McpResult<GetLoanFileOutput>> {
    if (!input.loanId) return mcpError('INVALID_ARGUMENT', 'loanId is required');
    return this.withApi(async (api) => {
      const res = await api<RawLoan>(
        'GET',
        `/loans/${encodeURIComponent(input.loanId)}`,
      );
      if (!res.ok) return res;
      return mcpOk({ loan: toLoanSummary(input.loanId, res.value) });
    });
  }

  async listOutstandingDocs(
    input: ListOutstandingDocsInput,
  ): Promise<McpResult<ListOutstandingDocsOutput>> {
    if (!input.loanId) return mcpError('INVALID_ARGUMENT', 'loanId is required');
    return this.withApi(async (api) => {
      const res = await api<RawCondition[]>(
        'GET',
        `/loans/${encodeURIComponent(input.loanId)}/conditions/underwriting`,
      );
      if (!res.ok) return res;
      const docs: EncompassOutstandingDoc[] = [];
      for (const c of res.value) {
        // Only chase items the borrower still owes. Encompass marks cleared
        // / received conditions with a status; we skip those.
        if (isCleared(c.status)) continue;
        docs.push(toOutstandingDoc(c));
      }
      return mcpOk({ docs });
    });
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async withApi<T>(fn: (api: ApiFn) => Promise<McpResult<T>>): Promise<McpResult<T>> {
    const resolved = await resolveEncompassCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;

function makeApiContext(resolved: ResolvedEncompass): ApiFn {
  return async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${ENCOMPASS_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${resolved.accessToken}`,
          // ICE routes the request to the lender's Encompass instance.
          'X-Elli-InstanceId': resolved.instanceId,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError('NETWORK', `Encompass network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `Encompass JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as { summary?: string; details?: string; error_description?: string };
    detail = body.summary ?? body.details ?? body.error_description ?? detail;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('UNAUTHORIZED', detail, { status: 401 });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403 });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404 });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429 });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status });
}

// ── Raw Encompass JSON → DTO mappers ─────────────────────────────────────

interface RawContact {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
}
interface RawApplication {
  borrower?: RawContact;
  coBorrower?: RawContact | null;
}
interface RawLoan {
  loanOfficer?: RawContact;
  applications?: RawApplication[];
  property?: { streetAddress?: string; city?: string; state?: string; postalCode?: string };
  loanPurpose?: string;
  estimatedClosingDate?: string;
}
interface RawCondition {
  id?: string | number;
  title?: string;
  description?: string;
  category?: string;
  dateRequested?: string;
  status?: string;
  borrowerResponded?: boolean;
  priorTo?: string;
}

function fullName(c: RawContact | undefined): string {
  if (!c) return '';
  const fn = c.fullName ?? [c.firstName, c.lastName].filter(Boolean).join(' ');
  return (fn ?? '').trim();
}

function toContact(c: RawContact | undefined, fallbackName: string): EncompassContact {
  const name = fullName(c);
  return {
    name: name.length > 0 ? name : fallbackName,
    email: c?.email && c.email.trim().length > 0 ? c.email.trim() : null,
  };
}

function toPurpose(raw: string | undefined): EncompassLoanSummary['purpose'] {
  switch ((raw ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')) {
    case 'purchase':
      return 'purchase';
    case 'cash-out-refinance':
    case 'cash-out-refi':
      return 'cash-out-refi';
    case 'heloc':
    case 'home-equity':
      return 'heloc';
    case 'no-cash-out-refinance':
    case 'rate-term-refinance':
    case 'refinance':
    default:
      return 'refinance';
  }
}

function toCategory(raw: string | undefined): EncompassDocCategory {
  switch ((raw ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')) {
    case 'income':
    case 'employment':
      return 'income';
    case 'assets':
    case 'asset':
      return 'assets';
    case 'identity':
    case 'id':
      return 'identity';
    case 'property':
    case 'appraisal':
      return 'property';
    case 'declarations':
    case 'disclosures':
      return 'declarations';
    case 'credit':
    case 'credit-letter':
      return 'credit-letter';
    default:
      return 'other';
  }
}

function isCleared(status: string | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  return s === 'cleared' || s === 'received' || s === 'satisfied' || s === 'waived';
}

function propertyAddress(p: RawLoan['property']): string {
  if (!p) return '';
  return [p.streetAddress, p.city, [p.state, p.postalCode].filter(Boolean).join(' ')]
    .filter((part) => part && part.trim().length > 0)
    .join(', ');
}

function toLoanSummary(loanId: string, loan: RawLoan): EncompassLoanSummary {
  const app = (loan.applications ?? [])[0];
  return {
    loanId,
    borrower: toContact(app?.borrower, 'Borrower'),
    coBorrower: app?.coBorrower ? toContact(app.coBorrower, 'Co-Borrower') : null,
    loanOfficer: toContact(loan.loanOfficer, 'Loan Officer'),
    propertyAddress: propertyAddress(loan.property),
    purpose: toPurpose(loan.loanPurpose),
    estimatedClosingDate: loan.estimatedClosingDate ?? null,
  };
}

function toOutstandingDoc(c: RawCondition): EncompassOutstandingDoc {
  return {
    id: String(c.id ?? ''),
    label: c.title ?? c.description ?? 'Outstanding item',
    category: toCategory(c.category),
    requestedAt: c.dateRequested ?? new Date(0).toISOString(),
    borrowerAcknowledged: c.borrowerResponded === true,
    // Encompass "prior to" markers (PTD / PTF) attach the condition to an
    // underwriting decision — treat any non-empty priorTo as condition-attached.
    conditionAttached: typeof c.priorTo === 'string' && c.priorTo.trim().length > 0,
  };
}
