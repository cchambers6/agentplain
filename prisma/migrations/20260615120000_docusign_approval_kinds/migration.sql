-- DocuSign approval gate. Adds the two MUTATING approval kinds the DocuSign
-- MCP server's approval gate writes (lib/integrations/docusign-mcp/
-- with-approval.ts): send an envelope for signature, or void an in-flight one.
-- Per project_no_outbound_architecture.md, neither fires from an autonomous
-- agent run — a PENDING row lands here, the operator approves on /approvals,
-- and only the next attempt carrying that approval id reaches the customer's
-- DocuSign account. Always human-decided; never auto-approved.
--
-- Additive enum values only — representable in schema.prisma, so no
-- schema-drift-baseline entry is needed (cf. raw-SQL index migrations).
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'DOCUSIGN_SEND_ENVELOPE';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'DOCUSIGN_VOID_ENVELOPE';
