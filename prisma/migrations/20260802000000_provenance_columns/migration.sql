-- Provenance at the write door.
-- (provenance-writedoor-2026-08-01)
--
-- One nullable JSONB column per provenance-bearing table, holding the
-- block defined by lib/provenance/types.ts:
--
--   { sourceType, origin, recordType, sourceRef, storedBy,
--     sourceHash, confidence, verified, capturedAt }
--
-- ── why the column is NULLABLE ─────────────────────────────────────────
-- Rows written before 2026-08 have no block and never will — backfilling
-- one would be inventing a citation, which is exactly the dishonesty this
-- work exists to prevent (feedback_no_guesses_no_estimates). NULL is the
-- truthful value for a legacy row, and the read path
-- (parseStoredProvenance) treats NULL as "unknown source" rather than
-- throwing. The customer-facing memory page keeps its legacy rendering
-- for those rows.
--
-- ── why there is no NOT NULL / CHECK constraint ────────────────────────
-- Enforcement lives in the application write door (assertProvenance), not
-- in Postgres. A DB constraint could only assert "some JSON is present";
-- it could not assert the cross-field honesty rules (an inference is
-- never born verified; a customer-chat block must claim customer origin).
-- Splitting enforcement across two layers would let the weaker one become
-- the de-facto contract. One door, one check, one place to read it.
--
-- ── drift ─────────────────────────────────────────────────────────────
-- Plain nullable column adds. `prisma migrate diff` stays empty, so this
-- needs NO entry in prisma/schema-drift-baseline.sql (that file exists for
-- raw-SQL index migrations Prisma cannot see).
--
-- ── RLS ───────────────────────────────────────────────────────────────
-- Untouched. Adding a column to an existing table inherits the table's
-- existing row-level policies; no policy references the new column.

ALTER TABLE "WorkspaceMemoryEntry" ADD COLUMN "provenance" JSONB;

ALTER TABLE "WorkApprovalQueueItem" ADD COLUMN "provenance" JSONB;

ALTER TABLE "TimeSavingsEntry" ADD COLUMN "provenance" JSONB;

ALTER TABLE "LeadCapture" ADD COLUMN "provenance" JSONB;
