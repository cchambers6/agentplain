-- Phase 1 init migration: schema + RLS policies.
-- RLS is the LAST line of defense per engineering_plan.md §5.5; route handlers still
-- assert actor.has_role_in(workspace, role) at the application layer.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ENUMS
CREATE TYPE "Role" AS ENUM ('BROKER_OWNER', 'AGENT');
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'DEACTIVATED');
CREATE TYPE "WorkspaceTier" AS ENUM ('HIGH_TOUCH', 'SCALED');
CREATE TYPE "WorkspaceBillingMode" AS ENUM ('MANUAL_INVOICE', 'STRIPE_SUBSCRIPTION');
CREATE TYPE "WorkApprovalKind" AS ENUM ('COMPLIANCE_FLAG', 'LISTING_RECOMMENDATION', 'BUYER_INQUIRY_REPLY_DRAFT', 'PRICING_RECOMMENDATION');
CREATE TYPE "WorkApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED', 'EXPIRED');
CREATE TYPE "ComplianceSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'BLOCKER');
CREATE TYPE "ComplianceFlagState" AS ENUM ('OPEN', 'TRIAGED_KEEP', 'TRIAGED_REWRITE', 'TRIAGED_BLOCK', 'RESOLVED');
CREATE TYPE "CapabilityProposalState" AS ENUM ('DRAFT', 'AWAITING_VOICE_BLOCK', 'AWAITING_REVIEW', 'RATIFIED', 'REJECTED', 'SUPERSEDED');

-- USERS
CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email" CITEXT NOT NULL UNIQUE,
  "name" TEXT,
  "isOperator" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "User_email_idx" ON "User"("email");

-- WORKSPACES
CREATE TABLE "Workspace" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "tier" "WorkspaceTier" NOT NULL DEFAULT 'HIGH_TOUCH',
  "stateCode" VARCHAR(2) NOT NULL DEFAULT 'GA',
  "billingMode" "WorkspaceBillingMode" NOT NULL DEFAULT 'MANUAL_INVOICE',
  "stripeCustomerId" TEXT UNIQUE,
  "stripeSubscriptionId" TEXT UNIQUE,
  "tierPriceUsdMonthly" INTEGER,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Workspace_slug_idx" ON "Workspace"("slug");

-- MEMBERSHIPS
CREATE TABLE "Membership" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "role" "Role" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("userId", "workspaceId")
);
CREATE INDEX "Membership_workspaceId_role_idx" ON "Membership"("workspaceId", "role");

-- WORK THRESHOLD CONFIG
CREATE TABLE "WorkThresholdConfig" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "kind" "WorkApprovalKind" NOT NULL,
  "requiresApprovalAboveSeverity" "ComplianceSeverity",
  "requiresApprovalForActionKinds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "autoApproveWhen" JSONB,
  "configuredByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "configuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspaceId", "kind")
);

-- WORK APPROVAL QUEUE
CREATE TABLE "WorkApprovalQueueItem" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentSlug" TEXT NOT NULL,
  "kind" "WorkApprovalKind" NOT NULL,
  "refTable" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "WorkApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "decisionReason" TEXT
);
CREATE INDEX "WorkApprovalQueueItem_workspaceId_status_idx" ON "WorkApprovalQueueItem"("workspaceId", "status");
CREATE INDEX "WorkApprovalQueueItem_workspaceId_kind_status_idx" ON "WorkApprovalQueueItem"("workspaceId", "kind", "status");

-- HANDOFF LOG (append-only by convention; no UPDATE / DELETE triggers in V1)
CREATE TABLE "HandoffLogEntry" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "fromAgent" TEXT NOT NULL,
  "toAgent" TEXT NOT NULL,
  "handoffType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "relatedSubjectTable" TEXT,
  "relatedSubjectId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "HandoffLogEntry_workspaceId_occurredAt_idx" ON "HandoffLogEntry"("workspaceId", "occurredAt");
CREATE INDEX "HandoffLogEntry_subject_idx" ON "HandoffLogEntry"("workspaceId", "relatedSubjectTable", "relatedSubjectId");

-- COMPLIANCE FLAG
CREATE TABLE "ComplianceFlag" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "sourceRecordTable" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "raisedByAgent" TEXT NOT NULL,
  "severity" "ComplianceSeverity" NOT NULL,
  "claim" TEXT NOT NULL,
  "rule" TEXT NOT NULL,
  "suggestedRewrite" TEXT,
  "state" "ComplianceFlagState" NOT NULL DEFAULT 'OPEN',
  "slaDueAt" TIMESTAMP(3),
  "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX "ComplianceFlag_workspaceId_state_idx" ON "ComplianceFlag"("workspaceId", "state");
