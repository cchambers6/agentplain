/**
 * lib/integrations/ezlynx-mcp/server.ts
 *
 * Production EZLynx MCP server. Wraps EZLynx's REST API behind the
 * `EzlynxMcpServer` interface so the COI-request skill never sees a `fetch`
 * call. Plain `fetch` — the vendor publishes no JS SDK.
 *
 * Cold-start safe: re-resolves (and refreshes if near expiry) the credential
 * on every method via `resolveEzlynxCredential`; no token is cached.
 *
 * Per `project_no_outbound_architecture.md`: READ-ONLY. We read an insured
 * account's policies on file; we never bind, quote, or issue anything.
 *
 * EZLynx REST:
 *   auth   Authorization: Bearer <access_token>
 *   base   https://api.ezlynx.com
 *   search GET /v1/accounts?name={legalName}    → account id
 *   policy GET /v1/accounts/{id}/policies       → EzlynxPolicy[]
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveEzlynxCredential, type ResolvedEzlynx } from './auth';
import {
  EZLYNX_API_BASE,
  type EzlynxCoverageLine,
  type EzlynxMcpServer,
  type EzlynxPolicy,
  type ListPoliciesInput,
  type ListPoliciesOutput,
} from './types';

export class ProdEzlynxMcpServer implements EzlynxMcpServer {
  readonly name = 'ezlynx-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdEzlynxMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listPoliciesForInsured(
    input: ListPoliciesInput,
  ): Promise<McpResult<ListPoliciesOutput>> {
    const legalName = input.insuredLegalName?.trim();
    if (!legalName) return mcpError('INVALID_ARGUMENT', 'insuredLegalName is required');
    return this.withApi(async (api) => {
      const params = new URLSearchParams({ name: legalName });
      const acctRes = await api<RawAccountSearch>('GET', `/v1/accounts?${params.toString()}`);
      if (!acctRes.ok) return acctRes;
      const account = (acctRes.value.accounts ?? [])[0];
      if (!account || account.id === undefined) {
        // Unknown insured → empty list (skill treats every line as not-on-file
        // and routes to operator review). Never fabricated.
        return mcpOk({ policies: [] });
      }
      const polRes = await api<RawPolicies>(
        'GET',
        `/v1/accounts/${encodeURIComponent(String(account.id))}/policies`,
      );
      if (!polRes.ok) return polRes;
      return mcpOk({ policies: (polRes.value.policies ?? []).map(toPolicy) });
    });
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async withApi<T>(fn: (api: ApiFn) => Promise<McpResult<T>>): Promise<McpResult<T>> {
    const resolved = await resolveEzlynxCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;

function makeApiContext(resolved: ResolvedEzlynx): ApiFn {
  return async <T>(method: string, path: string, body?: unknown) => {
    let res: Response;
    try {
      res = await fetch(`${EZLYNX_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${resolved.accessToken}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return mcpError('NETWORK', `EZLynx network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `EZLynx JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as { message?: string; error_description?: string; error?: string };
    detail = body.message ?? body.error_description ?? body.error ?? detail;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('UNAUTHORIZED', detail, { status: 401 });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403 });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404 });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429 });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status });
}

// ── Raw EZLynx JSON → DTO mappers ────────────────────────────────────────

interface RawAccount {
  id?: string | number;
  name?: string;
}
interface RawAccountSearch {
  accounts?: RawAccount[];
}
interface RawPolicy {
  policyNumber?: string;
  policy_number?: string;
  carrier?: string;
  carrierName?: string;
  lineOfBusiness?: string;
  line?: string;
  expirationDate?: string;
  expiration_date?: string;
  status?: string;
  inForce?: boolean;
}
interface RawPolicies {
  policies?: RawPolicy[];
}

/** Map EZLynx's line-of-business label to our normalized coverage line.
 *  Unknown lines collapse to 'other' — surfaced (so the CSR sees it),
 *  never dropped, never coerced into a coverage the skill might match. */
function toLine(raw: string | undefined): EzlynxCoverageLine {
  switch ((raw ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')) {
    case 'general-liability':
    case 'gl':
    case 'cgl':
      return 'general-liability';
    case 'auto-liability':
    case 'commercial-auto':
    case 'business-auto':
      return 'auto-liability';
    case 'workers-comp':
    case 'workers-compensation':
    case 'wc':
      return 'workers-comp';
    case 'umbrella':
    case 'excess':
      return 'umbrella';
    case 'professional-liability':
    case 'e&o':
    case 'errors-and-omissions':
      return 'professional-liability';
    case 'property':
    case 'commercial-property':
      return 'property';
    case 'inland-marine':
      return 'inland-marine';
    default:
      return 'other';
  }
}

function toPolicy(p: RawPolicy): EzlynxPolicy {
  const status = (p.status ?? '').trim().toLowerCase();
  const inForce =
    typeof p.inForce === 'boolean'
      ? p.inForce
      : status.length > 0
        ? status === 'active' || status === 'in force' || status === 'inforce'
        : true;
  return {
    policyNumber: p.policyNumber ?? p.policy_number ?? '',
    carrierName: p.carrierName ?? p.carrier ?? '',
    line: toLine(p.lineOfBusiness ?? p.line),
    expirationDate: p.expirationDate ?? p.expiration_date ?? '',
    inForce,
  };
}
