/**
 * lib/integrations/salesforce-mcp/actions/index.ts
 *
 * The Salesforce WRITE-ACTION surface — the per-action source of truth for the
 * mutating tools added in the write-action-depth wave. Each descriptor names
 * the action, its approval discipline, and a `summarize` that distills the
 * input into the canonical `detail` the approval gate fingerprints AND the
 * operator sees on the /approvals card.
 *
 * The actual REST is implemented on `ProdSalesforceMcpServer` (server.ts); the
 * gate decorator (with-approval.ts) reads these descriptors so the action name
 * + detail used for the fingerprint and the audit row are defined in exactly
 * one place. Nothing here calls Salesforce — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: send_email_template is genuinely
 * OUTBOUND (it reaches a recipient), so the gate is load-bearing — it never
 * fires without a recorded human approval.
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const SALESFORCE_CONNECTOR = 'salesforce';

// ── New write-action I/O types ───────────────────────────────────────────────

export interface CreateOpportunityInput {
  name: string;
  stageName: string;
  /** ISO close date (Salesforce CloseDate, YYYY-MM-DD). */
  closeDate: string;
  /** Amount as a number (Salesforce stores Opportunity.Amount as currency). */
  amount?: number;
  accountId?: string;
  /** Approval token once the operator has approved this exact opportunity. */
  pendingApprovalId?: string;
}
export interface CreateOpportunityOutput {
  opportunityId: string;
}

export interface UpdateRecordInput {
  /** Arbitrary sObject API name (e.g. "Lead", "Contact", "Opportunity"). */
  sobjectType: string;
  recordId: string;
  fields: Record<string, string>;
  pendingApprovalId?: string;
}
export interface UpdateRecordOutput {
  recordId: string;
}

export interface SendEmailTemplateInput {
  recipientEmail: string;
  /** Salesforce EmailTemplate id. */
  templateId: string;
  /** Optional target object (Lead/Contact) the merge fields resolve against. */
  targetObjectId?: string;
  pendingApprovalId?: string;
}
export interface SendEmailTemplateOutput {
  /** Salesforce email action status id when returned; otherwise queued. */
  statusId?: string;
  queued: boolean;
}

export interface LogCallInput {
  subject: string;
  description?: string;
  /** Salesforce id of the related Lead/Contact (WhoId). */
  whoId?: string;
  /** Salesforce id of the related Opportunity/Account (WhatId). */
  whatId?: string;
  pendingApprovalId?: string;
}
export interface LogCallOutput {
  taskId: string;
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
export function salesforceAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: SALESFORCE_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const CREATE_OPPORTUNITY: WriteActionDescriptor<CreateOpportunityInput> = {
  action: 'create_opportunity',
  discipline: 'sales',
  summarize: (i) => ({
    name: i.name,
    stageName: i.stageName,
    closeDate: i.closeDate,
    amount: i.amount ?? null,
    accountId: i.accountId ?? null,
  }),
};

export const UPDATE_RECORD: WriteActionDescriptor<UpdateRecordInput> = {
  action: 'update_record',
  discipline: 'sales',
  summarize: (i) => ({
    sobjectType: i.sobjectType,
    recordId: i.recordId,
    fields: i.fields,
  }),
};

export const SEND_EMAIL_TEMPLATE: WriteActionDescriptor<SendEmailTemplateInput> = {
  action: 'send_email_template',
  discipline: 'sales',
  summarize: (i) => ({
    recipientEmail: i.recipientEmail,
    templateId: i.templateId,
    targetObjectId: i.targetObjectId ?? null,
  }),
};

export const LOG_CALL: WriteActionDescriptor<LogCallInput> = {
  action: 'log_call',
  discipline: 'sales',
  summarize: (i) => ({
    subject: i.subject,
    description: i.description ?? null,
    whoId: i.whoId ?? null,
    whatId: i.whatId ?? null,
  }),
};

export const CREATE_TASK: WriteActionDescriptor<{
  whatId?: string;
  whoId?: string;
  subject: string;
  description?: string;
  status?: string;
  priority?: string;
  pendingApprovalId?: string;
}> = {
  action: 'create_task',
  discipline: 'sales',
  summarize: (i) => ({
    subject: i.subject,
    description: i.description ?? null,
    whoId: i.whoId ?? null,
    whatId: i.whatId ?? null,
    status: i.status ?? null,
    priority: i.priority ?? null,
  }),
};
