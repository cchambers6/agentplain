/**
 * GET /api/integrations/notion/oauth/callback?code=...&state=...
 *
 * Notion OAuth2 callback. Wave 7. Mirrors the HubSpot pattern with two
 * differences:
 *   1. Notion access tokens DO NOT EXPIRE and there is no refresh path.
 *      We persist with a sentinel far-future expiresAt and null refresh
 *      token (like the FUB API-key flow).
 *   2. After persisting the credential, the route fires a background
 *      Notion-ingest event so the customer's pages land in the knowledge
 *      substrate (pgvector-indexed) without the user having to wait for
 *      the next 6-hour sweep — the "research-on-demand has real context
 *      from day one" requirement from wave 7.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Notion REST seam is
 * `lib/integrations/notion-mcp/server.ts`. This callback only speaks
 * OAuth via the `NotionOAuth` adapter.
 *
 * Per `project_no_outbound_architecture.md`: this route writes durable
 * state + queues an inbound-only ingestion sweep. No mail / SMS /
 * customer-facing send.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { withSystemContext } from '@/lib/db/rls';
import { encrypt } from '@/lib/security/encryption';
import { NotionOAuth, NOTION_SENTINEL_EXPIRES_AT } from '@/lib/integrations/notion/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';
import { inngest } from '@/lib/inngest/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const INTEGRATION_ID = 'notion';

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
    return workspaceRedirect(origin, cookie, { error: 'notion_returned_error', detail: errorParam });
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

  const clientId = env.notionOAuthClientId();
  const clientSecret = env.notionOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return workspaceRedirect(origin, cookie, { error: 'notion_oauth_not_configured' });
  }

  const redirectUri = `${origin}/api/integrations/notion/oauth/callback`;
  const oauth = new NotionOAuth({ clientId, clientSecret, redirectUri });
  const exchanged = await oauth.exchangeCode({ code });
  if (!exchanged.ok) {
    return workspaceRedirect(origin, cookie, {
      error: 'token_exchange_failed',
      detail: `${exchanged.error.code}: ${exchanged.error.message}`.slice(0, 240),
    });
  }

  const { tokens, botId, workspaceId: notionWorkspaceId, workspaceName } = exchanged.value;
  // Notion tokens never expire → store the encrypted access token on
  // `accessTokenEncrypted`, leave `refreshTokenEncrypted` NULL, and pin
  // `expiresAt` to the sentinel. We do NOT route through the generic
  // `encryptTokenSet` helper because that helper expects a refresh token
  // bundle; we encrypt directly.
  const accessCipher = encrypt(tokens.accessToken);
  const providerMetadata = { botId, workspaceName, notionWorkspaceId };

  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: cookie.workspaceId,
          provider: 'NOTION',
          accountId: tokens.accountId,
        },
      },
      create: {
        workspaceId: cookie.workspaceId,
        provider: 'NOTION',
        accountId: tokens.accountId,
        accountEmail: tokens.accountEmail,
        accessTokenEncrypted: accessCipher,
        refreshTokenEncrypted: null,
        scopes: tokens.scopes,
        expiresAt: NOTION_SENTINEL_EXPIRES_AT,
        providerMetadata,
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        accountEmail: tokens.accountEmail,
        accessTokenEncrypted: accessCipher,
        refreshTokenEncrypted: null,
        scopes: tokens.scopes,
        expiresAt: NOTION_SENTINEL_EXPIRES_AT,
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
        payload: { provider: 'NOTION', integrationId: INTEGRATION_ID, botId, notionWorkspaceId, workspaceName },
      },
    }),
  );

  // Fire-and-forget ingestion event so the substrate populates with the
  // customer's pages without waiting for the next 6-hour sweep. The
  // notion-ingest function reads the workspace's Notion credential and
  // routes through the standard `ingestWorkspaceFiles` pipeline.
  await inngest.send({
    name: 'agentplain/notion-ingest.requested',
    data: { workspaceId: cookie.workspaceId, triggeredBy: 'oauth.callback' },
  });

  const res = workspaceRedirect(origin, cookie, { connected: INTEGRATION_ID });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
