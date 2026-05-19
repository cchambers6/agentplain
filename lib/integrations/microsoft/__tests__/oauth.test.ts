/**
 * Tests for the Microsoft identity platform OAuth client. Pins the token
 * exchange + refresh wire contract and error mapping.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MicrosoftOAuth, MICROSOFT_DEFAULT_SCOPES } from '../oauth';

const AUTHORITY = 'https://login.microsoftonline.com/common';
const CLIENT_ID = 'client-id-fake';
const CLIENT_SECRET = 'client-secret-fake';

interface Captured {
  url: string;
  body: string;
}

function makeFakeFetch(
  status: number,
  body: unknown,
  captured: Captured[] = [],
): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    captured.push({ url: u, body: String(init?.body ?? '') });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('MicrosoftOAuth.exchangeCodeForTokens', () => {
  it('sends grant_type=authorization_code + code + scopes', async () => {
    const captured: Captured[] = [];
    const oauth = new MicrosoftOAuth({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authority: AUTHORITY,
      fetchImpl: makeFakeFetch(
        200,
        {
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
          expires_in: 3600,
          scope: 'Mail.Read Mail.ReadWrite offline_access',
        },
        captured,
      ),
    });
    const res = await oauth.exchangeCodeForTokens({
      code: 'AUTH_CODE',
      redirectUri: 'https://agentplain.com/api/integrations/outlook/oauth/callback',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.value.accessToken, 'fresh-access');
      assert.equal(res.value.refreshToken, 'fresh-refresh');
      // 60s clock-skew subtraction.
      assert.ok(res.value.expiresAt.getTime() > Date.now());
    }
    assert.equal(captured.length, 1);
    assert.match(captured[0].url, /\/oauth2\/v2\.0\/token$/);
    assert.match(captured[0].body, /grant_type=authorization_code/);
    assert.match(captured[0].body, /code=AUTH_CODE/);
    assert.match(captured[0].body, /scope=/);
    // Must NOT request Mail.Send (no-outbound rule).
    assert.ok(!/Mail\.Send/i.test(captured[0].body));
  });

  it('returns INVALID_ARGUMENT when refresh_token is missing', async () => {
    const oauth = new MicrosoftOAuth({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authority: AUTHORITY,
      fetchImpl: makeFakeFetch(200, {
        access_token: 'fresh-access',
        expires_in: 3600,
      }),
    });
    const res = await oauth.exchangeCodeForTokens({
      code: 'AUTH_CODE',
      redirectUri: 'https://example.com/cb',
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'INVALID_ARGUMENT');
      assert.match(res.error.message, /offline_access/);
    }
  });
});

describe('MicrosoftOAuth.refreshTokens', () => {
  it('returns GRANT_REVOKED on invalid_grant', async () => {
    const oauth = new MicrosoftOAuth({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authority: AUTHORITY,
      fetchImpl: makeFakeFetch(400, {
        error: 'invalid_grant',
        error_description: 'AADSTS70000: Provided value for refresh_token is invalid.',
        error_codes: [70000],
      }),
    });
    const res = await oauth.refreshTokens({
      refreshToken: 'stale',
      accountEmail: 'a@example.com',
      accountId: 'oid-1',
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'GRANT_REVOKED');
  });

  it('preserves prior refresh_token when Microsoft omits it on refresh', async () => {
    const oauth = new MicrosoftOAuth({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authority: AUTHORITY,
      fetchImpl: makeFakeFetch(200, {
        access_token: 'rotated-access',
        expires_in: 3600,
        scope: 'Mail.Read Mail.ReadWrite offline_access',
      }),
    });
    const res = await oauth.refreshTokens({
      refreshToken: 'PRIOR-REFRESH',
      accountEmail: 'a@example.com',
      accountId: 'oid-1',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.value.refreshToken, 'PRIOR-REFRESH');
      assert.equal(res.value.accountId, 'oid-1');
      assert.equal(res.value.accountEmail, 'a@example.com');
    }
  });

  it('maps 429 to RATE_LIMITED', async () => {
    const oauth = new MicrosoftOAuth({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authority: AUTHORITY,
      fetchImpl: makeFakeFetch(429, { error: 'too_many_requests' }),
    });
    const res = await oauth.refreshTokens({
      refreshToken: 'r',
      accountEmail: 'a@example.com',
      accountId: 'oid-1',
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'RATE_LIMITED');
  });
});

describe('MicrosoftOAuth.revokeTokens', () => {
  it('is a no-op success (Microsoft does not expose a delegated revoke endpoint)', async () => {
    const oauth = new MicrosoftOAuth({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authority: AUTHORITY,
      fetchImpl: makeFakeFetch(500, 'should not be called'),
    });
    const res = await oauth.revokeTokens({ accessToken: 'irrelevant' });
    assert.equal(res.ok, true);
  });
});

describe('MICROSOFT_DEFAULT_SCOPES', () => {
  it('excludes Mail.Send per the no-outbound rule', () => {
    assert.ok(!MICROSOFT_DEFAULT_SCOPES.includes('Mail.Send' as never));
  });

  it('includes offline_access for refresh tokens', () => {
    assert.ok(MICROSOFT_DEFAULT_SCOPES.includes('offline_access'));
  });

  it('includes Mail.Read + Mail.ReadWrite for read + draft create', () => {
    assert.ok(MICROSOFT_DEFAULT_SCOPES.includes('Mail.Read'));
    assert.ok(MICROSOFT_DEFAULT_SCOPES.includes('Mail.ReadWrite'));
  });
});
