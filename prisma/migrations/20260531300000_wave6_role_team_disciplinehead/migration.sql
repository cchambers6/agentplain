-- Wave-6 phase 1+2 — team/role/RBAC schema foundation.
--
-- Adds:
--   * New Role enum values (OWNER, ADMIN, MEMBER, VIEWER). Existing
--     BROKER_OWNER + AGENT values stay; the policy layer in
--     lib/auth/roles.ts treats BROKER_OWNER≡OWNER and AGENT≡MEMBER so
--     every existing row keeps working with zero backfill.
--   * Membership.invitedByUserId + Membership.removedAt — audit columns.
--   * Membership index on (workspaceId, status) — used by RBAC checks.
--   * Team + TeamMembership tables. RLS-isolated per workspace.
--   * DisciplineHead table. One head per (workspace, discipline).
--   * WorkApprovalQueueItem.requiredApproverUserId — when populated, only
--     that user can approve. NULL preserves the existing behavior (any
--     qualified member). Existing rows backfill to NULL via column add.
--   * WorkApprovalQueueItem index on (requiredApproverUserId, status).
--
-- Single-owner workspaces (every Phase-1 workspace today) continue
-- working without intervention: no DisciplineHead rows → all routing
-- stays at "any qualified member" → owner approves as they do today.

-- 1. Extend Role enum.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MEMBER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VIEWER';

-- 2. Membership audit columns.
ALTER TABLE "Membership"
  ADD COLUMN "invitedByUserId" UUID,
  ADD COLUMN "removedAt"       TIMESTAMP(3);

ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Membership_workspaceId_status_idx"
  ON "Membership" ("workspaceId", "status");

-- 3. Team + TeamMembership.
CREATE TABLE "Team" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId"     UUID NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" UUID,
  "archivedAt"      TIMESTAMP(3),
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Team_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Team_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Team_workspaceId_name_key"
  ON "Team" ("workspaceId", "name");
CREATE INDEX "Team_workspaceId_archivedAt_idx"
  ON "Team" ("workspaceId", "archivedAt");

CREATE TABLE "TeamMembership" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId"       UUID NOT NULL,
  "userId"       UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamMembership_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamMembership_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "Membership"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TeamMembership_teamId_userId_key"
  ON "TeamMembership" ("teamId", "userId");
CREATE INDEX "TeamMembership_userId_idx"
  ON "TeamMembership" ("userId");
CREATE INDEX "TeamMembership_membershipId_idx"
  ON "TeamMembership" ("membershipId");

-- 4. DisciplineHead.
CREATE TABLE "DisciplineHead" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId"     UUID NOT NULL,
  "discipline"      TEXT NOT NULL,
  "userId"          UUID NOT NULL,
  "assignedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID,
  CONSTRAINT "DisciplineHead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisciplineHead_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DisciplineHead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DisciplineHead_assignedByUserId_fkey"
    FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DisciplineHead_workspaceId_discipline_key"
  ON "DisciplineHead" ("workspaceId", "discipline");
CREATE INDEX "DisciplineHead_userId_idx"
  ON "DisciplineHead" ("userId");

-- 5. WorkApprovalQueueItem.requiredApproverUserId.
ALTER TABLE "WorkApprovalQueueItem"
  ADD COLUMN "requiredApproverUserId" UUID;

ALTER TABLE "WorkApprovalQueueItem"
  ADD CONSTRAINT "WorkApprovalQueueItem_requiredApproverUserId_fkey"
    FOREIGN KEY ("requiredApproverUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WorkApprovalQueueItem_requiredApproverUserId_status_idx"
  ON "WorkApprovalQueueItem" ("requiredApproverUserId", "status");
