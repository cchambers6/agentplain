-- Client portal (app/portal/[customerSlug]). Per-workspace branded portal
-- through which the SMB owner gives THEIR end clients status, doc upload, and
-- owner-gated Plaino chat. See lib/portal/* + schema.prisma "Client portal"
-- block. These tables are NOT under the workspace RLS policies (an end client
-- has no app.user_id/app.workspace_id GUC); access is mediated in the app layer
-- by portalConfigId scoping + verified PortalSession.

-- Outgoing client-portal message approval kind. Additive enum value — like the
-- DocuSign kinds, gates a MUTATING outbound action (a message to the owner's
-- end client). Never used in THIS migration's table DDL, so safe to add in the
-- same transaction.
ALTER TYPE "WorkApprovalKind" ADD VALUE IF NOT EXISTS 'PORTAL_CLIENT_MESSAGE';

-- CreateEnum
CREATE TYPE "PortalCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PortalActor" AS ENUM ('CLIENT', 'OWNER', 'PLAINO');

-- CreateEnum
CREATE TYPE "PortalMessageDelivery" AS ENUM ('DELIVERED', 'PENDING_APPROVAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "PortalScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateTable
CREATE TABLE "PortalConfig" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "brandColor" TEXT NOT NULL DEFAULT '#B65D3A',
    "brandLogoUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalClient" (
    "id" UUID NOT NULL,
    "portalConfigId" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalCase" (
    "id" UUID NOT NULL,
    "portalConfigId" UUID NOT NULL,
    "clientId" UUID,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PortalCaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalCaseEvent" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "actor" "PortalActor" NOT NULL DEFAULT 'OWNER',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalInvite" (
    "id" UUID NOT NULL,
    "portalConfigId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" UUID NOT NULL,
    "portalConfigId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalThread" (
    "id" UUID NOT NULL,
    "portalConfigId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "caseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMessage" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "portalConfigId" UUID NOT NULL,
    "sender" "PortalActor" NOT NULL,
    "body" TEXT NOT NULL,
    "deliveryStatus" "PortalMessageDelivery" NOT NULL DEFAULT 'DELIVERED',
    "approvalItemId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalDocument" (
    "id" UUID NOT NULL,
    "portalConfigId" UUID NOT NULL,
    "clientId" UUID,
    "caseId" UUID,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "scanStatus" "PortalScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanDetail" TEXT,
    "uploadedBy" "PortalActor" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedAt" TIMESTAMP(3),

    CONSTRAINT "PortalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalConfig_workspaceId_key" ON "PortalConfig"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalConfig_slug_key" ON "PortalConfig"("slug");

-- CreateIndex
CREATE INDEX "PortalConfig_slug_idx" ON "PortalConfig"("slug");

-- CreateIndex
CREATE INDEX "PortalClient_portalConfigId_idx" ON "PortalClient"("portalConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalClient_portalConfigId_email_key" ON "PortalClient"("portalConfigId", "email");

-- CreateIndex
CREATE INDEX "PortalCase_portalConfigId_status_idx" ON "PortalCase"("portalConfigId", "status");

-- CreateIndex
CREATE INDEX "PortalCase_clientId_idx" ON "PortalCase"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalCase_portalConfigId_reference_key" ON "PortalCase"("portalConfigId", "reference");

-- CreateIndex
CREATE INDEX "PortalCaseEvent_caseId_occurredAt_idx" ON "PortalCaseEvent"("caseId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalInvite_tokenHash_key" ON "PortalInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalInvite_portalConfigId_idx" ON "PortalInvite"("portalConfigId");

-- CreateIndex
CREATE INDEX "PortalInvite_clientId_idx" ON "PortalInvite"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_tokenHash_key" ON "PortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalSession_clientId_idx" ON "PortalSession"("clientId");

-- CreateIndex
CREATE INDEX "PortalSession_portalConfigId_idx" ON "PortalSession"("portalConfigId");

-- CreateIndex
CREATE INDEX "PortalThread_portalConfigId_clientId_idx" ON "PortalThread"("portalConfigId", "clientId");

-- CreateIndex
CREATE INDEX "PortalThread_clientId_updatedAt_idx" ON "PortalThread"("clientId", "updatedAt");

-- CreateIndex
CREATE INDEX "PortalMessage_threadId_createdAt_idx" ON "PortalMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "PortalMessage_approvalItemId_idx" ON "PortalMessage"("approvalItemId");

-- CreateIndex
CREATE INDEX "PortalDocument_portalConfigId_scanStatus_idx" ON "PortalDocument"("portalConfigId", "scanStatus");

-- CreateIndex
CREATE INDEX "PortalDocument_caseId_idx" ON "PortalDocument"("caseId");

-- CreateIndex
CREATE INDEX "PortalDocument_clientId_idx" ON "PortalDocument"("clientId");

-- AddForeignKey
ALTER TABLE "PortalConfig" ADD CONSTRAINT "PortalConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalClient" ADD CONSTRAINT "PortalClient_portalConfigId_fkey" FOREIGN KEY ("portalConfigId") REFERENCES "PortalConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalCase" ADD CONSTRAINT "PortalCase_portalConfigId_fkey" FOREIGN KEY ("portalConfigId") REFERENCES "PortalConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalCase" ADD CONSTRAINT "PortalCase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PortalClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalCaseEvent" ADD CONSTRAINT "PortalCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PortalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalInvite" ADD CONSTRAINT "PortalInvite_portalConfigId_fkey" FOREIGN KEY ("portalConfigId") REFERENCES "PortalConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalInvite" ADD CONSTRAINT "PortalInvite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PortalClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_portalConfigId_fkey" FOREIGN KEY ("portalConfigId") REFERENCES "PortalConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PortalClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalThread" ADD CONSTRAINT "PortalThread_portalConfigId_fkey" FOREIGN KEY ("portalConfigId") REFERENCES "PortalConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalThread" ADD CONSTRAINT "PortalThread_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PortalClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalThread" ADD CONSTRAINT "PortalThread_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PortalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "PortalThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_portalConfigId_fkey" FOREIGN KEY ("portalConfigId") REFERENCES "PortalConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocument" ADD CONSTRAINT "PortalDocument_portalConfigId_fkey" FOREIGN KEY ("portalConfigId") REFERENCES "PortalConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocument" ADD CONSTRAINT "PortalDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PortalCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocument" ADD CONSTRAINT "PortalDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PortalClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
