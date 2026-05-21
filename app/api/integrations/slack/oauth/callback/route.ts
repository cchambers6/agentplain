/**
 * GET /api/integrations/slack/oauth/callback?code=...&state=...
 *
 * Slack OAuth v2 (user-token) callback. Mirrors the DocuSign callback:
 *   1. Verify the sealed `agentplain_oauth_state` cookie.
 *   2. Exchange code for the USER token via `SlackOAuth.exchangeCode`.
 *   3. Encrypt tokens; upsert IntegrationCredential (provider=SLACK) with
 *      providerMetadata = { teamId, teamName, slackUserId }.
 *   4. Audit log + redirect to /app/workspace/<id>/integrations.
 *
 * The redirect_uri passed to the token exchange MUST byte-match the one used
 * in the authorize URL: `<origin>/api/integrations/slack/oauth/callback`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Slack Web API seam is
 * `lib/integrations/slack-mcp/server.ts`. This callback only speaks OAuth via
 * the `SlackOAuth` adapter.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { prisma } from '@/lib/db/prisma';
import { withSystemContext } from '@/lib/db/rls';
import { encryptTokenSet } from '@/lib/integrations';
import { SlackOAuth } from '@/lib/integrations/slack/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const INTEGRATION_ID = 'slack';

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
    return workspaceRedirect(origin, cookie, { error: 'slack_returned_error', detail: errorParam });
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

  const clientId = env.slackOAuthClientId();
  const clientSecret = env.slackOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return workspaceRedirect(origin, cookie, { error: 'slack_oauth_not_configured' });
  }

  // redirect_uri MUST byte-match the authorize URL's redirect_uri.
  const redirectUri = new URL('/api/integrations/slack/oauth/callback', origin).toString();
  const oauth = new SlackOAuth({ clientId, clientSecret, redirectUri });
  const exchanged = await oauth.exchangeCode({ code });
  if (!exchanged.ok) {
    return workspaceRedirect(origin, cookie, {
      error: 'token_exchange_failed',
      detail: `${exchanged.error.code}: ${exchanged.error.message}`.slice(0, 240),
    });
  }

  const { tokens, team } = exchanged.value;
  const enc = encryptTokenSet(tokens);
  const providerMetadata = { teamId: team.teamId, teamName: team.teamName, slackUserId: team.slackUserId };

  const credential = await prisma.integrationCredential.upsert({
    where: {
      workspaceId_provider_accountId: {
        workspaceId: cookie.workspaceId,
        provider: 'SLACK',
        accountId: tokens.accountId,
      },
    },
    create: {
      workspaceId: cookie.workspaceId,
      provider: 'SLACK',
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
      payload: { provider: 'SLACK', integrationId: INTEGRATION_ID, accountEmail: tokens.accountEmail, scopes: tokens.scopes },
    },
  });

  const res = workspaceRedirect(origin, cookie, { connected: INTEGRATION_ID });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
