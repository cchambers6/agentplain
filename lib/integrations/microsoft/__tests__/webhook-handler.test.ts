/**
 * Tests for the Microsoft Graph webhook handler. Mirrors
 * `lib/integrations/__tests__/webhook-handler.test.ts` (Gmail).
 *
 * Two distinct request shapes are exercised:
 *   1. Validation handshake — `?validationToken=…`, no body
 *   2. Notification delivery — JSON body with `value[].clientState`
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MicrosoftWebhookHandler } from '../webhook-handler';

const VALID_CLIENT_STATE = 'a'.repeat(32);

function notificationRequest(body: unknown): Request {
  return new Request('https://agentplain.com/api/webhooks/microsoft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('MicrosoftWebhookHandler.detectValidation', () => {
  it('detects validation handshake via ?validationToken=', () => {
    const req = new Request(
      'https://agentplain.com/api/webhooks/microsoft?validationToken=hello-from-graph',
      { method: 'POST' },
    );
    const v = MicrosoftWebhookHandler.detectValidation(req);
    assert.notEqual(v, null);
    assert.equal(v?.validationToken, 'hello-from-graph');
  });

  it('returns null for non-validation requests', () => {
    const req = new Request('https://agentplain.com/api/webhooks/microsoft', {
      method: 'POST',
    });
    const v = MicrosoftWebhookHandler.detectValidation(req);
    assert.equal(v, null);
  });

  it('preserves the token value through URL decoding', () => {
    // Microsoft sends the token URL-encoded; URL parsing handles the decode.
    const req = new Request(
      'https://agentplain.com/api/webhooks/microsoft?validationToken=hello%20world',
      { method: 'POST' },
    );
    const v = MicrosoftWebhookHandler.detectValidation(req);
    assert.equal(v?.validationToken, 'hello world');
  });
});

describe('MicrosoftWebhookHandler.verify', () => {
  it('rejects body with no value[]', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.verify(notificationRequest({}));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'SIGNATURE_INVALID');
  });

  it('rejects empty value[]', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.verify(notificationRequest({ value: [] }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'SIGNATURE_INVALID');
  });

  it('rejects when clientState is missing', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.verify(
      notificationRequest({
        value: [{ subscriptionId: 'sub-1', resource: 'users/jd/messages/1' }],
      }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'SIGNATURE_INVALID');
  });

  it('rejects when clientState mismatches the configured secret', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.verify(
      notificationRequest({
        value: [
          {
            subscriptionId: 'sub-1',
            resource: 'users/jd/messages/1',
            clientState: 'wrong-secret',
          },
        ],
      }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'SIGNATURE_INVALID');
  });

  it('accepts when every item carries the configured clientState', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.verify(
      notificationRequest({
        value: [
          {
            subscriptionId: 'sub-1',
            resource: 'users/aad-oid-001/messages/AAMkAtest-1',
            clientState: VALID_CLIENT_STATE,
          },
          {
            subscriptionId: 'sub-1',
            resource: 'users/aad-oid-001/messages/AAMkAtest-2',
            clientState: VALID_CLIENT_STATE,
          },
        ],
      }),
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.valid, true);
      assert.equal(r.value.accountIdentifier, 'aad-oid-001');
    }
  });

  it('rejects a mixed batch (one valid + one forged)', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.verify(
      notificationRequest({
        value: [
          { subscriptionId: 's', clientState: VALID_CLIENT_STATE },
          { subscriptionId: 's', clientState: 'attacker' },
        ],
      }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'SIGNATURE_INVALID');
  });
});

describe('MicrosoftWebhookHandler.parse', () => {
  it('extracts message id from resourceData', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.parse(
      notificationRequest({
        value: [
          {
            subscriptionId: 's',
            clientState: VALID_CLIENT_STATE,
            resource: 'users/aad-oid-001/messages/AAMkA-msg-001',
            resourceData: { id: 'AAMkA-msg-001' },
          },
        ],
      }),
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.cursor, 'AAMkA-msg-001');
      assert.equal(r.value.accountEmail, 'aad-oid-001');
    }
  });

  it('returns MALFORMED_RESPONSE on missing value[]', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.parse(notificationRequest({ junk: true }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'MALFORMED_RESPONSE');
  });

  it('handles lifecycle events without resourceData', async () => {
    const h = new MicrosoftWebhookHandler({ clientState: VALID_CLIENT_STATE });
    const r = await h.parse(
      notificationRequest({
        value: [
          {
            subscriptionId: 's',
            clientState: VALID_CLIENT_STATE,
            lifecycleEvent: 'reauthorizationRequired',
            resource: 'users/aad-oid-001',
          },
        ],
      }),
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      // No message id on a lifecycle event — cursor stays undefined.
      assert.equal(r.value.cursor, undefined);
      assert.equal(r.value.accountEmail, 'aad-oid-001');
    }
  });
});

describe('MicrosoftWebhookHandler constructor', () => {
  it('throws when clientState is empty', () => {
    assert.throws(
      () => new MicrosoftWebhookHandler({ clientState: '' }),
      /clientState is required/,
    );
  });

  it('throws when clientState is too short (under 16 chars)', () => {
    assert.throws(
      () => new MicrosoftWebhookHandler({ clientState: 'short' }),
      /at least 16 chars/,
    );
  });
});
