-- Wave-3 discipline-wrap WorkApprovalKind values.
--
-- Each value maps one production caller (an Inngest cron OR the
-- instruction-handler) to a discipline-tagged approval queue row the
-- operator reviews on /approvals. Closes the four NOT-DELIVERING
-- disciplines from `docs/fleet-autonomy-audit-2026-05-28.md` §10.
--
--   ANALYTICS_PULSE   — weekly Monday read by lib/skills/analytics-
--                       weekly-pulse-general (analytics discipline).
--   RESEARCH_BRIEF    — drafted by lib/skills/research-on-demand-general
--                       when the dispatcher tags an instruction as
--                       targetDiscipline='research'. Substrate-grounded
--                       with the no-web-search gap named honestly.
--   CONTENT_CALENDAR  — weekly Monday content suggestions composed by
--                       lib/skills/content-calendar-drafter-general
--                       under the marketing discipline.
--   COMPLIANCE_DIGEST — daily sweep by lib/skills/compliance-watch-general
--                       flagging high-risk patterns (PII + sentinel
--                       corpus matches) in last 24h of approval drafts.
--                       Legal discipline.
--
-- All four kinds are DRAFT-only per project_no_outbound_architecture.md;
-- agentplain never sends, posts, or executes — the operator decides
-- what to do with each row.
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'ANALYTICS_PULSE';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'RESEARCH_BRIEF';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'CONTENT_CALENDAR';
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'COMPLIANCE_DIGEST';
