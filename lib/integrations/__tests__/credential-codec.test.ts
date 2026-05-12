/**
 * Tests for the credential encrypt/decrypt seam in lib/integrations/index.ts.
 * Verifies the round-trip is lossless and that ciphertexts differ across
 * calls (random IV per encryption.ts).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, isEncrypted } from '../../security/encryption';

const TEST_KEY_HEX = randomBytes(32).toString('hex');

describe('credential codec — round-trip', () => {
  it('uses the v1 format from lib/security/encryption.ts', () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    const ct = encrypt('access-token-fake-abc');
    assert.ok(isEncrypted(ct));
    assert.equal(ct.split(':').length, 4);
    assert.equal(ct.split(':')[0], 'v1');
  });

  it('round-trips a refresh token', () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    const plain = '1//09abc-refresh-token-value';
    const ct = encrypt(plain);
    assert.equal(decrypt(ct), plain);
  });

  it('produces different ciphertexts on each call (random IV)', () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    const a = encrypt('same-token');
    const b = encrypt('same-token');
    assert.notEqual(a, b);
    assert.equal(decrypt(a), decrypt(b));
  });

  it('throws if a ciphertext is decrypted with a different key', () => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
    const ct = encrypt('secret');
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
    assert.throws(() => decrypt(ct));
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
  });
});
