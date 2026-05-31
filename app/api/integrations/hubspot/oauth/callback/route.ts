/**
 * GET /api/integrations/hubspot/oauth/callback?code=...&state=...
 *
 * HubSpot OAuth2 callback. Wave 7. Mirrors the QuickBooks pattern:
 *   1. Verify the sealed `agentplain_oauth_state` cookie.
 *   2. Exchange code (+ the byte-matched redirect_uri) for tokens via
 *      `HubspotOAuth.exchangeCode`. HubSpot returns the hub id via a
 *      separate /oauth/v1/access-tokens/{token} introspection call.
 *   3. Encrypt tokens; upsert IntegrationCredential (provider=HUBSPOT)
 *      with providerMetadata = { hubId }.
 *   4. Audit log + redirect to /app/workspace/<id>/integrations.
 *
 * No WebhookSubscription row is created — wave 7 starts with poll-only
 * sync via the hourly sweep; HubSpot webhooks land in a later wave.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the CRM REST seam is
 * `lib/integrations/hubspot-mcp/server.ts`. This callback only speaks
 * OAuth via the `HubspotOAuth` adapter.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { withSystemContext } from '@/lib/db/rls';
import { encryptTokenSet } from '@/lib/integrations';
import { HubspotOAuth } from '@/lib/integrations/hubspot/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const INTEGRATION_ID = 'hubspot';

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

function workspaceRedirect(origin: string, cookie: OAuthStateCookie, params: Record<string, string>): NextResponse {
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
    return workspaceRedirect(origin, cookie, { error: 'integration_mismatch', detail: cookie.integrationId ?? '' });
  }
  if (errorParam) {
    return workspaceRedirect(origin, cookie, { error: 'hubspot_returned_error', detail: errorParam });
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
        where: { userId: session.userId, workspaceId: cookie.workspaceId, status: 'ACTIVE', role: 'BROKER_OWNER' },
        select: { id: true },
      }),
    );
    if (!membership) {
      return NextResponse.json({ error: 'workspace_forbidden' }, { status: 403 });
    }
  }

  const clientId = env.hubspotOAuthClientId();
  const clientSecret = env.hubspotOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return workspaceRedirect(origin, cookie, { error: 'hubspot_oauth_not_configured' });
  }

  const redirectUri = `${origin}/api/integrations/hubspot/oauth/callback`;
  const oauth = new HubspotOAuth({ clientId, clientSecret, redirectUri });
  const exchanged = await oauth.exchangeCode({ code });
  if (!exchanged.ok) {
    return workspaceRedirect(origin, cookie, {
      error: 'token_exchange_failed',
      detail: `${exchanged.error.code}: ${exchanged.error.message}`.slice(0, 240),
    });
  }

  const { tokens, hubId } = exchanged.value;
  const enc = encryptTokenSet(tokens);
  const providerMetadata = { hubId };

  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: cookie.workspaceId,
          provider: 'HUBSPOT',
          accountId: tokens.accountId,
        },
      },
      create: {
        workspaceId: cookie.workspaceId,
        provider: 'HUBSPOT',
        accountId: tokens.accountId,
        accountEmail: tokens.accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: enc.refreshTokenEncrypted,
        scopes: enc.scopes,
        expiresAt: enc.expiresAt,
        providerMetadata,
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        accountEmail: tokens.accountEmail,
        accessTokenEncrypted: enc.accessTokenEncrypted,
        refreshTokenEncrypted: enc.refreshTokenEncrypted,
        scopes: enc.scopes,
        expiresAt: enc.expiresAt,
        providerMetadata,
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
    }),
  );

  await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId: cookie.workspaceId,
        action: 'integration.connected',
        targetTable: 'IntegrationCredential',
        targetId: credential.id,
        payload: { provider: 'HUBSPOT', integrationId: INTEGRATION_ID, hubId, scopes: tokens.scopes },
      },
    }),
  );

  const res = workspaceRedirect(origin, cookie, { connected: INTEGRATION_ID });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
