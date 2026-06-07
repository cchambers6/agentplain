-- CreatorBrief — human-creator handoff for brand-defining creative.
-- (feat/creative-asset-capability-2026-06-06)
--
-- The fleet does NOT improvise brand assets in raw SVG/PNG when a real design
-- tool exists OR when the work is brand-defining
-- (feedback_creative_assets_use_tools_or_humans). For brand-defining jobs the
-- Media discipline's creative router assembles a brief packet (brand tokens +
-- references + delivery spec + acceptance criteria) and an operator dispatches
-- it to an outside creator, then pastes the finished asset back at
-- /operator/creative-briefs.
--
-- ── id column default ──────────────────────────────────────────────────
-- The `id` column is created WITHOUT `DEFAULT gen_random_uuid()`. Prisma
-- generates `@default(uuid())` ids client-side, so the reconciled DB state
-- (after the repo-wide `id DROP DEFAULT` baseline — see
-- prisma/schema-drift-baseline.sql) carries no DB default. Creating the column
-- without one keeps `prisma migrate diff` empty for this table, so this
-- migration adds ZERO new entries to the drift baseline
-- (project_schema_drift_baseline_for_raw_indexes).
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- Operator-only, exactly like LeadCapture. The router persists DRAFT rows
-- under withSystemContext (app.is_operator='true'); /operator/creative-briefs
-- is the dispatch + acceptance queue. `workspaceId` is an optional link — a
-- platform-level brand brief (e.g. the robot-dog mark) carries no workspace.

CREATE TYPE "CreatorBriefStatus" AS ENUM (
  'DRAFT',
  'BRIEFED',
  'DELIVERED',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "CreatorBriefKind" AS ENUM (
  'BRAND_MARK',
  'HERO_ILLUSTRATION',
  'MASCOT_ILLUSTRATION',
  'PHOTOGRAPHY_DIRECTION',
  'MOTION_IDENT',
  'PRINT_COLLATERAL',
  'OTHER'
);

CREATE TABLE "CreatorBrief" (
  "id" UUID NOT NULL,
  "workspaceId" UUID,
  "kind" "CreatorBriefKind" NOT NULL,
  "status" "CreatorBriefStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "packet" JSONB NOT NULL,
  "routedReason" TEXT NOT NULL,
  "creatorRef" TEXT,
  "delivery" JSONB,
  "reviewNotes" TEXT,
  "createdByAgent" TEXT,
  "decidedByUserId" UUID,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorBrief_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreatorBrief_status_createdAt_idx"
  ON "CreatorBrief"("status", "createdAt");

CREATE INDEX "CreatorBrief_workspaceId_createdAt_idx"
  ON "CreatorBrief"("workspaceId", "createdAt");

CREATE INDEX "CreatorBrief_kind_status_idx"
  ON "CreatorBrief"("kind", "status");

ALTER TABLE "CreatorBrief"
  ADD CONSTRAINT "CreatorBrief_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS — operator-only. The router writes DRAFT rows under withSystemContext
-- (app.is_operator='true'); the operator console reads + decides under the
-- same clause.
ALTER TABLE "CreatorBrief" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreatorBrief" FORCE ROW LEVEL SECURITY;

CREATE POLICY "creatorbrief_operator_all" ON "CreatorBrief"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
