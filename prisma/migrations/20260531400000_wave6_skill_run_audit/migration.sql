-- Wave-6 phase 4 — SkillRun audit table.
--
-- The per-discipline scorecards shipped in wave-5 read from the approval
-- queue, which made skipped + failed fires invisible. SkillRun is the
-- canonical "what happened" table: every cron / Inngest entry seam writes
-- a row before any expensive work, the outcome column is updated at end.
-- Wave-6 migrates scorecards to read from this table so the
-- customer-facing numbers report honestly.

CREATE TYPE "SkillRunOutcome" AS ENUM (
  'DRAFTED',
  'SUCCEEDED_NO_DRAFT',
  'SKIPPED_PAUSED',
  'SKIPPED_UNINSTALLED',
  'SKIPPED_WINDOW',
  'SKIPPED_DISCIPLINE_DISABLED',
  'SKIPPED_DRY_RUN',
  'FAILED'
);

CREATE TABLE "SkillRun" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId"  UUID NOT NULL,
  "skillSlug"    TEXT NOT NULL,
  "discipline"   TEXT,
  "firedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),
  "outcome"      "SkillRunOutcome" NOT NULL,
  "durationMs"   INTEGER,
  "errorMessage" TEXT,
  "queueItemId"  UUID,
  CONSTRAINT "SkillRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SkillRun_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SkillRun_queueItemId_fkey"
    FOREIGN KEY ("queueItemId") REFERENCES "WorkApprovalQueueItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SkillRun_workspaceId_firedAt_idx"
  ON "SkillRun" ("workspaceId", "firedAt" DESC);
CREATE INDEX "SkillRun_workspaceId_skillSlug_firedAt_idx"
  ON "SkillRun" ("workspaceId", "skillSlug", "firedAt" DESC);
CREATE INDEX "SkillRun_workspaceId_discipline_firedAt_idx"
  ON "SkillRun" ("workspaceId", "discipline", "firedAt" DESC);
CREATE INDEX "SkillRun_workspaceId_outcome_firedAt_idx"
  ON "SkillRun" ("workspaceId", "outcome", "firedAt" DESC);
