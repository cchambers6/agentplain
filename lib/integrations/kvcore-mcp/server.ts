/**
 * lib/integrations/kvcore-mcp/server.ts
 *
 * Production kvCORE MCP server. Wraps the kvCORE REST surface behind the
 * `KvcoreMcpServer` interface via `client.ts`. One instance per `{workspaceId}`
 * per request. This file + `client.ts` are the ONLY places that touch kvCORE;
 * route handlers + skills speak the MCP interface
 * (`feedback_no_silent_vendor_lock.md`).
 *
 * Cold-start safe: every method re-resolves the credential; no key cached
 * on the instance.
 *
 * The single READ method (`listLeads`) issues a real GET once a credential
 * resolves. The three MUTATING methods (`createLead`, `sendMassMessage`,
 * `logActivity`) funnel through the approval seam — they return
 * APPROVAL_REQUIRED and never call kvCORE from the scaffold. When Conner wires
 * the credential + a real approval gate (DocuSign's gate is the reference),
 * the gated branch is replaced with the documented POST.
 */

import { gateMutation, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { makeKvcoreClient } from './client';
import { resolveKvcoreCredential } from './auth';
import {
  type CreateLeadInput,
  type CreateLeadOutput,
  type KvcoreLeadSummary,
  type KvcoreMcpServer,
  type ListLeadsInput,
  type ListLeadsOutput,
  type LogActivityInput,
  type LogActivityOutput,
  type SendMassMessageInput,
  type SendMassMessageOutput,
} from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export class ProdKvcoreMcpServer implements KvcoreMcpServer {
  readonly name = 'kvcore-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdKvcoreMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const resolved = await resolveKvcoreCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    const client = makeKvcoreClient({
      apiKey: resolved.value.credential.accessToken,
    });
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (input.query) params.set('query', input.query);
    const res = await client.get<RawLeadsEnvelope | RawLead[]>(`/contacts?${params.toString()}`);
    if (!res.ok) return res;
    const data = Array.isArray(res.value)
      ? res.value
      : Array.isArray(res.value.data)
        ? res.value.data
        : [];
    return mcpOk({ leads: data.map(toLeadSummary) });
  }

  // ── Mutating: approval-gated. kvCORE is never called from the scaffold. ────

  async createLead(_input: CreateLeadInput): Promise<McpResult<CreateLeadOutput>> {
    return gateMutation('kvCORE', 'creating a lead');
  }

  async sendMassMessage(
    _input: SendMassMessageInput,
  ): Promise<McpResult<SendMassMessageOutput>> {
    return gateMutation('kvCORE', 'sending a mass message');
  }

  async logActivity(_input: LogActivityInput): Promise<McpResult<LogActivityOutput>> {
    return gateMutation('kvCORE', 'logging an activity');
  }
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawLeadsEnvelope {
  data?: RawLead[];
}
interface RawLead {
  id?: number | string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
}

function toLeadSummary(l: RawLead): KvcoreLeadSummary {
  return {
    id: l.id != null ? String(l.id) : '',
    name: l.name ?? '',
    email: l.email ?? null,
    phone: l.phone ?? null,
    status: l.status ?? '',
    source: l.source ?? null,
  };
}
