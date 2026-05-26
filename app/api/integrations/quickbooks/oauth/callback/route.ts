/**
 * GET /api/integrations/quickbooks/oauth/callback?code=...&state=...&realmId=...
 *
 * Intuit (QuickBooks Online) Authorization Code Grant callback. Mirrors the
 * DocuSign callback:
 *   1. Verify the sealed `agentplain_oauth_state` cookie.
 *   2. Exchange code (+ the byte-matched redirect_uri) for tokens via
 *      `QuickbooksOAuth.exchangeCode`. Intuit returns `realmId` (the company
 *      id) ON THE CALLBACK QUERY STRING — there is no userinfo for the
 *      accounting-only scope, so accountId = realmId and the company label
 *      comes from a one-shot CompanyInfo read (with a realmId fallback).
 *   3. Encrypt tokens; upsert IntegrationCredential (provider=QUICKBOOKS) with
 *      providerMetadata = { realmId, environment }.
 *   4. Audit log + redirect to /app/workspace/<id>/integrations.
 *
 * NOTE: sandbox vs production realm IDs differ — the environment recorded here
 * pins which Intuit API base server.ts later targets; a sandbox realmId 401s
 * against the production base and vice versa.
 *
 * No WebhookSubscription row is created (deviation from DocuSign): QuickBooks
 * Online does not use a Connect-style push subscription in this integration,
 * so there is nothing to renew.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Accounting REST seam is
 * `lib/integrations/quickbooks-mcp/server.ts`. This callback only speaks OAuth
 * via the `QuickbooksOAuth` adapter.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { withSystemContext } from '@/lib/db/rls';
import { encryptTokenSet } from '@/lib/integrations';
import { QuickbooksOAuth } from '@/lib/integrations/quickbooks/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const INTEGRATION_ID = 'quickbooks';

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
  const realmId = params.get('realmId');
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
    return workspaceRedirect(origin, cookie, { error: 'quickbooks_returned_error', detail: errorParam });
  }
  if (!code || !stateParam) {
    return workspaceRedirect(origin, cookie, { error: 'missing_code_or_state' });
  }
  if (!realmId) {
    return workspaceRedirect(origin, cookie, { error: 'missing_realm_id' });
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

  const clientId = env.quickbooksOAuthClientId();
  const clientSecret = env.quickbooksOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return workspaceRedirect(origin, cookie, { error: 'quickbooks_oauth_not_configured' });
  }

  const environment = env.quickbooksEnvironment();
  // redirect_uri must byte-match the value used to start the flow + the value
  // registered in the Intuit app config.
  const redirectUri = `${origin}/api/integrations/quickbooks/oauth/callback`;
  const oauth = new QuickbooksOAuth({ clientId, clientSecret, environment, redirectUri });
  const exchanged = await oauth.exchangeCode({ code, realmId });
  if (!exchanged.ok) {
    return workspaceRedirect(origin, cookie, {
      error: 'token_exchange_failed',
      detail: `${exchanged.error.code}: ${exchanged.error.message}`.slice(0, 240),
    });
  }

  const { tokens } = exchanged.value;
  const enc = encryptTokenSet(tokens);
  const providerMetadata = { realmId, environment };

  // IntegrationCredential is workspace-scoped RLS — runs through
  // withSystemContext on the connect path.
  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: cookie.workspaceId,
          provider: 'QUICKBOOKS',
          accountId: tokens.accountId,
        },
      },
      create: {
        workspaceId: cookie.workspaceId,
        provider: 'QUICKBOOKS',
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
        payload: { provider: 'QUICKBOOKS', integrationId: INTEGRATION_ID, realmId, environment, scopes: tokens.scopes },
      },
    }),
  );

  const res = workspaceRedirect(origin, cookie, { connected: INTEGRATION_ID });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
