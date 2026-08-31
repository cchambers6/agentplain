-- agentplain — RLS coverage for the client-portal tree, TeamMembership, and
-- the outreach CRM. Closes the LAST 12 tables in the schema with no
-- row-level security of any kind.
--
-- WHAT WAS WRONG
-- --------------
-- The 2026-06-17 memory-scale migration closed six gap tables and shipped a
-- CI invariant ("every model with a workspaceId column has RLS enabled").
-- That predicate matches on a LITERAL workspaceId column, so it could only
-- ever see 1 of the 12 remaining uncovered tables — PortalConfig. The other
-- 11 are tenant-scoped one or two FK hops out and were invisible to it:
--
--     PortalClient, PortalCase, PortalInvite, PortalSession, PortalThread,
--     PortalMessage, PortalDocument   -> via portalConfigId -> PortalConfig
--     PortalCaseEvent                 -> via caseId -> PortalCase -> PortalConfig
--     TeamMembership                  -> via teamId -> Team
--     OutreachProspect, OutreachTouch -> operator-global, no tenant at all
--
-- The Portal tree is the one place we hold the customer's OWN clients' data
-- — PortalClient.name, PortalCase.reference/title and PortalDocument.filename
-- are plaintext (only PortalMessage.body is AES-GCM ciphertext). Every portal
-- access path runs through withSystemContext, and every policy in this schema
-- carries an `is_operator='true'` arm, so until this migration the database
-- had NO control over these tables at all — application code was the only one.
--
-- WHY DENORMALIZE workspaceId RATHER THAN JOIN UP THE FK CHAIN
-- -----------------------------------------------------------
-- The alternative was a policy with a correlated EXISTS subquery walking
-- portalConfigId -> PortalConfig.workspaceId. Rejected for three reasons:
--
--   1. PRECEDENT. 20260526000000_add_integration_rls hit exactly this shape
--      (WebhookEvent, one FK hop off a workspace-scoped parent) and chose to
--      denormalize, explicitly so the policy could stay "a plain column-
--      equality check (matching the pattern used by every other workspace-
--      scoped table in the schema) — same shape, same GUC names, no new
--      convention." All 52 policied tables today are column-equality. An
--      EXISTS-subquery policy would be the first of its kind in this schema.
--   2. PARTITION-READINESS. A partitioned table's PRIMARY KEY and every
--      UNIQUE constraint must include the partition column
--      (prisma/manual/20260617_partition_embedding_by_workspace.sql). A
--      workspaceId that only exists on a parent table can never become a
--      partition key here.
--   3. HOT PATH. PortalMessage is the highest-volume table in this tree
--      (every chat turn writes two rows and re-reads the thread). A
--      correlated subquery in its USING clause is evaluated per row for any
--      non-operator connection.
--
-- The cost of denormalizing is a backfill and a companion code change. Both
-- are bounded here: the backfill joins are total (every FK in every chain is
-- NOT NULL), and the code change is 6 helper signatures in lib/portal/ — all
-- of which already have workspaceId in scope at every call site. Following
-- the manual partition migration's rule, that code change ships in this same
-- release; Prisma types the new column as required, so a missed write path
-- is a compile error, not a runtime one.
--
-- OutreachProspect / OutreachTouch are NOT customer data and get no
-- workspaceId — see section 4.

-- =====================================================================
-- 1. Denormalize workspaceId — ADD COLUMN (nullable first, so the
--    backfill can run on tables that already hold rows)
-- =====================================================================
-- AlterTable
ALTER TABLE "PortalClient"    ADD COLUMN "workspaceId" UUID;
-- AlterTable
ALTER TABLE "PortalCase"      ADD COLUMN "workspaceId" UUID;
-- AlterTable
ALTER TABLE "PortalCaseEvent" ADD COLUMN "workspaceId" UUID;
-- AlterTable
ALTER TABLE "PortalInvite"    ADD COLUMN "workspaceId" UUID;
-- AlterTable
ALTER TABLE "PortalSession"   ADD COLUMN "workspaceId" UUID;
-- AlterTable
ALTER TABLE "PortalThread"    ADD COLUMN "workspaceId" UUID;
-- AlterTable
ALTER TABLE "PortalMessage"   ADD COLUMN "workspaceId" UUID;
-- AlterTable
ALTER TABLE "PortalDocument"  ADD COLUMN "workspaceId" UUID;
-- AlterTable
ALTER TABLE "TeamMembership"  ADD COLUMN "workspaceId" UUID;

-- =====================================================================
-- 2. Backfill from the FK chain. Every join column below is NOT NULL on
--    its table, and PortalConfig.workspaceId / Team.workspaceId are NOT
--    NULL, so each join is total — no row can be left unresolved except
--    by pre-existing referential corruption, which section 3 rejects.
-- =====================================================================

