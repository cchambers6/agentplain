-- agentplain customer-surface shell migration.
-- Implements product_spec.md §13.1–13.2 (2026-05-09 amendment):
--   * Vertical enum — 9 launch verticals (no medical; see
--     feedback_no_new_verticals_finish_locked).
--   * WorkspaceVerticalTier enum — Regular/Plus/Max per-seat tier ladder.
--   * Workspace.vertical + Workspace.verticalTier columns, backfilled to
--     REAL_ESTATE / REGULAR for any Phase 1 realty rows.
--   * OnboardingState 1:1 to Workspace, RLS gated by workspaceId.

CREATE TYPE "Vertical" AS ENUM (
  'REAL_ESTATE',
  'MORTGAGE',
  'INSURANCE',
  'PROPERTY_MANAGEMENT',
  'TITLE_ESCROW',
  'RECRUITING',
  'HOME_SERVICES',
  'CPA',
  'LAW',
  'RIA'
);

CREATE TYPE "WorkspaceVerticalTier" AS ENUM ('REGULAR', 'PLUS', 'MAX');

-- Backfill-safe: NOT NULL with default; existing rows pick up the default.
ALTER TABLE "Workspace"
  ADD COLUMN "vertical" "Vertical" NOT NULL DEFAULT 'REAL_ESTATE',
  ADD COLUMN "verticalTier" "WorkspaceVerticalTier" NOT NULL DEFAULT 'REGULAR';

CREATE INDEX "Workspace_vertical_idx" ON "Workspace"("vertical");

CREATE TABLE "OnboardingState" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "currentStep" TEXT NOT NULL DEFAULT 'confirm_details',
  "completedSteps" JSONB NOT NULL DEFAULT '[]',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- RLS: workspace-scoped. Same shape as Membership / WorkThresholdConfig.
ALTER TABLE "OnboardingState" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_workspace_isolation" ON "OnboardingState"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- Backfill OnboardingState for any pre-existing workspaces so /onboarding
-- renders for them too. Default currentStep is confirm_details; existing
-- Phase 1 workspaces have already confirmed details, but we let them re-visit.
INSERT INTO "OnboardingState" ("workspaceId", "currentStep", "completedSteps", "updatedAt")
SELECT w.id, 'confirm_details', '[]'::jsonb, CURRENT_TIMESTAMP
FROM "Workspace" w
LEFT JOIN "OnboardingState" o ON o."workspaceId" = w.id
WHERE o.id IS NULL;
