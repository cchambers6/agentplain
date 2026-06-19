/**
 * lib/integrations/boldtrail-mcp/server.ts
 *
 * Production BoldTrail MCP server. Wraps the BoldTrail REST surface behind the
 * `BoldtrailMcpServer` interface via `client.ts`. One instance per
 * `{workspaceId}` per request. This file + `client.ts` are the ONLY places that
 * touch BoldTrail; route handlers + skills speak the MCP interface
 * (`feedback_no_silent_vendor_lock.md`).
 *
 * Cold-start safe: every method re-resolves the credential; no key cached on
 * the instance.
 *
 * The single READ method (`listLeads`) issues a real GET once a credential
 * resolves. The two MUTATING methods (`updatePipeline`, `sendTemplate`) funnel
 * through the approval seam — they return APPROVAL_REQUIRED and never call
 * BoldTrail from the scaffold. When Conner wires the credential + a real
 * approval gate (DocuSign's gate is the reference), the gated branch is
 * replaced with the documented POST.
 */

import { gateMutation, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { makeBoldtrailClient } from './client';
import { resolveBoldtrailCredential } from './auth';
import {
  type BoldTrailLeadSummary,
  type BoldtrailMcpServer,
  type ListLeadsInput,
  type ListLeadsOutput,
  type SendTemplateInput,
  type SendTemplateOutput,
  type UpdatePipelineInput,
  type UpdatePipelineOutput,
} from './types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export class ProdBoldtrailMcpServer implements BoldtrailMcpServer {
  readonly name = 'boldtrail-rest' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdBoldtrailMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listLeads(input: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
    const limit = Math.min(Math.max(1, input.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const resolved = await resolveBoldtrailCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    const client = makeBoldtrailClient({
      apiKey: resolved.value.credential.accessToken,
    });
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (input.query) params.set('query', input.query);
    const res = await client.get<RawLeadsEnvelope>(`/leads?${params.toString()}`);
    if (!res.ok) return res;
    const data = Array.isArray(res.value.data) ? res.value.data : [];
    return mcpOk({ leads: data.map(toLeadSummary) });
  }

  // ── Mutating: approval-gated. BoldTrail is never called from the scaffold. ──

  async updatePipeline(
    _input: UpdatePipelineInput,
  ): Promise<McpResult<UpdatePipelineOutput>> {
    return gateMutation('BoldTrail', 'updating a lead pipeline');
  }

  async sendTemplate(
    _input: SendTemplateInput,
  ): Promise<McpResult<SendTemplateOutput>> {
    return gateMutation('BoldTrail', 'sending a template message');
  }
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawLeadsEnvelope {
  data?: RawLead[];
}
interface RawLead {
  id?: number | string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  stage?: string;
  pipeline_id?: number | string | null;
}

function toLeadSummary(l: RawLead): BoldTrailLeadSummary {
  const name =
    l.name ??
    [l.first_name, l.last_name].filter((p) => p && p.length > 0).join(' ');
  return {
    id: l.id != null ? String(l.id) : '',
    name: name ?? '',
    email: l.email ?? null,
    stage: l.stage ?? '',
    pipelineId: l.pipeline_id != null ? String(l.pipeline_id) : null,
  };
}
