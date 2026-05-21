/**
 * Contract tests for the IntegrationProvider interface — runs the
 * TestIntegrationProvider plus GoogleOAuth (with mocked fetch) through
 * the same assertions. Two-implementation rule satisfied per
 * feedback_runner_portability.md.
 *
 * Network-touching code is mocked via injected `fetchImpl` rather than
 * msw — keeps the test runner pure node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GoogleOAuth } from '../google/oauth';
import { TestIntegrationProvider } from '../test-provider';
import type { TokenSet } from '../types';

// ── Test fixture: pre-seed a TestIntegrationProvider ─────────────────────

function seedTokens(): TokenSet {
  return {
    accessToken: 'access-fake-abc',
    refreshToken: 'refresh-fake-xyz',
    expiresAt: new Date(Date.now() + 3600_000),
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    accountId: 'sub-12345',
    accountEmail: 'dogfood@example.com',
  };
}

// ── TestIntegrationProvider behavioral pinning ───────────────────────────

describe('TestIntegrationProvider — basic contract', () => {
  it('exchangeCodeForTokens returns seeded token-set', async () => {
    const tokens = seedTokens();
    const p = new TestIntegrationProvider({
      seed: { codeMap: { 'good-code': tokens } },
    });
    const res = await p.exchangeCodeForTokens({
      code: 'good-code',
      redirectUri: 'https://example.com/cb',
    });
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.value.accessToken, 'access-fake-abc');
  });

  it('exchangeCodeForTokens returns NOT_FOUND for unknown code', async () => {
    const p = new TestIntegrationProvider();
    const res = await p.exchangeCodeForTokens({
      code: 'no-such-code',
      redirectUri: 'https://example.com/cb',
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'NOT_FOUND');
  });

  it('createSubscription returns expiry 7 days out (Gmail watch lifetime)', async () => {
    const p = new TestIntegrationProvider();
    const now = Date.now();
    const res = await p.createSubscription({
      credential: {
        id: 'cred-id',
        workspaceId: 'ws-id',
        provider: 'GOOGLE',
        accountId: 'sub-1',
        accountEmail: 'dog@example.com',
        accessToken: 'a',
        refreshToken: 'r',
        scopes: [],
        expiresAt: new Date(now + 3600_000),
        providerMetadata: null,
      },
      notificationUrl: 'https://example.com/webhook',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      const days = (res.value.expiresAt.getTime() - now) / (24 * 60 * 60 * 1000);
      assert.ok(days > 6.9 && days < 7.1, `expected ~7 days, got ${days}`);
    }
  });

  it('renewSubscription preserves the provider subscription id', async () => {
    const p = new TestIntegrationProvider();
    const credential = {
      id: 'cred-id',
      workspaceId: 'ws-id',
      provider: 'GOOGLE' as const,
      accountId: 'sub-1',
      accountEmail: 'dog@example.com',
      accessToken: 'a',
      refreshToken: 'r',
      scopes: [],
      expiresAt: new Date(),
      providerMetadata: null,
    };
    const res = await p.renewSubscription({
      credential,
      subscriptionId: 'existing-sub-123',
      notificationUrl: 'https://example.com/webhook',
    });
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.value.providerSubscriptionId, 'existing-sub-123');
  });

  it('records every call for assertion in tests', async () => {
    const p = new TestIntegrationProvider();
    await p.revokeTokens({ accessToken: 'x' });
    assert.equal(p.calls.length, 1);
    assert.equal(p.calls[0].method, 'revokeTokens');
  });
});

// ── GoogleOAuth with mocked fetch ────────────────────────────────────────

function makeFakeTokenFetch(
  responses: Array<{ status: number; body: Record<string, unknown> | string }>,
): typeof fetch {
  let i = 0;
  return async (
    _input: string | URL | Request,
    _init?: RequestInit,
  ): Promise<Response> => {
    const r = responses[i++] ?? { status: 200, body: {} };
    const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return new Response(text, {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

describe('GoogleOAuth — token exchange', () => {
  it('exchangeCodeForTokens parses a healthy token response + userinfo', async () => {
    const oauth = new GoogleOAuth({
      clientId: 'cid',
      clientSecret: 'secret',
      fetchImpl: makeFakeTokenFetch([
        {
          status: 200,
          body: {
            access_token: 'aT',
            refresh_token: 'rT',
            expires_in: 3600,
            scope:
              'openid email profile https://www.googleapis.com/auth/gmail.readonly',
            token_type: 'Bearer',
          },
        },
        {
          status: 200,
          body: { sub: 'sub-123', email: 'dog@example.com' },
        },
      ]),
    });
    const res = await oauth.exchangeCodeForTokens({
      code: 'code-xyz',
      redirectUri: 'https://example.com/cb',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.value.accessToken, 'aT');
      assert.equal(res.value.refreshToken, 'rT');
      assert.equal(res.value.accountId, 'sub-123');
      assert.equal(res.value.accountEmail, 'dog@example.com');
      assert.deepEqual(res.value.scopes, [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
      ]);
    }
  });

  it('exchangeCodeForTokens returns INVALID_ARGUMENT when refresh_token missing', async () => {
    const oauth = new GoogleOAuth({
      clientId: 'cid',
      clientSecret: 'secret',
      fetchImpl: makeFakeTokenFetch([
        {
          status: 200,
          body: { access_token: 'aT', expires_in: 3600, scope: 'openid email' },
        },
      ]),
    });
    const res = await oauth.exchangeCodeForTokens({
      code: 'code-xyz',
      redirectUri: 'https://example.com/cb',
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'INVALID_ARGUMENT');
  });

  it('refreshTokens maps invalid_grant to GRANT_REVOKED', async () => {
    const oauth = new GoogleOAuth({
      clientId: 'cid',
      clientSecret: 'secret',
      fetchImpl: makeFakeTokenFetch([
        {
          status: 400,
          body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' },
        },
      ]),
    });
    const res = await oauth.refreshTokens({
      refreshToken: 'old-r',
      accountEmail: 'dog@example.com',
      accountId: 'sub-1',
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'GRANT_REVOKED');
  });

  it('refreshTokens preserves the prior refresh_token when response omits one', async () => {
    const oauth = new GoogleOAuth({
      clientId: 'cid',
      clientSecret: 'secret',
      fetchImpl: makeFakeTokenFetch([
        {
          status: 200,
          body: {
            access_token: 'newA',
            expires_in: 3600,
            scope: 'openid email',
          },
        },
      ]),
    });
    const res = await oauth.refreshTokens({
      refreshToken: 'old-r-keep-me',
      accountEmail: 'dog@example.com',
      accountId: 'sub-1',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.value.accessToken, 'newA');
      assert.equal(res.value.refreshToken, 'old-r-keep-me');
    }
  });

  it('revokeTokens treats 400 invalid_token as success-idempotent', async () => {
    const oauth = new GoogleOAuth({
      clientId: 'cid',
      clientSecret: 'secret',
      fetchImpl: makeFakeTokenFetch([
        { status: 400, body: { error: 'invalid_token' } },
      ]),
    });
    const res = await oauth.revokeTokens({ accessToken: 'already-revoked' });
    assert.equal(res.ok, true);
  });

  it('exchangeCodeForTokens maps 401 to UNAUTHORIZED', async () => {
    const oauth = new GoogleOAuth({
      clientId: 'cid',
      clientSecret: 'secret',
      fetchImpl: makeFakeTokenFetch([
        { status: 401, body: { error: 'invalid_client' } },
      ]),
    });
    const res = await oauth.exchangeCodeForTokens({
      code: 'x',
      redirectUri: 'https://example.com/cb',
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'UNAUTHORIZED');
  });

  it('buildAuthorizationUrl encodes scopes + access_type=offline + prompt=consent', () => {
    const oauth = new GoogleOAuth({ clientId: 'cid', clientSecret: 's' });
    const url = oauth.buildAuthorizationUrl({
      redirectUri: 'https://app.example/callback',
      state: 'nonce-1',
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://accounts.google.com');
    assert.equal(parsed.pathname, '/o/oauth2/v2/auth');
    assert.equal(parsed.searchParams.get('access_type'), 'offline');
    assert.equal(parsed.searchParams.get('prompt'), 'consent');
    assert.equal(parsed.searchParams.get('state'), 'nonce-1');
    const scopes = (parsed.searchParams.get('scope') ?? '').split(' ');
    assert.ok(scopes.includes('https://www.googleapis.com/auth/gmail.readonly'));
  });

  it('throws on construction without clientId / clientSecret', () => {
    assert.throws(() => new GoogleOAuth({ clientId: '', clientSecret: 'x' }));
    assert.throws(() => new GoogleOAuth({ clientId: 'x', clientSecret: '' }));
  });
});
