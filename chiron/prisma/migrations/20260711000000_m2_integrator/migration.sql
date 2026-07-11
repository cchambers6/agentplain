-- M2: IntegrationMap table + WeeklyPlan.vision (Chiron-voice week rationale).

-- CreateTable
CREATE TABLE "IntegrationMap" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "philosophyPackRef" TEXT NOT NULL,
    "curriculaRefs" JSONB NOT NULL,
    "parentDecisions" JSONB NOT NULL DEFAULT '[]',
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "IntegrationMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationMap_familyId_revision_idx" ON "IntegrationMap"("familyId", "revision");

-- CreateIndex
CREATE INDEX "IntegrationMap_workspaceId_idx" ON "IntegrationMap"("workspaceId");

-- AddForeignKey
ALTER TABLE "IntegrationMap" ADD CONSTRAINT "IntegrationMap_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "WeeklyPlan" ADD COLUMN "vision" TEXT NOT NULL DEFAULT '';
