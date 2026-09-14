-- agentplain — ApprovalEvidence: the append-only approval record.
--
-- AUTHORED, NOT APPLIED. `prisma migrate deploy` and `prisma migrate resolve`
-- are Conner's to run. See the PR description for the pre-flight.
--
-- WHAT THIS ASSUMES ABOUT EXISTING DATA
-- -------------------------------------
-- Nothing. Every statement below is additive and touches no existing row:
-- one new table, two new indexes, one new function, one new trigger. There is
-- no backfill, no ALTER of an existing table, no column added to a table that
-- holds rows, and no constraint applied to pre-existing data. The only
-- pre-existing objects referenced are "Workspace"("id") and "User"("id"), both
-- of which exist in every migration state at or after 20260511180000.
--
-- It therefore cannot fail on data shape. The failure modes that remain are
-- environmental: the migration lane being blocked (see 20260618000003), or the
-- database being unreachable. Both are outside this file.
--
-- WHY THERE IS NO FOREIGN KEY TO "WorkApprovalQueueItem"
-- -----------------------------------------------------
-- This is the load-bearing decision in the whole migration.
--
-- The queue item is deleted by three reachable paths (two crons and a
-- customer-facing one-tap walk-away; enumerated in lib/approvals/evidence.ts).
-- An FK to it has only bad options:
--
--   ON DELETE CASCADE  — deletes the evidence with the thing it is evidence
--                        of. Defeats the table entirely.
--   ON DELETE RESTRICT — makes the customer's own "delete my data" button
--                        fail at runtime. Worse than either alternative: it
--                        breaks a shipped promise loudly and at the moment of
--                        greatest customer distrust.
--   ON DELETE SET NULL — loses the only link back to the decided row.
--
-- "approvalItemId" is therefore a plain indexed UUID column, deliberately
-- unconstrained. It records WHICH item was decided and survives that item's
-- deletion, which is the entire point. The trade — a dangling id after
-- teardown — is correct here: the evidence row carries its own full copy of
-- everything that mattered (kind, agentSlug, refTable/refId, body, snapshot),
-- so it is self-sufficient without the parent.
--
-- WHY "workspaceId" IS NULLABLE WITH SET NULL
-- -------------------------------------------
-- Exactly the shape "AuditLog" already uses, and for the same reason: the row
-- must outlive the workspace. Workspace closure severs the tenant link and
-- leaves the evidence, rather than cascading it away.
--
-- Consequence, stated plainly: the RLS policy below is a column-equality
-- check, so a post-teardown row (workspaceId IS NULL) matches NO tenant and is
-- visible only under the operator grant. That is intended. Evidence for a
-- departed customer is a legal artifact for agentplain's own defence, not a
-- tenant-readable record.

-- =====================================================================
-- 1. The table
-- =====================================================================
-- CreateTable
CREATE TABLE "ApprovalEvidence" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId"     UUID,
    -- Deliberately NOT a foreign key. See the header.
    "approvalItemId"  UUID         NOT NULL,
    "kind"            TEXT         NOT NULL,
    "agentSlug"       TEXT         NOT NULL,
    "refTable"        TEXT         NOT NULL,
    "refId"           TEXT         NOT NULL,
    "decision"        TEXT         NOT NULL,
    "decisionReason"  TEXT,
    "route"           TEXT         NOT NULL,
    -- Decision time and send time are DISTINCT values, by explicit
    -- requirement. "decidedAt" is copied from the decision write, never
    -- defaulted to now(), so it is the decision's clock and not this row's.
    "decidedAt"       TIMESTAMP(3) NOT NULL,
    -- NULL unless the writing seam itself performed the send. The fleet
    -- drafts and the customer's own system sends, so on the human and machine
    -- routes we cannot observe a send and this column honestly stays NULL.
    -- A later confirmed send APPENDS A NEW ROW; it does not update this one.
    "sentAt"          TIMESTAMP(3),
    "decidedByUserId" UUID,
    -- Did the human rewrite the draft before approving it? Derived from the
    -- payload's "editedAt" stamp, which editApprovalDraft writes.
    "humanEdited"     BOOLEAN      NOT NULL DEFAULT false,
    "subject"         TEXT,
    -- Discrete addressees only, never a parsed display line.
    "recipients"      TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "fromAccount"     TEXT,
    -- AES-256-GCM envelopes (lib/security/payload-crypto.ts), same as
    -- WorkApprovalQueueItem.payload. The ledger is not a plaintext copy of
    -- data that is ciphertext one table over.
    "approvedBody"    JSONB        NOT NULL,
    "payloadSnapshot" JSONB        NOT NULL,
    -- This row's own clock, for detecting a gap between decision and record.
    "recordedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ApprovalEvidence_decision_check"
        CHECK ("decision" IN ('APPROVED', 'AUTO_APPROVED', 'REJECTED')),
    CONSTRAINT "ApprovalEvidence_route_check"
        CHECK ("route" IN ('human', 'machine', 'operator'))
);

