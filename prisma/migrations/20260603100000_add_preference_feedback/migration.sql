-- agentplain — PreferenceFeedback (customer-facing closed-loop draft feedback)
--
-- The explicit, categorized correction a customer leaves on a draft in
-- /approvals ("doesn't sound like us" → pick a category + reason). Distinct
-- from the append-only PreferenceSignal log: PreferenceFeedback drives the
-- weekly customer-feedback-drift-sweep (aggregate by targetSkillSlug +
-- category; ≥3 same-category corrections → queue a CapabilityProposal) and
-- the /briefings "what we learned from your feedback" section that closes
-- the loop back to the customer.
--
-- RLS pattern matches WorkspacePreference / PreferenceSignal
-- (20260523000000_add_workspace_preferences): customers see only their own
-- rows; operators (and system/cron via withSystemContext) see everything.
-- FORCE ROW LEVEL SECURITY so the policies bind even for the table owner
-- (see 20260526000001_force_rls + tests/wave5-multitenant-isolation.test.ts).

-- =====================================================================
-- ENUM
-- =====================================================================
CREATE TYPE "PreferenceFeedbackCategory" AS ENUM (
  'TONE',
  'STRUCTURE',
  'FACTUAL',
  'LENGTH',
  'OTHER'
);

-- =====================================================================
-- PREFERENCE FEEDBACK
-- =====================================================================
CREATE TABLE "PreferenceFeedback" (
  "id"              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId"     UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId"          UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "targetSkillSlug" TEXT NOT NULL,
  "originalDraft"   TEXT,
  "correctedDraft"  TEXT,
  "reason"          TEXT NOT NULL,
  "category"        "PreferenceFeedbackCategory" NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PreferenceFeedback_workspaceId_createdAt_idx"
  ON "PreferenceFeedback"("workspaceId", "createdAt");

CREATE INDEX "PreferenceFeedback_workspaceId_targetSkillSlug_category_idx"
  ON "PreferenceFeedback"("workspaceId", "targetSkillSlug", "category");

-- Cross-workspace operator drift signal (leadership board) scans by time.
CREATE INDEX "PreferenceFeedback_createdAt_idx"
  ON "PreferenceFeedback"("createdAt");

ALTER TABLE "PreferenceFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PreferenceFeedback" FORCE ROW LEVEL SECURITY;

CREATE POLICY "preference_feedback_read" ON "PreferenceFeedback"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

CREATE POLICY "preference_feedback_write" ON "PreferenceFeedback"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
