-- Plaino customer-persistent memory (feat/plaino-memory-2026-05-28).
--
-- One workspace-isolated table:
--   * WorkspaceMemoryEntry — durable per-workspace memory that Plaino
--     reads on every dispatch and writes to from extract-from-
--     conversation. `body` is encrypted at rest (AES-256-GCM, v1
--     envelope) for the same reason ChatMessage.body is — customers
--     surface PII into memory entries unprompted.
--
-- Same RLS posture as ChatThread / ChatMessage: ENABLE + FORCE; policy
-- gates on app.workspace_id GUC with the operator escape. Workspace A's
-- entries can never be read or written from workspace B's context.
--
-- The composite (workspaceId, kind, pinned, createdAt) index serves the
-- dispatcher's per-fire read pattern — "pinned first, then by recency,
-- scoped to this workspace + kind" — without a sort step. The
-- (workspaceId, pinned, updatedAt) index serves the customer-facing
-- memory page which lists by recency across kinds.
--
-- Additive + NULLABLE-safe: no existing table is mutated. Rolling back
-- is a one-step DROP of the table + the enum.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
CREATE TYPE "WorkspaceMemoryKind" AS ENUM ('USER', 'FEEDBACK', 'PROJECT', 'REFERENCE');

-- ---------------------------------------------------------------------------
-- WorkspaceMemoryEntry
-- ---------------------------------------------------------------------------
CREATE TABLE "WorkspaceMemoryEntry" (
  "id"                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId"         UUID NOT NULL,
  "kind"                "WorkspaceMemoryKind" NOT NULL,
  "title"               TEXT NOT NULL,
  "body"                TEXT NOT NULL,
  "sourceChatMessageId" UUID,
  "pinned"              BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  "lastReadAt"          TIMESTAMP(3),
  CONSTRAINT "WorkspaceMemoryEntry_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceMemoryEntry_sourceChatMessageId_fkey"
    FOREIGN KEY ("sourceChatMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WorkspaceMemoryEntry_workspaceId_kind_pinned_createdAt_idx"
  ON "WorkspaceMemoryEntry"("workspaceId", "kind", "pinned", "createdAt");
CREATE INDEX "WorkspaceMemoryEntry_workspaceId_pinned_updatedAt_idx"
  ON "WorkspaceMemoryEntry"("workspaceId", "pinned", "updatedAt");

ALTER TABLE "WorkspaceMemoryEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMemoryEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspace_memory_entry_workspace_isolation" ON "WorkspaceMemoryEntry"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
