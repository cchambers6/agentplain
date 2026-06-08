-- Compliance rewrite-and-stage — counsel-feedback redline loop.
-- (wave-4/compliance-rewrite-stage-2026-06-07)
--
-- Adds CounselRedline: the durable store for the learned-language loop
-- (pride-audit theme #14). When counsel red-lines a sentinel rewrite
-- suggestion, the operator records one row here. Once a (workspace,
-- vertical, rule, clausePattern) bucket accumulates 5 agreeing red-lines,
-- the rewrite engine embeds that learned language verbatim in future
-- compliant-replacement suggestions (lib/agents/sentinel/redline-store.ts).
--
-- ── id column default ──────────────────────────────────────────────────
-- The `id` column is created WITHOUT a `DEFAULT gen_random_uuid()`. Prisma
-- generates `@default(uuid())` ids client-side, so the reconciled DB state
-- (after the repo-wide `id DROP DEFAULT` baseline — see
-- prisma/schema-drift-baseline.sql) carries no DB default. Creating the
-- column without one keeps `prisma migrate diff` empty for this table, so
-- this migration adds ZERO new entries to the drift baseline.
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- Operator-only, exactly like LeadCapture. The compliance sweep + the
-- operator counsel-review console run under withSystemContext
-- (app.is_operator='true'); a customer never reads another workspace's
-- counsel corrections.

CREATE TABLE "CounselRedline" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "verticalSlug" VARCHAR(64) NOT NULL,
  "ruleId" VARCHAR(128) NOT NULL,
  "clausePattern" TEXT NOT NULL,
  "preferredLanguage" TEXT NOT NULL,
  "rationale" TEXT,
  "recordedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CounselRedline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CounselRedline_workspaceId_verticalSlug_ruleId_createdAt_idx"
  ON "CounselRedline"("workspaceId", "verticalSlug", "ruleId", "createdAt");

ALTER TABLE "CounselRedline"
  ADD CONSTRAINT "CounselRedline_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CounselRedline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CounselRedline" FORCE ROW LEVEL SECURITY;

CREATE POLICY "counselredline_operator_all" ON "CounselRedline"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
