-- Add three /general runtime approval kinds matching the three cross-role
-- skills (inbox triage, follow-up nudge, process-doc drafter). Each kind
-- maps one production caller to the approvals UI affordance the operator
-- reviews. All three skills are draft-only by contract — see lib/skills/
-- {inbox-triage-general,follow-up-chaser-general,process-doc-drafter-
-- general} + project_no_outbound_architecture.md.
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'INBOX_TRIAGE';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_NUDGE';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'PROCESS_DOC_DRAFT';
