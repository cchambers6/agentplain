-- Trial-guarantee time-savings ledger.
-- (feat/guarantee-time-savings-walkaway-2026-06-17)
--
-- One append-only row per completed action the fleet performed, valued in
-- minutes via lib/guarantee/savings-calibration.ts. The workspace counter
-- sums these live; the Day-7 cron evaluates the sum against the guarantee
-- bar; the walk-away receipt reports what we did before the customer left.
--
-- ── id column default ──────────────────────────────────────────────────
-- `id` is created WITHOUT `DEFAULT gen_random_uuid()`. Prisma generates
-- @default(uuid()) ids client-side, so the reconciled DB state (after the
-- repo-wide `id DROP DEFAULT` baseline — prisma/schema-drift-baseline.sql)
-- carries no DB default. Creating the column without one keeps
-- `prisma migrate diff` empty → ZERO new drift-baseline entries.
--
-- ── idempotency ────────────────────────────────────────────────────────
-- The UNIQUE on (workspaceId, sourceTable, sourceId, actionType) is the
-- counter's double-count guard: an at-least-once runtime can call
-- recordSavedTime repeatedly for the same workflow artifact and the
-- duplicate insert is skipped (Prisma createMany skipDuplicates).
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- workspace-isolation OR operator (identical shape to PreferenceFeedback /
-- SupportTicket). The customer reads their own counter under workspace
-- RLS; the persist seam + Day-7 cron write under operator context.

CREATE TABLE "TimeSavingsEntry" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "actionType" TEXT NOT NULL,
  "verticalSlug" TEXT NOT NULL,
  "minutesSaved" INTEGER NOT NULL,
  "sourceTable" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimeSavingsEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimeSavingsEntry_workspaceId_sourceTable_sourceId_actionType_key"
  ON "TimeSavingsEntry"("workspaceId", "sourceTable", "sourceId", "actionType");

CREATE INDEX "TimeSavingsEntry_workspaceId_occurredAt_idx"
  ON "TimeSavingsEntry"("workspaceId", "occurredAt");

ALTER TABLE "TimeSavingsEntry"
  ADD CONSTRAINT "TimeSavingsEntry_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeSavingsEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeSavingsEntry" FORCE ROW LEVEL SECURITY;

CREATE POLICY "TimeSavingsEntry_workspace_or_operator"
  ON "TimeSavingsEntry"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );
