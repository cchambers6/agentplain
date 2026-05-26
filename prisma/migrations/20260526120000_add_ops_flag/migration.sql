-- agentplain — DB-backed ops flag store (P0-4).
--
-- The Inngest pause flag previously lived only in `process.env`, written
-- by `lib/ops/inngest/control.ts` via the Vercel REST API and read by
-- `lib/inngest/run-with-disable-gate.ts` from `process.env` at function
-- entry. That gave us a 5+ minute propagation lag: a Vercel env upsert
-- only takes effect on the NEXT cold start, so a pause could not stop
-- the next cron tick (the in-flight serverless invocation kept its
-- original env snapshot). Caught by the 2026-05-26 fleet architecture
-- assessment (P0-4) — see docs/fleet-architecture-assessment.md.
--
-- This table is the new source of truth for ops-managed flags. The
-- writer (`lib/ops/inngest/control.ts`) sets the row first; the gate
-- (`lib/inngest/run-with-disable-gate.ts`) reads it on every Inngest
-- function invocation. A pause now takes effect on the NEXT tick, not
-- the next cold start.
--
-- The env-var path remains as a cold-start cache / fallback for the
-- case the DB is unreachable: a missing or errored DB read defaults to
-- "consult env", and the existing strict-equality semantic
-- (`value === 'true'` is paused; everything else is active) is preserved.
-- That defends against an outage of this table taking out every cron in
-- the system — the worst case degrades to the prior behavior.
--
-- The table is intentionally operator-only — no per-workspace scope.
-- Policy: `is_operator='true'` for both USING and WITH CHECK. FORCE ROW
-- LEVEL SECURITY ensures Postgres binds the policy even for the table
-- owner role (Neon's `neondb_owner`), matching the convention applied
-- by the companion FORCE migration. Every legitimate access path goes
-- through `withSystemContext` (lib/db/rls.ts), which sets
-- `app.is_operator='true'` on the GUC before the DML runs — so cron
-- gate reads, webhook gate reads, and the throttle CLI's writes all
-- pass the policy uniformly.

-- ============================================================
-- 1. Table
-- ============================================================

CREATE TABLE "OpsFlag" (
  -- Operator-visible flag name. For Inngest pause flags this is the
  -- same string the env-var path uses (e.g.
  -- INNGEST_FN_DISABLE_AGENTPLAIN_TRIAL_WARNINGS), so the env fallback
  -- and the DB path are interchangeable without any name translation.
  "name"      TEXT NOT NULL,
  -- Flag value. For pause flags the literal string "true" means paused;
  -- any other value (including "false", unset row, garbage) means
  -- active. Strict-equality, matching `lib/inngest/disable-flag.ts`.
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  -- Free-text actor string. NOT a User FK — the writer can be a system
  -- identity ("system"), a CLI invocation ("cli:throttle.ts"), or a
  -- specific operator ("user:<uuid>"). Kept as TEXT so we don't have to
  -- model the union in the schema.
  "updatedBy" TEXT,
  -- Optional operator-supplied note (why this flag was flipped). Pure
  -- documentation; the gate does not read it.
  "note"      TEXT,

  CONSTRAINT "OpsFlag_pkey" PRIMARY KEY ("name")
);

-- Recent-write index for the ops console (future) — cheap, supports
-- "what changed in the last hour" without a sequential scan.
CREATE INDEX "OpsFlag_updatedAt_idx" ON "OpsFlag" ("updatedAt");

-- ============================================================
-- 2. RLS policy + FORCE
-- ============================================================

-- Operator-only: the only legitimate callers are cron / webhook gate
-- reads (via withSystemContext) and the ops CLI writes (also via
-- withSystemContext). No per-workspace branch.
ALTER TABLE "OpsFlag" ENABLE ROW LEVEL SECURITY;
-- FORCE binds the policy even for the table-owner role, matching the
-- convention applied to every other policied table in the schema. A
-- table-owner connection (e.g. Neon's `neondb_owner`) without the
-- `app.is_operator` GUC set will see zero rows; with the GUC set to
-- 'true', it sees everything. This is the shape required for the gate
-- and the CLI to function while still locking out any accidental bare
-- `prisma.opsFlag.*` read from a non-system code path.
ALTER TABLE "OpsFlag" FORCE ROW LEVEL SECURITY;

CREATE POLICY "ops_flag_operator_only" ON "OpsFlag"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
