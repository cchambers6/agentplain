/**
 * lib/integrations/buildium-mcp/with-approval.ts
 *
 * The Buildium approval gate — the connector-specific decorator that forces
 * EVERY mutating Buildium method through the shared connector approval gate
 * (`lib/integrations/approval`) before the REST API is touched. Mirrors
 * `hubspot-mcp/with-approval.ts`, built on the generic gate so the connectors
 * share one fingerprint/persistence/audit core.
 *
 * Read methods (`listDelinquentLeases`, `healthCheck`) pass straight through.
 * The four write-action-depth additions — create_work_order, charge_late_fee
 * (OUTBOUND money), post_notice, send_tenant_msg (OUTBOUND) — are intercepted:
 * a missing/invalid/expired grant returns APPROVAL_REQUIRED and the Buildium
 * call never happens; a valid grant lets the call run and is audit-logged.
 *
 * Installed at the factory seam (`buildBuildiumMcpServer`), so an ungated
 * Buildium server cannot be obtained.
 */

import type { McpResult } from '@/lib/integrations/mcp-core';
import {
  gateAndRun,
  type ConnectorApprovalDeps,
  type GatedAction,
} from '@/lib/integrations/approval';
import type {
  BuildiumHealth,
  BuildiumMcpServer,
  ListDelinquentLeasesInput,
  ListDelinquentLeasesOutput,
} from './types';
import {
  CREATE_WORK_ORDER,
  CHARGE_LATE_FEE,
  POST_NOTICE,
  SEND_TENANT_MSG,
  buildiumAction,
  type CreateWorkOrderInput,
  type CreateWorkOrderOutput,
  type ChargeLateFeeInput,
  type ChargeLateFeeOutput,
  type PostNoticeInput,
  type PostNoticeOutput,
  type SendTenantMsgInput,
  type SendTenantMsgOutput,
  type WriteActionDescriptor,
} from './actions';

/** Wrap a Buildium server so all mutating methods require an approved grant. */
export function withBuildiumApproval(
  inner: BuildiumMcpServer,
  deps: ConnectorApprovalDeps,
): BuildiumMcpServer {
  return new GatedBuildiumMcpServer(inner, deps);
}

class GatedBuildiumMcpServer implements BuildiumMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  constructor(
    private readonly inner: BuildiumMcpServer,
    private readonly deps: ConnectorApprovalDeps,
  ) {
    this.name = inner.name;
    this.workspaceId = inner.workspaceId;
  }

  private gate<T>(action: GatedAction, execute: () => Promise<McpResult<T>>) {
    return gateAndRun({
      gate: this.deps.gate,
      audit: this.deps.audit,
      workspaceId: this.workspaceId,
      action,
      execute,
    });
  }

  // ── Reads: straight pass-through ───────────────────────────────────────

  listDelinquentLeases(
    input?: ListDelinquentLeasesInput,
  ): Promise<McpResult<ListDelinquentLeasesOutput>> {
    return this.inner.listDelinquentLeases(input);
  }

  healthCheck(): Promise<BuildiumHealth> {
    return this.inner.healthCheck();
  }

  // ── Write-action-depth mutations ───────────────────────────────────────

  createWorkOrder(
    input: CreateWorkOrderInput,
  ): Promise<McpResult<CreateWorkOrderOutput>> {
    return this.gate(buildiumAction(CREATE_WORK_ORDER, input), () =>
      this.inner.createWorkOrder(input),
    );
  }
  chargeLateFee(input: ChargeLateFeeInput): Promise<McpResult<ChargeLateFeeOutput>> {
    return this.gate(buildiumAction(CHARGE_LATE_FEE, input), () =>
      this.inner.chargeLateFee(input),
    );
  }
  postNotice(input: PostNoticeInput): Promise<McpResult<PostNoticeOutput>> {
    return this.gate(buildiumAction(POST_NOTICE, input), () =>
      this.inner.postNotice(input),
    );
  }
  sendTenantMsg(input: SendTenantMsgInput): Promise<McpResult<SendTenantMsgOutput>> {
    return this.gate(buildiumAction(SEND_TENANT_MSG, input), () =>
      this.inner.sendTenantMsg(input),
    );
  }
}

// Re-export for symmetry with other connectors' approval modules.
export type { WriteActionDescriptor };
