-- agentplain Phase 2 — Inquiry intake (feat/max-quote-intake, 2026-05-15).
-- Persists rows for the /custom contact form so /operator/inquiries has a
-- queue to triage. Unifies the Custom-skill-build path AND the Max-tier
-- quote path through one inbox per `project_stripe_both_surfaces.md`
-- (Max is ad-hoc / quote-based; not a productized Stripe price).
--
-- No-outbound posture per `project_no_outbound_architecture.md`: the row
-- is the durable artifact; one email lands in Conner's inbox; nothing
-- auto-replies. Operator decides routing on /operator/inquiries.
--
-- RLS: operator-only. The submit path uses withSystemContext (app.is_operator='true').

CREATE TYPE "InquiryType" AS ENUM (
  'CUSTOM_SKILL_BUILD',
  'MAX_SERVICE_ENGAGEMENT',
  'NOT_SURE'
);

CREATE TYPE "InquiryStatus" AS ENUM (
  'NEW',
  'TRIAGED_CUSTOM',
  'TRIAGED_MAX',
  'TRIAGED_BOTH',
  'DECLINED',
  'CONVERTED'
);

CREATE TABLE "Inquiry" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "business" TEXT NOT NULL,
  "vertical" TEXT NOT NULL,
  "seats" TEXT NOT NULL,
  "needs" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "inquiryType" "InquiryType" NOT NULL DEFAULT 'CUSTOM_SKILL_BUILD',
  "serviceIntensityNotes" TEXT,
  "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
  "emailMessageId" TEXT,
  "triageNotes" TEXT,
  "triagedAt" TIMESTAMP(3),
  "triagedByUserId" UUID,
  "convertedWorkspaceId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inquiry_triagedByUserId_fkey"
    FOREIGN KEY ("triagedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Inquiry_status_createdAt_idx" ON "Inquiry"("status", "createdAt");
CREATE INDEX "Inquiry_inquiryType_status_idx" ON "Inquiry"("inquiryType", "status");
CREATE INDEX "Inquiry_createdAt_idx" ON "Inquiry"("createdAt");

-- RLS — operator-only for everything. The submit handler calls
-- withSystemContext (app.is_operator='true') so the public POST satisfies
-- the WITH CHECK clause without needing a logged-in user.
ALTER TABLE "Inquiry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inquiry_operator_all" ON "Inquiry"
  FOR ALL
  USING (current_setting('app.is_operator', true) = 'true')
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
