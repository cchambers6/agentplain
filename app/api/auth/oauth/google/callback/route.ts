/**
 * GET /api/auth/oauth/google/callback?code=...&state=...
 *
 * OAuth2 callback per https://developers.google.com/identity/protocols/oauth2/web-server
 * (read 2026-05-11). Sequence:
 *   1. Read the encrypted `agentplain_oauth_state` cookie. Reject if missing,
 *      expired, or mismatched against the `state` query param.
 *   2. Exchange `code` for tokens via `GoogleOAuth.exchangeCodeForTokens`.
 *   3. Encrypt the tokens via `lib/security/encryption.ts`.
 *   4. Upsert into `IntegrationCredential` (unique on workspace+provider+accountId).
 *   5. Call `users.watch` to create the Pub/Sub subscription.
 *   6. Upsert `WebhookSubscription`.
 *   7. Append a row to `agent-state/integrations_audit_log.md` is OUT OF
 *      SCOPE for the route handler (filesystem writes in serverless are
 *      ephemeral). Audit rows for connect events land in the AuditLog
 *      Prisma table; the markdown audit log is renewal-cron-driven from
 *      a cron context that runs in a writable filesystem (or future
 *      shared blob storage).
 *   8. Redirect operator to /operator/integrations.
 *
 * Per `feedback_verify_after_create`: after every DB write, the next step
 * reads it back. The webhook subscription create reads back the credential
 * we just upserted, etc.
 *
 * On any failure: the redirect target is /operator/integrations?error=<code>
 * so the operator sees the failure mode inline.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { GoogleOAuth } from '@/lib/integrations/google/oauth';
import { decryptCredential, encryptTokenSet, getProvider } from '@/lib/integrations';
import { requireUser } from '@/lib/auth/server';
import { withSystemContext } from '@/lib/db/rls';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';

// Backwards-compatible cookie shape. The legacy operator-only start route
// (/api/auth/oauth/google/connect) writes the 3-field shape. The Phase C
// customer-self-serve start route (/api/integrations/[id]/oauth/start)
// also sets `integrationId` — when present, the success path lands on the
// workspace integrations page instead of /operator/integrations. The same
// start route may also set `returnTo` (e.g. onboarding step 2 deep-link)
// — when present and workspace-scoped, the success path lands on that
// origin so the user doesn't get bounced out of the flow they came from.
interface OAuthStateCookie {
  nonce: string;
  workspaceId: string;
  integrationId?: string;
  issuedAt: number;
  returnTo?: string;
}

function landingBase(cookie: OAuthStateCookie): string {
  if (cookie.integrationId) {
    if (
      cookie.returnTo &&
      cookie.returnTo.startsWith(`/app/workspace/${cookie.workspaceId}`)
    ) {
      return cookie.returnTo;
    }
    return `/app/workspace/${cookie.workspaceId}/integrations`;
  }
  return '/operator/integrations';
}

function redirectWithError(
  origin: string,
  cookie: OAuthStateCookie,
  code: string,
  detail?: string,
): NextResponse {
  const url = new URL(landingBase(cookie), origin);
  url.searchParams.set('error', code);
  if (detail) url.searchParams.set('detail', detail.slice(0, 240));
  return NextResponse.redirect(url);
}

function redirectSuccess(
  origin: string,
  cookie: OAuthStateCookie,
  credentialId: string,
): NextResponse {
  const url = new URL(landingBase(cookie), origin);
  // Operator path expects the credential id; customer path expects the
  // integration id so the marketplace banner can name the connector.
  if (cookie.integrationId) {
    url.searchParams.set('connected', cookie.integrationId);
  } else {
    url.searchParams.set('connected', credentialId);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();
  const origin = env.appPublicOrigin();
  const params = req.nextUrl.searchParams;
  const code = params.get('code');
  const stateParam = params.get('state');
  const errorParam = params.get('error');

  // Read + clear the state cookie BEFORE the error branches so we can land
  // on the right page (operator vs customer marketplace) on every failure.
  // The unseal will throw if expired/tampered.
  const sealed = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!sealed) {
    return NextResponse.redirect(
      new URL('/operator/integrations?error=missing_state_cookie', origin),
    );
  }
  let cookie: OAuthStateCookie;
  try {
    cookie = await unsealData<OAuthStateCookie>(sealed, {
      password: env.sessionPassword(),
    });
  } catch {
    return NextResponse.redirect(
      new URL('/operator/integrations?error=invalid_state_cookie', origin),
    );
  }

  // Authorization: operators can complete any connect (legacy flow). For
  // the customer-self-serve flow (cookie has `integrationId`), the signed-
  // in user must be an active broker-owner of the workspace they connected.
  if (!session.isOperator) {
    if (!cookie.integrationId) {
      return NextResponse.json(
        { error: 'operator_only' },
        { status: 403 },
      );
    }
    const membership = await withSystemContext((tx) =>
      tx.membership.findFirst({
        where: {
          userId: session.userId,
          workspaceId: cookie.workspaceId,
          status: 'ACTIVE',
          role: 'BROKER_OWNER',
        },
        select: { id: true },
      }),
    );
    if (!membership) {
      return NextResponse.json(
        { error: 'workspace_forbidden' },
        { status: 403 },
      );
    }
  }

  if (errorParam) {
    // Google returns ?error=access_denied when the user denies consent.
    return redirectWithError(origin, cookie, 'google_returned_error', errorParam);
  }
  if (!code || !stateParam) {
    return redirectWithError(origin, cookie, 'missing_code_or_state');
  }
  if (cookie.nonce !== stateParam) {
    return redirectWithError(origin, cookie, 'state_mismatch');
  }

  // Exchange code for tokens.
  const clientId = env.googleOAuthClientId();
  const clientSecret = env.googleOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return redirectWithError(origin, cookie, 'google_oauth_not_configured');
  }
  const oauth = new GoogleOAuth({ clientId, clientSecret });
  const redirectUri = new URL('/api/auth/oauth/google/callback', origin).toString();
  const tokens = await oauth.exchangeCodeForTokens({ code, redirectUri });
  if (!tokens.ok) {
    return redirectWithError(origin, cookie, 'token_exchange_failed', `${tokens.error.code}: ${tokens.error.message}`);
  }

  // Persist credential (encrypted at rest). IntegrationCredential is now
  // workspace-scoped RLS (20260526000000_add_integration_rls), so every
  // read/write runs through withSystemContext — the OAuth callback is the
  // first time we know which workspace the credential belongs to and we
  // act on behalf of the system to provision it.
  const enc = encryptTokenSet(tokens.value);
  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: cookie.workspaceId,
          provider: 'GOOGLE',
          accountId: tokens.value.accountId,
        },
      },
      create: {
        workspaceId: cookie.workspaceId,
        provider: 'GOOGLE',
        accountId: tokens.value.accountId,
        accountEmail: tokens.value.accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: enc.refreshTokenEncrypted,
        scopes: enc.scopes,
        expiresAt: enc.expiresAt,
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        accountEmail: tokens.value.accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: enc.refreshTokenEncrypted,
        scopes: enc.scopes,
        expiresAt: enc.expiresAt,
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
    }),
  );

  // Verify-after-create: re-read the credential to assert it persisted.
  const verifyCred = await withSystemContext((tx) =>
    tx.integrationCredential.findUnique({
      where: { id: credential.id },
    }),
  );
  if (!verifyCred) {
    return redirectWithError(origin, cookie, 'credential_persist_verify_failed');
  }

  // Subscribe to Gmail push notifications.
  try {
    const provider = getProvider('GOOGLE');
    const decrypted = decryptCredential(verifyCred);
    const notificationUrl = new URL('/api/webhooks/google', origin).toString();
    const sub = await provider.createSubscription({
      credential: decrypted,
      notificationUrl,
    });
    if (!sub.ok) {
      // Credential is good but subscription failed. Don't bail — let the
      // renewal cron retry. Surface the error on the operator UI.
      await withSystemContext((tx) =>
        tx.auditLog.create({
          data: {
            actorUserId: session.userId,
            workspaceId: cookie.workspaceId,
            action: 'integration.subscription.create_failed',
            targetTable: 'IntegrationCredential',
            targetId: credential.id,
            payload: {
              provider: 'GOOGLE',
              error: {
                code: sub.error.code,
                message: sub.error.message,
                status: sub.error.status ?? null,
              },
            },
          },
        }),
      );
      return redirectWithError(origin, cookie, 'subscription_failed', `${sub.error.code}: ${sub.error.message}`);
    }

    await withSystemContext(async (tx) => {
      // No unique key on subscriptionId alone — find the existing row
      // (if any) and then upsert by primary key. Both reads run inside
      // the same system-context transaction so the RLS policy resolves
      // against a single GUC set.
      const existing = await tx.webhookSubscription.findFirst({
        where: {
          workspaceId: cookie.workspaceId,
          integrationCredentialId: credential.id,
          provider: 'GOOGLE',
        },
        select: { id: true },
      });
      await tx.webhookSubscription.upsert({
        where: { id: existing?.id ?? '00000000-0000-0000-0000-000000000000' },
        create: {
          workspaceId: cookie.workspaceId,
          integrationCredentialId: credential.id,
          provider: 'GOOGLE',
          subscriptionId: sub.value.providerSubscriptionId,
          resource: sub.value.resource,
          expiresAt: sub.value.expiresAt,
          notificationUrl,
          lastRenewedAt: new Date(),
          status: 'ACTIVE',
        },
        update: {
          subscriptionId: sub.value.providerSubscriptionId,
          resource: sub.value.resource,
          expiresAt: sub.value.expiresAt,
          notificationUrl,
          lastRenewedAt: new Date(),
          status: 'ACTIVE',
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return redirectWithError(origin, cookie, 'subscription_create_threw', message);
  }

  // Audit row (DB-side; markdown audit log is renewal-cron-driven).
  await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId: cookie.workspaceId,
        action: 'integration.connected',
        targetTable: 'IntegrationCredential',
        targetId: credential.id,
        payload: {
          provider: 'GOOGLE',
          accountEmail: tokens.value.accountEmail,
          scopes: tokens.value.scopes,
        },
      },
    }),
  );

  const res = redirectSuccess(origin, cookie, credential.id);
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
