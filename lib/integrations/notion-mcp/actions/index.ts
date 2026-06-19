/**
 * lib/integrations/notion-mcp/actions/index.ts
 *
 * The Notion WRITE-ACTION surface — the per-action source of truth for the
 * mutating tools gated by the connector approval gate. Each descriptor names
 * the action, its approval discipline, and a `summarize` that distills the
 * input into the canonical `detail` the approval gate fingerprints AND the
 * operator sees on the /approvals card.
 *
 * The actual REST is implemented on `ProdNotionMcpServer` (server.ts); the gate
 * decorator (with-approval.ts) reads these descriptors so the action name +
 * detail used for the fingerprint and the audit row are defined in exactly one
 * place. Nothing here calls Notion — it's the gate-facing metadata.
 *
 * Per `project_no_outbound_architecture.md`: every Notion write (create a page,
 * update/append/archive a page, add a comment) mutates the customer's own
 * Notion. The gate makes the human approval impossible to skip — no write
 * reaches Notion without a recorded grant.
 */

import type { GatedAction } from '@/lib/integrations/approval';

export const NOTION_CONNECTOR = 'notion';

// ── New write-action I/O types ───────────────────────────────────────────────

export interface AddCommentInput {
  /** Page (or block) the comment is attached to. */
  pageId: string;
  /** Plain-text comment body. */
  body: string;
  /** Approval token once the operator has approved this exact comment. */
  pendingApprovalId?: string;
}
export interface AddCommentOutput {
  commentId: string;
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
export function notionAction<TInput extends { pendingApprovalId?: string }>(
  descriptor: WriteActionDescriptor<TInput>,
  input: TInput,
): GatedAction {
  return {
    connector: NOTION_CONNECTOR,
    action: descriptor.action,
    pendingApprovalId: input.pendingApprovalId,
    discipline: descriptor.discipline,
    detail: descriptor.summarize(input),
  };
}

export const ADD_COMMENT: WriteActionDescriptor<AddCommentInput> = {
  action: 'add_comment',
  discipline: 'operations',
  summarize: (i) => ({ pageId: i.pageId, body: i.body }),
};
