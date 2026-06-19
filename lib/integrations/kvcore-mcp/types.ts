/**
 * lib/integrations/kvcore-mcp/types.ts
 *
 * kvCORE MCP server tool surface. One instance per `{workspaceId}` per request
 * (never reused across workspaces). Built on `lib/integrations/mcp-core` — the
 * vendor-neutral JSON-RPC envelope + result shapes — so the wire format
 * matches the shipped Gmail/Outlook/QuickBooks/Karbon servers.
 *
 * SCAFFOLD (2026-06-17): kvCORE is `coming-soon` in the marketplace. The typed
 * surface, auth shape, tool registry, and dispatch route are wired; the
 * credential path opens when Conner enrolls in the kvCORE partner program and
 * sets the per-account API key (carried in `accessTokenEncrypted`, same pattern
 * as SIERRA / FOLLOW_UP_BOSS). Until then read tools return
 * CREDENTIAL_NOT_FOUND and mutating tools return APPROVAL_REQUIRED.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this surface covers
 * the real small-brokerage value loop — list leads, capture a new lead, blast a
 * mass message to a segment, and log an activity against a lead. The
 * lead-triage-realestate skill reads leads to triage new inquiries; the
 * follow-up surface queues mass messages + logs touchpoints.
 *
 * Per `project_no_outbound_architecture.md`: `create_lead`, `send_mass_message`,
 * and `log_activity` are MUTATING — every one funnels through the approval seam
 * (`mcp-core/approval.ts`) and never fires from an autonomous run without a
 * recorded human approval. `list_leads` is read-only.
 *
 * Per `feedback_no_silent_vendor_lock.md`: kvCORE REST calls only appear in
 * `client.ts`/`server.ts`. The skill layer sees the `KvcoreMcpServer` interface.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type KvcoreMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface KvcoreLeadSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** kvCORE lead status — free-text pipeline label. */
  status: string;
  /** Lead source ("Zillow", "IDX", "Facebook"...). null when unset. */
  source: string | null;
}

export interface ListLeadsInput {
  /** Free-text query against lead name / email. */
  query?: string;
  limit?: number;
}
export interface ListLeadsOutput {
  leads: KvcoreLeadSummary[];
}

// ── Mutating action inputs/outputs ──────────────────────────────────────────

export interface CreateLeadInput {
  name: string;
  email?: string;
  phone?: string;
  /** Optional lead source label. */
  source?: string;
  /** Carried forward once an operator approves the action. */
  pendingApprovalId?: string;
}
export interface CreateLeadOutput {
  leadId: string;
}

export interface SendMassMessageInput {
  /** kvCORE lead ids the message is queued for. */
  leadIds: string[];
  message: string;
  pendingApprovalId?: string;
}
export interface SendMassMessageOutput {
  queuedCount: number;
}

export interface LogActivityInput {
  leadId: string;
  note: string;
  pendingApprovalId?: string;
}
export interface LogActivityOutput {
  activityId: string;
}

// ── Interface every implementation honors ──────────────────────────────────

export interface KvcoreMcpServer extends McpServerBase {
  // Read
  listLeads(input: ListLeadsInput): Promise<KvcoreMcpResult<ListLeadsOutput>>;
  // Mutating — approval-gated
  createLead(input: CreateLeadInput): Promise<KvcoreMcpResult<CreateLeadOutput>>;
  sendMassMessage(
    input: SendMassMessageInput,
  ): Promise<KvcoreMcpResult<SendMassMessageOutput>>;
  logActivity(input: LogActivityInput): Promise<KvcoreMcpResult<LogActivityOutput>>;
}

export const KVCORE_NAMESPACE = 'kvcore';
