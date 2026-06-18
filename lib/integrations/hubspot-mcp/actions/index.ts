/**
 * lib/integrations/hubspot-mcp/actions/index.ts
 *
 * The HubSpot WRITE-ACTION surface — the per-action source of truth for the
 * mutating tools added in the write-action-depth wave. Each descriptor names
 * the action, its approval discipline, and a `summarize` that distills the
 * input into the canonical `detail` the approval gate fingerprints AND the
 * operator sees on the /approvals card.
 *
 * The actual REST is implemented on `ProdHubspotMcpServer` (server.ts); the
 * gate decorator (with-approval.ts) reads these descriptors so the action name
 * + detail used for the fingerprint and the audit row are defined in exactly
 * one place. Nothing here calls HubSpot — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: send_email_template and
 * send_sequence_enrollment are genuinely OUTBOUND (they reach a contact), so
 * the gate is load-bearing — neither fires without a recorded human approval.
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const HUBSPOT_CONNECTOR = 'hubspot';

// ── New write-action I/O types ───────────────────────────────────────────────

export interface CreateDealInput {
  dealName: string;
  /** Amount as a string (HubSpot stores deal amount as a string property). */
  amount?: string;
  pipeline?: string;
  dealStage?: string;
  /** ISO date. */
  closeDate?: string;
  /** Contact to associate the new deal with. */
  associatedContactId?: string;
  /** Approval token once the operator has approved this exact deal. */
  pendingApprovalId?: string;
}
export interface CreateDealOutput {
  dealId: string;
}

export interface UpdateDealStageInput {
  dealId: string;
  dealStage: string;
  pipeline?: string;
  pendingApprovalId?: string;
}
export interface UpdateDealStageOutput {
  dealId: string;
  dealStage: string;
}

export type HubspotActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING';
export interface LogActivityInput {
  objectType: 'contacts' | 'deals' | 'companies';
  objectId: string;
  activityType: HubspotActivityType;
  body: string;
  /** ISO timestamp; defaults to now. */
  timestamp?: string;
  pendingApprovalId?: string;
}
export interface LogActivityOutput {
  activityId: string;
  activityType: HubspotActivityType;
}

export interface CreateTaskInput {
  title: string;
  body?: string;
  /** ISO due date. */
  dueDate?: string;
  /** HubSpot owner id the task is assigned to. */
  ownerId?: string;
  associatedObjectType?: 'contacts' | 'deals' | 'companies';
  associatedObjectId?: string;
  pendingApprovalId?: string;
}
export interface CreateTaskOutput {
  taskId: string;
}

export interface SendEmailTemplateInput {
  /** Recipient contact. */
  contactId: string;
  recipientEmail: string;
  /** HubSpot transactional email (template) id. */
  emailId: string;
  /** Token-replacement values for the template's merge fields. */
  customProperties?: Record<string, string>;
  pendingApprovalId?: string;
}
export interface SendEmailTemplateOutput {
  /** HubSpot single-send statusId. */
  statusId: string;
}

export interface SendSequenceEnrollmentInput {
  contactId: string;
  sequenceId: string;
  /** The connected mailbox the sequence sends from. */
  senderEmail: string;
  pendingApprovalId?: string;
}
export interface SendSequenceEnrollmentOutput {
  enrollmentId: string;
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
export function hubspotAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: HUBSPOT_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const CREATE_DEAL: WriteActionDescriptor<CreateDealInput> = {
  action: 'create_deal',
  discipline: 'sales',
  summarize: (i) => ({
    dealName: i.dealName,
    amount: i.amount ?? null,
    pipeline: i.pipeline ?? null,
    dealStage: i.dealStage ?? null,
    closeDate: i.closeDate ?? null,
    associatedContactId: i.associatedContactId ?? null,
  }),
};

export const UPDATE_DEAL_STAGE: WriteActionDescriptor<UpdateDealStageInput> = {
  action: 'update_deal_stage',
  discipline: 'sales',
  summarize: (i) => ({ dealId: i.dealId, dealStage: i.dealStage, pipeline: i.pipeline ?? null }),
};

export const LOG_ACTIVITY: WriteActionDescriptor<LogActivityInput> = {
  action: 'log_activity',
  discipline: 'sales',
  summarize: (i) => ({
    objectType: i.objectType,
    objectId: i.objectId,
    activityType: i.activityType,
    body: i.body,
  }),
};

export const CREATE_TASK: WriteActionDescriptor<CreateTaskInput> = {
  action: 'create_task',
  discipline: 'sales',
  summarize: (i) => ({
    title: i.title,
    body: i.body ?? null,
    dueDate: i.dueDate ?? null,
    ownerId: i.ownerId ?? null,
    associatedObjectType: i.associatedObjectType ?? null,
    associatedObjectId: i.associatedObjectId ?? null,
  }),
};

export const SEND_EMAIL_TEMPLATE: WriteActionDescriptor<SendEmailTemplateInput> = {
  action: 'send_email_template',
  discipline: 'sales',
  summarize: (i) => ({
    contactId: i.contactId,
    recipientEmail: i.recipientEmail,
    emailId: i.emailId,
    customProperties: i.customProperties ?? null,
  }),
};

export const SEND_SEQUENCE_ENROLLMENT: WriteActionDescriptor<SendSequenceEnrollmentInput> = {
  action: 'send_sequence_enrollment',
  discipline: 'sales',
  summarize: (i) => ({
    contactId: i.contactId,
    sequenceId: i.sequenceId,
    senderEmail: i.senderEmail,
  }),
};
