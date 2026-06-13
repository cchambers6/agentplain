/**
 * Tests for the one-click unsubscribe token. Uses a fixed key override so
 * the suite needs no ENCRYPTION_KEY env.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token';

// A 32-byte key (the master key is AES-256 sized); any fixed buffer works
// for HMAC here.
const KEY = Buffer.alloc(32, 7);
const WS = '11111111-1111-1111-1111-111111111111';

describe('unsubscribe token', () => {
  it('round-trips a workspace id', () => {
    const token = signUnsubscribeToken(WS, KEY);
    assert.equal(verifyUnsubscribeToken(token, KEY), WS);
  });

  it('rejects a tampered workspace id', () => {
    const token = signUnsubscribeToken(WS, KEY);
    const tampered = token.replace(WS, '22222222-2222-2222-2222-222222222222');
    assert.equal(verifyUnsubscribeToken(tampered, KEY), null);
  });

  it('rejects a tampered signature', () => {
    const token = signUnsubscribeToken(WS, KEY);
    assert.equal(verifyUnsubscribeToken(`${token}x`, KEY), null);
  });

  it('rejects a token signed with a different key', () => {
    const token = signUnsubscribeToken(WS, KEY);
    const otherKey = Buffer.alloc(32, 9);
    assert.equal(verifyUnsubscribeToken(token, otherKey), null);
  });

  it('rejects malformed tokens', () => {
    assert.equal(verifyUnsubscribeToken('', KEY), null);
    assert.equal(verifyUnsubscribeToken('no-separator', KEY), null);
    assert.equal(verifyUnsubscribeToken('.sigonly', KEY), null);
    assert.equal(verifyUnsubscribeToken('idonly.', KEY), null);
  });

  it('preserves a workspace id that itself contains the separator char', () => {
    // The id is a UUID (no dot), but verify the lastIndexOf split is robust:
    // a hypothetical id with a dot still round-trips because we split on the
    // LAST separator.
    const weird = 'tenant.acme';
    const token = signUnsubscribeToken(weird, KEY);
    assert.equal(verifyUnsubscribeToken(token, KEY), weird);
  });
});
