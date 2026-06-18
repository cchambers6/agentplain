/**
 * lib/integrations/buildium-mcp/actions/index.ts
 *
 * The Buildium WRITE-ACTION surface — the per-action source of truth for the
 * mutating tools added in the write-action-depth wave. Each descriptor names
 * the action, its approval discipline (`operations` — property ops), and a
 * `summarize` that distills the input into the canonical `detail` the approval
 * gate fingerprints AND the operator sees on the /approvals card.
 *
 * The actual REST is implemented on `ProdBuildiumMcpServer` (server.ts); the
 * gate decorator (with-approval.ts) reads these descriptors so the action name
 * + detail used for the fingerprint and the audit row are defined in exactly
 * one place. Nothing here calls Buildium — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: `charge_late_fee` posts money to a
 * lease ledger and `send_tenant_msg` reaches a tenant — both are genuinely
 * OUTBOUND, so the gate is load-bearing: neither fires without a recorded human
 * approval. `create_work_order` and `post_notice` mutate Buildium's records and
 * are gated identically.
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const BUILDIUM_CONNECTOR = 'buildium';

// ── New write-action I/O types ───────────────────────────────────────────────

export interface CreateWorkOrderInput {
  /** Buildium property the work order is for. */
  propertyId: string;
  /** Optional specific unit within the property. */
  unitId?: string;
  title: string;
  description: string;
  /** Buildium work-order priority. */
  priority?: 'Low' | 'Normal' | 'High';
  /** Approval token once the operator has approved this exact work order. */
  pendingApprovalId?: string;
}
export interface CreateWorkOrderOutput {
  workOrderId: string;
}

export interface ChargeLateFeeInput {
  /** Lease whose ledger the charge posts to. */
  leaseId: string;
  /** Charge amount in dollars. */
  amount: number;
  /** Optional memo line shown on the tenant's ledger. */
  memo?: string;
  pendingApprovalId?: string;
}
export interface ChargeLateFeeOutput {
  transactionId: string;
}

export interface PostNoticeInput {
  /** Lease the notice is posted against. */
  leaseId: string;
  subject: string;
  body: string;
  pendingApprovalId?: string;
}
export interface PostNoticeOutput {
  noticeId: string;
}

export interface SendTenantMsgInput {
  /** Buildium tenant (resident) the message is sent to. */
  tenantId: string;
  subject: string;
  body: string;
  pendingApprovalId?: string;
}
export interface SendTenantMsgOutput {
  messageId: string;
}

// ── Gate-facing descriptors ───────────────────────────────────────────────────

/**
 * A write-action descriptor. `summarize` builds the canonical, secret-free
 * `detail` used for BOTH the fingerprint and the operator's approval card.
 */
export interface WriteActionDescriptor<TInput> {
  action: string;
  discipline: string;
  summarize: (input: TInput) => Record<string, unknown>;
}

/** Build the `GatedAction` a decorator method passes to the gate. */
export function buildiumAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: BUILDIUM_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const CREATE_WORK_ORDER: WriteActionDescriptor<CreateWorkOrderInput> = {
  action: 'create_work_order',
  discipline: 'operations',
  summarize: (i) => ({
    propertyId: i.propertyId,
    unitId: i.unitId ?? null,
    title: i.title,
    description: i.description,
    priority: i.priority ?? null,
  }),
};

export const CHARGE_LATE_FEE: WriteActionDescriptor<ChargeLateFeeInput> = {
  action: 'charge_late_fee',
  discipline: 'operations',
  summarize: (i) => ({
    leaseId: i.leaseId,
    amount: i.amount,
    memo: i.memo ?? null,
  }),
};

export const POST_NOTICE: WriteActionDescriptor<PostNoticeInput> = {
  action: 'post_notice',
  discipline: 'operations',
  summarize: (i) => ({
    leaseId: i.leaseId,
    subject: i.subject,
    body: i.body,
  }),
};

export const SEND_TENANT_MSG: WriteActionDescriptor<SendTenantMsgInput> = {
  action: 'send_tenant_msg',
  discipline: 'operations',
  summarize: (i) => ({
    tenantId: i.tenantId,
    subject: i.subject,
    body: i.body,
  }),
};
