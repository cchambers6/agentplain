-- feat(data-minimization) — chat retention controls.
-- (feat/data-minimization-ephemeral-pass-through-2026-06-18)
--
-- Two nullable INTEGER columns drive the OPT-IN chat auto-purge in
-- lib/plaino/chat-retention.ts. Chat is kept for the LIFE OF THE ACCOUNT by
-- default; these let a privacy-conscious customer opt into auto-purge:
--
--   WorkspacePreference.chatRetentionDays — workspace-wide opt-in auto-purge
--     window in days. NULL = keep for the account lifetime (the default).
--
--   ChatThread.retentionDays — per-thread override. NULL = inherit the
--     workspace setting (which itself defaults to lifetime).
--
-- Both nullable with NO default, so the backfill is a no-op: every existing
-- thread/workspace keeps NULL and is therefore kept for the account lifetime
-- (never auto-deleted). The daily conversation-cleanup cron only deletes
-- threads where the customer set a finite window. Plain Prisma-modeled columns
-- (not raw-SQL indexes), so they create no schema-drift-baseline entry.

-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN "retentionDays" INTEGER;

-- AlterTable
ALTER TABLE "WorkspacePreference" ADD COLUMN "chatRetentionDays" INTEGER;
