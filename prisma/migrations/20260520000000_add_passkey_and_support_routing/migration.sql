-- agentplain Phase 2 — Passkey (WebAuthn) auth + support routing scaffold
-- (feat/passkey-auth-and-support-routing-2026-05-20).
--
-- Two independent net-new surfaces:
--   1. WebAuthnCredential — an ADDITIONAL sign-in option alongside the magic
--      link. Scoped to User (auth is user-level; resolves default workspace
--      afterward, like MagicLinkToken). RLS: self-or-system, mirroring the
--      MagicLinkToken policy — registration runs under the user GUC, the
--      authenticate lookup-by-credentialId runs under the system/operator GUC
--      (no session exists yet).
--   2. SupportRequest — workspace-scoped support inbox scaffold. RLS:
--      workspace-isolation (operator OR matching workspace GUC), mirroring
--      WorkApprovalQueueItem. The customer submits under their workspace
--      context; operators read everything under the system GUC.

-- ---------------------------------------------------------------------------
-- WebAuthnCredential
-- ---------------------------------------------------------------------------
CREATE TABLE "WebAuthnCredential" (
  "id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId"       UUID NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey"    TEXT NOT NULL,
  "counter"      BIGINT NOT NULL DEFAULT 0,
  "transports"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "label"        TEXT,
  "deviceType"   TEXT,
  "backedUp"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"   TIMESTAMP(3),
  CONSTRAINT "WebAuthnCredential_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");
CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");

-- RLS — self-or-system, identical posture to MagicLinkToken. The operator/
-- system context (app.is_operator='true') covers the pre-session authenticate
-- lookup; the owning user covers registration + settings management.
ALTER TABLE "WebAuthnCredential" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webauthn_self_or_system" ON "WebAuthnCredential"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "userId"::text = current_setting('app.user_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "userId"::text = current_setting('app.user_id', true)
  );

-- ---------------------------------------------------------------------------
-- SupportRequest
-- ---------------------------------------------------------------------------
CREATE TYPE "SupportRequestStatus" AS ENUM ('NEW', 'OPEN', 'RESOLVED');

CREATE TABLE "SupportRequest" (
  "id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "workspaceId"    UUID NOT NULL,
  "fromUserId"     UUID,
  "subject"        TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "status"         "SupportRequestStatus" NOT NULL DEFAULT 'NEW',
  "emailMessageId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportRequest_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupportRequest_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SupportRequest_workspaceId_createdAt_idx" ON "SupportRequest"("workspaceId", "createdAt");
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

-- RLS — workspace isolation, identical posture to WorkApprovalQueueItem.
ALTER TABLE "SupportRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_request_workspace_isolation" ON "SupportRequest"
  FOR ALL
  USING (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  )
  WITH CHECK (
    current_setting('app.is_operator', true) = 'true'
    OR "workspaceId"::text = current_setting('app.workspace_id', true)
  );
