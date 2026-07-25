/**
 * GET /api/integrations/google-calendar/oauth/callback?code=...&state=...
 *
 * Google Calendar Authorization Code Grant callback. SEPARATE from the Gmail
 * callback (`app/api/auth/oauth/google/callback/route.ts`) on purpose — the
 * Gmail callback forces a `users.watch` Pub/Sub subscription that fails for a
 * Calendar-only grant. Mirrors the Drive callback
 * (`app/api/integrations/google-drive/oauth/callback/route.ts`) minus the
 * file-ingestion trigger: the scheduler reads the calendar on demand, so
 * there is nothing to eagerly ingest at connect time.
 *
 * Calendar reuses the existing Gmail Google OAuth app + the SAME `GOOGLE`
 * credential row (same Google account; the Calendar scopes merge with any
 * already-granted Gmail/Drive scopes via Google's `include_granted_scopes`).
 * Because the row may already carry Gmail per-account routing data, the
 * upsert UPDATE deliberately does NOT touch `providerMetadata`.
 *
 *   1. Verify the sealed `agentplain_oauth_state` cookie (integrationId must
 *      be `google-calendar`).
 *   2. Exchange code for tokens via `GoogleOAuth.exchangeCodeForTokens`.
 *   3. Encrypt tokens; upsert IntegrationCredential (provider=GOOGLE) keyed on
 *      workspaceId_provider_accountId. No Gmail watch, no WebhookSubscription.
 *   4. Audit log + redirect to the returnTo / integrations surface.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this callback only speaks OAuth via
 * the `GoogleOAuth` adapter. The Calendar REST SDK seam is
 * `lib/integrations/google-calendar-mcp/server.ts`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { withSystemContext } from '@/lib/db/rls';
import { encryptTokenSet } from '@/lib/integrations';
import { GoogleOAuth } from '@/lib/integrations/google/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const INTEGRATION_ID = 'google-calendar';

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
  // (lib/integrations/oauth-urls.ts builds `<origin>/api/integrations/google-calendar/oauth/callback`).
  const redirectUri = new URL('/api/integrations/google-calendar/oauth/callback', origin).toString();

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

  // Calendar shares the GOOGLE credential row with Gmail + Drive. On UPDATE,
  // do NOT clobber providerMetadata — it may hold Gmail per-account routing
  // data (e.g. Pub/Sub historyId). Only set on CREATE (null for a fresh row).
  // With include_granted_scopes the token response's scope list is the UNION
  // of everything this account has granted, so overwriting `scopes` here
  // keeps the row's grant record complete rather than narrowing it.
  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
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
        // providerMetadata deliberately omitted — a Calendar reconnect never
        // wipes Gmail's per-account routing data.
      },
    }),
  );

  const verify = await withSystemContext((tx) =>
    tx.integrationCredential.findUnique({ where: { id: credential.id } }),
  );
  if (!verify) {
    return workspaceRedirect(origin, cookie, { error: 'credential_persist_verify_failed' });
  }

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
          integrationId: INTEGRATION_ID,
          accountEmail: tokens.accountEmail,
          scopes: tokens.scopes,
        },
      },
    }),
  );

  const res = workspaceRedirect(origin, cookie, { connected: INTEGRATION_ID });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
