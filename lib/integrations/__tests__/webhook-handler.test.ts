/**
 * Tests for the Pub/Sub OIDC webhook handler. We mock OAuth2Client.verifyIdToken
 * directly — the real key fetch + signature verification is google-auth-library's
 * responsibility and is exercised by its own test suite. Here we pin our
 * adapter's claim-checking semantics.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OAuth2Client } from 'google-auth-library';

import { GmailWebhookHandler } from '../google/webhook-handler';

interface FakeTicket {
  getPayload(): { aud?: string; email?: string } | undefined;
}

function makeFakeClient(
  payloadOrThrow: { aud?: string; email?: string } | Error,
): OAuth2Client {
  const c = new OAuth2Client();
  // verifyIdToken's full type is internal to google-auth-library; we cast
  // through unknown to stub it without an `any` escape.
  (c as unknown as { verifyIdToken: () => Promise<unknown> }).verifyIdToken = async () => {
    if (payloadOrThrow instanceof Error) throw payloadOrThrow;
    return {
      getPayload(): { aud?: string; email?: string } | undefined {
        return payloadOrThrow;
      },
    } as FakeTicket;
  };
  return c;
}

const audience = 'https://agentplain.com/api/webhooks/google';
const serviceAccountEmail = 'pubsub-pusher@example-project.iam.gserviceaccount.com';

function reqWithAuth(value: string | null): Request {
  const headers = new Headers();
  if (value !== null) headers.set('Authorization', value);
  return new Request('https://agentplain.com/api/webhooks/google', {
    method: 'POST',
    headers,
  });
}

describe('GmailWebhookHandler.verify', () => {
  it('returns SIGNATURE_INVALID when Authorization header is missing', async () => {
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient({ aud: audience, email: serviceAccountEmail }),
    });
    const r = await h.verify(reqWithAuth(null));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'SIGNATURE_INVALID');
  });

  it('returns SIGNATURE_INVALID when header is not Bearer-form', async () => {
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient({ aud: audience, email: serviceAccountEmail }),
    });
    const r = await h.verify(reqWithAuth('Basic abc'));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'SIGNATURE_INVALID');
  });

  it('returns SIGNATURE_INVALID when verifyIdToken throws', async () => {
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient(new Error('bad signature')),
    });
    const r = await h.verify(reqWithAuth('Bearer eyJ-something'));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'SIGNATURE_INVALID');
      assert.match(r.error.message, /bad signature/);
    }
  });

  it('returns SIGNATURE_INVALID when email claim does not match', async () => {
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient({
        aud: audience,
        email: 'attacker@evil.example',
      }),
    });
    const r = await h.verify(reqWithAuth('Bearer eyJ-something'));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'SIGNATURE_INVALID');
      assert.match(r.error.message, /email claim/);
    }
  });

  it('returns SIGNATURE_INVALID when aud claim does not match', async () => {
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient({
        aud: 'https://wrong-audience.example',
        email: serviceAccountEmail,
      }),
    });
    const r = await h.verify(reqWithAuth('Bearer eyJ-something'));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'SIGNATURE_INVALID');
      assert.match(r.error.message, /aud claim/);
    }
  });

  it('returns valid=true when aud + email both match', async () => {
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient({ aud: audience, email: serviceAccountEmail }),
    });
    const r = await h.verify(reqWithAuth('Bearer eyJ-something'));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.valid, true);
      assert.equal(r.value.accountIdentifier, serviceAccountEmail);
    }
  });
});

describe('GmailWebhookHandler.parse', () => {
  function reqWithBody(body: unknown): Request {
    return new Request('https://agentplain.com/api/webhooks/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('decodes a healthy Pub/Sub Gmail push body', async () => {
    const inner = { emailAddress: 'dog@example.com', historyId: 123456 };
    const encoded = Buffer.from(JSON.stringify(inner), 'utf8').toString('base64');
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient({ aud: audience, email: serviceAccountEmail }),
    });
    const r = await h.parse(
      reqWithBody({
        message: { data: encoded, messageId: 'mid-1', publishTime: 'now' },
        subscription: 'projects/p/subscriptions/s',
      }),
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.accountEmail, 'dog@example.com');
      assert.equal(r.value.cursor, '123456');
      assert.deepEqual(
        (r.value.raw as { subscription: string }).subscription,
        'projects/p/subscriptions/s',
      );
    }
  });

  it('returns MALFORMED_RESPONSE when message.data is missing', async () => {
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient({ aud: audience, email: serviceAccountEmail }),
    });
    const r = await h.parse(reqWithBody({ message: {} }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'MALFORMED_RESPONSE');
  });

  it('returns MALFORMED_RESPONSE when the decoded JSON has no historyId', async () => {
    const encoded = Buffer.from(
      JSON.stringify({ emailAddress: 'dog@example.com' }),
      'utf8',
    ).toString('base64');
    const h = new GmailWebhookHandler({
      audience,
      serviceAccountEmail,
      oauthClient: makeFakeClient({ aud: audience, email: serviceAccountEmail }),
    });
    const r = await h.parse(reqWithBody({ message: { data: encoded } }));
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.code, 'MALFORMED_RESPONSE');
      assert.match(r.error.message, /historyId/);
    }
  });
});
