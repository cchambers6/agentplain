-- Mobile app V2 — push notifications + Sign in with Apple.
-- (feat/mobile-app-v2-polish-2026-06-06)
--
-- Adds:
--   * PushDevice — one row per physical device's Expo push token, scoped to
--     User. Powers /api/mobile/push/register and the approval-ready push
--     fan-out (lib/push). The token is an opaque routing handle, not a
--     secret, so it is stored in the clear (like WebAuthnCredential.publicKey).
--   * User.appleSub — the Apple "Sign in with Apple" stable subject claim,
--     letting a returning Apple user re-match even when Apple withholds the
--     email on subsequent logins. One identity, multiple auth methods.
--
-- ── id column default ──────────────────────────────────────────────────
-- PushDevice.id is created WITHOUT `DEFAULT gen_random_uuid()`. Prisma
-- generates `@default(uuid())` ids client-side, so the reconciled DB state
-- (after the repo-wide `id DROP DEFAULT` baseline — see
-- prisma/schema-drift-baseline.sql) carries no DB default. Creating the
-- column without one keeps `prisma migrate diff` empty for this table, so
-- this migration adds ZERO new entries to the drift baseline.
--
-- ── RLS ────────────────────────────────────────────────────────────────
-- PushDevice: user-isolation (`app.user_id`) OR operator-all. The register
-- route runs under the signed-in user's RLS context; the approval-trigger
-- fan-out runs under withSystemContext (app.is_operator='true') and reads
-- every owner's devices — mirroring the briefing fan-out. A customer can
-- never read another user's device tokens.
--
-- User already has RLS enabled from the phase-1 init migration; adding a
-- nullable column + unique index needs no policy change.

ALTER TABLE "User" ADD COLUMN "appleSub" TEXT;

CREATE UNIQUE INDEX "User_appleSub_key" ON "User"("appleSub");

CREATE TABLE "PushDevice" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "expoPushToken" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "deviceName" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDevice_expoPushToken_key"
  ON "PushDevice"("expoPushToken");

CREATE INDEX "PushDevice_userId_enabled_idx"
  ON "PushDevice"("userId", "enabled");

ALTER TABLE "PushDevice"
  ADD CONSTRAINT "PushDevice_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushDevice" FORCE ROW LEVEL SECURITY;

CREATE POLICY "PushDevice_user_or_operator"
  ON "PushDevice"
  USING (
    "userId"::text = current_setting('app.user_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  )
  WITH CHECK (
    "userId"::text = current_setting('app.user_id', true)
    OR current_setting('app.is_operator', true) = 'true'
  );
