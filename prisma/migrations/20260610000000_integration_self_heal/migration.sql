-- pfd-2 integration self-heal — broken integrations tell the customer and
-- fix themselves on reconnect.
--
-- Adds three enums + two workspace-scoped tables:
--
--   IntegrationHealthCheck — per-(workspace, provider) health row the daily
--     health cron upserts. Records HEALTHY/UNHEALTHY/UNKNOWN, the KIND of check
--     (REAL_READ vs CREDENTIAL_ONLY — labelled honestly per the signup-to-go
--     audit's "health = credential status only is misleading" finding), the
--     de-dupe state for the reconnect email (notifiedAt — one email per
--     breakage, not daily spam), the breakage anchor (unhealthySince — drives
--     the >72h human escalation + the customer banner), and escalatedAt so the
--     page fires once per breakage.
--
--   RetryableAction — durable retry queue. An in-flight action that failed
--     because an integration was broken enqueues here instead of being silently
--     dropped; the resume sweep re-runs it when the integration goes healthy
--     again (or on a slow backstop timer). idempotencyKey is unique-per-
--     workspace so a resume never double-executes. HELD is the degraded-mode
--     state for a non-critical side-effect (Slack notify) whose primary action
--     already succeeded — flushed on reconnect.
--
-- ── id column default ──────────────────────────────────────────────────
-- Both `id` columns are created WITHOUT a `DEFAULT gen_random_uuid()`. Prisma
-- generates `@default(uuid())` ids client-side, so the reconciled DB state
-- (after the repo-wide id DROP DEFAULT baseline — see
-- prisma/schema-drift-baseline.sql) carries no DB default. Creating the columns
-- without one keeps `prisma migrate diff` empty for these tables, so this
-- migration adds ZERO new entries to the drift baseline.
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- Both tables are workspace-scoped: workspace members read their own rows; the
-- operator/system context (app.is_operator='true', which the crons run under
-- via withSystemContext) reads + writes all rows. Same shape as
-- IntegrationCredential / WebhookSubscription.

CREATE TYPE "IntegrationHealthStatus" AS ENUM (
  'HEALTHY',
  'UNHEALTHY',
  'UNKNOWN'
);

CREATE TYPE "IntegrationHealthCheckKind" AS ENUM (
  'REAL_READ',
  'CREDENTIAL_ONLY'
);

CREATE TYPE "RetryableActionStatus" AS ENUM (
  'PENDING',
  'RESOLVED',
  'DEAD',
  'HELD'
);

-- ── IntegrationHealthCheck ──────────────────────────────────────────────
CREATE TABLE "IntegrationHealthCheck" (
  "id"             UUID NOT NULL,
  "workspaceId"    UUID NOT NULL,
  "provider"       "IntegrationProvider" NOT NULL,
  "status"         "IntegrationHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
  "checkKind"      "IntegrationHealthCheckKind" NOT NULL DEFAULT 'CREDENTIAL_ONLY',
  "lastError"      TEXT,
  "lastCheckedAt"  TIMESTAMP(3),
  "unhealthySince" TIMESTAMP(3),
  "notifiedAt"     TIMESTAMP(3),
  "escalatedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationHealthCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationHealthCheck_workspaceId_provider_key"
  ON "IntegrationHealthCheck"("workspaceId", "provider");

CREATE INDEX "IntegrationHealthCheck_status_unhealthySince_idx"
  ON "IntegrationHealthCheck"("status", "unhealthySince");

CREATE INDEX "IntegrationHealthCheck_workspaceId_idx"
  ON "IntegrationHealthCheck"("workspaceId");

ALTER TABLE "IntegrationHealthCheck"
  ADD CONSTRAINT "IntegrationHealthCheck_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntegrationHealthCheck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntegrationHealthCheck" FORCE ROW LEVEL SECURITY;

CREATE POLICY "IntegrationHealthCheck_workspace_or_operator"
  ON "IntegrationHealthCheck"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );

-- ── RetryableAction ─────────────────────────────────────────────────────
CREATE TABLE "RetryableAction" (
  "id"             UUID NOT NULL,
  "workspaceId"    UUID NOT NULL,
  "provider"       "IntegrationProvider" NOT NULL,
  "actionKind"     TEXT NOT NULL,
  "payload"        JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status"         "RetryableActionStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt"  TIMESTAMP(3),
  "lastError"      TEXT,
  "diedAt"         TIMESTAMP(3),
  "resolvedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetryableAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetryableAction_workspaceId_idempotencyKey_key"
  ON "RetryableAction"("workspaceId", "idempotencyKey");

CREATE INDEX "RetryableAction_status_provider_nextAttemptAt_idx"
  ON "RetryableAction"("status", "provider", "nextAttemptAt");

CREATE INDEX "RetryableAction_workspaceId_status_idx"
  ON "RetryableAction"("workspaceId", "status");

ALTER TABLE "RetryableAction"
  ADD CONSTRAINT "RetryableAction_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RetryableAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetryableAction" FORCE ROW LEVEL SECURITY;

CREATE POLICY "RetryableAction_workspace_or_operator"
  ON "RetryableAction"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );
