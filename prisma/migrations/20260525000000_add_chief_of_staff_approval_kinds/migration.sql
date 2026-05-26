-- Add three chief-of-staff scheduler approval kinds for the proposals the
-- skill emits (meeting candidate slots, reply drafts, to-dos). Each kind
-- maps to its own renderer in app/(product)/app/workspace/[id]/approvals.
-- The skill is draft-only by contract — see lib/skills/chief-of-staff-
-- scheduler + project_no_outbound_architecture.md.
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'CHIEF_OF_STAFF_MEETING';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'CHIEF_OF_STAFF_REPLY_DRAFT';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'CHIEF_OF_STAFF_TODO';