-- Direct: portalConfigId -> PortalConfig.workspaceId
UPDATE "PortalClient" t
SET "workspaceId" = pc."workspaceId"
FROM "PortalConfig" pc
WHERE t."portalConfigId" = pc."id" AND t."workspaceId" IS NULL;

UPDATE "PortalCase" t
SET "workspaceId" = pc."workspaceId"
FROM "PortalConfig" pc
WHERE t."portalConfigId" = pc."id" AND t."workspaceId" IS NULL;

UPDATE "PortalInvite" t
SET "workspaceId" = pc."workspaceId"
FROM "PortalConfig" pc
WHERE t."portalConfigId" = pc."id" AND t."workspaceId" IS NULL;

UPDATE "PortalSession" t
SET "workspaceId" = pc."workspaceId"
FROM "PortalConfig" pc
WHERE t."portalConfigId" = pc."id" AND t."workspaceId" IS NULL;

UPDATE "PortalThread" t
SET "workspaceId" = pc."workspaceId"
FROM "PortalConfig" pc
WHERE t."portalConfigId" = pc."id" AND t."workspaceId" IS NULL;

UPDATE "PortalMessage" t
SET "workspaceId" = pc."workspaceId"
FROM "PortalConfig" pc
WHERE t."portalConfigId" = pc."id" AND t."workspaceId" IS NULL;

UPDATE "PortalDocument" t
SET "workspaceId" = pc."workspaceId"
FROM "PortalConfig" pc
WHERE t."portalConfigId" = pc."id" AND t."workspaceId" IS NULL;

-- Two hops: caseId -> PortalCase.portalConfigId -> PortalConfig.workspaceId
UPDATE "PortalCaseEvent" t
SET "workspaceId" = pc."workspaceId"
FROM "PortalCase" c
JOIN "PortalConfig" pc ON pc."id" = c."portalConfigId"
WHERE t."caseId" = c."id" AND t."workspaceId" IS NULL;

-- teamId -> Team.workspaceId
UPDATE "TeamMembership" t
SET "workspaceId" = tm."workspaceId"
FROM "Team" tm
WHERE t."teamId" = tm."id" AND t."workspaceId" IS NULL;

-- =====================================================================
-- 3. Defense in depth — fail the migration loudly rather than ship a
--    half-tenanted table. Same guard shape as
--    20260526000000_add_integration_rls used for WebhookEvent.
-- =====================================================================
DO $$
DECLARE
  t            text;
  orphan_count integer;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'PortalClient', 'PortalCase', 'PortalCaseEvent', 'PortalInvite',
    'PortalSession', 'PortalThread', 'PortalMessage', 'PortalDocument',
    'TeamMembership'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE "workspaceId" IS NULL', t)
      INTO orphan_count;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION
        '% rows without a resolved workspaceId after backfill: %', t, orphan_count;
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- 4. Lock the column down: NOT NULL + FK to Workspace (CASCADE, matching
--    every other tenant table) + the workspace-first index the policy
--    and every workspace-scoped read will use.
-- =====================================================================
ALTER TABLE "PortalClient"    ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PortalCase"      ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PortalCaseEvent" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PortalInvite"    ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PortalSession"   ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PortalThread"    ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PortalMessage"   ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PortalDocument"  ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "TeamMembership"  ALTER COLUMN "workspaceId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "PortalClient" ADD CONSTRAINT "PortalClient_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PortalCase" ADD CONSTRAINT "PortalCase_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PortalCaseEvent" ADD CONSTRAINT "PortalCaseEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PortalInvite" ADD CONSTRAINT "PortalInvite_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PortalThread" ADD CONSTRAINT "PortalThread_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PortalDocument" ADD CONSTRAINT "PortalDocument_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PortalClient_workspaceId_idx"    ON "PortalClient"("workspaceId");
-- CreateIndex
CREATE INDEX "PortalCase_workspaceId_idx"      ON "PortalCase"("workspaceId");
-- CreateIndex
CREATE INDEX "PortalCaseEvent_workspaceId_idx" ON "PortalCaseEvent"("workspaceId");
-- CreateIndex
CREATE INDEX "PortalInvite_workspaceId_idx"    ON "PortalInvite"("workspaceId");
-- CreateIndex
CREATE INDEX "PortalSession_workspaceId_idx"   ON "PortalSession"("workspaceId");
-- CreateIndex
CREATE INDEX "PortalThread_workspaceId_idx"    ON "PortalThread"("workspaceId");
-- CreateIndex
CREATE INDEX "PortalMessage_workspaceId_idx"   ON "PortalMessage"("workspaceId");
-- CreateIndex
CREATE INDEX "PortalDocument_workspaceId_idx"  ON "PortalDocument"("workspaceId");
-- CreateIndex
CREATE INDEX "TeamMembership_workspaceId_idx"  ON "TeamMembership"("workspaceId");

