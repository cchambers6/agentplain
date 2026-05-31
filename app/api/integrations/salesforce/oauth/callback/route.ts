/**
 * GET /api/integrations/salesforce/oauth/callback?code=...&state=...
 *
 * Salesforce OAuth2 callback. Wave 7. Mirrors the HubSpot pattern:
 *   1. Verify the sealed `agentplain_oauth_state` cookie.
 *   2. Exchange code for tokens via `SalesforceOAuth.exchangeCode`.
 *      The Salesforce token response carries `instance_url` (per-org
 *      REST host) which we persist on providerMetadata.
 *   3. Encrypt tokens; upsert IntegrationCredential (provider=SALESFORCE)
 *      with providerMetadata = { instanceUrl, orgId }.
 *   4. Audit log + redirect to /app/workspace/<id>/integrations.
 *
 * NOTE on partner enrollment: customer-installed dev-tier Connected
 * Apps work without Salesforce partner-program enrollment. Production
 * AppExchange distribution requires Connected App security review;
 * until that lands, each customer uses their own dev Connected App.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { withSystemContext } from '@/lib/db/rls';
import { encryptTokenSet } from '@/lib/integrations';
import { SalesforceOAuth } from '@/lib/integrations/salesforce/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const INTEGRATION_ID = 'salesforce';

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
    return workspaceRedirect(origin, cookie, { error: 'salesforce_returned_error', detail: errorParam });
  }
  if (!code || !stateParam) {
    return workspaceRedirect(origin, cookie, { error: 'missing_code_or_state' });
  }
  if (cookie.nonce !== stateParam) {
    return workspaceRedirect(origin, cookie, { error: 'state_mismatch' });
  }

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

  const clientId = env.salesforceOAuthClientId();
  const clientSecret = env.salesforceOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return workspaceRedirect(origin, cookie, { error: 'salesforce_oauth_not_configured' });
  }

  const redirectUri = `${origin}/api/integrations/salesforce/oauth/callback`;
  const oauth = new SalesforceOAuth({
    clientId,
    clientSecret,
    loginHost: env.salesforceLoginHost(),
    redirectUri,
  });
  const exchanged = await oauth.exchangeCode({ code });
  if (!exchanged.ok) {
    return workspaceRedirect(origin, cookie, {
      error: 'token_exchange_failed',
      detail: `${exchanged.error.code}: ${exchanged.error.message}`.slice(0, 240),
    });
  }

  const { tokens, instanceUrl, orgId, username } = exchanged.value;
  const enc = encryptTokenSet(tokens);
  const providerMetadata = { instanceUrl, orgId, username };

  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: cookie.workspaceId,
          provider: 'SALESFORCE',
          accountId: tokens.accountId,
        },
      },
      create: {
        workspaceId: cookie.workspaceId,
        provider: 'SALESFORCE',
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
        payload: { provider: 'SALESFORCE', integrationId: INTEGRATION_ID, orgId, instanceUrl, scopes: tokens.scopes },
      },
    }),
  );

  const res = workspaceRedirect(origin, cookie, { connected: INTEGRATION_ID });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
