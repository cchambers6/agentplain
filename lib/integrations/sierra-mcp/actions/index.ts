/**
 * lib/integrations/sierra-mcp/actions/index.ts
 *
 * The Sierra Interactive WRITE-ACTION surface — the per-action source of truth
 * for the mutating tools added in the write-action-depth wave. Each descriptor
 * names the action, its approval discipline, and a `summarize` that distills the
 * input into the canonical `detail` the approval gate fingerprints AND the
 * operator sees on the /approvals card.
 *
 * The actual REST is implemented on `ProdSierraMcpServer` (server.ts); the gate
 * decorator (with-approval.ts) reads these descriptors so the action name +
 * detail used for the fingerprint and the audit row are defined in exactly one
 * place. Nothing here calls Sierra — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: `send_drip` is genuinely OUTBOUND
 * (it enrolls a contact into a drip campaign that reaches them), so the gate is
 * load-bearing — it never fires without a recorded human approval.
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const SIERRA_CONNECTOR = 'sierra';

// ── New write-action I/O types ───────────────────────────────────────────────

export interface CreateContactInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  /** Free-text lead source ("Zillow", "IDX", "Referral"...). */
  source?: string;
  /** Approval token once the operator has approved this exact contact. */
  pendingApprovalId?: string;
}
export interface CreateContactOutput {
  contactId: string;
}

export interface SendDripInput {
  contactId: string;
  campaignId: string;
  pendingApprovalId?: string;
}
export interface SendDripOutput {
  enrollmentId: string;
}

export interface UpdateStatusInput {
  leadId: string;
  status: string;
  pendingApprovalId?: string;
}
export interface UpdateStatusOutput {
  leadId: string;
  status: string;
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
export function sierraAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: SIERRA_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const CREATE_CONTACT: WriteActionDescriptor<CreateContactInput> = {
  action: 'create_contact',
  discipline: 'sales',
  summarize: (i) => ({
    firstName: i.firstName,
    lastName: i.lastName,
    email: i.email ?? null,
    phone: i.phone ?? null,
    source: i.source ?? null,
  }),
};

export const SEND_DRIP: WriteActionDescriptor<SendDripInput> = {
  action: 'send_drip',
  discipline: 'sales',
  summarize: (i) => ({ contactId: i.contactId, campaignId: i.campaignId }),
};

export const UPDATE_STATUS: WriteActionDescriptor<UpdateStatusInput> = {
  action: 'update_status',
  discipline: 'sales',
  summarize: (i) => ({ leadId: i.leadId, status: i.status }),
};
