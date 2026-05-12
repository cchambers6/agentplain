/**
 * GET /api/auth/oauth/google/connect?workspaceId=<uuid>
 *
 * Initiates the Google OAuth authorization-code flow:
 *   1. Generate a 32-byte CSRF nonce.
 *   2. Set it in an HttpOnly cookie (`agentplain_oauth_state`).
 *   3. Encode workspaceId + nonce into the OAuth `state` parameter.
 *   4. Redirect the browser to the Google authorize URL.
 *
 * The callback route reads the cookie + state and asserts equality before
 * exchanging the code (RFC 6749 §10.12).
 *
 * Authorization: operator only — only Conner (or any allowlisted operator
 * per feedback_no_prod_secrets_in_dev → OPERATOR_EMAIL_ALLOWLIST) can
 * initiate a Google connect today. Phase 2 customer self-serve OAuth UI
 * lands in a follow-on PR.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { sealData } from 'iron-session';
import { GoogleOAuth } from '@/lib/integrations/google/oauth';
import { requireUser } from '@/lib/auth/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_STATE_COOKIE = 'agentplain_oauth_state';
const STATE_TTL_SECONDS = 600;

interface OAuthStateCookie {
  nonce: string;
  workspaceId: string;
  issuedAt: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireUser();
  if (!session.isOperator) {
    return NextResponse.json(
      { error: 'operator_only', message: 'Only operators can connect Google in PR-B. Customer self-serve UI lands in a follow-on PR.' },
      { status: 403 },
    );
  }

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    return NextResponse.json(
      { error: 'invalid_workspace_id', message: 'workspaceId query param must be a UUID.' },
      { status: 400 },
    );
  }

  const clientId = env.googleOAuthClientId();
  const clientSecret = env.googleOAuthClientSecret();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: 'google_oauth_not_configured',
        message:
          'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set on this deployment. See docs/operator-integrations-setup.md.',
      },
      { status: 503 },
    );
  }

  const oauth = new GoogleOAuth({ clientId, clientSecret });
  const nonce = randomBytes(32).toString('hex');
  const state = nonce; // state = nonce; workspaceId travels via cookie (not in state URL)
  const cookiePayload: OAuthStateCookie = {
    nonce,
    workspaceId,
    issuedAt: Date.now(),
  };

  // Seal the cookie with iron-session (same SESSION_PASSWORD secret already
  // protecting session cookies — separate cookie name, separate purpose).
  const sealed = await sealData(cookiePayload, {
    password: env.sessionPassword(),
    ttl: STATE_TTL_SECONDS,
  });

  const redirectUri = new URL('/api/auth/oauth/google/callback', env.appPublicOrigin()).toString();
  const authorizeUrl = oauth.buildAuthorizationUrl({
    redirectUri,
    state,
    loginHint: session.email,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, sealed, {
    httpOnly: true,
    secure: env.appPublicOrigin().startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
