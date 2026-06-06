-- Support draft-into-review handler — resolution schema.
-- (feat/support-draft-into-review-handler-2026-06-03, Stream A.3 + D.4)
--
-- The support-handler fleet already drafts a first-touch reply into the
-- operator approval queue (kind=SUPPORT_HANDLER_REPLY_DRAFT) when a
-- customer submits from /help. This migration adds the operator-side
-- *resolution* surface so an approved reply can be sent and the request
-- closed out with an audit-grade who/when stamp.
--
-- Two new SupportRequestStatus values:
--   IN_REVIEW — a fleet draft is PENDING in the approval queue (set by
--               lib/inngest/functions/support-handler-on-create once the
--               draft is sunk).
--   ARCHIVED  — operator filed the request away without a reply (spam /
--               duplicate / non-actionable). Kept distinct from RESOLVED
--               so analytics can separate "answered" from "dismissed".
--
-- Two new SupportRequest columns:
--   resolvedAt — when an approved reply was sent (status → RESOLVED).
--   resolvedBy — operator User.id who approved + sent it (plain uuid,
--                mirroring the audit-actor convention).
--
-- Neon is PostgreSQL 16, which permits ALTER TYPE ... ADD VALUE inside the
-- migration transaction. The new values are NOT referenced by any DML in
-- this file, so the same-transaction-use restriction does not apply.

ALTER TYPE "SupportRequestStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW' BEFORE 'OPEN';
ALTER TYPE "SupportRequestStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TABLE "SupportRequest"
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedBy" UUID;
