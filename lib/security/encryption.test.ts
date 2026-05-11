import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import {
  decrypt,
  encrypt,
  isEncrypted,
  loadMasterKey,
  safeEqualSecret,
  InvalidCiphertextError,
  InvalidKeyError,
  MissingKeyError,
  __internals,
} from './encryption'

const TEST_KEY = randomBytes(32)
const TEST_KEY_HEX = TEST_KEY.toString('hex')

describe('encryption: round-trip', () => {
  it('decrypts what it encrypted (ascii)', () => {
    const plaintext = 'whsec_abc123_signing_secret'
    const ct = encrypt(plaintext, TEST_KEY)
    assert.equal(decrypt(ct, TEST_KEY), plaintext)
  })

  it('decrypts what it encrypted (utf-8 with non-ascii)', () => {
    const plaintext = 'señá-clave-™-🔑-signing-secret'
    const ct = encrypt(plaintext, TEST_KEY)
    assert.equal(decrypt(ct, TEST_KEY), plaintext)
  })

  it('handles empty string', () => {
    const ct = encrypt('', TEST_KEY)
    assert.equal(decrypt(ct, TEST_KEY), '')
  })

  it('handles long secrets', () => {
    const plaintext = 'x'.repeat(8192)
    const ct = encrypt(plaintext, TEST_KEY)
    assert.equal(decrypt(ct, TEST_KEY), plaintext)
  })
})

describe('encryption: IV uniqueness', () => {
  it('produces different ciphertexts for the same plaintext on each call', () => {
    const plaintext = 'identical-input'
    const a = encrypt(plaintext, TEST_KEY)
    const b = encrypt(plaintext, TEST_KEY)
    assert.notEqual(a, b, 'two encryptions of the same plaintext must differ (random IV)')
    assert.equal(decrypt(a, TEST_KEY), plaintext)
    assert.equal(decrypt(b, TEST_KEY), plaintext)
  })

  it('produces 1000 unique IVs across 1000 encryptions', () => {
    const ivs = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const ct = encrypt('test', TEST_KEY)
      const iv = ct.split(':')[1]
      ivs.add(iv)
    }
    assert.equal(ivs.size, 1000, 'expected 1000 unique IVs')
  })
})

describe('encryption: tamper detection', () => {
  it('rejects ciphertext when authentication tag is altered', () => {
    const ct = encrypt('secret', TEST_KEY)
    const parts = ct.split(':')
    const tampered = `${parts[0]}:${parts[1]}:${flipLastHex(parts[2])}:${parts[3]}`
    assert.throws(
      () => decrypt(tampered, TEST_KEY),
      (err: Error) => err instanceof InvalidCiphertextError,
    )
  })

  it('rejects ciphertext when ciphertext body is altered', () => {
    const ct = encrypt('a-real-secret', TEST_KEY)
    const parts = ct.split(':')
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${flipLastHex(parts[3])}`
    assert.throws(
      () => decrypt(tampered, TEST_KEY),
      (err: Error) => err instanceof InvalidCiphertextError,
    )
  })

  it('rejects ciphertext encrypted under a different key', () => {
    const otherKey = randomBytes(32)
    const ct = encrypt('different-key-test', TEST_KEY)
    assert.throws(
      () => decrypt(ct, otherKey),
      (err: Error) => err instanceof InvalidCiphertextError,
    )
  })

  it('rejects payload with wrong number of parts', () => {
    assert.throws(
      () => decrypt('v1:abcd', TEST_KEY),
      (err: Error) => err instanceof InvalidCiphertextError,
    )
  })

  it('rejects payload with unknown version', () => {
    const ct = encrypt('x', TEST_KEY)
    const tampered = ct.replace(/^v1:/, 'v2:')
    assert.throws(
      () => decrypt(tampered, TEST_KEY),
      (err: Error) => err instanceof InvalidCiphertextError,
    )
  })

  it('rejects payload with non-hex characters', () => {
    assert.throws(
      () => decrypt('v1:zzzz:zzzz:zzzz', TEST_KEY),
      (err: Error) => err instanceof InvalidCiphertextError,
    )
  })
})

describe('encryption: key handling', () => {
  it('throws MissingKeyError when ENCRYPTION_KEY is unset', () => {
    const original = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    try {
      assert.throws(() => encrypt('x'), (err: Error) => err instanceof MissingKeyError)
      assert.throws(() => loadMasterKey(), (err: Error) => err instanceof MissingKeyError)
    } finally {
      if (original !== undefined) process.env.ENCRYPTION_KEY = original
    }
  })

  it('throws InvalidKeyError for non-hex env value', () => {
    assert.throws(
      () => loadMasterKey('not-hex'),
      (err: Error) => err instanceof InvalidKeyError,
    )
  })

  it('throws InvalidKeyError for wrong-length hex env value', () => {
    assert.throws(
      () => loadMasterKey('deadbeef'),
      (err: Error) => err instanceof InvalidKeyError,
    )
  })

  it('loads a valid 64-char hex key', () => {
    const key = loadMasterKey(TEST_KEY_HEX)
    assert.equal(key.length, 32)
    assert.equal(key.toString('hex'), TEST_KEY_HEX)
  })

  it('reads ENCRYPTION_KEY from process.env when no override', () => {
    const original = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX
    try {
      const ct = encrypt('env-key-test')
      assert.equal(decrypt(ct), 'env-key-test')
    } finally {
      if (original !== undefined) process.env.ENCRYPTION_KEY = original
      else delete process.env.ENCRYPTION_KEY
    }
  })
})

describe('encryption: format', () => {
  it('isEncrypted recognizes its own output', () => {
    const ct = encrypt('x', TEST_KEY)
    assert.equal(isEncrypted(ct), true)
    assert.equal(isEncrypted('plain-text'), false)
    assert.equal(isEncrypted(''), false)
  })

  it('uses the documented v1 format', () => {
    const ct = encrypt('x', TEST_KEY)
    const parts = ct.split(':')
    assert.equal(parts.length, 4)
    assert.equal(parts[0], __internals.FORMAT_VERSION)
    assert.equal(parts[1].length, __internals.IV_BYTES * 2, 'iv hex length')
    assert.equal(parts[2].length, __internals.TAG_BYTES * 2, 'auth tag hex length')
  })
})

describe('safeEqualSecret', () => {
  it('returns true for equal strings', () => {
    assert.equal(safeEqualSecret('abc', 'abc'), true)
  })

  it('returns false for different strings of equal length', () => {
    assert.equal(safeEqualSecret('abc', 'abd'), false)
  })

  it('returns false for strings of different length without throwing', () => {
    assert.equal(safeEqualSecret('abc', 'abcd'), false)
  })
})

function flipLastHex(s: string): string {
  if (!s) return s
  const last = s.slice(-1)
  const flipped = last === '0' ? '1' : '0'
  return s.slice(0, -1) + flipped
}
