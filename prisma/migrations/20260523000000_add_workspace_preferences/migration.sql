-- agentplain — Workspace preferences + signal log
--
-- Lands the "tell us once and it adjusts / needs less from you over time"
-- claim from marketing/[vertical]/page.tsx + the onboarding
-- set_preferences step.
--
-- Two tables:
--   1. WorkspacePreference — one row per workspace, the aggregated state
--      the draft/categorize/schedule skills read on every fire (per
--      feedback_cold_start_safe_agents.md — no in-memory cache).
--   2. PreferenceSignal — append-only audit log of every captured signal
--      (onboarding form value, draft edit, draft reject). Lets a future
--      reconstructor rebuild WorkspacePreference from first principles.
--
-- RLS pattern matches lib/db/rls.ts: customers see only their own rows;
-- operators see everything. Same shape as WorkApprovalQueueItem etc.

-- =====================================================================
-- ENUM
-- =====================================================================
CREATE TYPE "PreferenceSignalSource" AS ENUM (
  'ONBOARDING_FORM',
  'DRAFT_EDIT',
  'DRAFT_REJECT'
);

-- =====================================================================
-- WORKSPACE PREFERENCE (one per workspace)
-- =====================================================================
CREATE TABLE "WorkspacePreference" (
  "id"                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId"         UUID NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "draftingTone"        TEXT,
  "categorizationNotes" TEXT,
  "calendarWindow"      TEXT,
  "learnedDraftNotes"   TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);

CREATE INDEX "WorkspacePreference_workspaceId_idx"
  ON "WorkspacePreference"("workspaceId");

ALTER TABLE "WorkspacePreference" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_preference_read" ON "WorkspacePreference"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

CREATE POLICY "workspace_preference_write" ON "WorkspacePreference"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- =====================================================================
-- PREFERENCE SIGNAL (append-only log)
-- =====================================================================
CREATE TABLE "PreferenceSignal" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "source"      "PreferenceSignalSource" NOT NULL,
  "kind"        TEXT NOT NULL,
  "text"        TEXT NOT NULL,
  "refTable"    TEXT,
  "refId"       TEXT,
  "payload"     JSONB,
  "capturedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PreferenceSignal_workspaceId_capturedAt_idx"
  ON "PreferenceSignal"("workspaceId", "capturedAt");

CREATE INDEX "PreferenceSignal_workspaceId_source_idx"
  ON "PreferenceSignal"("workspaceId", "source");

ALTER TABLE "PreferenceSignal" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preference_signal_read" ON "PreferenceSignal"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

CREATE POLICY "preference_signal_write" ON "PreferenceSignal"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
