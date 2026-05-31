/**
 * lib/integrations/taxdome-mcp/server.ts
 *
 * Production TaxDome MCP server. Wraps the TaxDome REST API behind the
 * `TaxdomeMcpServer` interface. One instance per `{workspaceId}` per
 * request. This file is the ONLY place that calls the TaxDome REST API;
 * route handlers + skills speak the MCP interface (per
 * `feedback_no_silent_vendor_lock.md`). Plain `fetch`, no SDK.
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveTaxdomeCredential`; no key is cached on the instance.
 *
 * Read-only by contract — no `create_*` or `update_*` paths here. The
 * MCP server surface stays in lock-step with the `TaxdomeMcpServer`
 * interface, which only exposes read tools today.
 *
 * NOTE on the REST shapes: TaxDome's API v2 (per docs.taxdome.com /
 * help.taxdome.com) returns paginated lists under `{ data: [...], meta:
 * {...} }`. The mappers below tolerate either flat-array or paginated
 * envelopes so partner-program drift doesn't break our reads. If your
 * firm's TaxDome instance is on the older v1 envelope you'll see
 * `MALFORMED_RESPONSE` here — that's the honest signal to upgrade.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveTaxdomeCredential, taxdomeApiBase, type ResolvedTaxdome } from './auth';
import {
  type GetClientInput,
  type GetClientOutput,
  type GetTaxDocumentInput,
  type GetTaxDocumentOutput,
  type ListClientsInput,
  type ListClientsOutput,
  type ListEngagementLettersInput,
  type ListEngagementLettersOutput,
  type ListReceivedDocumentsInput,
  type ListReceivedDocumentsOutput,
  type ListTaxDocumentsInput,
  type ListTaxDocumentsOutput,
  type TaxdomeClientSummary,
  type TaxdomeDocumentSummary,
  type TaxdomeMcpServer,
} from './types';

const DEFAULT_COUNT = 25;
const MAX_COUNT = 100;

export class ProdTaxdomeMcpServer implements TaxdomeMcpServer {
  readonly name = 'taxdome-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdTaxdomeMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listClients(input: ListClientsInput): Promise<McpResult<ListClientsOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawListEnvelope<RawClient>>(
        'GET',
        `/clients?limit=${count.value}`,
      );
      if (!res.ok) return res;
      return mcpOk({
        clients: unwrapList(res.value).map(toClientSummary),
      });
    });
  }

  async getClient(input: GetClientInput): Promise<McpResult<GetClientOutput>> {
    if (!input.clientId) return mcpError('INVALID_ARGUMENT', 'getClient requires clientId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawClient | { data: RawClient }>(
        'GET',
        `/clients/${encodeURIComponent(input.clientId)}`,
      );
      if (!res.ok) return res;
      const raw = 'data' in res.value && res.value.data ? res.value.data : (res.value as RawClient);
      if (!raw || !raw.id) return mcpError('NOT_FOUND', `No client ${input.clientId}`);
      return mcpOk({ client: toClientSummary(raw) });
    });
  }

  async listTaxDocuments(
    input: ListTaxDocumentsInput,
  ): Promise<McpResult<ListTaxDocumentsOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const params = new URLSearchParams();
    params.set('limit', String(count.value));
    if (input.clientId) params.set('client_id', input.clientId);
    if (input.status) params.set('status', input.status);
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawListEnvelope<RawDocument>>(
        'GET',
        `/documents?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({ documents: unwrapList(res.value).map(toDocumentSummary) });
    });
  }

  async getTaxDocument(
    input: GetTaxDocumentInput,
  ): Promise<McpResult<GetTaxDocumentOutput>> {
    if (!input.documentId) return mcpError('INVALID_ARGUMENT', 'getTaxDocument requires documentId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawDocument | { data: RawDocument }>(
        'GET',
        `/documents/${encodeURIComponent(input.documentId)}`,
      );
      if (!res.ok) return res;
      const raw =
        'data' in res.value && res.value.data ? res.value.data : (res.value as RawDocument);
      if (!raw || !raw.id) return mcpError('NOT_FOUND', `No document ${input.documentId}`);
      return mcpOk({ document: toDocumentSummary(raw) });
    });
  }

  async listEngagementLetters(
    input: ListEngagementLettersInput,
  ): Promise<McpResult<ListEngagementLettersOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const params = new URLSearchParams();
    params.set('limit', String(count.value));
    params.set('kind', 'engagement-letter');
    if (input.clientId) params.set('client_id', input.clientId);
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawListEnvelope<RawDocument>>(
        'GET',
        `/documents?${params.toString()}`,
      );
      if (!res.ok) return res;
      const docs = unwrapList(res.value)
        .map(toDocumentSummary)
        .filter((d) => d.kind === 'engagement-letter');
      return mcpOk({ engagementLetters: docs });
    });
  }

  async listReceivedDocuments(
    input: ListReceivedDocumentsInput,
  ): Promise<McpResult<ListReceivedDocumentsOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const params = new URLSearchParams();
    params.set('limit', String(count.value));
    params.set('kind', 'received-doc');
    if (input.clientId) params.set('client_id', input.clientId);
    if (input.uploadedSince) params.set('uploaded_since', input.uploadedSince);
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawListEnvelope<RawDocument>>(
        'GET',
        `/documents?${params.toString()}`,
      );
      if (!res.ok) return res;
      const docs = unwrapList(res.value)
        .map(toDocumentSummary)
        .filter((d) => d.kind === 'received-doc');
      return mcpOk({ receivedDocuments: docs });
    });
  }

  // ── internals ─────────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (ctx: { api: ApiFn }) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveTaxdomeCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

// ── REST helpers ───────────────────────────────────────────────────────────

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;

function makeApiContext(resolved: ResolvedTaxdome): { api: ApiFn } {
  const base = taxdomeApiBase(resolved.portalSubdomain);
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
      return mcpError(
        'NETWORK',
        `TaxDome network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError(
        'MALFORMED_RESPONSE',
        `TaxDome JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: res.status },
      );
    }
  };

  return { api };
}

function mapRestError(
  res: Response,
  text: string,
): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as { message?: string; error?: string };
    detail = body.message ?? body.error ?? detail;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('TOKEN_EXPIRED', detail, { status: 401 });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403 });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404 });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429 });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status });
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawListEnvelope<T> {
  data?: T[];
  /** Some TaxDome endpoints return a flat array; some return `{ data,
   *  meta }`. `unwrapList` tolerates both. */
}
interface RawClient {
  id?: string;
  name?: string;
  display_name?: string;
  email?: string;
  primary_email?: string;
  status?: string;
  active?: boolean;
}
interface RawDocument {
  id?: string;
  filename?: string;
  name?: string;
  client_id?: string;
  uploaded_at?: string;
  created_at?: string;
  status?: string;
  kind?: string;
  type?: string;
}

