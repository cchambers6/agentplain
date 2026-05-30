-- Wave-2 skill marketplace. Today the agents page is read-only — the
-- customer cannot say "this skill is on" / "this skill is off" beyond
-- the 8-discipline toggle (audit §9 #5). This table is the workspace
-- × skill join row that the marketplace page writes into and every
-- runtime caller reads at fire time.
--
-- Default-install rules (in code, not in this table): the 5 horizontal
-- LIVE skills + the per-vertical LIVE skill matching workspace.vertical
-- are installed by default for new workspaces — NO row in this table
-- means "default-installed when the catalog says LIVE; not installed
-- otherwise." An uninstall writes a row with `disabledAt` set. A
-- re-install clears `disabledAt`. The reader treats `disabledAt IS NULL`
-- as installed.

CREATE TABLE "WorkspaceSkillInstallation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  -- Matches `lib/skills/<slug>/` and `SKILL_CATALOG.slug`. Free-form
  -- string so adding a new skill needs no migration.
  "skillSlug" VARCHAR(64) NOT NULL,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "installedByUserId" UUID,
  -- NULL = currently installed. Non-null = customer uninstalled at
  -- that timestamp; the row stays so the audit / reinstall flow can
  -- see the history.
  "disabledAt" TIMESTAMP(3),
  CONSTRAINT "WorkspaceSkillInstallation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkspaceSkillInstallation"
  ADD CONSTRAINT "WorkspaceSkillInstallation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceSkillInstallation"
  ADD CONSTRAINT "WorkspaceSkillInstallation_installedByUserId_fkey"
  FOREIGN KEY ("installedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WorkspaceSkillInstallation_workspaceId_skillSlug_key"
  ON "WorkspaceSkillInstallation"("workspaceId", "skillSlug");

CREATE INDEX "WorkspaceSkillInstallation_workspaceId_disabledAt_idx"
  ON "WorkspaceSkillInstallation"("workspaceId", "disabledAt");

ALTER TABLE "WorkspaceSkillInstallation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceSkillInstallation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "WorkspaceSkillInstallation_tenant_isolation"
  ON "WorkspaceSkillInstallation"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );
