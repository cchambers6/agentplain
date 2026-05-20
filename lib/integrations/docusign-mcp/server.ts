/**
 * lib/integrations/docusign-mcp/server.ts
 *
 * Production DocuSign MCP server. Wraps the eSignature REST API v2.1 behind
 * the `DocuSignMcpServer` interface. One instance per `{workspaceId}` per
 * request. This file is the ONLY place that calls the DocuSign REST API;
 * route handlers + skills speak the MCP interface (per
 * `feedback_no_silent_vendor_lock.md`).
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveDocuSignCredential`; no token is cached on the instance.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveDocuSignCredential, type ResolvedDocuSign } from './auth';
import {
  type DocuSignMcpServer,
  type DownloadCompletedDocumentInput,
  type DownloadCompletedDocumentOutput,
  type EnvelopeSummary,
  type GetEnvelopeStatusInput,
  type GetEnvelopeStatusOutput,
  type GetRecipientStatusInput,
  type GetRecipientStatusOutput,
  type ListEnvelopesInput,
  type ListEnvelopesOutput,
  type RecipientStatus,
  type SendEnvelopeInput,
  type SendEnvelopeOutput,
  type VoidEnvelopeInput,
  type VoidEnvelopeOutput,
} from './types';

const DEFAULT_COUNT = 25;
const MAX_COUNT = 100;

export class ProdDocuSignMcpServer implements DocuSignMcpServer {
  readonly name = 'docusign-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdDocuSignMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listEnvelopes(input: ListEnvelopesInput): Promise<McpResult<ListEnvelopesOutput>> {
    const count = clampCount(input.count);
    if (!count.ok) return count;
    const fromDate = input.fromDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return this.withApi(async (ctx) => {
      const params = new URLSearchParams({ from_date: fromDate, count: String(count.value) });
      if (input.status) params.set('status', input.status);
      const res = await ctx.api<{ envelopes?: RawEnvelope[]; resultSetSize?: string }>(
        'GET',
        `/envelopes?${params.toString()}`,
      );
      if (!res.ok) return res;
      return mcpOk({
        envelopes: (res.value.envelopes ?? []).map(toEnvelopeSummary),
        resultSetSize:
          res.value.resultSetSize !== undefined ? Number(res.value.resultSetSize) : null,
      });
    });
  }

  async getEnvelopeStatus(input: GetEnvelopeStatusInput): Promise<McpResult<GetEnvelopeStatusOutput>> {
    if (!input.envelopeId) return mcpError('INVALID_ARGUMENT', 'getEnvelopeStatus requires envelopeId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<RawEnvelope>('GET', `/envelopes/${encodeURIComponent(input.envelopeId)}`);
      if (!res.ok) return res;
      return mcpOk({ envelope: toEnvelopeSummary(res.value) });
    });
  }

  async getRecipientStatus(input: GetRecipientStatusInput): Promise<McpResult<GetRecipientStatusOutput>> {
    if (!input.envelopeId) return mcpError('INVALID_ARGUMENT', 'getRecipientStatus requires envelopeId');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<{ signers?: RawRecipient[]; carbonCopies?: RawRecipient[]; agents?: RawRecipient[] }>(
        'GET',
        `/envelopes/${encodeURIComponent(input.envelopeId)}/recipients`,
      );
      if (!res.ok) return res;
      const all = [
        ...(res.value.signers ?? []),
        ...(res.value.carbonCopies ?? []),
        ...(res.value.agents ?? []),
      ];
      return mcpOk({ recipients: all.map(toRecipientStatus) });
    });
  }

  async sendEnvelope(input: SendEnvelopeInput): Promise<McpResult<SendEnvelopeOutput>> {
    if (!input.emailSubject) return mcpError('INVALID_ARGUMENT', 'sendEnvelope requires emailSubject');
    const usingTemplate = !!input.templateId;
    const usingDocuments = !!(input.documents && input.documents.length > 0);
    if (usingTemplate === usingDocuments) {
      return mcpError(
        'INVALID_ARGUMENT',
        'sendEnvelope requires EITHER templateId (+templateRoles) OR documents (+signers), not both/neither.',
      );
    }
    const status = input.status ?? 'sent';
    const body: Record<string, unknown> = { emailSubject: input.emailSubject, status };
    if (usingTemplate) {
      body.templateId = input.templateId;
      body.templateRoles = (input.templateRoles ?? []).map((r) => ({
        roleName: r.roleName,
        name: r.name,
        email: r.email,
      }));
    } else {
      body.documents = (input.documents ?? []).map((d, i) => ({
        documentId: String(i + 1),
        name: d.name,
        fileExtension: d.fileExtension,
        documentBase64: d.documentBase64,
      }));
      body.recipients = {
        signers: (input.signers ?? []).map((s, i) => ({
          recipientId: String(i + 1),
          routingOrder: s.routingOrder ?? '1',
          name: s.name,
          email: s.email,
        })),
      };
    }
    return this.withApi(async (ctx) => {
      const res = await ctx.api<{ envelopeId?: string; status?: string; statusDateTime?: string }>(
        'POST',
        '/envelopes',
        body,
      );
      if (!res.ok) return res;
      if (!res.value.envelopeId) return mcpError('MALFORMED_RESPONSE', 'envelopes.create returned no envelopeId');
      return mcpOk({
        envelopeId: res.value.envelopeId,
        status: res.value.status ?? status,
        statusDateTime: res.value.statusDateTime ?? null,
      });
    });
  }

  async downloadCompletedDocument(
    input: DownloadCompletedDocumentInput,
  ): Promise<McpResult<DownloadCompletedDocumentOutput>> {
    if (!input.envelopeId) return mcpError('INVALID_ARGUMENT', 'downloadCompletedDocument requires envelopeId');
    const documentId = input.documentId ?? 'combined';
    return this.withApi(async (ctx) => {
      const res = await ctx.apiBinary(
        `/envelopes/${encodeURIComponent(input.envelopeId)}/documents/${encodeURIComponent(documentId)}`,
      );
      if (!res.ok) return res;
      return mcpOk({
        envelopeId: input.envelopeId,
        documentId,
        contentType: res.value.contentType,
        contentBase64: res.value.base64,
        sizeBytes: res.value.sizeBytes,
      });
    });
  }

  async voidEnvelope(input: VoidEnvelopeInput): Promise<McpResult<VoidEnvelopeOutput>> {
    if (!input.envelopeId) return mcpError('INVALID_ARGUMENT', 'voidEnvelope requires envelopeId');
    if (!input.voidedReason) return mcpError('INVALID_ARGUMENT', 'voidEnvelope requires voidedReason');
    return this.withApi(async (ctx) => {
      const res = await ctx.api<{ envelopeId?: string; status?: string }>(
        'PUT',
        `/envelopes/${encodeURIComponent(input.envelopeId)}`,
        { status: 'voided', voidedReason: input.voidedReason },
      );
      if (!res.ok) return res;
      return mcpOk({ envelopeId: input.envelopeId, status: res.value.status ?? 'voided' });
    });
  }

  // ── internals ─────────────────────────────────────────────────────────

  private async withApi<T>(
    fn: (ctx: { api: ApiFn; apiBinary: ApiBinaryFn }) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveDocuSignCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApiContext(resolved.value));
  }
}

// ── REST helpers ───────────────────────────────────────────────────────────

type ApiFn = <T>(method: string, path: string, body?: unknown) => Promise<McpResult<T>>;
type ApiBinaryFn = (
  path: string,
) => Promise<McpResult<{ base64: string; contentType: string; sizeBytes: number }>>;

function makeApiContext(resolved: ResolvedDocuSign): { api: ApiFn; apiBinary: ApiBinaryFn } {
  const base = `${resolved.apiBaseUri}/restapi/v2.1/accounts/${resolved.accountId}`;
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
      return mcpError('NETWORK', `DocuSign network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapRestError(res, text);
    if (text.length === 0) return mcpOk({} as T);
    try {
      return mcpOk(JSON.parse(text) as T);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `DocuSign JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
  };

  const apiBinary: ApiBinaryFn = async (path: string) => {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method: 'GET',
        headers: { Authorization: authHeader, Accept: 'application/pdf' },
      });
    } catch (err) {
      return mcpError('NETWORK', `DocuSign network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) return mapRestError(res, await res.text());
    const buf = Buffer.from(await res.arrayBuffer());
    return mcpOk({
      base64: buf.toString('base64'),
      contentType: res.headers.get('content-type') ?? 'application/pdf',
      sizeBytes: buf.byteLength,
    });
  };

  return { api, apiBinary };
}

function mapRestError(res: Response, text: string): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as { errorCode?: string; message?: string };
    detail = body.message ?? detail;
    reference = body.errorCode;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return mcpError('TOKEN_EXPIRED', detail, { status: 401, reference });
  if (res.status === 403) return mcpError('FORBIDDEN', detail, { status: 403, reference });
  if (res.status === 404) return mcpError('NOT_FOUND', detail, { status: 404, reference });
  if (res.status === 429) return mcpError('RATE_LIMITED', detail, { status: 429, reference });
  if (res.status >= 500) return mcpError('UPSTREAM_ERROR', detail, { status: res.status, reference });
  return mcpError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawEnvelope {
  envelopeId?: string;
  status?: string;
  emailSubject?: string;
  sentDateTime?: string;
  completedDateTime?: string;
  statusChangedDateTime?: string;
}

interface RawRecipient {
  recipientId?: string;
  name?: string;
  email?: string;
  status?: string;
  routingOrder?: string;
  signedDateTime?: string;
  deliveredDateTime?: string;
}

function toEnvelopeSummary(e: RawEnvelope): EnvelopeSummary {
  return {
    envelopeId: e.envelopeId ?? '',
    status: e.status ?? 'unknown',
    emailSubject: e.emailSubject ?? null,
    sentDateTime: e.sentDateTime ?? null,
    completedDateTime: e.completedDateTime ?? null,
    statusChangedDateTime: e.statusChangedDateTime ?? null,
  };
}

function toRecipientStatus(r: RawRecipient): RecipientStatus {
  return {
    recipientId: r.recipientId ?? '',
    name: r.name ?? '',
    email: r.email ?? '',
    status: r.status ?? 'unknown',
    routingOrder: r.routingOrder ?? null,
    signedDateTime: r.signedDateTime ?? null,
    deliveredDateTime: r.deliveredDateTime ?? null,
  };
}

function clampCount(value: number | undefined): McpResult<number> {
  if (value === undefined) return mcpOk(DEFAULT_COUNT);
  if (!Number.isInteger(value) || value <= 0) return mcpError('INVALID_ARGUMENT', `count must be a positive integer, got ${value}`);
  if (value > MAX_COUNT) return mcpError('INVALID_ARGUMENT', `count must be <= ${MAX_COUNT}, got ${value}`);
  return mcpOk(value);
}