function unwrapList<T>(envelope: RawListEnvelope<T> | T[]): T[] {
  if (Array.isArray(envelope)) return envelope;
  if (envelope && Array.isArray(envelope.data)) return envelope.data;
  return [];
}

function toClientSummary(c: RawClient): TaxdomeClientSummary {
  const id = c.id ?? '';
  const name = c.display_name ?? c.name ?? '';
  const email = c.primary_email ?? c.email ?? null;
  const active =
    typeof c.active === 'boolean'
      ? c.active
      : c.status === 'active' || c.status === undefined
        ? true
        : false;
  return { id, name, email, active };
}

function toDocumentSummary(d: RawDocument): TaxdomeDocumentSummary {
  const id = d.id ?? '';
  const filename = d.filename ?? d.name ?? '';
  const clientId = d.client_id ?? '';
  const uploadedAt = d.uploaded_at ?? d.created_at ?? '';
  const status = normalizeStatus(d.status);
  const kind = normalizeKind(d.kind ?? d.type);
  return { id, filename, clientId, uploadedAt, status, kind };
}

function normalizeStatus(raw: string | undefined): TaxdomeDocumentSummary['status'] {
  if (raw === 'reviewed' || raw === 'sent-to-client' || raw === 'archived') return raw;
  return 'pending-review';
}

function normalizeKind(raw: string | undefined): TaxdomeDocumentSummary['kind'] {
  if (raw === 'tax-return' || raw === 'engagement-letter' || raw === 'received-doc') return raw;
  return 'other';
}

function clampCount(value: number | undefined): McpResult<number> {
  if (value === undefined) return mcpOk(DEFAULT_COUNT);
  if (!Number.isInteger(value) || value <= 0)
    return mcpError('INVALID_ARGUMENT', `count must be a positive integer, got ${value}`);
  if (value > MAX_COUNT)
    return mcpError('INVALID_ARGUMENT', `count must be <= ${MAX_COUNT}, got ${value}`);
  return mcpOk(value);
}
