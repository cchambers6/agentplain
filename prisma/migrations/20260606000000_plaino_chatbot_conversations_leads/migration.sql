-- Plaino chatbot — marketing widget + in-app support backbone.
-- (feat/plaino-chatbot-marketing-support-2026-06-06)
--
-- Two surfaces, one backbone (app/api/chat with a `mode` flag):
--   * MARKETING — anonymous site widget. Sales-tuned. Can capture a lead.
--   * SUPPORT   — authenticated in-app chat. Workspace-aware; answers from
--                 the knowledge substrate and drafts replies into the
--                 existing operator review queue (kind=SUPPORT_HANDLER_REPLY_DRAFT).
--
-- Adds:
--   * PlainoConversation — the per-conversation log both modes write to,
--     feeding the drift sweep + voice-fingerprinting passes. `turns` is an
--     AES-256-GCM envelope at rest (lib/security/payload-crypto).
--   * LeadCapture — operator-only marketing-lead queue (mirrors Inquiry).
--
-- ── id column default ──────────────────────────────────────────────────
-- The `id` columns are created WITHOUT a `DEFAULT gen_random_uuid()`. Prisma
-- generates `@default(uuid())` ids client-side, so the reconciled DB state
-- (after the repo-wide `id DROP DEFAULT` baseline — see
-- prisma/schema-drift-baseline.sql) carries no DB default. Creating the
-- column without one keeps `prisma migrate diff` empty for these tables, so
-- this migration adds ZERO new entries to the drift baseline.
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- PlainoConversation: workspace-isolation (SUPPORT rows, signed-in member)
-- OR operator-all (MARKETING anonymous writes via withSystemContext + the
-- operator console). A NULL-workspace MARKETING row is reachable only by the
-- operator clause, so a customer can never read another visitor's chat.
-- LeadCapture: operator-only, exactly like Inquiry — the capture endpoint
-- persists under withSystemContext.

CREATE TYPE "PlainoConversationMode" AS ENUM (
  'MARKETING',
  'SUPPORT'
);

CREATE TYPE "LeadCaptureStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'CONVERTED',
  'DECLINED'
);

CREATE TABLE "PlainoConversation" (
  "id" UUID NOT NULL,
  "mode" "PlainoConversationMode" NOT NULL,
  "workspaceId" UUID,
  "sessionId" TEXT NOT NULL,
  "sourcePage" TEXT,
  "turns" JSONB NOT NULL,
  "leadCaptured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlainoConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlainoConversation_mode_createdAt_idx"
  ON "PlainoConversation"("mode", "createdAt");

CREATE INDEX "PlainoConversation_workspaceId_createdAt_idx"
  ON "PlainoConversation"("workspaceId", "createdAt");

ALTER TABLE "PlainoConversation"
  ADD CONSTRAINT "PlainoConversation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlainoConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlainoConversation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "PlainoConversation_workspace_or_operator"
  ON "PlainoConversation"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );

CREATE TABLE "LeadCapture" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "business" TEXT,
  "vertical" TEXT,
  "intent" TEXT NOT NULL,
  "sourcePage" TEXT,
  "conversationId" UUID,
  "status" "LeadCaptureStatus" NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "triagedAt" TIMESTAMP(3),
  "triagedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadCapture_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadCapture_status_createdAt_idx"
  ON "LeadCapture"("status", "createdAt");

CREATE INDEX "LeadCapture_createdAt_idx"
  ON "LeadCapture"("createdAt");

-- RLS — operator-only. The capture handler calls withSystemContext
-- (app.is_operator='true') so the anonymous POST satisfies WITH CHECK
-- without a logged-in user, mirroring Inquiry.
ALTER TABLE "LeadCapture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadCapture" FORCE ROW LEVEL SECURITY;

CREATE POLICY "leadcapture_operator_all" ON "LeadCapture"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
