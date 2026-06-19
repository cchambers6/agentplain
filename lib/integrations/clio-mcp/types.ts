/**
 * lib/integrations/clio-mcp/types.ts
 *
 * Clio MCP server tool surface. One instance per `{workspaceId}` per request
 * (never reused across workspaces). Built on `lib/integrations/mcp-core` — the
 * vendor-neutral JSON-RPC envelope + result shapes — so the wire format
 * matches the shipped Gmail/Outlook/QuickBooks/Karbon servers.
 *
 * SCAFFOLD (2026-06-17): Clio is `coming-soon` in the marketplace. The typed
 * surface, auth shape, tool registry, and dispatch route are wired; the
 * credential path opens when Conner registers the OAuth app
 * (app.clio.com/api/v4/documentation) and sets CLIO_OAUTH_CLIENT_ID/SECRET.
 * Until then read tools return CREDENTIAL_NOT_FOUND and mutating tools return
 * APPROVAL_REQUIRED.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this surface covers
 * the real small-law-firm value loop — list matters (Clio's name for cases),
 * open a matter, log time against it, raise a bill, and send a secure client
 * message. The law-intake-conflict-screen skill reads matters + contacts to
 * screen a new intake; the billing surface raises bills + logs time.
 *
 * Per `project_no_outbound_architecture.md`: `create_matter`, `log_time`,
 * `create_bill`, and `send_secure_message` are MUTATING — every one funnels
 * through the approval seam (`mcp-core/approval.ts`) and never fires from an
 * autonomous run without a recorded human approval. `list_matters` is read-only.
 *
 * Per `feedback_no_silent_vendor_lock.md`: Clio REST calls only appear in
 * `client.ts`/`server.ts`. The skill layer sees the `ClioMcpServer` interface.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type ClioMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface ClioMatterSummary {
  id: string;
  /** Matter display number / reference (e.g. "00123-Smith"). */
  displayNumber: string;
  description: string;
  /** Clio matter status — open / pending / closed. */
  status: 'open' | 'pending' | 'closed';
  /** Responsible attorney email, when surfaced. null otherwise. */
  responsibleAttorneyEmail: string | null;
  /** Client (contact) id this matter belongs to. null when detached. */
  clientId: string | null;
}

export interface ListMattersInput {
  /** Free-text query against matter description / display number. */
  query?: string;
  status?: ClioMatterSummary['status'];
  limit?: number;
}
export interface ListMattersOutput {
  matters: ClioMatterSummary[];
}

// ── Mutating action inputs/outputs ──────────────────────────────────────────

export interface CreateMatterInput {
  /** Existing Clio contact id the matter is opened for. */
  clientId: string;
  description: string;
  /** Optional practice area / matter type label. */
  practiceArea?: string;
  /** Carried forward once an operator approves the action. */
  pendingApprovalId?: string;
}
export interface CreateMatterOutput {
  matterId: string;
  displayNumber: string;
}

export interface LogTimeInput {
  matterId: string;
  /** Duration in minutes. */
  minutes: number;
  description: string;
  /** Activity date (ISO yyyy-mm-dd). Defaults to today on the Clio side. */
  date?: string;
  pendingApprovalId?: string;
}
export interface LogTimeOutput {
  activityId: string;
}

export interface CreateBillInput {
  matterId: string;
  /** Bill issue date (ISO yyyy-mm-dd). */
  issueDate?: string;
  pendingApprovalId?: string;
}
export interface CreateBillOutput {
  billId: string;
  total: number | null;
}

export interface SendSecureMessageInput {
  matterId: string;
  /** Clio contact id of the recipient (a client on the matter). */
  recipientContactId: string;
  subject: string;
  body: string;
  pendingApprovalId?: string;
}
export interface SendSecureMessageOutput {
  messageId: string;
}

// ── Interface every implementation honors ──────────────────────────────────

export interface ClioMcpServer extends McpServerBase {
  // Read
  listMatters(input: ListMattersInput): Promise<ClioMcpResult<ListMattersOutput>>;
  // Mutating — approval-gated
  createMatter(input: CreateMatterInput): Promise<ClioMcpResult<CreateMatterOutput>>;
  logTime(input: LogTimeInput): Promise<ClioMcpResult<LogTimeOutput>>;
  createBill(input: CreateBillInput): Promise<ClioMcpResult<CreateBillOutput>>;
  sendSecureMessage(
    input: SendSecureMessageInput,
  ): Promise<ClioMcpResult<SendSecureMessageOutput>>;
}

export const CLIO_NAMESPACE = 'clio';
