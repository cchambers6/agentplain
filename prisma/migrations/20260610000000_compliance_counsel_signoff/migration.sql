-- pfd-5 — Compliance counsel sign-off gate.
-- (pfd/compliance-counsel-gate)
--
-- Makes "unreviewed legal text can never ship to a customer" a STRUCTURAL
-- guarantee rather than a policy one. Adds ComplianceCounselSignoff: one
-- durable row per compliance-corpus vertical recording whether counsel has
-- signed off on the corpus for that INDUSTRY. The rewrite-and-stage gate
-- (lib/agents/sentinel/counsel-signoff.ts) reads this on every fire and only
-- generates replacement legal text when the vertical is signed AND current.
--
-- PLATFORM-LEVEL, not per-workspace: counsel reviews the shared corpus for a
-- vertical once; the sign-off applies to every workspace in that vertical.
-- Hence NO workspaceId column and a UNIQUE constraint on verticalSlug.
--
-- ── fail-closed ─────────────────────────────────────────────────────────
-- The table SHIPS EMPTY. No row for a vertical = unsigned = gated. There is
-- no seed insert here on purpose: real-estate (the currently-live vertical)
-- becomes gated until an operator records its sign-off after uploading the
-- counsel artifact. See the PR's CONNER DECISION section.
--
-- ── id column default ──────────────────────────────────────────────────
-- The `id` column is created WITHOUT a `DEFAULT gen_random_uuid()`. Prisma
-- generates `@default(uuid())` ids client-side, so after the repo-wide
-- `id DROP DEFAULT` baseline (prisma/schema-drift-baseline.sql) the
-- reconciled DB state carries no DB default. Creating the column without one
-- keeps `prisma migrate diff` empty for this table, so this migration adds
-- ZERO new entries to the drift baseline.
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- Operator-only, exactly like CounselRedline / LeadCapture. The operator
-- sign-off console and the gate both run under withSystemContext
-- (app.is_operator='true'); a customer never reads or writes counsel
-- sign-off state.

CREATE TABLE "ComplianceCounselSignoff" (
  "id" UUID NOT NULL,
  "verticalSlug" VARCHAR(64) NOT NULL,
  "signedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "artifactRef" TEXT,
  "signedByEmail" VARCHAR(320),
  "signedByUserId" UUID,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceCounselSignoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceCounselSignoff_verticalSlug_key"
  ON "ComplianceCounselSignoff"("verticalSlug");

ALTER TABLE "ComplianceCounselSignoff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ComplianceCounselSignoff" FORCE ROW LEVEL SECURITY;

CREATE POLICY "compliancecounselsignoff_operator_all" ON "ComplianceCounselSignoff"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
