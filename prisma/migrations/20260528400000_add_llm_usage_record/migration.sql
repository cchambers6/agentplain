-- Token-usage accounting + Stripe-meter backlog (feat/token-usage-billing-2026-05-28).
--
-- One row per successful LLM call that carries a workspaceId in its meta;
-- the LoggingLlmProvider drops workspaceId-less calls instead of fabricating
-- a fake tag. Cost is captured at write time in micro-cents (BigInt) using
-- current Anthropic list pricing, so the row remains source-of-truth even
-- if rates later shift.
--
-- `stripeReportedAt` is the daily Stripe-meter cron's idempotency marker:
-- NULL = backlog (eligible for emission), non-NULL = already reported.
--
-- Workspace-isolation posture mirrors every other tenant-data table:
-- operator (app.is_operator='true') sees everything; otherwise the
-- workspace GUC must match. Additive + NULLABLE-safe — no existing table
-- is mutated. Rolling back is a one-step DROP + DROP TYPE.

-- ---------------------------------------------------------------------------
-- LlmSourceSurface enum — mirrors LlmRequestMeta.skill at the call-site.
-- ---------------------------------------------------------------------------
CREATE TYPE "LlmSourceSurface" AS ENUM (
  'PLAINO_CHAT',
  'OFFICE_ADMIN',
  'CATEGORIZE',
  'COORDINATE',
  'SCHEDULE',
  'DRAFT',
  'SUPPORT_HANDLER',
  'INBOX_TRIAGE',
  'FOLLOW_UP_CHASER',
  'PROCESS_DOC_DRAFTER',
  'SCHEDULER_SWEEP',
  'MEMORY_EXTRACT',
  'OTHER'
);

-- ---------------------------------------------------------------------------
-- LlmUsageRecord
-- ---------------------------------------------------------------------------
CREATE TABLE "LlmUsageRecord" (
  "id"                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId"         UUID NOT NULL,
  "model"               TEXT NOT NULL,
  "inputTokens"         INTEGER NOT NULL DEFAULT 0,
  "outputTokens"        INTEGER NOT NULL DEFAULT 0,
  "cacheCreationTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheReadTokens"     INTEGER NOT NULL DEFAULT 0,
  "costMicroCents"      BIGINT NOT NULL DEFAULT 0,
  "sourceSurface"       "LlmSourceSurface" NOT NULL,
  "stripeReportedAt"    TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmUsageRecord_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Window aggregations on the billing page (today / period / 30 days) sort
-- DESC on createdAt within a single workspace's rows.
CREATE INDEX "LlmUsageRecord_workspaceId_createdAt_idx"
  ON "LlmUsageRecord"("workspaceId", "createdAt" DESC);

-- Daily Stripe-meter cron scans for unreported rows per workspace. The
-- index name matches the @@index(map: ...) in schema.prisma so Prisma's
-- drift detector recognizes it.
CREATE INDEX "LlmUsageRecord_workspace_meter_idx"
  ON "LlmUsageRecord"("workspaceId", "stripeReportedAt");

-- ---------------------------------------------------------------------------
-- RLS — workspace isolation (operator overlay aware).
-- ---------------------------------------------------------------------------
ALTER TABLE "LlmUsageRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LlmUsageRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY "llm_usage_record_workspace_isolation" ON "LlmUsageRecord"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
