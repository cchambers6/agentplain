-- Support-handler approval kind. Drafts produced by lib/skills/support-handler
-- in response to a SupportRequest land in WorkApprovalQueueItem with this
-- kind so the discipline-grouped /approvals page renders the drafted reply
-- under customer-success for the operator to approve / edit / escalate.
--
-- Draft-only by contract — agentplain never sends the reply. The operator
-- approves; the customer's existing email path performs the send. See
-- lib/skills/support-handler + project_no_outbound_architecture.md.
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'SUPPORT_HANDLER_REPLY_DRAFT';
