-- agentplain — Memory-scale layer: RLS isolation hardening + tiering + BYO storage.
--
-- Three things land here, all additive (no destructive change to existing
-- rows or columns):
--
--   1. SCHEMA additions (structural DDL below is the canonical Prisma output
--      of `migrate diff` against schema.prisma, so the schema-drift CI stays
--      green — no NEW drift beyond prisma/schema-drift-baseline.sql):
--        * 6 enums (MemoryStorageProvider, DataRegion, MemoryTier,
--          StorageKmsProvider, MemoryAuditActorType, MemoryAuditAction)
--        * Workspace.memoryStorage + Workspace.dataRegion
--        * WorkspaceMemoryEntry.tier + .archivedRef + .archivedAt + a sweep idx
--        * WorkspaceStorageConfig (customer-hosted bucket creds, encrypted)
--        * MemoryAuditLog (append-only memory access trail)
--
--   2. RLS on the two new tables — standard "operator OR workspace match"
--      shape + FORCE ROW LEVEL SECURITY (the table-owner bypass closer; see
--      20260526000001_force_rls and the wave5 isolation CI invariant).
--
--   3. RLS GAP CLOSURE — six pre-existing customer-scoped tables shipped with
--      a workspaceId column but NEVER had RLS enabled:
--        DisciplineHead, SkillRun, SkillScheduleWindow, Team,
--        WorkspaceLifecycleEvent, WorkspacePauseConfig
--      (verified 2026-06-17: zero ENABLE ROW LEVEL SECURITY across all prior
--      migrations). The Workspace.teams relation comment even claims "Teams
--      are RLS-isolated per workspace" — this migration makes that true.
--      Without it, a connection as the table-owner role (Neon's default
--      neondb_owner) reads every tenant's teams / skill-run history /
--      discipline routing / pause+schedule config. Same workspace-isolation
--      policy + FORCE as every other policied table.
--
-- The application-layer companion is that every read/write to these tables
-- already routes through withRls / withSystemContext (lib/db/rls.ts); the
-- wave5 source-grep invariant locks that discipline. System writes (the cron
-- SkillRun inserts, the lifecycle-event sweep) pass because every policy
-- carries the is_operator='true' branch that withSystemContext sets.

-- =====================================================================
-- 1. SCHEMA — enums (canonical Prisma DDL)
-- =====================================================================
-- CreateEnum
CREATE TYPE "MemoryStorageProvider" AS ENUM ('AGENTPLAIN', 'CUSTOMER');
-- CreateEnum
CREATE TYPE "DataRegion" AS ENUM ('US_EAST', 'US_WEST', 'EU_WEST', 'AP_SOUTHEAST');
-- CreateEnum
CREATE TYPE "MemoryTier" AS ENUM ('HOT', 'WARM', 'COLD');
-- CreateEnum
CREATE TYPE "StorageKmsProvider" AS ENUM ('NONE', 'AWS_KMS', 'GCP_KMS', 'BYO');
-- CreateEnum
CREATE TYPE "MemoryAuditActorType" AS ENUM ('SYSTEM', 'AGENT', 'HUMAN');
-- CreateEnum
CREATE TYPE "MemoryAuditAction" AS ENUM ('READ', 'WRITE', 'ARCHIVE', 'RESTORE', 'EXPORT', 'DELETE', 'MIGRATE');

-- =====================================================================
-- 2. SCHEMA — columns + tables (canonical Prisma DDL)
-- =====================================================================
-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "dataRegion" "DataRegion" NOT NULL DEFAULT 'US_EAST',
ADD COLUMN     "memoryStorage" "MemoryStorageProvider" NOT NULL DEFAULT 'AGENTPLAIN';

-- AlterTable
ALTER TABLE "WorkspaceMemoryEntry" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedRef" TEXT,
ADD COLUMN     "tier" "MemoryTier" NOT NULL DEFAULT 'HOT';