-- =====================================================================
-- 5. RLS — the 10 tenant-scoped tables.
-- =====================================================================
-- Standard workspace-isolation shape (operator OR workspace match) FOR ALL,
-- + FORCE. FORCE is required because prisma migrate deploy creates the
-- tables, so Neon's neondb_owner owns them and would otherwise bypass every
-- policy (see 20260526000001_force_rls).
--
-- NOTE ON THE OPERATOR ARM: every portal path today runs under
-- withSystemContext, so the is_operator arm carries them. That is deliberate
-- — an end client has no GUC identity of their own (lib/portal/identity.ts),
-- and portalConfigId scoping remains the primary boundary. What this policy
-- adds is the floor that was missing: a connection WITHOUT operator context
-- can no longer read another tenant's portal rows, and the tables are no
-- longer invisible to the coverage invariant in
-- tests/rls-memory-scale-isolation.test.ts.

-- PortalConfig — the per-workspace portal root (already carried workspaceId).
ALTER TABLE "PortalConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_config_workspace_isolation" ON "PortalConfig"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- PortalClient — an end client of the SMB owner. `name` is plaintext.
ALTER TABLE "PortalClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalClient" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_client_workspace_isolation" ON "PortalClient"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- PortalCase — the tracked matter. `reference` + `title` are plaintext.
ALTER TABLE "PortalCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalCase" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_case_workspace_isolation" ON "PortalCase"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- PortalCaseEvent — client-visible status timeline.
ALTER TABLE "PortalCaseEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalCaseEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_case_event_workspace_isolation" ON "PortalCaseEvent"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- PortalInvite — magic-link invite (sha256 hash only, but email is plaintext).
ALTER TABLE "PortalInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalInvite" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_invite_workspace_isolation" ON "PortalInvite"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- PortalSession — live end-client session (token hash only).
ALTER TABLE "PortalSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalSession" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_session_workspace_isolation" ON "PortalSession"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- PortalThread — a client <-> Plaino conversation.
ALTER TABLE "PortalThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalThread" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_thread_workspace_isolation" ON "PortalThread"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- PortalMessage — body is AES-256-GCM ciphertext; metadata/routing is not.
ALTER TABLE "PortalMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_message_workspace_isolation" ON "PortalMessage"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- PortalDocument — `filename` is plaintext; blobUrl points at the bytes.
ALTER TABLE "PortalDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortalDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY "portal_document_workspace_isolation" ON "PortalDocument"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- TeamMembership — who is on which Wave-6 team. Team itself was policied by
-- 20260617000000_memory_scale_rls_tiering_byo; its join table was missed
-- because it has no literal workspaceId column.
ALTER TABLE "TeamMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMembership" FORCE ROW LEVEL SECURITY;
CREATE POLICY "team_membership_workspace_isolation" ON "TeamMembership"
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
-- 6. OutreachProspect / OutreachTouch — operator-global, NOT customer data
-- =====================================================================
-- These two are agentplain's OWN design-partner pipeline, not anything a
-- customer owns. The evidence, all in-repo:
--
--   * schema.prisma, the block comment above OutreachStage: "System of
--     record for the founder-led design-partner motion... Operator-only
--     surface at /operator/outreach; like LeadCapture, prospects are global
--     (they aren't customers yet, so there is no workspace to scope to)."
--   * The only writers are app/(operator)/operator/outreach/actions.ts —
--     an operator-segment route group. No product surface touches them.
--   * The stage ladder (LIST / FIT / DISCOVERY / DP_TALK / AGREEMENT /
--     ACTIVATION / ACTIVE_PILOT / NOT_YET / LOST) is the funnel that ENDS in
--     a workspace existing; a row here is by definition pre-customer.
--
-- So the right answer is NOT a workspaceId column and NOT a silent
-- omission — it is the operator-only policy this schema already uses for
-- exactly this class of table (leadcapture_operator_all in
-- 20260606000000_plaino_chatbot_conversations_leads, and inquiry_operator_all
-- before it). That is strictly stronger than an exemption: instead of being
-- excused from the coverage invariant, these tables are covered by it, and a
-- workspace-context connection is denied outright rather than filtered.

-- OutreachProspect
ALTER TABLE "OutreachProspect" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutreachProspect" FORCE ROW LEVEL SECURITY;
CREATE POLICY "outreach_prospect_operator_all" ON "OutreachProspect"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');

-- OutreachTouch — append-only touch log hanging off a prospect.
ALTER TABLE "OutreachTouch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutreachTouch" FORCE ROW LEVEL SECURITY;
CREATE POLICY "outreach_touch_operator_all" ON "OutreachTouch"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
