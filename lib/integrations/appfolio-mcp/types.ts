/**
 * lib/integrations/appfolio-mcp/types.ts
 *
 * AppFolio MCP server tool surface. One instance per `{workspaceId}` per request
 * (never reused across workspaces). Built on `lib/integrations/mcp-core` — the
 * vendor-neutral JSON-RPC envelope + result shapes — so the wire format
 * matches the shipped Gmail/Outlook/QuickBooks/Karbon servers.
 *
 * SCAFFOLD (2026-06-17): AppFolio is `coming-soon` in the marketplace. The typed
 * surface, auth shape, tool registry, and dispatch route are wired; the
 * credential path opens when Conner completes AppFolio's partner-program
 * approval (~2 month review) and a customer's client id + secret + subdomain
 * land. Until then read tools return CREDENTIAL_NOT_FOUND and mutating tools
 * return APPROVAL_REQUIRED.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this surface covers
 * the real small-property-manager value loop — list units (with occupancy),
 * open a maintenance work order, charge a tenant, and serve a notice. The PM
 * vertical skills read units to triage occupancy + maintenance.
 *
 * Per `project_no_outbound_architecture.md`: `create_work_order`,
 * `charge_tenant`, and `send_notice` are MUTATING — every one funnels through
 * the approval seam (`mcp-core/approval.ts`) and never fires from an autonomous
 * run without a recorded human approval. `list_units` is read-only.
 *
 * Per `feedback_no_silent_vendor_lock.md`: AppFolio REST calls only appear in
 * `client.ts`/`server.ts`. The skill layer sees the `AppfolioMcpServer`
 * interface.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type AppfolioMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface AppFolioUnitSummary {
  id: string;
  /** Unit street address / display label. */
  address: string;
  /** Property id this unit belongs to. null when detached. */
  propertyId: string | null;
  /** Occupancy state, normalized tolerantly from the AppFolio payload. */
  occupancy: 'occupied' | 'vacant' | 'unknown';
  /** Raw AppFolio unit status label, passed through. */
  status: string;
}

export interface ListUnitsInput {
  /** Filter to a single property's units. */
  propertyId?: string;
  limit?: number;
}
export interface ListUnitsOutput {
  units: AppFolioUnitSummary[];
}

// ── Mutating action inputs/outputs ──────────────────────────────────────────

export interface CreateWorkOrderInput {
  unitId: string;
  description: string;
  /** Optional priority label. */
  priority?: 'low' | 'normal' | 'high';
  /** Carried forward once an operator approves the action. */
  pendingApprovalId?: string;
}
export interface CreateWorkOrderOutput {
  workOrderId: string;
}

export interface ChargeTenantInput {
  unitId: string;
  /** Charge amount in dollars. */
  amount: number;
  memo?: string;
  pendingApprovalId?: string;
}
export interface ChargeTenantOutput {
  chargeId: string;
}

export interface SendNoticeInput {
  unitId: string;
  /** Notice type label (e.g. "late-rent", "lease-renewal"). */
  noticeType: string;
  body: string;
  pendingApprovalId?: string;
}
export interface SendNoticeOutput {
  noticeId: string;
}

// ── Interface every implementation honors ──────────────────────────────────

export interface AppfolioMcpServer extends McpServerBase {
  // Read
  listUnits(input: ListUnitsInput): Promise<AppfolioMcpResult<ListUnitsOutput>>;
  // Mutating — approval-gated
  createWorkOrder(
    input: CreateWorkOrderInput,
  ): Promise<AppfolioMcpResult<CreateWorkOrderOutput>>;
  chargeTenant(input: ChargeTenantInput): Promise<AppfolioMcpResult<ChargeTenantOutput>>;
  sendNotice(input: SendNoticeInput): Promise<AppfolioMcpResult<SendNoticeOutput>>;
}

export const APPFOLIO_NAMESPACE = 'appfolio';