-- =====================================================================
-- 2. Indexes — the two questions discovery actually asks
-- =====================================================================
-- "everything this workspace decided, newest first"
CREATE INDEX "ApprovalEvidence_workspaceId_decidedAt_idx"
    ON "ApprovalEvidence" ("workspaceId", "decidedAt");
-- "the evidence for THIS approval" — the join that replaces the absent FK
CREATE INDEX "ApprovalEvidence_approvalItemId_idx"
    ON "ApprovalEvidence" ("approvalItemId");

-- Note the absence of a UNIQUE constraint on "approvalItemId". Append-only
-- means a second row for the same item is a legitimate later event (a
-- confirmed send), not a duplicate to be rejected.

-- =====================================================================
-- 3. Foreign keys — both SET NULL, both to tables that outlive nothing
-- =====================================================================
-- AddForeignKey
ALTER TABLE "ApprovalEvidence"
    ADD CONSTRAINT "ApprovalEvidence_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalEvidence"
    ADD CONSTRAINT "ApprovalEvidence_decidedByUserId_fkey"
    FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- 4. APPEND-ONLY, ENFORCED IN THE DATABASE
-- =====================================================================
-- A comment saying "do not update this" is not a control. A ledger the
-- application can rewrite is not evidence.
--
-- Enforced with a row trigger rather than REVOKE UPDATE/DELETE, deliberately:
-- this schema has no GRANT/REVOKE anywhere (verified across prisma/migrations
-- at origin/main), the deploy role and the runtime role are not distinguished
-- here, and a table owner is not restrained by REVOKE on its own table. A
-- trigger is role-independent and fails the same way for everyone.
--
-- DDL is unaffected: a future migration can still ALTER or DROP this table,
-- and a legal-hold-driven purge would run
--   ALTER TABLE "ApprovalEvidence" DISABLE TRIGGER "approval_evidence_append_only";
-- deliberately, in its own migration, with a reason written down.
CREATE OR REPLACE FUNCTION approval_evidence_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'ApprovalEvidence is append-only: % is not permitted on this table',
        TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "approval_evidence_append_only"
    BEFORE UPDATE OR DELETE ON "ApprovalEvidence"
    FOR EACH ROW EXECUTE FUNCTION approval_evidence_append_only();

-- =====================================================================
-- 5. Row-level security — same shape as every other policied table
-- =====================================================================
-- Column-equality, matching all 52+ existing policies. See
-- 20260830000000_portal_team_outreach_rls for why this schema does not use
-- EXISTS-subquery policies.
--
-- The WITH CHECK arm permits an INSERT whose "workspaceId" matches the
-- connection's workspace, so evidence is written on the tenant's own
-- connection inside the tenant's own transaction — which is the requirement.
ALTER TABLE "ApprovalEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalEvidence" FORCE ROW LEVEL SECURITY;

CREATE POLICY "approval_evidence_workspace_isolation" ON "ApprovalEvidence"
    FOR ALL
    USING (
      current_setting('app.is_operator', true) = 'true'
      OR "workspaceId"::text = current_setting('app.workspace_id', true)
    )
    WITH CHECK (
      current_setting('app.is_operator', true) = 'true'
      OR "workspaceId"::text = current_setting('app.workspace_id', true)
    );
