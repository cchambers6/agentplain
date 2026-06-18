/**
 * lib/integrations/mycase-mcp/types.ts
 *
 * MyCase MCP server tool surface. One instance per `{workspaceId}` per request
 * (never reused across workspaces). Built on `lib/integrations/mcp-core` — the
 * vendor-neutral JSON-RPC envelope + result shapes — so the wire format
 * matches the shipped Gmail/Outlook/QuickBooks/Karbon/Clio servers.
 *
 * SCAFFOLD (2026-06-17): MyCase is `coming-soon` in the marketplace. The typed
 * surface, auth shape, tool registry, and dispatch route are wired; the
 * credential path opens when Conner enables the MyCase API and stores the
 * per-workspace API token. Until then read tools return CREDENTIAL_NOT_FOUND
 * and mutating tools return APPROVAL_REQUIRED.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this surface covers
 * the real small-law-firm value loop — list cases, open a case, send a client
 * invoice, and update a case's status. The law-intake-conflict-screen skill
 * reads cases to screen a new intake; the billing surface sends invoices.
 *
 * Per `project_no_outbound_architecture.md`: `create_case`, `send_invoice`,
 * and `update_status` are MUTATING — every one funnels through the approval
 * seam (`mcp-core/approval.ts`) and never fires from an autonomous run without
 * a recorded human approval. `list_cases` is read-only.
 *
 * Per `feedback_no_silent_vendor_lock.md`: MyCase REST calls only appear in
 * `client.ts`/`server.ts`. The skill layer sees the `MyCaseMcpServer` interface.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type MyCaseMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface MyCaseCaseSummary {
  id: string;
  /** Case display name. */
  name: string;
  /** MyCase case status — open / pending / closed. */
  status: 'open' | 'pending' | 'closed';
  /** Client (contact) id this case belongs to. null when detached. */
  clientId: string | null;
  /** Lead attorney email, when surfaced. null otherwise. */
  leadAttorneyEmail: string | null;
}

export interface ListCasesInput {
  /** Free-text query against case name. */
  query?: string;
  status?: MyCaseCaseSummary['status'];
  limit?: number;
}
export interface ListCasesOutput {
  cases: MyCaseCaseSummary[];
}

// ── Mutating action inputs/outputs ──────────────────────────────────────────

export interface CreateCaseInput {
  /** Existing MyCase contact id the case is opened for. */
  clientId: string;
  name: string;
  /** Optional practice area / case type label. */
  practiceArea?: string;
  /** Carried forward once an operator approves the action. */
  pendingApprovalId?: string;
}
export interface CreateCaseOutput {
  caseId: string;
}

export interface SendInvoiceInput {
  caseId: string;
  /** Invoice amount in dollars. Defaults to the case's outstanding balance. */
  amount?: number;
  pendingApprovalId?: string;
}
export interface SendInvoiceOutput {
  invoiceId: string;
}

export interface UpdateStatusInput {
  caseId: string;
  status: MyCaseCaseSummary['status'];
  pendingApprovalId?: string;
}
export interface UpdateStatusOutput {
  caseId: string;
  status: string;
}

// ── Interface every implementation honors ──────────────────────────────────

export interface MyCaseMcpServer extends McpServerBase {
  // Read
  listCases(input: ListCasesInput): Promise<MyCaseMcpResult<ListCasesOutput>>;
  // Mutating — approval-gated
  createCase(input: CreateCaseInput): Promise<MyCaseMcpResult<CreateCaseOutput>>;
  sendInvoice(input: SendInvoiceInput): Promise<MyCaseMcpResult<SendInvoiceOutput>>;
  updateStatus(input: UpdateStatusInput): Promise<MyCaseMcpResult<UpdateStatusOutput>>;
}

export const MYCASE_NAMESPACE = 'mycase';
