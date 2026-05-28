-- Talk-to-Plaino chat surface (feat/talk-to-plaino-chat-v1-2026-05-28).
--
-- Two new tables, both workspace-isolated under RLS:
--   * ChatThread  — one per workspace in v1.
--   * ChatMessage — encrypted-at-rest message log.
--
-- Both follow the same workspace-isolation posture as SupportRequest
-- and WorkApprovalQueueItem: operator (app.is_operator='true') sees
-- everything; otherwise the workspace GUC must match. RLS isolation
-- of these two tables is the load-bearing property the v1 spec
-- demands — "workspace A's threads can never appear in workspace B."
--
-- ChatMessage.body holds AES-256-GCM ciphertext using the v1 envelope
-- (lib/security/encryption — "v1:iv:tag:ct"). Plaintext NEVER reaches
-- the DB. The application layer decrypts at read time.
--
-- Additive + NULLABLE-safe: no existing table is mutated. Rolling
-- back is a two-step DROP.

-- ---------------------------------------------------------------------------
-- ChatThread
-- ---------------------------------------------------------------------------
CREATE TABLE "ChatThread" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL,
  "title"       TEXT NOT NULL DEFAULT 'talk with Plaino',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatThread_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ChatThread_workspaceId_updatedAt_idx"
  ON "ChatThread"("workspaceId", "updatedAt");

ALTER TABLE "ChatThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatThread" FORCE ROW LEVEL SECURITY;
CREATE POLICY "chat_thread_workspace_isolation" ON "ChatThread"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- ---------------------------------------------------------------------------
-- ChatMessage
-- ---------------------------------------------------------------------------
CREATE TABLE "ChatMessage" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "threadId"    UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "role"        TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatMessage_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatMessage_role_check"
    CHECK ("role" IN ('customer', 'plaino'))
);

CREATE INDEX "ChatMessage_threadId_createdAt_idx"
  ON "ChatMessage"("threadId", "createdAt");
CREATE INDEX "ChatMessage_workspaceId_createdAt_idx"
  ON "ChatMessage"("workspaceId", "createdAt");

ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY "chat_message_workspace_isolation" ON "ChatMessage"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
