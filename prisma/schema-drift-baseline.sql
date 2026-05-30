-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actingAsUserId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "BillingEvent" DROP CONSTRAINT "BillingEvent_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "CapabilityProposal" DROP CONSTRAINT "CapabilityProposal_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "ComplianceFlag" DROP CONSTRAINT "ComplianceFlag_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Embedding" DROP CONSTRAINT "Embedding_documentId_fkey";

-- DropForeignKey
ALTER TABLE "Embedding" DROP CONSTRAINT "Embedding_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "HandoffLogEntry" DROP CONSTRAINT "HandoffLogEntry_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "IntegrationCredential" DROP CONSTRAINT "IntegrationCredential_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "KnowledgeDocument" DROP CONSTRAINT "KnowledgeDocument_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "MagicLinkToken" DROP CONSTRAINT "MagicLinkToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_userId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "OnboardingState" DROP CONSTRAINT "OnboardingState_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "PreferenceSignal" DROP CONSTRAINT "PreferenceSignal_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WebhookEvent" DROP CONSTRAINT "WebhookEvent_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "WebhookSubscription" DROP CONSTRAINT "WebhookSubscription_integrationCredentialId_fkey";

-- DropForeignKey
ALTER TABLE "WebhookSubscription" DROP CONSTRAINT "WebhookSubscription_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkApprovalQueueItem" DROP CONSTRAINT "WorkApprovalQueueItem_decidedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "WorkApprovalQueueItem" DROP CONSTRAINT "WorkApprovalQueueItem_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkThresholdConfig" DROP CONSTRAINT "WorkThresholdConfig_configuredByUserId_fkey";

-- DropForeignKey
ALTER TABLE "WorkThresholdConfig" DROP CONSTRAINT "WorkThresholdConfig_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceInvoice" DROP CONSTRAINT "WorkspaceInvoice_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspacePreference" DROP CONSTRAINT "WorkspacePreference_workspaceId_fkey";

-- DropIndex
DROP INDEX "Embedding_vector_cosine_idx";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BillingEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CapabilityProposal" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChatMessage" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChatThread" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ComplianceFlag" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Embedding" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HandoffLogEntry" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Inquiry" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IntegrationCredential" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LlmUsageRecord" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MagicLinkToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Membership" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OnboardingState" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PreferenceSignal" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SkillConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupportRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WebAuthnCredential" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WebhookEvent" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WebhookSubscription" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkApprovalQueueItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkThresholdConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspaceBriefing" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspaceInvoice" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspaceMemoryEntry" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspacePreference" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspaceSkillInstallation" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkThresholdConfig" ADD CONSTRAINT "WorkThresholdConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkThresholdConfig" ADD CONSTRAINT "WorkThresholdConfig_configuredByUserId_fkey" FOREIGN KEY ("configuredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkApprovalQueueItem" ADD CONSTRAINT "WorkApprovalQueueItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkApprovalQueueItem" ADD CONSTRAINT "WorkApprovalQueueItem_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffLogEntry" ADD CONSTRAINT "HandoffLogEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityProposal" ADD CONSTRAINT "CapabilityProposal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvoice" ADD CONSTRAINT "WorkspaceInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actingAsUserId_fkey" FOREIGN KEY ("actingAsUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_integrationCredentialId_fkey" FOREIGN KEY ("integrationCredentialId") REFERENCES "IntegrationCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLinkToken" ADD CONSTRAINT "MagicLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePreference" ADD CONSTRAINT "WorkspacePreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceSignal" ADD CONSTRAINT "PreferenceSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "HandoffLogEntry_subject_idx" RENAME TO "HandoffLogEntry_workspaceId_relatedSubjectTable_relatedSubj_idx";

