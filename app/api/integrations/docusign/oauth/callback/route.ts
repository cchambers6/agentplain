/**
 * GET /api/integrations/docusign/oauth/callback?code=...&state=...
 *
 * DocuSign Authorization Code Grant callback. Mirrors the Outlook callback:
 *   1. Verify the sealed `agentplain_oauth_state` cookie.
 *   2. Exchange code for tokens + resolve the default account (REST base_uri)
 *      via `DocuSignOAuth.exchangeCode`.
 *   3. Encrypt tokens; upsert IntegrationCredential (provider=DOCUSIGN) with
 *      providerMetadata = { apiBaseUri, accountName }.
 *   4. Upsert a WebhookSubscription row that represents the account's DocuSign
 *      Connect configuration, so inbound Connect events have a row to attach
 *      to. expiresAt is far-future (Connect doesn't expire), keeping it out of
 *      the renewal sweep's window.
 *   5. Audit log + redirect to /app/workspace/<id>/integrations.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the DocuSign REST SDK seam is
 * `lib/integrations/docusign-mcp/server.ts`. This callback only speaks OAuth
 * via the `DocuSignOAuth` adapter.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { withSystemContext } from '@/lib/db/rls';
import { encryptTokenSet } from '@/lib/integrations';
import { DocuSignOAuth } from '@/lib/integrations/docusign/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const INTEGRATION_ID = 'docusign';
/** Connect configuration never expires; park it far in the future so the
 *  renewal sweep (expiresAt < now+24h) ignores DocuSign subscriptions. */
const CONNECT_FAR_FUTURE = new Date('2099-01-01T00:00:00Z');

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
    return workspaceRedirect(origin, cookie, { error: 'docusign_returned_error', detail: errorParam });
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

  const clientId = env.docusignOAuthClientId();
  const clientSecret = env.docusignOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return workspaceRedirect(origin, cookie, { error: 'docusign_oauth_not_configured' });
  }

  const oauth = new DocuSignOAuth({ clientId, clientSecret, baseUri: env.docusignOAuthBaseUri() });
  const exchanged = await oauth.exchangeCode({ code });
  if (!exchanged.ok) {
    return workspaceRedirect(origin, cookie, {
      error: 'token_exchange_failed',
      detail: `${exchanged.error.code}: ${exchanged.error.message}`.slice(0, 240),
    });
  }

  const { tokens, account } = exchanged.value;
  const enc = encryptTokenSet(tokens);
  const providerMetadata = { apiBaseUri: account.apiBaseUri, accountName: account.accountName };

  // IntegrationCredential + WebhookSubscription are workspace-scoped RLS
  // (20260526000000_add_integration_rls); the connect path runs through
  // withSystemContext to seed app.is_operator='true' on each write.
  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.upsert({
      where: {
        workspaceId_provider_accountId: {
          workspaceId: cookie.workspaceId,
          provider: 'DOCUSIGN',
          accountId: tokens.accountId,
        },
      },
      create: {
        workspaceId: cookie.workspaceId,
        provider: 'DOCUSIGN',
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

  // Represent the account's DocuSign Connect config so inbound Connect events
  // have a subscription row to attach to. notificationUrl is informational
  // here (Connect is configured in the DocuSign admin), but we record it.
  const notificationUrl = new URL('/api/integrations/docusign/connect', origin).toString();
  await withSystemContext(async (tx) => {
    const existing = await tx.webhookSubscription.findFirst({
      where: { workspaceId: cookie.workspaceId, integrationCredentialId: credential.id, provider: 'DOCUSIGN' },
      select: { id: true },
    });
    await tx.webhookSubscription.upsert({
      where: { id: existing?.id ?? '00000000-0000-0000-0000-000000000000' },
      create: {
        workspaceId: cookie.workspaceId,
        integrationCredentialId: credential.id,
        provider: 'DOCUSIGN',
        subscriptionId: tokens.accountId,
        resource: `docusign-connect:${tokens.accountId}`,
        expiresAt: CONNECT_FAR_FUTURE,
        notificationUrl,
        lastRenewedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        subscriptionId: tokens.accountId,
        resource: `docusign-connect:${tokens.accountId}`,
        expiresAt: CONNECT_FAR_FUTURE,
        notificationUrl,
        status: 'ACTIVE',
      },
    });
  });

  await withSystemContext((tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId: cookie.workspaceId,
        action: 'integration.connected',
        targetTable: 'IntegrationCredential',
        targetId: credential.id,
        payload: { provider: 'DOCUSIGN', integrationId: INTEGRATION_ID, accountEmail: tokens.accountEmail, scopes: tokens.scopes },
      },
    }),
  );

  const res = workspaceRedirect(origin, cookie, { connected: INTEGRATION_ID });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
