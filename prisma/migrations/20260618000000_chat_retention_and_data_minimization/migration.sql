-- feat(data-minimization) — chat retention controls.
-- (feat/data-minimization-ephemeral-pass-through-2026-06-18)
--
-- Two nullable INTEGER columns drive the chat-retention policy in
-- lib/plaino/chat-retention.ts:
--
--   WorkspacePreference.chatRetentionDays — workspace-wide, customer-set
--     opt-in retention window in days. NULL = the session-scoped default
--     (2 days). The owner raises it on /settings/data/storage, clamped to
--     the workspace's per-tier ceiling.
--
--   ChatThread.retentionDays — per-thread override (e.g. a pinned reference
--     thread). NULL = inherit the workspace setting. Also tier-clamped.
--
-- Both nullable with NO default, so the backfill is a no-op: every existing
-- thread/workspace keeps NULL and therefore inherits the session-scoped
-- default. The daily conversation-cleanup cron reads these to decide which
-- threads have aged out. Plain Prisma-modeled columns (not raw-SQL indexes),
-- so they create no schema-drift-baseline entry.

-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN "retentionDays" INTEGER;

-- AlterTable
ALTER TABLE "WorkspacePreference" ADD COLUMN "chatRetentionDays" INTEGER;
