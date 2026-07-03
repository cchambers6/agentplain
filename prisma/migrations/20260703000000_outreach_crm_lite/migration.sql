-- Design-partner outreach CRM-lite (send-path wave 2026-07-03).
-- Prospect row + append-only touch log; stage ladder ratified in
-- docs/sales/deep-dive-2026-07-02/06-pipeline-and-forecasting.md.
--
-- ── id column default ──────────────────────────────────────────────────
-- `id` is created WITHOUT `DEFAULT gen_random_uuid()`. Prisma generates
-- @default(uuid()) ids client-side, so the reconciled DB state (after the
-- repo-wide `id DROP DEFAULT` baseline — prisma/schema-drift-baseline.sql)
-- carries no DB default.

-- CreateEnum
CREATE TYPE "OutreachStage" AS ENUM ('LIST', 'FIT', 'DISCOVERY', 'DP_TALK', 'AGREEMENT', 'ACTIVATION', 'ACTIVE_PILOT', 'NOT_YET', 'LOST');

-- CreateEnum
CREATE TYPE "OutreachTouchKind" AS ENUM ('EMAIL_SENT', 'REPLY_RECEIVED', 'CALL_HELD', 'NOTE', 'STAGE_CHANGE');

-- CreateTable
CREATE TABLE "OutreachProspect" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "business" TEXT,
    "email" TEXT,
    "vertical" TEXT,
    "source" TEXT,
    "stage" "OutreachStage" NOT NULL DEFAULT 'LIST',
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "revisitDate" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachTouch" (
    "id" UUID NOT NULL,
    "prospectId" UUID NOT NULL,
    "kind" "OutreachTouchKind" NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachTouch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachProspect_stage_nextActionDate_idx" ON "OutreachProspect"("stage", "nextActionDate");

-- CreateIndex
CREATE INDEX "OutreachProspect_createdAt_idx" ON "OutreachProspect"("createdAt");

-- CreateIndex
CREATE INDEX "OutreachTouch_prospectId_occurredAt_idx" ON "OutreachTouch"("prospectId", "occurredAt");

-- AddForeignKey
ALTER TABLE "OutreachTouch" ADD CONSTRAINT "OutreachTouch_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "OutreachProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
