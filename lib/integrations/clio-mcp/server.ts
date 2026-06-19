/**
 * lib/integrations/clio-mcp/server.ts
 *
 * Production Clio MCP server. Wraps the Clio API v4 REST surface behind the
 * `ClioMcpServer` interface via `client.ts`. One instance per `{workspaceId}`
 * per request. This file + `client.ts` are the ONLY places that touch Clio;
 * route handlers + skills speak the MCP interface
 * (`feedback_no_silent_vendor_lock.md`).
 *
 * Cold-start safe: every method re-resolves the credential; no token cached
 * on the instance.
 *
 * The single READ method (`listMatters`) issues a real GET once a credential
 * resolves. The four MUTATING methods (`createMatter`, `logTime`, `createBill`,
 * `sendSecureMessage`) funnel through the approval seam — they return
 * APPROVAL_REQUIRED and never call Clio from the scaffold. When Conner wires
 * the credential + a real approval gate (DocuSign's gate is the reference),
 * the gated branch is replaced with the documented POST.
 */

import { gateMutation, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { makeClioClient } from './client';
import { resolveClioCredential } from './auth';
import {
  type ClioMatterSummary,
  type ClioMcpServer,
  type CreateBillInput,
  type CreateBillOutput,
  type CreateMatterInput,
  type CreateMatterOutput,
  type ListMattersInput,
  type ListMattersOutput,
  type LogTimeInput,
  type LogTimeOutput,
  type SendSecureMessageInput,
  type SendSecureMessageOutput,
} from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export class ProdClioMcpServer implements ClioMcpServer {
  readonly name = 'clio-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdClioMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listMatters(input: ListMattersInput): Promise<McpResult<ListMattersOutput>> {
    const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const resolved = await resolveClioCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    const client = makeClioClient({
      accessToken: resolved.value.credential.accessToken,
      regionHost: resolved.value.regionHost,
    });
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('fields', 'id,display_number,description,status,responsible_attorney{email},client{id}');
    if (input.query) params.set('query', input.query);
    if (input.status) params.set('status', input.status);
    const res = await client.get<RawMattersEnvelope>(`/matters.json?${params.toString()}`);
    if (!res.ok) return res;
    const data = Array.isArray(res.value.data) ? res.value.data : [];
    return mcpOk({ matters: data.map(toMatterSummary) });
  }

  // ── Mutating: approval-gated. Clio is never called from the scaffold. ──────

  async createMatter(_input: CreateMatterInput): Promise<McpResult<CreateMatterOutput>> {
    return gateMutation('Clio', 'opening a matter');
  }

  async logTime(_input: LogTimeInput): Promise<McpResult<LogTimeOutput>> {
    return gateMutation('Clio', 'logging time on a matter');
  }

  async createBill(_input: CreateBillInput): Promise<McpResult<CreateBillOutput>> {
    return gateMutation('Clio', 'raising a bill');
  }

  async sendSecureMessage(
    _input: SendSecureMessageInput,
  ): Promise<McpResult<SendSecureMessageOutput>> {
    return gateMutation('Clio', 'sending a secure client message');
  }
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawMattersEnvelope {
  data?: RawMatter[];
}
interface RawMatter {
  id?: number | string;
  display_number?: string;
  description?: string;
  status?: string;
  responsible_attorney?: { email?: string } | null;
  client?: { id?: number | string } | null;
}

function toMatterSummary(m: RawMatter): ClioMatterSummary {
  return {
    id: m.id != null ? String(m.id) : '',
    displayNumber: m.display_number ?? '',
    description: m.description ?? '',
    status: normalizeStatus(m.status),
    responsibleAttorneyEmail: m.responsible_attorney?.email ?? null,
    clientId: m.client?.id != null ? String(m.client.id) : null,
  };
}

function normalizeStatus(raw: string | undefined): ClioMatterSummary['status'] {
  const v = (raw ?? '').toLowerCase();
  if (v === 'pending' || v === 'closed') return v;
  return 'open';
}
