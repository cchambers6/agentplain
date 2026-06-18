/**
 * lib/integrations/follow-up-boss-mcp/actions/index.ts
 *
 * The Follow Up Boss WRITE-ACTION surface — the per-action source of truth for
 * the mutating tools added in the write-action-depth wave. Each descriptor
 * names the action, its approval discipline (`sales` — these are CRM/outbound
 * writes), and a `summarize` that distills the input into the canonical
 * `detail` the approval gate fingerprints AND the operator sees on the
 * /approvals card.
 *
 * The actual REST is implemented on `ProdFollowUpBossMcpServer` (server.ts); the
 * gate decorator (with-approval.ts) reads these descriptors so the action name
 * + detail used for the fingerprint and the audit row are defined in exactly
 * one place. Nothing here calls FUB — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: `send_text_template` is genuinely
 * OUTBOUND (it reaches a lead), so the gate is load-bearing — it never fires
 * without a recorded human approval. `create_lead` and `schedule_action_plan`
 * mutate the broker's own system of record and are likewise gated.
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const FOLLOW_UP_BOSS_CONNECTOR = 'follow_up_boss';

// ── New write-action I/O types ───────────────────────────────────────────────

export interface CreateLeadInput {
  /** Full name. If provided, takes precedence over firstName/lastName. */
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  /** Free-text lead source ("Zillow", "Open House", "Referral", etc.). */
  source?: string;
  /** Approval token once the operator has approved this exact lead. */
  pendingApprovalId?: string;
}
export interface CreateLeadOutput {
  leadId: string;
}

export interface SendTextTemplateInput {
  /** FUB person id the text is sent to. OUTBOUND. */
  personId: string;
  /** FUB text-message template id. */
  templateId: string;
  /** Optional override / merged message body. */
  message?: string;
  pendingApprovalId?: string;
}
export interface SendTextTemplateOutput {
  messageId: string;
}

export interface ScheduleActionPlanInput {
  /** FUB person id the action plan is assigned to. */
  personId: string;
  /** FUB action-plan id to apply. */
  actionPlanId: string;
  pendingApprovalId?: string;
}
export interface ScheduleActionPlanOutput {
  actionPlanPersonId: string;
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
export function fubAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: FOLLOW_UP_BOSS_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const CREATE_LEAD: WriteActionDescriptor<CreateLeadInput> = {
  action: 'create_lead',
  discipline: 'sales',
  summarize: (i) => ({
    name: i.name ?? null,
    firstName: i.firstName ?? null,
    lastName: i.lastName ?? null,
    email: i.email ?? null,
    phone: i.phone ?? null,
    source: i.source ?? null,
  }),
};

export const SEND_TEXT_TEMPLATE: WriteActionDescriptor<SendTextTemplateInput> = {
  action: 'send_text_template',
  discipline: 'sales',
  summarize: (i) => ({
    personId: i.personId,
    templateId: i.templateId,
    message: i.message ?? null,
  }),
};

export const SCHEDULE_ACTION_PLAN: WriteActionDescriptor<ScheduleActionPlanInput> = {
  action: 'schedule_action_plan',
  discipline: 'sales',
  summarize: (i) => ({
    personId: i.personId,
    actionPlanId: i.actionPlanId,
  }),
};
