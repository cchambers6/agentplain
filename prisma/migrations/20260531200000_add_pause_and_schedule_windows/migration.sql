-- Wave-5 customer-control surfaces:
--   1. WorkspacePauseConfig — vacation / PTO / cutover window
--   2. SkillScheduleWindow — per-skill TZ-aware fire schedule
--
-- Both consulted by the shared fire-gate at lib/skills/fire-gate.ts on
-- every skill fire. See feedback_cold_start_safe_agents.md — no
-- in-memory caching of the gate result.

-- CreateTable
CREATE TABLE "WorkspacePauseConfig" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "pausedFrom" TIMESTAMP(3) NOT NULL,
    "pausedUntil" TIMESTAMP(3) NOT NULL,
    "pausedDisciplineIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasonEncrypted" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspacePauseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspacePauseConfig_workspaceId_pausedUntil_idx" ON "WorkspacePauseConfig"("workspaceId", "pausedUntil");

-- CreateIndex
CREATE INDEX "WorkspacePauseConfig_pausedFrom_pausedUntil_idx" ON "WorkspacePauseConfig"("pausedFrom", "pausedUntil");

-- AddForeignKey
ALTER TABLE "WorkspacePauseConfig" ADD CONSTRAINT "WorkspacePauseConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePauseConfig" ADD CONSTRAINT "WorkspacePauseConfig_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SkillScheduleWindow" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "skillSlug" VARCHAR(64) NOT NULL,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startHourLocal" INTEGER NOT NULL,
    "endHourLocal" INTEGER NOT NULL,
    "workspaceTimezone" VARCHAR(64) NOT NULL,
    "configuredByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillScheduleWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkillScheduleWindow_workspaceId_skillSlug_key" ON "SkillScheduleWindow"("workspaceId", "skillSlug");

-- CreateIndex
CREATE INDEX "SkillScheduleWindow_workspaceId_idx" ON "SkillScheduleWindow"("workspaceId");

-- AddForeignKey
ALTER TABLE "SkillScheduleWindow" ADD CONSTRAINT "SkillScheduleWindow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillScheduleWindow" ADD CONSTRAINT "SkillScheduleWindow_configuredByUserId_fkey" FOREIGN KEY ("configuredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
