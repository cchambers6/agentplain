-- Wave-2 per-skill config. The customer can adjust knobs per
-- installed skill — "for follow-up-chaser, wait 7 days not 3" or
-- "cc my paralegal on intake replies" — and the skill caller reads
-- the config at every fire. Audit §9 #4 (2026-05-28) flagged the
-- absence of any per-skill knob.
--
-- The config blob lives encrypted at rest because customers will
-- inevitably surface PII into a config (sender allowlists, paralegal
-- emails). The shape is per-skill: defined in
-- `lib/skills/config.ts` as typed interfaces, persisted as a JSON
-- string inside the encrypted envelope.

CREATE TABLE "SkillConfig" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  -- Matches `lib/skills/<slug>/`. Free-form string so adding a new
  -- skill doesn't need a migration.
  "skillSlug" VARCHAR(64) NOT NULL,
  -- AES-256-GCM v1-envelope ciphertext of the per-skill JSON config.
  -- The reader decrypts + JSON.parses; defaults applied on missing
  -- keys so older configs forward-compat cleanly.
  "configJson" TEXT NOT NULL,
  "configuredByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SkillConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SkillConfig"
  ADD CONSTRAINT "SkillConfig_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SkillConfig"
  ADD CONSTRAINT "SkillConfig_configuredByUserId_fkey"
  FOREIGN KEY ("configuredByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SkillConfig_workspaceId_skillSlug_key"
  ON "SkillConfig"("workspaceId", "skillSlug");

ALTER TABLE "SkillConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillConfig" FORCE ROW LEVEL SECURITY;

CREATE POLICY "SkillConfig_tenant_isolation"
  ON "SkillConfig"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );
