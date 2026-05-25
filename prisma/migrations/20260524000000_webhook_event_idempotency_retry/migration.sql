-- agentplain — WebhookEvent idempotency + retry control
--
-- The inbound receivers (/api/webhooks/google, /api/webhooks/microsoft)
-- previously inserted a new WebhookEvent row on every notification, even
-- when Pub/Sub or Microsoft Graph re-delivered the same event under
-- their at-least-once contract. The drain consumer's only retry signal
-- was the `error` column — no attempt count, no backoff, no deadletter.
--
-- This migration adds:
--   * `dedupeKey` — provider-derived idempotency key. UNIQUE per
--     (subscriptionId, dedupeKey) so the receivers can upsert by key
--     instead of insert-and-hope. NULLable so existing rows survive.
--   * `attemptCount` — bumped on every processing attempt.
--   * `nextAttemptAt` — backoff timestamp; rows in the future are
--     skipped by the drain consumer.
--   * `deadlettered` — terminal "stop retrying" flag for ops triage.
--
-- A composite index on (processed, deadlettered, nextAttemptAt) makes
-- the drain query (`WHERE processed=false AND deadlettered=false AND
-- (nextAttemptAt IS NULL OR nextAttemptAt < now())`) index-only.
--
-- Backward-compat: every new column is NULLable or has a default, so
-- existing rows continue to work without backfill. The drain consumer
-- treats NULL dedupeKey as "no idempotency — single row" and NULL
-- nextAttemptAt as "eligible immediately", which matches prior behavior.

ALTER TABLE "WebhookEvent"
  ADD COLUMN "dedupeKey"     TEXT,
  ADD COLUMN "attemptCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "deadlettered"  BOOLEAN NOT NULL DEFAULT false;

-- Idempotency: (subscriptionId, dedupeKey) is unique when dedupeKey is
-- set. Postgres treats NULLs as distinct by default, so historical rows
-- (dedupeKey = NULL) coexist freely.
CREATE UNIQUE INDEX "WebhookEvent_subscriptionId_dedupeKey_key"
  ON "WebhookEvent"("subscriptionId", "dedupeKey");

-- Drain query index: WHERE processed=false AND deadlettered=false
-- ORDER BY nextAttemptAt ASC NULLS FIRST. Sequential scan today,
-- index-only after this migration.
CREATE INDEX "WebhookEvent_processed_deadlettered_nextAttemptAt_idx"
  ON "WebhookEvent"("processed", "deadlettered", "nextAttemptAt");
