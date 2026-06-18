/**
 * lib/integrations/gmail-mcp/actions/index.ts
 *
 * The Gmail WRITE-ACTION surface — the per-action source of truth for the
 * mutating tools added in the write-action-depth wave. Each descriptor names
 * the action, its approval discipline, and a `summarize` that distills the
 * input into the canonical `detail` the approval gate fingerprints AND the
 * operator sees on the /approvals card.
 *
 * The actual Gmail REST is implemented on `ProdGmailMcpServer` (server.ts);
 * the gate decorator (with-approval.ts) reads these descriptors so the action
 * name + detail used for the fingerprint and the audit row are defined in
 * exactly one place. Nothing here calls Gmail — it's the gate-facing metadata.
 *
 * Mirrors `lib/integrations/hubspot-mcp/actions/index.ts` exactly; only the
 * connector string + the per-action I/O types differ.
 *
 * Per `project_no_outbound_architecture.md`: `compose_from_template` and
 * `schedule_send` are genuinely OUTBOUND (a message ultimately reaches a
 * recipient), so the gate is load-bearing — neither fires without a recorded
 * human approval. This is exactly why these methods route through the gate.
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const GMAIL_CONNECTOR = 'gmail';

// ── New write-action I/O types ───────────────────────────────────────────────

export interface ComposeFromTemplateInput {
  /** Recipient address(es). One or more; joined with `,` on send. */
  to: string[];
  /** The customer-defined template id to render. */
  templateId: string;
  /** Token-replacement values for the template's merge fields. */
  variables?: Record<string, string>;
  /** Approval token once the operator has approved this exact send. */
  pendingApprovalId?: string;
}
export interface ComposeFromTemplateOutput {
  /** Provider message id of the sent message. */
  messageId: string;
  /** Thread the sent message landed on, when known. */
  threadId?: string;
}

export interface ScheduleSendInput {
  to: string[];
  subject: string;
  body: string;
  /** ISO 8601 timestamp the customer's scheduler dispatches the draft at. */
  sendAt: string;
  pendingApprovalId?: string;
}
export interface ScheduleSendOutput {
  /** The id the customer's scheduler dispatches at `sendAt`. */
  scheduledId: string;
}

export interface ArchiveInput {
  messageId: string;
  pendingApprovalId?: string;
}
export interface ArchiveOutput {
  messageId: string;
  archived: true;
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
export function gmailAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: GMAIL_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const COMPOSE_FROM_TEMPLATE: WriteActionDescriptor<ComposeFromTemplateInput> = {
  action: 'compose_from_template',
  discipline: 'general',
  summarize: (i) => ({
    to: [...i.to],
    templateId: i.templateId,
    variables: i.variables ?? null,
  }),
};

export const SCHEDULE_SEND: WriteActionDescriptor<ScheduleSendInput> = {
  action: 'schedule_send',
  discipline: 'general',
  summarize: (i) => ({
    to: [...i.to],
    subject: i.subject,
    body: i.body,
    sendAt: i.sendAt,
  }),
};

export const ARCHIVE: WriteActionDescriptor<ArchiveInput> = {
  action: 'archive',
  discipline: 'general',
  summarize: (i) => ({ messageId: i.messageId }),
};
