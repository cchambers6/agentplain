-- Wave-4 phase 1 — closes the 8th discipline (finance) by giving every
-- workspace a weekly finance pulse, not just the per-vertical
-- invoice-chasing-realestate + month-end-close-cpa skills. The new
-- FINANCE_PULSE approval kind backs `lib/skills/finance-pulse-general`
-- + the Monday 13:05 UTC cron at
-- `lib/inngest/functions/finance-pulse-sweep.ts`.
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'FINANCE_PULSE';
