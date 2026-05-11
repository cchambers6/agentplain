-- agentplain Phase 2 — Stripe per-seat subscription billing.
-- Implements project_stripe_both_surfaces.md (three-tier per-seat ladder,
-- 30-day trial, no card at signup, lookup_key-resolved Prices) and the
-- brief acceptance bar (Subscription + BillingEvent + idempotency).
--
-- Card-at-signup conflict surfaced for Conner's resolution in the PR
-- description: this migration follows the brief's `trial_period_days: 30`
-- + no-card-at-signup interpretation of feedback_max_friction_reduction_for_trials.

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'CANCELED',
  'UNPAID'
);

CREATE TYPE "SeatBand" AS ENUM (
  'SEATS_1',
  'SEATS_2_9',
  'SEATS_10_24',
  'SEATS_25_49',
  'SEATS_50_99'
);

CREATE TABLE "Subscription" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "stripeSubscriptionId" TEXT NOT NULL UNIQUE,
  "stripeCustomerId" TEXT NOT NULL,
  "tier" "WorkspaceVerticalTier" NOT NULL,
  "seatBand" "SeatBand" NOT NULL,
  "seats" INTEGER NOT NULL DEFAULT 1,
  "status" "SubscriptionStatus" NOT NULL,
  "trialEndsAt" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT FALSE,
  "defaultPaymentMethodId" TEXT,
  "lastTrialWarningDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_trialEndsAt_idx" ON "Subscription"("trialEndsAt");
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- RLS: workspace-scoped — broker-owner reads their own subscription.
-- Webhook + signup paths use the operator/system context.
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_workspace_isolation" ON "Subscription"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );

CREATE TABLE "BillingEvent" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "subscriptionId" UUID REFERENCES "Subscription"("id") ON DELETE SET NULL,
  "workspaceId" UUID,
  "type" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL UNIQUE,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "BillingEvent_subscriptionId_receivedAt_idx"
  ON "BillingEvent"("subscriptionId", "receivedAt");
CREATE INDEX "BillingEvent_workspaceId_receivedAt_idx"
  ON "BillingEvent"("workspaceId", "receivedAt");

-- BillingEvent rows are written by the webhook handler under operator
-- context (no session yet). Reads are workspace-scoped so a broker-owner
-- can render a billing timeline on /settings/billing.
ALTER TABLE "BillingEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_event_workspace_read" ON "BillingEvent"
  FOR SELECT
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
CREATE POLICY "billing_event_operator_write" ON "BillingEvent"
  FOR INSERT
  WITH CHECK (current_setting('app.is_operator', true) = 'true');
