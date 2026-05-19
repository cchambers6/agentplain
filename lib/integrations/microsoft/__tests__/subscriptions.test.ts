/**
 * Tests for the Microsoft Graph subscription client. Uses a stub `fetch`
 * to pin the wire contract — request method, headers, body shape — and
 * the response → ProviderSubscription mapping.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SUBSCRIPTION_MINUTES,
  MAX_SUBSCRIPTION_MINUTES,
  MicrosoftSubscriptionClient,
} from '../subscriptions';

const VALID_CLIENT_STATE = 'a'.repeat(32);
const ACCESS_TOKEN = 'access-token-value';
const ACCOUNT_EMAIL = 'connerchambers6@example.onmicrosoft.com';

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function makeFakeFetch(
  status: number,
  body: unknown,
  captured: CapturedRequest[] = [],
): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    captured.push({ url: u, init: init ?? {} });
    // The Response constructor forbids a body on 204/205. Pass null in
    // that case so the fake doesn't throw before the test reaches an
    // assertion.
    const responseBody =
      status === 204 || status === 205
        ? null
        : typeof body === 'string'
          ? body
          : JSON.stringify(body);
    return new Response(responseBody, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('MicrosoftSubscriptionClient.create', () => {
  it('POSTs to /subscriptions with the expected body shape', async () => {
    const captured: CapturedRequest[] = [];
    const subId = '11111111-2222-3333-4444-555555555555';
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const client = new MicrosoftSubscriptionClient({
      clientState: VALID_CLIENT_STATE,
      fetchImpl: makeFakeFetch(
        201,
        {
          id: subId,
          changeType: 'created',
          notificationUrl: 'https://agentplain.com/api/webhooks/microsoft',
          resource: "me/mailFolders('Inbox')/messages",
          expirationDateTime: future,
          clientState: VALID_CLIENT_STATE,
        },
        captured,
      ),
    });
    const res = await client.create({
      accessToken: ACCESS_TOKEN,
      notificationUrl: 'https://agentplain.com/api/webhooks/microsoft',
      accountEmail: ACCOUNT_EMAIL,
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.value.providerSubscriptionId, subId);
      assert.equal(res.value.resource, "me/mailFolders('Inbox')/messages");
      assert.ok(res.value.expiresAt instanceof Date);
    }
    assert.equal(captured.length, 1);
    const sent = captured[0];
    assert.equal(sent.url, 'https://graph.microsoft.com/v1.0/subscriptions');
    assert.equal(sent.init.method, 'POST');
    const headers = new Headers(sent.init.headers ?? {});
    assert.equal(headers.get('Authorization'), `Bearer ${ACCESS_TOKEN}`);
    assert.equal(headers.get('Content-Type'), 'application/json');
    const sentBody = JSON.parse(String(sent.init.body)) as Record<string, unknown>;
    assert.equal(sentBody.changeType, 'created');
    assert.equal(sentBody.resource, "me/mailFolders('Inbox')/messages");
    assert.equal(sentBody.clientState, VALID_CLIENT_STATE);
    assert.equal(
      sentBody.notificationUrl,
      'https://agentplain.com/api/webhooks/microsoft',
    );
    assert.equal(
      sentBody.lifecycleNotificationUrl,
      'https://agentplain.com/api/webhooks/microsoft',
    );
  });

  it('returns MALFORMED_RESPONSE when the response omits id', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const client = new MicrosoftSubscriptionClient({
      clientState: VALID_CLIENT_STATE,
      fetchImpl: makeFakeFetch(201, { expirationDateTime: future }),
    });
    const res = await client.create({
      accessToken: ACCESS_TOKEN,
      notificationUrl: 'https://agentplain.com/api/webhooks/microsoft',
      accountEmail: ACCOUNT_EMAIL,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'MALFORMED_RESPONSE');
  });

  it('maps 401 to TOKEN_EXPIRED', async () => {
    const client = new MicrosoftSubscriptionClient({
      clientState: VALID_CLIENT_STATE,
      fetchImpl: makeFakeFetch(401, {
        error: { code: 'InvalidAuthenticationToken', message: 'expired' },
      }),
    });
    const res = await client.create({
      accessToken: 'stale',
      notificationUrl: 'https://agentplain.com/api/webhooks/microsoft',
      accountEmail: ACCOUNT_EMAIL,
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'TOKEN_EXPIRED');
  });

  it('maps 400 to INVALID_ARGUMENT and surfaces the Graph error code', async () => {
    const client = new MicrosoftSubscriptionClient({
      clientState: VALID_CLIENT_STATE,
      fetchImpl: makeFakeFetch(400, {
        error: {
          code: 'ExtensionError',
          message: 'Subscription validation request failed',
        },
      }),
    });
    const res = await client.create({
      accessToken: ACCESS_TOKEN,
      notificationUrl: 'https://example.com/missing',
      accountEmail: ACCOUNT_EMAIL,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'INVALID_ARGUMENT');
      assert.equal(res.error.reference, 'ExtensionError');
    }
  });
});

describe('MicrosoftSubscriptionClient.renew', () => {
  it('PATCHes /subscriptions/{id} with expirationDateTime only', async () => {
    const captured: CapturedRequest[] = [];
    const subId = '11111111-2222-3333-4444-555555555555';
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const client = new MicrosoftSubscriptionClient({
      clientState: VALID_CLIENT_STATE,
      fetchImpl: makeFakeFetch(
        200,
        {
          id: subId,
          resource: "me/mailFolders('Inbox')/messages",
          expirationDateTime: future,
        },
        captured,
      ),
    });
    const res = await client.renew({
      accessToken: ACCESS_TOKEN,
      subscriptionId: subId,
      accountEmail: ACCOUNT_EMAIL,
    });
    assert.equal(res.ok, true);
    assert.equal(captured.length, 1);
    const sent = captured[0];
    assert.equal(
      sent.url,
      `https://graph.microsoft.com/v1.0/subscriptions/${subId}`,
    );
    assert.equal(sent.init.method, 'PATCH');
    const sentBody = JSON.parse(String(sent.init.body)) as Record<string, unknown>;
    assert.deepEqual(Object.keys(sentBody), ['expirationDateTime']);
  });
});

describe('MicrosoftSubscriptionClient.remove', () => {
  it('DELETEs /subscriptions/{id} and returns ok on success', async () => {
    const captured: CapturedRequest[] = [];
    const subId = 'sub-to-delete';
    const client = new MicrosoftSubscriptionClient({
      clientState: VALID_CLIENT_STATE,
      fetchImpl: makeFakeFetch(204, '', captured),
    });
    const res = await client.remove({ accessToken: ACCESS_TOKEN, subscriptionId: subId });
    assert.equal(res.ok, true);
    assert.equal(captured[0].init.method, 'DELETE');
  });

  it('treats 404 as success (idempotent)', async () => {
    const client = new MicrosoftSubscriptionClient({
      clientState: VALID_CLIENT_STATE,
      fetchImpl: makeFakeFetch(404, {
        error: { code: 'ResourceNotFound', message: 'gone' },
      }),
    });
    const res = await client.remove({
      accessToken: ACCESS_TOKEN,
      subscriptionId: 'already-gone',
    });
    assert.equal(res.ok, true);
  });
});

describe('MicrosoftSubscriptionClient lifetime clamps', () => {
  it('exports a default lifetime ≤ the Graph cap', () => {
    assert.ok(DEFAULT_SUBSCRIPTION_MINUTES <= MAX_SUBSCRIPTION_MINUTES);
    assert.ok(DEFAULT_SUBSCRIPTION_MINUTES >= 15);
  });
});
