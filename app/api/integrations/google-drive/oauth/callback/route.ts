/**
 * GET /api/integrations/google-drive/oauth/callback?code=...&state=...
 *
 * Google Drive Authorization Code Grant callback. SEPARATE from the Gmail
 * callback (`app/api/auth/oauth/google/callback/route.ts`) on purpose: the
 * Gmail callback forces a `users.watch` Pub/Sub subscription that fails for a
 * Drive-only grant. This callback exchanges the code via the shared
 * `GoogleOAuth` adapter and persists the `GOOGLE` `IntegrationCredential`
 * WITHOUT creating any Gmail watch.
 *
 * Drive reuses the existing Gmail Google OAuth app + the SAME `GOOGLE`
 * credential row (same Google account; the Drive scopes merge with any
 * already-granted Gmail scopes via Google's `include_granted_scopes`). Because
 * the row may already carry Gmail per-account routing data, the upsert UPDATE
 * deliberately does NOT touch `providerMetadata` — refresh + reconnect never
 * rewrite it.
 *
 *   1. Verify the sealed `agentplain_oauth_state` cookie (integrationId must
 *      be `google-drive`).
 *   2. Exchange code for tokens via `GoogleOAuth.exchangeCodeForTokens`.
 *   3. Encrypt tokens; upsert IntegrationCredential (provider=GOOGLE) keyed on
 *      workspaceId_provider_accountId. No Gmail watch, no WebhookSubscription.
 *   4. Audit log + redirect to /app/workspace/<id>/integrations.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this callback only speaks OAuth via
 * the `GoogleOAuth` adapter. The Drive REST SDK seam is
 * `lib/integrations/google-drive-mcp/server.ts`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { prisma } from '@/lib/db/prisma';
import { withSystemContext } from '@/lib/db/rls';
import { encryptTokenSet } from '@/lib/integrations';
import { GoogleOAuth } from '@/lib/integrations/google/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const INTEGRATION_ID = 'google-drive';

interface OAuthStateCookie {
  nonce: string;
  workspaceId: string;
  integrationId?: string;
  issuedAt: number;
  returnTo?: string;
}

function landingPath(cookie: OAuthStateCookie): string {
  if (cookie.returnTo && cookie.returnTo.startsWith(`/app/workspace/${cookie.workspaceId}`)) {
    return cookie.returnTo;
  }
  return `/app/workspace/${cookie.workspaceId}/integrations`;
}

function workspaceRedirect(
  origin: string,
  cookie: OAuthStateCookie,
  params: Record<string, string>,
): NextResponse {
  const url = new URL(landingPath(cookie), origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

function fallbackRedirect(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL('/app', origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();
  const origin = env.appPublicOrigin();
  const params = req.nextUrl.searchParams;
  const code = params.get('code');
  const stateParam = params.get('state');
  const errorParam = params.get('error');

  const sealed = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!sealed) return fallbackRedirect(origin, { error: 'missing_state_cookie' });
  let cookie: OAuthStateCookie;
  try {
    cookie = await unsealData<OAuthStateCookie>(sealed, { password: env.sessionPassword() });
  } catch {
    return fallbackRedirect(origin, { error: 'invalid_state_cookie' });
  }

  if (cookie.integrationId !== INTEGRATION_ID) {
    return workspaceRedirect(origin, cookie, {
      error: 'integration_mismatch',
      detail: cookie.integrationId ?? '',
    });
  }
  if (errorParam) {
    return workspaceRedirect(origin, cookie, { error: 'google_returned_error', detail: errorParam });
  }
  if (!code || !stateParam) {
    return workspaceRedirect(origin, cookie, { error: 'missing_code_or_state' });
  }
  if (cookie.nonce !== stateParam) {
    return workspaceRedirect(origin, cookie, { error: 'state_mismatch' });
  }

  // Authorization: customer-self-serve — active broker-owner of the workspace.
  if (!session.isOperator) {
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
      return NextResponse.json({ error: 'workspace_forbidden' }, { status: 403 });
    }
  }

  const clientId = env.googleOAuthClientId();
  const clientSecret = env.googleOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return workspaceRedirect(origin, cookie, { error: 'google_oauth_not_configured' });
  }

  // Redirect URI must byte-match the one used to build the authorize URL
  // (lib/integrations/oauth-urls.ts builds `<origin>/api/integrations/google-drive/oauth/callback`).
  const redirectUri = new URL('/api/integrations/google-drive/oauth/callback', origin).toString();

  const oauth = new GoogleOAuth({ clientId, clientSecret });
  const exchanged = await oauth.exchangeCodeForTokens({ code, redirectUri });
  if (!exchanged.ok) {
    return workspaceRedirect(origin, cookie, {
      error: 'token_exchange_failed',
      detail: `${exchanged.error.code}: ${exchanged.error.message}`.slice(0, 240),
    });
  }

  const tokens = exchanged.value;
  const enc = encryptTokenSet(tokens);

  // Drive shares the GOOGLE credential row with Gmail. On UPDATE, do NOT
  // clobber providerMetadata — it may hold Gmail per-account routing data
  // (e.g. Pub/Sub historyId). Only set it on CREATE (null for a fresh row).
  const credential = await prisma.integrationCredential.upsert({
    where: {
      workspaceId_provider_accountId: {
        workspaceId: cookie.workspaceId,
        provider: 'GOOGLE',
        accountId: tokens.accountId,
      },
    },
    create: {
      workspaceId: cookie.workspaceId,
      provider: 'GOOGLE',
      accountId: tokens.accountId,
      accountEmail: tokens.accountEmail,
      accessTokenEncrypted: enc.accessTokenEncrypted,
      refreshTokenEncrypted: enc.refreshTokenEncrypted,
      scopes: enc.scopes,
      expiresAt: enc.expiresAt,
      lastRefreshedAt: new Date(),
      status: 'ACTIVE',
    },
    update: {
      accountEmail: tokens.accountEmail,
      accessTokenEncrypted: enc.accessTokenEncrypted,
      refreshTokenEncrypted: enc.refreshTokenEncrypted,
      scopes: enc.scopes,
      expiresAt: enc.expiresAt,
      lastRefreshedAt: new Date(),
      status: 'ACTIVE',
      // providerMetadata deliberately omitted — left as-is so a Drive
      // reconnect never wipes Gmail's per-account routing data.
    },
  });

  const verify = await prisma.integrationCredential.findUnique({ where: { id: credential.id } });
  if (!verify) {
    return workspaceRedirect(origin, cookie, { error: 'credential_persist_verify_failed' });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      workspaceId: cookie.workspaceId,
      action: 'integration.connected',
      targetTable: 'IntegrationCredential',
      targetId: credential.id,
      payload: {
        provider: 'GOOGLE',
        integrationId: INTEGRATION_ID,
        accountEmail: tokens.accountEmail,
        scopes: tokens.scopes,
      },
    },
  });

  const res = workspaceRedirect(origin, cookie, { connected: INTEGRATION_ID });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
