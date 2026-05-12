-- agentplain Phase 2 — Gmail integration plumbing (P0-10 / P0-12 PR-B).
-- Adds IntegrationCredential + WebhookSubscription + WebhookEvent so the
-- OAuth flow + Pub/Sub push receiver + renewal cron have storage to land on.
-- Functional acceptance (read/categorize/coordinate/schedule/draft on Conner's
-- inbox) is PR-C; this migration ships plumbing only per
-- feedback_integration_acceptance_is_functional.md.
--
-- Encrypted-at-rest tokens via lib/security/encryption.ts (AES-256-GCM v1 format).
-- The token columns hold v1:iv:tag:ciphertext blobs — never plaintext.
--
-- Gmail watch lifetime: 7 days per https://developers.google.com/workspace/gmail/api/guides/push
-- (read 2026-05-11). Renewal cron sweeps rows with expires_at < now() + 24h
-- and re-calls users.watch — same Pub/Sub topic, fresh expiration.

CREATE TYPE "IntegrationProvider" AS ENUM (
  'GOOGLE',
  'M365'
);

CREATE TYPE "IntegrationCredentialStatus" AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'ERROR'
);

CREATE TYPE "WebhookSubscriptionStatus" AS ENUM (
  'ACTIVE',
  'EXPIRING',
  'EXPIRED',
  'RENEWAL_FAILED',
  'UNSUBSCRIBED'
);

CREATE TABLE "IntegrationCredential" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "provider" "IntegrationProvider" NOT NULL,
  "accountId" TEXT NOT NULL,
  "accountEmail" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT '{}',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastRefreshedAt" TIMESTAMP(3),
  "status" "IntegrationCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "IntegrationCredential_workspaceId_provider_accountId_key"
  ON "IntegrationCredential"("workspaceId", "provider", "accountId");

CREATE INDEX "IntegrationCredential_workspaceId_provider_idx"
  ON "IntegrationCredential"("workspaceId", "provider");

CREATE INDEX "IntegrationCredential_status_expiresAt_idx"
  ON "IntegrationCredential"("status", "expiresAt");

CREATE TABLE "WebhookSubscription" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId" UUID NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "integrationCredentialId" UUID NOT NULL REFERENCES "IntegrationCredential"("id") ON DELETE CASCADE,
  "provider" "IntegrationProvider" NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "notificationUrl" TEXT NOT NULL,
  "lastRenewedAt" TIMESTAMP(3),
  "status" "WebhookSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "WebhookSubscription_workspaceId_provider_idx"
  ON "WebhookSubscription"("workspaceId", "provider");

CREATE INDEX "WebhookSubscription_status_expiresAt_idx"
  ON "WebhookSubscription"("status", "expiresAt");

CREATE INDEX "WebhookSubscription_integrationCredentialId_idx"
  ON "WebhookSubscription"("integrationCredentialId");

CREATE TABLE "WebhookEvent" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "subscriptionId" UUID NOT NULL REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE,
  "rawPayload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed" BOOLEAN NOT NULL DEFAULT FALSE,
  "processedAt" TIMESTAMP(3),
  "error" TEXT
);

CREATE INDEX "WebhookEvent_subscriptionId_receivedAt_idx"
  ON "WebhookEvent"("subscriptionId", "receivedAt");

CREATE INDEX "WebhookEvent_processed_receivedAt_idx"
  ON "WebhookEvent"("processed", "receivedAt");