CREATE INDEX "ComplianceFlag_workspaceId_slaDueAt_idx" ON "ComplianceFlag"("workspaceId", "slaDueAt");

-- CAPABILITY PROPOSAL (operator-internal mirror; customer roles never read)
CREATE TABLE "CapabilityProposal" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID REFERENCES "Workspace"("id") ON DELETE SET NULL,
  "notionPageId" TEXT UNIQUE,
  "targetAgentSlug" TEXT,
  "proposer" TEXT,
  "body" TEXT NOT NULL,
  "voiceBlock" TEXT,
  "voiceBlockHash" TEXT,
  "state" "CapabilityProposalState" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CapabilityProposal_workspaceId_state_idx" ON "CapabilityProposal"("workspaceId", "state");
CREATE INDEX "CapabilityProposal_state_idx" ON "CapabilityProposal"("state");

-- WORKSPACE INVOICE
CREATE TABLE "WorkspaceInvoice" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "stripeInvoiceId" TEXT UNIQUE,
  "amountUsdCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "hostedInvoiceUrl" TEXT,
  "pdfUrl" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3)
);
CREATE INDEX "WorkspaceInvoice_workspaceId_issuedAt_idx" ON "WorkspaceInvoice"("workspaceId", "issuedAt");

-- AUDIT LOG
CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "actorUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "actingAsUserId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "workspaceId" UUID REFERENCES "Workspace"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "targetTable" TEXT,
  "targetId" TEXT,
  "payload" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_workspaceId_occurredAt_idx" ON "AuditLog"("workspaceId", "occurredAt");
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt");

-- MAGIC LINK TOKEN
CREATE TABLE "MagicLinkToken" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "purpose" TEXT NOT NULL DEFAULT 'sign_in',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MagicLinkToken_userId_expiresAt_idx" ON "MagicLinkToken"("userId", "expiresAt");

-- =====================================================================
-- ROW-LEVEL SECURITY
-- =====================================================================
-- Connection setup per request sets app.workspace_id and app.is_operator
-- via SELECT set_config('app.workspace_id', ..., true) inside a transaction.
-- See lib/db/rls.ts for the wrapper.

-- WORKSPACE itself: a member sees only their workspaces; operator sees all.
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_member_read" ON "Workspace"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR id::text = current_setting('app.workspace_id', true)
  );
CREATE POLICY "workspace_operator_write" ON "Workspace"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');

-- MEMBERSHIP: scoped by current workspace context; operator full.
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membership_workspace_isolation" ON "Membership"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- WorkThresholdConfig
ALTER TABLE "WorkThresholdConfig" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wtc_workspace_isolation" ON "WorkThresholdConfig"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- WorkApprovalQueueItem
ALTER TABLE "WorkApprovalQueueItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waqi_workspace_isolation" ON "WorkApprovalQueueItem"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- HandoffLogEntry
ALTER TABLE "HandoffLogEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "handoff_workspace_isolation" ON "HandoffLogEntry"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- ComplianceFlag
ALTER TABLE "ComplianceFlag" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flag_workspace_isolation" ON "ComplianceFlag"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- CapabilityProposal — OPERATOR ONLY. Customer roles cannot read this table.
ALTER TABLE "CapabilityProposal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capability_proposal_operator_only" ON "CapabilityProposal"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');

-- WorkspaceInvoice
ALTER TABLE "WorkspaceInvoice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_workspace_isolation" ON "WorkspaceInvoice"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

-- AuditLog: workspace-scoped reads; INSERT happens under operator/system contexts.
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_workspace_read" ON "AuditLog"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
CREATE POLICY "audit_operator_write" ON "AuditLog"
  FOR INSERT
  WITH CHECK (current_setting('app.is_operator', true) = 'true' OR "actorUserId" IS NOT NULL);

-- User table is NOT workspace-scoped. Reads gated at app layer.
-- We still enable RLS to prevent stray cross-tenant queries.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_self_or_operator" ON "User"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR id::text = current_setting('app.user_id', true)
    -- members of the same workspace can read each other's basic profile
    OR EXISTS (
      SELECT 1 FROM "Membership" m
      WHERE m."userId" = "User".id
        AND m."workspaceId"::text = current_setting('app.workspace_id', true)
    )
  );
CREATE POLICY "user_self_or_operator_write" ON "User"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR id::text = current_setting('app.user_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR id::text = current_setting('app.user_id', true)
  );

-- MagicLinkToken: only the system (operator context) and the owning user can read.
ALTER TABLE "MagicLinkToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "magic_link_self_or_system" ON "MagicLinkToken"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "userId"::text = current_setting('app.user_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "userId"::text = current_setting('app.user_id', true)
  );
