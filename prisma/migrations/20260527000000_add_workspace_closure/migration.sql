-- agentplain — customer-initiated workspace closure (data-controls PR).
--
-- Adds the soft-delete state machine that customer-side teardown rides on.
-- The deletion functions in `lib/customer-files/deletion.ts` (PR #94) are
-- the executor; this migration adds the GUARD: a workspace can't be hard-
-- purged without first sitting in CLOSING with a scheduled purge time the
-- customer can still cancel inside.
--
-- States:
--   ACTIVE   — default; normal operating workspace.
--   CLOSING  — customer asked to close. Workspace still readable + cancellable
--              until `scheduledHardPurgeAt`. The hourly Inngest sweep
--              (`workspace-teardown-sweep`) picks rows whose scheduled time
--              has passed and runs `tearDownWorkspaceData`.
--   CLOSED   — hard purge has run. Workspace + Membership rows survive so
--              the audit + billing trail stays queryable; every tenant-data
--              child table has been emptied per the PR-#94 teardown helper.
--
-- Why soft-delete + grace window: typed-confirmation alone isn't enough.
-- A misclick or a momentary "I'll just see what happens" mood must not
-- be irreversible. The 7-day default window matches the longest typical
-- vacation absence — long enough that a customer who closes by accident
-- or under stress can come back and cancel.
--
-- Why this lives on Workspace itself (not a sidecar table): every read
-- path already pulls the Workspace row; an extra join just to learn
-- "is this workspace winding down" would be noise.

-- ============================================================
-- 1. Enum
-- ============================================================

CREATE TYPE "WorkspaceClosureStatus" AS ENUM ('ACTIVE', 'CLOSING', 'CLOSED');

-- ============================================================
-- 2. Columns on Workspace
-- ============================================================

ALTER TABLE "Workspace"
  ADD COLUMN "closureStatus"            "WorkspaceClosureStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "closingInitiatedAt"       TIMESTAMP(3),
  ADD COLUMN "closingInitiatedByUserId" UUID,
  ADD COLUMN "scheduledHardPurgeAt"     TIMESTAMP(3),
  ADD COLUMN "closedAt"                 TIMESTAMP(3),
  ADD COLUMN "closureReason"            TEXT;

-- The hard-purge sweep filters on (closureStatus, scheduledHardPurgeAt).
-- Index it so the sweep's table-scan cost stays bounded as the workspace
-- count grows.
CREATE INDEX "Workspace_closureStatus_scheduledHardPurgeAt_idx"
  ON "Workspace" ("closureStatus", "scheduledHardPurgeAt");

-- ============================================================
-- 3. RLS audit-log policy reuse
-- ============================================================
--
-- No new RLS policy needed:
--   * Workspace already carries `workspace_self_isolation` from
--     20260508000000_phase1_init (members read their own workspace; updates
--     are operator-only at the SQL layer). The closure server action runs
--     the Workspace UPDATE under withSystemContext so the operator branch
--     of the policy passes — same pattern integrations/disconnect uses.
--   * AuditLog already covers actor-attributed writes; the closure action
--     writes an audit row for every state transition.