-- CreateTable
CREATE TABLE "WorkspaceStorageConfig" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "provider" "MemoryStorageProvider" NOT NULL DEFAULT 'CUSTOMER',
    "endpoint" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "accessKeyEncrypted" TEXT NOT NULL,
    "secretKeyEncrypted" TEXT NOT NULL,
    "kmsProvider" "StorageKmsProvider" NOT NULL DEFAULT 'NONE',
    "kmsKeyRefEncrypted" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceStorageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryAuditLog" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "actorType" "MemoryAuditActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "MemoryAuditAction" NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemoryAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceStorageConfig_workspaceId_key" ON "WorkspaceStorageConfig"("workspaceId");
-- CreateIndex
CREATE INDEX "WorkspaceStorageConfig_workspaceId_idx" ON "WorkspaceStorageConfig"("workspaceId");
-- CreateIndex
CREATE INDEX "MemoryAuditLog_workspaceId_createdAt_idx" ON "MemoryAuditLog"("workspaceId", "createdAt");
-- CreateIndex
CREATE INDEX "MemoryAuditLog_workspaceId_recordType_recordId_idx" ON "MemoryAuditLog"("workspaceId", "recordType", "recordId");
-- CreateIndex
CREATE INDEX "WorkspaceMemoryEntry_workspaceId_tier_pinned_updatedAt_idx" ON "WorkspaceMemoryEntry"("workspaceId", "tier", "pinned", "updatedAt");

-- AddForeignKey
ALTER TABLE "WorkspaceStorageConfig" ADD CONSTRAINT "WorkspaceStorageConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "MemoryAuditLog" ADD CONSTRAINT "MemoryAuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- 3. RLS — new tables (workspace-isolation + FORCE)
-- =====================================================================

-- WorkspaceStorageConfig — members may READ their own config row (the data
-- page renders bucket/region/verified state; the encrypted credential
-- columns never decrypt client-side). WRITES are operator-only: credential
-- changes route through the server action under withSystemContext, never a
-- raw member-context write. Split read/write mirrors knowledge_doc_*.
ALTER TABLE "WorkspaceStorageConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceStorageConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY "storage_config_read" ON "WorkspaceStorageConfig"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
CREATE POLICY "storage_config_write" ON "WorkspaceStorageConfig"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');

-- MemoryAuditLog — members READ their own workspace's trail; WRITES are
-- operator/system-only (every audit insert runs through lib/memory/audit.ts
-- under withSystemContext, matching the AuditLog precedent and the wave5
-- "no bare prisma.auditLog.create" invariant).
ALTER TABLE "MemoryAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemoryAuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memory_audit_read" ON "MemoryAuditLog"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
CREATE POLICY "memory_audit_write" ON "MemoryAuditLog"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');

-- =====================================================================
-- 4. RLS GAP CLOSURE — 6 pre-existing customer-scoped tables, no prior RLS
-- =====================================================================
-- Standard workspace-isolation shape (operator OR workspace match) FOR ALL,
-- + FORCE. These tables are read by members and written by system/cron
-- (which sets is_operator='true' via withSystemContext), so a single
-- FOR ALL policy serves both correctly.

-- DisciplineHead — per-discipline approver routing.
ALTER TABLE "DisciplineHead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisciplineHead" FORCE ROW LEVEL SECURITY;
CREATE POLICY "discipline_head_workspace_isolation" ON "DisciplineHead"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- SkillRun — every cron / Inngest fire audit row.
ALTER TABLE "SkillRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY "skill_run_workspace_isolation" ON "SkillRun"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- SkillScheduleWindow — per-skill cron scheduling windows.
ALTER TABLE "SkillScheduleWindow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillScheduleWindow" FORCE ROW LEVEL SECURITY;
CREATE POLICY "skill_schedule_window_workspace_isolation" ON "SkillScheduleWindow"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- Team — Wave-6 RBAC sub-workspace groupings.
ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" FORCE ROW LEVEL SECURITY;
CREATE POLICY "team_workspace_isolation" ON "Team"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- WorkspaceLifecycleEvent — signup/closure audit log.
ALTER TABLE "WorkspaceLifecycleEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceLifecycleEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspace_lifecycle_event_workspace_isolation" ON "WorkspaceLifecycleEvent"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- WorkspacePauseConfig — skill pause scheduling.
ALTER TABLE "WorkspacePauseConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspacePauseConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspace_pause_config_workspace_isolation" ON "WorkspacePauseConfig"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
