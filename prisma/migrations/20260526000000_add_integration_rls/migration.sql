-- agentplain — RLS policies on the integration plumbing tables.
--
-- The Phase-2 Gmail migration (20260511180000_add_gmail_integration) created
-- `IntegrationCredential`, `WebhookSubscription`, `WebhookEvent` without
-- enabling row-level security, even though all three carry per-workspace
-- data. `IntegrationCredential` is the highest-sensitivity table in the
-- schema (encrypted OAuth refresh tokens). This was caught by the 2026-05-26
-- fleet architecture review (P0-1) — see docs/fleet-architecture-assessment.md.
--
-- This migration closes the gap:
--   1. Denormalize `workspaceId` onto WebhookEvent so the RLS policy can be
--      a plain column-equality check (matching the pattern used by every
--      other workspace-scoped table in the schema). Backfilled from the FK
--      join against WebhookSubscription, then made NOT NULL + FK CASCADE.
--   2. Enable RLS on all three tables and add the standard
--      "operator OR workspace match" policy used by WorkApprovalQueueItem,
--      HandoffLogEntry, ComplianceFlag, WorkspaceInvoice, etc. — same shape,
--      same GUC names (app.is_operator, app.workspace_id), no new convention.
--
-- The application-layer companion is wrapping every read/write to these
-- tables in `withSystemContext` / `withRls` — without that wrapping the
-- legitimate SYSTEM writes (webhook drain, renewal sweep, OAuth token
-- storage) would be rejected by the new policies. The wave5 isolation test
-- (tests/wave5-multitenant-isolation.test.ts) source-greps for bare
-- prisma.<model>. reads to lock that discipline in at CI time.

-- ============================================================
-- 1. WebhookEvent.workspaceId — denormalize for column-equality RLS
-- ============================================================

ALTER TABLE "WebhookEvent"
  ADD COLUMN "workspaceId" UUID;

-- Backfill from the parent WebhookSubscription. The FK is NOT NULL on every
-- existing row so this join is total.
UPDATE "WebhookEvent" we
SET "workspaceId" = ws."workspaceId"
FROM "WebhookSubscription" ws
WHERE we."subscriptionId" = ws."id"
  AND we."workspaceId" IS NULL;

-- Defense in depth: if any rows didn't get a workspaceId from the join
-- (would indicate orphaned events), fail the migration loudly.
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM "WebhookEvent" WHERE "workspaceId" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'WebhookEvent rows without resolved workspaceId after backfill: %', orphan_count;
  END IF;
END $$;

ALTER TABLE "WebhookEvent"
  ALTER COLUMN "workspaceId" SET NOT NULL;

ALTER TABLE "WebhookEvent"
  ADD CONSTRAINT "WebhookEvent_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WebhookEvent_workspaceId_idx"
  ON "WebhookEvent"("workspaceId");

-- ============================================================
-- 2. RLS policies (standard workspace-isolation shape)
-- ============================================================

-- IntegrationCredential
ALTER TABLE "IntegrationCredential" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_credential_workspace_isolation" ON "IntegrationCredential"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- WebhookSubscription
ALTER TABLE "WebhookSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_subscription_workspace_isolation" ON "WebhookSubscription"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- WebhookEvent (now carries denormalized workspaceId)
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_event_workspace_isolation" ON "WebhookEvent"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
