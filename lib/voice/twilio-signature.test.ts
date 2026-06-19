import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  HmacTwilioSignatureVerifier,
  RejectAllSignatureVerifier,
  SdkTwilioSignatureVerifier,
  canonicalWebhookUrl,
  type SignatureCheckInput,
} from './twilio-signature';

// Twilio's documented reference vector style: HMAC-SHA1 over
// url + sorted(key+value) pairs, base64. We compute the expected value the
// same way Twilio's servers would and assert the verifier accepts it.
const AUTH_TOKEN = '12345678901234567890123456789012';

function sign(url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac('sha1', AUTH_TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64');
}

describe('HmacTwilioSignatureVerifier', () => {
  const url = 'https://app.agentplain.com/api/voice/twilio/incoming';
  const params = {
    CallSid: 'CA1234567890abcdef',
    From: '+14155551212',
    To: '+18005550100',
    CallStatus: 'ringing',
  };

  it('accepts a correctly-signed request', () => {
    const v = new HmacTwilioSignatureVerifier(AUTH_TOKEN);
    const input: SignatureCheckInput = { url, params, signature: sign(url, params) };
    assert.equal(v.verify(input), true);
  });

  it('rejects a tampered body (added param)', () => {
    const v = new HmacTwilioSignatureVerifier(AUTH_TOKEN);
    const goodSig = sign(url, params);
    const tampered = { ...params, From: '+19998887777' };
    assert.equal(v.verify({ url, params: tampered, signature: goodSig }), false);
  });

  it('rejects a request signed with a different token', () => {
    const v = new HmacTwilioSignatureVerifier(AUTH_TOKEN);
    const wrongSig = createHmac('sha1', 'wrong-token')
      .update(Buffer.from(url, 'utf-8'))
      .digest('base64');
    assert.equal(v.verify({ url, params, signature: wrongSig }), false);
  });

  it('rejects when the signature header is absent', () => {
    const v = new HmacTwilioSignatureVerifier(AUTH_TOKEN);
    assert.equal(v.verify({ url, params, signature: null }), false);
  });

  it('is order-independent over params (Twilio sorts keys)', () => {
    const v = new HmacTwilioSignatureVerifier(AUTH_TOKEN);
    const reordered = { To: params.To, CallStatus: params.CallStatus, From: params.From, CallSid: params.CallSid };
    assert.equal(v.verify({ url, params: reordered, signature: sign(url, params) }), true);
  });
});

describe('RejectAllSignatureVerifier', () => {
  it('always rejects (fail-closed when no secret)', () => {
    const v = new RejectAllSignatureVerifier();
    assert.equal(v.verify({ url: 'https://x', params: {}, signature: 'anything' }), false);
  });
});

describe('SdkTwilioSignatureVerifier', () => {
  it('delegates to the SDK validateRequest with the right args', () => {
    let seen: unknown[] = [];
    const fakeSdk = {
      validateRequest: (...args: unknown[]) => {
        seen = args;
        return true;
      },
    };
    const v = new SdkTwilioSignatureVerifier(fakeSdk, AUTH_TOKEN);
    const input = { url: 'https://x/y', params: { A: '1' }, signature: 'sig' };
    assert.equal(v.verify(input), true);
    assert.deepEqual(seen, [AUTH_TOKEN, 'sig', 'https://x/y', { A: '1' }]);
  });

  it('rejects when the signature header is absent without calling the SDK', () => {
    let called = false;
    const v = new SdkTwilioSignatureVerifier(
      {
        validateRequest: () => {
          called = true;
          return true;
        },
      },
      AUTH_TOKEN,
    );
    assert.equal(v.verify({ url: 'https://x', params: {}, signature: null }), false);
    assert.equal(called, false);
  });
});

describe('canonicalWebhookUrl', () => {
  it('returns the request url unchanged when no public base is set', () => {
    delete process.env.VOICE_PUBLIC_BASE_URL;
    const u = 'https://preview.vercel.app/api/voice/twilio/incoming?x=1';
    assert.equal(canonicalWebhookUrl(u), u);
  });

  it('swaps origin to the public base but preserves path + query', () => {
    process.env.VOICE_PUBLIC_BASE_URL = 'https://app.agentplain.com';
    const u = 'https://internal-proxy.local/api/voice/twilio/status?CallSid=CA1';
    assert.equal(
      canonicalWebhookUrl(u),
      'https://app.agentplain.com/api/voice/twilio/status?CallSid=CA1',
    );
    delete process.env.VOICE_PUBLIC_BASE_URL;
  });
});
