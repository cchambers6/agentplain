-- Add five admin approval kinds for the office-admin skill.
-- See lib/skills/office-admin/ + app/(product)/app/workspace/[id]/approvals/.
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'ADMIN_VERIFICATION_CODE';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'ADMIN_PASSWORD_RESET';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'ADMIN_TRIAL_ENDING';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'ADMIN_BILLING_NOTICE';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'ADMIN_SECURITY_ALERT';
