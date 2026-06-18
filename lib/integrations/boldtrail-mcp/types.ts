/**
 * lib/integrations/boldtrail-mcp/types.ts
 *
 * BoldTrail MCP server tool surface. One instance per `{workspaceId}` per
 * request (never reused across workspaces). Built on
 * `lib/integrations/mcp-core` — the vendor-neutral JSON-RPC envelope + result
 * shapes — so the wire format matches the shipped
 * Gmail/Outlook/QuickBooks/Karbon/Clio servers.
 *
 * SCAFFOLD (2026-06-17): BoldTrail is `coming-soon` in the marketplace. The
 * typed surface, auth shape, tool registry, and dispatch route are wired; the
 * credential path opens when Conner enrolls in the BoldTrail developer-partner
 * program and a per-account API key lands — see TODOS-FOR-CONNER. Until then
 * read tools return CREDENTIAL_NOT_FOUND and mutating tools return
 * APPROVAL_REQUIRED.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this surface covers
 * the real-estate lead-CRM value loop — list leads, move a lead through the
 * pipeline, and send a templated message. The realty lead-triage skills read
 * leads to triage a new inquiry; the pipeline + template surface advances and
 * nurtures it.
 *
 * Per `project_no_outbound_architecture.md`: `update_pipeline` and
 * `send_template` are MUTATING — each funnels through the approval seam
 * (`mcp-core/approval.ts`) and never fires from an autonomous run without a
 * recorded human approval. `list_leads` is read-only.
 *
 * Per `feedback_no_silent_vendor_lock.md`: BoldTrail REST calls only appear in
 * `client.ts`/`server.ts`. The skill layer sees the `BoldtrailMcpServer`
 * interface.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type BoldtrailMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface BoldTrailLeadSummary {
  id: string;
  name: string;
  /** Lead's primary email, when surfaced. null otherwise. */
  email: string | null;
  /** Pipeline stage label (e.g. "New", "Nurture", "Active"). */
  stage: string;
  /** Pipeline this lead sits in. null when detached. */
  pipelineId: string | null;
}

export interface ListLeadsInput {
  /** Free-text query against lead name / email. */
  query?: string;
  limit?: number;
}
export interface ListLeadsOutput {
  leads: BoldTrailLeadSummary[];
}

// ── Mutating action inputs/outputs ──────────────────────────────────────────

export interface UpdatePipelineInput {
  leadId: string;
  pipelineId: string;
  stage: string;
  /** Carried forward once an operator approves the action. */
  pendingApprovalId?: string;
}
export interface UpdatePipelineOutput {
  leadId: string;
  stage: string;
}

export interface SendTemplateInput {
  leadId: string;
  templateId: string;
  pendingApprovalId?: string;
}
export interface SendTemplateOutput {
  messageId: string;
}

// ── Interface every implementation honors ──────────────────────────────────

export interface BoldtrailMcpServer extends McpServerBase {
  // Read
  listLeads(input: ListLeadsInput): Promise<BoldtrailMcpResult<ListLeadsOutput>>;
  // Mutating — approval-gated
  updatePipeline(
    input: UpdatePipelineInput,
  ): Promise<BoldtrailMcpResult<UpdatePipelineOutput>>;
  sendTemplate(
    input: SendTemplateInput,
  ): Promise<BoldtrailMcpResult<SendTemplateOutput>>;
}

export const BOLDTRAIL_NAMESPACE = 'boldtrail';
