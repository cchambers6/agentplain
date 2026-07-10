-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'GA',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "philosophy" TEXT NOT NULL DEFAULT 'charlotte_mason',
    "schoolDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4]::INTEGER[],
    "goals" TEXT,
    "calendarFeed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthdate" TIMESTAMP(3) NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'grammar',
    "model" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curriculum" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "subjects" TEXT[],
    "scopeSequence" JSONB,
    "pace" TEXT,
    "parentNotes" TEXT,
    "catalogId" TEXT,

    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "rationale" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "weeklyPlanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'planned',

    CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "completion" JSONB NOT NULL DEFAULT '[]',
    "debriefTranscript" JSONB NOT NULL DEFAULT '[]',
    "debriefClosedAt" TIMESTAMP(3),

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "record" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'rules',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCostRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "agent" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicrocents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyCostRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Family_workspaceId_key" ON "Family"("workspaceId");

-- CreateIndex
CREATE INDEX "Child_workspaceId_idx" ON "Child"("workspaceId");

-- CreateIndex
CREATE INDEX "Child_familyId_idx" ON "Child"("familyId");

-- CreateIndex
CREATE INDEX "Curriculum_workspaceId_idx" ON "Curriculum"("workspaceId");

-- CreateIndex
CREATE INDEX "Curriculum_familyId_idx" ON "Curriculum"("familyId");

-- CreateIndex
CREATE INDEX "WeeklyPlan_workspaceId_idx" ON "WeeklyPlan"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlan_familyId_weekStart_key" ON "WeeklyPlan"("familyId", "weekStart");

-- CreateIndex
CREATE INDEX "DayPlan_date_idx" ON "DayPlan"("date");

-- CreateIndex
CREATE INDEX "DayPlan_workspaceId_idx" ON "DayPlan"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlan_weeklyPlanId_date_key" ON "DayPlan"("weeklyPlanId", "date");

-- CreateIndex
CREATE INDEX "DailyLog_familyId_date_idx" ON "DailyLog"("familyId", "date");

-- CreateIndex
CREATE INDEX "DailyLog_workspaceId_idx" ON "DailyLog"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_childId_date_key" ON "DailyLog"("childId", "date");

-- CreateIndex
CREATE INDEX "ComplianceRecord_familyId_date_idx" ON "ComplianceRecord"("familyId", "date");

-- CreateIndex
CREATE INDEX "ComplianceRecord_workspaceId_idx" ON "ComplianceRecord"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRecord_childId_date_key" ON "ComplianceRecord"("childId", "date");

-- CreateIndex
CREATE INDEX "DailyCostRecord_familyId_date_idx" ON "DailyCostRecord"("familyId", "date");

-- CreateIndex
CREATE INDEX "DailyCostRecord_workspaceId_idx" ON "DailyCostRecord"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCostRecord_familyId_date_agent_tier_key" ON "DailyCostRecord"("familyId", "date", "agent", "tier");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_weeklyPlanId_fkey" FOREIGN KEY ("weeklyPlanId") REFERENCES "WeeklyPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRecord" ADD CONSTRAINT "ComplianceRecord_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCostRecord" ADD CONSTRAINT "DailyCostRecord_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

