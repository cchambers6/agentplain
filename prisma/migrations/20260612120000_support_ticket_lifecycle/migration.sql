-- Customer-facing support TICKET lifecycle.
-- (feat/customer-support-channel-and-ticket-lifecycle, 2026-06-12)
--
-- The "Real ticketing (Intercom/Zendesk-grade) is a later phase" promised in
-- the SupportRequestStatus comment. A first-class, customer-visible ticket
-- with a stable number, a threaded conversation, an explicit first-response
-- SLA, staff assignment, and a full open→closed lifecycle worked from
-- /operator/tickets. Coexists with SupportRequest (the quick drafted-reply
-- unit); this is for tracked, human-owned tickets.
--
-- ── id column default ──────────────────────────────────────────────────
-- The `id` columns are created WITHOUT a `DEFAULT gen_random_uuid()`. Prisma
-- generates `@default(uuid())` ids client-side, so the reconciled DB state
-- (after the repo-wide `id DROP DEFAULT` baseline — prisma/schema-drift-
-- baseline.sql) carries no DB default. Creating the columns without one keeps
-- `prisma migrate diff` empty for these tables → ZERO new drift-baseline
-- entries (same as the plaino-chatbot migration). The ONE exception is
-- SupportTicket."number", an intentional DB sequence (SERIAL) that Prisma
-- represents as @default(autoincrement()) — also drift-clean.
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- SupportTicket + SupportTicketMessage: workspace-isolation OR operator
-- (identical shape to PlainoConversation). A member reads/writes only their
-- own workspace's rows; staff (operator context) see all. The
-- internal/customer-visible split on messages is an APPLICATION-level filter
-- on top of RLS — the customer loader always excludes `internal = true`.

CREATE TYPE "SupportTicketStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_CUSTOMER',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE "SupportTicketPriority" AS ENUM (
  'P0',
  'P1',
  'P2',
  'P3'
);

CREATE TYPE "SupportTicketCategory" AS ENUM (
  'BILLING',
  'WORKFLOW',
  'INTEGRATION',
  'BUG',
  'OTHER'
);

CREATE TYPE "SupportTicketAuthor" AS ENUM (
  'CUSTOMER',
  'STAFF',
  'SYSTEM'
);

CREATE TABLE "SupportTicket" (
  "id" UUID NOT NULL,
  -- SERIAL: gap-tolerant, never-reused public ticket number. Prisma sees
  -- @default(autoincrement()); no drift-baseline entry.
  "number" SERIAL NOT NULL,
  "workspaceId" UUID NOT NULL,
  "userId" UUID,
  "subject" TEXT NOT NULL,
  "category" "SupportTicketCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'P2',
  "context" JSONB NOT NULL DEFAULT '{}',
  "assignedTo" TEXT,
  "firstResponseDueAt" TIMESTAMP(3),
  "firstRespondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");

CREATE INDEX "SupportTicket_workspaceId_createdAt_idx"
  ON "SupportTicket"("workspaceId", "createdAt");

CREATE INDEX "SupportTicket_status_priority_createdAt_idx"
  ON "SupportTicket"("status", "priority", "createdAt");

CREATE INDEX "SupportTicket_assignedTo_status_idx"
  ON "SupportTicket"("assignedTo", "status");

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket" FORCE ROW LEVEL SECURITY;

CREATE POLICY "SupportTicket_workspace_or_operator"
  ON "SupportTicket"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );

CREATE TABLE "SupportTicketMessage" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "author" "SupportTicketAuthor" NOT NULL,
  "authorUserId" UUID,
  "body" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx"
  ON "SupportTicketMessage"("ticketId", "createdAt");

CREATE INDEX "SupportTicketMessage_workspaceId_idx"
  ON "SupportTicketMessage"("workspaceId");

ALTER TABLE "SupportTicketMessage"
  ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicketMessage"
  ADD CONSTRAINT "SupportTicketMessage_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicketMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicketMessage" FORCE ROW LEVEL SECURITY;

CREATE POLICY "SupportTicketMessage_workspace_or_operator"
  ON "SupportTicketMessage"
  USING (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "workspaceId"::text = current_setting('app.workspace_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );
