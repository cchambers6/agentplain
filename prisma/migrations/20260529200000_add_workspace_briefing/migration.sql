-- Wave-2 briefings generator. The page at
-- /app/workspace/[id]/briefings has promised "Briefings land here at
-- 9am ET each workday" since the read-only Notion provider shipped —
-- audit §8 #5 (2026-05-28) flagged the page as fiction because no
-- generator existed. This migration adds the durable row the wave-2
-- generator writes into.
--
-- `body` is encrypted at rest with the v1 envelope
-- (lib/security/encryption — `v1:iv:tag:ct`) because the briefing
-- inevitably names customers, deals, and quoted email fragments. The
-- generator's only readers are the page render path and the
-- notification email; both decrypt before surfacing.
--
-- `summary` is a non-PII aggregate (counts, top categories) used to
-- render the briefings list without round-tripping every row through
-- decryption.

CREATE TABLE "WorkspaceBriefing" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  -- ISO Y-M-D (UTC) the briefing covers. One briefing per workspace per
  -- day; the @@unique below enforces it so a cron retry is idempotent.
  "forDate" VARCHAR(10) NOT NULL,
  -- AES-256-GCM ciphertext using the v1 envelope. NEVER plaintext at rest.
  "body" TEXT NOT NULL,
  -- Aggregate counts + top categories. Schema lives in
  -- lib/skills/briefing-generator/types.ts; widening is a JSON column
  -- write, not a migration.
  "summary" JSONB NOT NULL DEFAULT '{}',
  -- READY / FAILED / EMPTY. Future statuses may include MUTED for the
  -- per-workspace mute path. String so widening is schema-cheap.
  "status" VARCHAR(16) NOT NULL DEFAULT 'READY',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Set by the notification email path. NULL = email queued but not
  -- yet sent (or skipped because of the workspace-level mute).
  "emailedAt" TIMESTAMP(3),
  CONSTRAINT "WorkspaceBriefing_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkspaceBriefing"
  ADD CONSTRAINT "WorkspaceBriefing_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WorkspaceBriefing_workspaceId_forDate_key"
  ON "WorkspaceBriefing"("workspaceId", "forDate");

CREATE INDEX "WorkspaceBriefing_workspaceId_generatedAt_idx"
  ON "WorkspaceBriefing"("workspaceId", "generatedAt");

-- Per-workspace mute toggle. NULL = briefings enabled (the default).
-- Non-null = customer turned them off; the generator skips and the
-- page renders a "muted — turn back on" empty state.
ALTER TABLE "WorkspacePreference"
  ADD COLUMN "briefingsMutedAt" TIMESTAMP(3);

-- RLS posture matches every other workspace-scoped table. The
-- generator writes through `withSystemContext`; the page reads
-- through the user's RLS context.
ALTER TABLE "WorkspaceBriefing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceBriefing" FORCE ROW LEVEL SECURITY;

CREATE POLICY "WorkspaceBriefing_tenant_isolation"
  ON "WorkspaceBriefing"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );
