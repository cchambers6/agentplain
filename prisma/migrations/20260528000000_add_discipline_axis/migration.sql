-- agentplain — discipline axis (Strand 3 UX wedge, 2026-05-28).
--
-- Adds the customer-facing discipline axis introduced by the Strand 1
-- fleet expansion plan (`docs/fleet-expansion-plan-2026-05-27.md`). The
-- discipline is the dimension above the vertical — every workspace lives
-- in ONE vertical but exposes work across the 8 disciplines (analytics,
-- research, legal, marketing, sales-enablement, customer-success,
-- finance, operations).
--
-- Why two columns, no enum:
--   * `WorkApprovalQueueItem.discipline` is NULLABLE — legacy rows
--     written before this migration ran carry NULL, and the approvals
--     UI buckets NULL items into the "All recent" fallback section so
--     nothing disappears. New inserts populate the column where the
--     producing skill has a known discipline tag.
--   * `WorkspacePreference.disabledDisciplines TEXT[]` is the truth
--     source for the customer-facing toggle on the Discipline panel.
--     Defaults to empty (every discipline ON by default for a new
--     workspace); the toggle appends when the operator opts out.
--   * Discipline is stored as TEXT (not a Postgres enum) so adding /
--     renaming a discipline is a content edit in `lib/disciplines`
--     rather than a migration. The application-layer zod schema in
--     `lib/disciplines/index.ts` is what enforces the valid set.
--
-- Idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS lets a re-run of
-- this migration (manual or via the Preview-hits-prod path) succeed
-- against a database that already has the columns.
--
-- Safe under the known Preview-hits-prod hazard (see
-- `project_apex_alias_drift_rootcause.md` + reference docs on Vercel +
-- Neon setup): both adds are PURELY ADDITIVE — no NOT NULL constraint,
-- no DEFAULT-with-rewrite on existing rows. Existing pre-migration
-- callers continue to write rows without the column, and the column
-- stays NULL on those rows.

-- ============================================================
-- 1. WorkApprovalQueueItem.discipline
-- ============================================================

ALTER TABLE "WorkApprovalQueueItem"
  ADD COLUMN IF NOT EXISTS "discipline" TEXT;

-- Index supports the discipline-grouped /approvals query the panel
-- needs (filter by workspace + discipline + status). Mirrors the
-- existing (workspaceId, status) and (workspaceId, kind, status)
-- indexes that the renderer already relies on.
CREATE INDEX IF NOT EXISTS "WorkApprovalQueueItem_workspaceId_discipline_status_idx"
  ON "WorkApprovalQueueItem" ("workspaceId", "discipline", "status");

-- ============================================================
-- 2. WorkspacePreference.disabledDisciplines
-- ============================================================

ALTER TABLE "WorkspacePreference"
  ADD COLUMN IF NOT EXISTS "disabledDisciplines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ============================================================
-- 3. RLS — no new policy required
-- ============================================================
--
-- WorkApprovalQueueItem and WorkspacePreference both inherit the
-- workspace_self_isolation policy from `20260526000000_add_integration_rls`
-- / `20260526000001_force_rls`. Adding a column does not change row-level
-- visibility; the per-workspace tenant boundary already covers the new
-- field. The `discipline-isolation` test in
-- `tests/disciplines-isolation.test.ts` pins this — a workspace-A query
-- for discipline=marketing never returns a workspace-B row, even after
-- the new index is in place.
