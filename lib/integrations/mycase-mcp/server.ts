/**
 * lib/integrations/mycase-mcp/server.ts
 *
 * Production MyCase MCP server. Wraps the MyCase REST surface behind the
 * `MyCaseMcpServer` interface via `client.ts`. One instance per `{workspaceId}`
 * per request. This file + `client.ts` are the ONLY places that touch MyCase;
 * route handlers + skills speak the MCP interface
 * (`feedback_no_silent_vendor_lock.md`).
 *
 * Cold-start safe: every method re-resolves the credential; no token cached
 * on the instance.
 *
 * The single READ method (`listCases`) issues a real GET once a credential
 * resolves. The three MUTATING methods (`createCase`, `sendInvoice`,
 * `updateStatus`) funnel through the approval seam — they return
 * APPROVAL_REQUIRED and never call MyCase from the scaffold. When Conner wires
 * the credential + a real approval gate (DocuSign's gate is the reference),
 * the gated branch is replaced with the documented POST.
 */

import { gateMutation, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { makeMyCaseClient } from './client';
import { resolveMyCaseCredential } from './auth';
import {
  type CreateCaseInput,
  type CreateCaseOutput,
  type ListCasesInput,
  type ListCasesOutput,
  type MyCaseCaseSummary,
  type MyCaseMcpServer,
  type SendInvoiceInput,
  type SendInvoiceOutput,
  type UpdateStatusInput,
  type UpdateStatusOutput,
} from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export class ProdMyCaseMcpServer implements MyCaseMcpServer {
  readonly name = 'mycase-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdMyCaseMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listCases(input: ListCasesInput): Promise<McpResult<ListCasesOutput>> {
    const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const resolved = await resolveMyCaseCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    const client = makeMyCaseClient({
      accessToken: resolved.value.credential.accessToken,
    });
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (input.query) params.set('query', input.query);
    if (input.status) params.set('status', input.status);
    const res = await client.get<RawCasesEnvelope>(`/cases.json?${params.toString()}`);
    if (!res.ok) return res;
    const data = Array.isArray(res.value.data) ? res.value.data : [];
    return mcpOk({ cases: data.map(toCaseSummary) });
  }

  // ── Mutating: approval-gated. MyCase is never called from the scaffold. ────

  async createCase(_input: CreateCaseInput): Promise<McpResult<CreateCaseOutput>> {
    return gateMutation('MyCase', 'opening a case');
  }

  async sendInvoice(_input: SendInvoiceInput): Promise<McpResult<SendInvoiceOutput>> {
    return gateMutation('MyCase', 'sending an invoice');
  }

  async updateStatus(_input: UpdateStatusInput): Promise<McpResult<UpdateStatusOutput>> {
    return gateMutation('MyCase', 'updating case status');
  }
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawCasesEnvelope {
  data?: RawCase[];
}
interface RawCase {
  id?: number | string;
  name?: string;
  status?: string;
  client?: { id?: number | string } | null;
  lead_attorney?: { email?: string } | null;
}

function toCaseSummary(c: RawCase): MyCaseCaseSummary {
  return {
    id: c.id != null ? String(c.id) : '',
    name: c.name ?? '',
    status: normalizeStatus(c.status),
    clientId: c.client?.id != null ? String(c.client.id) : null,
    leadAttorneyEmail: c.lead_attorney?.email ?? null,
  };
}

function normalizeStatus(raw: string | undefined): MyCaseCaseSummary['status'] {
  const v = (raw ?? '').toLowerCase();
  if (v === 'pending' || v === 'closed') return v;
  return 'open';
}
