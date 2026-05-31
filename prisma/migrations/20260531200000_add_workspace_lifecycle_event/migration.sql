-- Wave-4 phase 4 — Stripe abandoned-signup sweep. Closes the honesty
-- gap PR #123 named: a workspace that signs up + gets a magic link
-- but abandons Stripe Checkout exists with no usable Subscription.
-- The new `stripe-abandoned-signup-sweep` Inngest cron writes events
-- into WorkspaceLifecycleEvent as it nudges, deactivates, and archives
-- those workspaces.
--
-- Schema additions:
--   - Workspace.signupSetupCompletedAt — set when the first
--     `customer.subscription.created` webhook fires for the workspace.
--   - Workspace.setupDeactivatedAt — set when the sweep flips the gate
--     on (7d post-signup with no checkout); the existing PAUSED gate
--     in lib/billing/workspace-paused-gate.ts honors this.
--   - WorkspaceLifecycleEventKind enum + WorkspaceLifecycleEvent table.

CREATE TYPE "WorkspaceLifecycleEventKind" AS ENUM (
  'SETUP_NUDGE_SENT',
  'SETUP_DEACTIVATED',
  'SETUP_ARCHIVED',
  'SETUP_RESUMED'
);

ALTER TABLE "Workspace"
  ADD COLUMN "signupSetupCompletedAt" TIMESTAMP(3),
  ADD COLUMN "setupDeactivatedAt" TIMESTAMP(3);

CREATE INDEX "Workspace_signupSetupCompletedAt_setupDeactivatedAt_idx"
  ON "Workspace" ("signupSetupCompletedAt", "setupDeactivatedAt");

CREATE TABLE "WorkspaceLifecycleEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "kind" "WorkspaceLifecycleEventKind" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "noteEncrypted" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "WorkspaceLifecycleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceLifecycleEvent_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE
);

CREATE INDEX "WorkspaceLifecycleEvent_workspaceId_occurredAt_idx"
  ON "WorkspaceLifecycleEvent" ("workspaceId", "occurredAt");

CREATE INDEX "WorkspaceLifecycleEvent_kind_occurredAt_idx"
  ON "WorkspaceLifecycleEvent" ("kind", "occurredAt");

-- Wave-3 schema-drift baseline (lib/billing/workspace-paused-gate.ts)
-- treats PAUSED + PAST_DUE as the gate set; wave-4 extends the same
-- gate to honor Workspace.setupDeactivatedAt IS NOT NULL. No enum
-- change needed — the gate code reads both signals.
