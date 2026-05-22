import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16
const FORMAT_VERSION = 'v1'

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncryptionError'
  }
}

export class MissingKeyError extends EncryptionError {
  constructor() {
    super(
      'ENCRYPTION_KEY env var is missing. Generate one with `openssl rand -hex 32` and set it on the host (Vercel project env).',
    )
    this.name = 'MissingKeyError'
  }
}

export class InvalidKeyError extends EncryptionError {
  constructor(reason: string) {
    super(`ENCRYPTION_KEY is invalid: ${reason}. Expected 64 hex characters (32 bytes).`)
    this.name = 'InvalidKeyError'
  }
}

export class InvalidCiphertextError extends EncryptionError {
  constructor(reason: string) {
    super(`Ciphertext is invalid: ${reason}.`)
    this.name = 'InvalidCiphertextError'
  }
}

export function loadMasterKey(envValue?: string): Buffer {
  const raw = envValue ?? process.env.ENCRYPTION_KEY
  if (!raw) throw new MissingKeyError()
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new InvalidKeyError('not a 64-character hex string')
  }
  return Buffer.from(raw, 'hex')
}

/**
 * Non-throwing presence + format check for the master key. The honesty seam
 * the credential-use paths gate on: a missing/malformed ENCRYPTION_KEY means
 * we genuinely cannot decrypt saved tokens, so callers return a CLEAR typed
 * failure instead of letting `decrypt()` throw and 500 the surface / crash the
 * cron. This does NOT weaken encryption — when the key is present and valid,
 * the codec is unchanged; this only lets callers fail gracefully when it isn't.
 *
 * Mirrors the `lib/integrations/config-status.ts` `isIntegrationConfigured`
 * seam and the briefings `NOTION_API_KEY` graceful-degrade pattern.
 */
export function isEncryptionConfigured(envValue?: string): boolean {
  const raw = envValue ?? process.env.ENCRYPTION_KEY
  return typeof raw === 'string' && /^[0-9a-fA-F]{64}$/.test(raw)
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(`${FORMAT_VERSION}:`)
}

export function encrypt(plaintext: string, keyOverride?: Buffer): string {
  if (typeof plaintext !== 'string') {
    throw new EncryptionError('plaintext must be a string')
  }
  const key = keyOverride ?? loadMasterKey()
  if (key.length !== KEY_BYTES) {
    throw new InvalidKeyError(`expected ${KEY_BYTES} bytes, got ${key.length}`)
  }

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    FORMAT_VERSION,
    iv.toString('hex'),
    authTag.toString('hex'),
    ciphertext.toString('hex'),
  ].join(':')
}

export function decrypt(payload: string, keyOverride?: Buffer): string {
  if (typeof payload !== 'string' || !payload) {
    throw new InvalidCiphertextError('payload must be a non-empty string')
  }
  const parts = payload.split(':')
  if (parts.length !== 4) {
    throw new InvalidCiphertextError(`expected 4 colon-separated parts, got ${parts.length}`)
  }
  const [version, ivHex, tagHex, ctHex] = parts
  if (version !== FORMAT_VERSION) {
    throw new InvalidCiphertextError(`unknown version "${version}"`)
  }
  if (!/^[0-9a-f]+$/i.test(ivHex) || !/^[0-9a-f]+$/i.test(tagHex) || !/^[0-9a-f]*$/i.test(ctHex)) {
    throw new InvalidCiphertextError('non-hex characters in payload')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ctHex, 'hex')
  if (iv.length !== IV_BYTES) {
    throw new InvalidCiphertextError(`iv must be ${IV_BYTES} bytes, got ${iv.length}`)
  }
  if (authTag.length !== TAG_BYTES) {
    throw new InvalidCiphertextError(`auth tag must be ${TAG_BYTES} bytes, got ${authTag.length}`)
  }

  const key = keyOverride ?? loadMasterKey()
  if (key.length !== KEY_BYTES) {
    throw new InvalidKeyError(`expected ${KEY_BYTES} bytes, got ${key.length}`)
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    throw new InvalidCiphertextError('authentication failed (key mismatch or tampered ciphertext)')
  }
}

export function safeEqualSecret(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export const __internals = {
  ALGORITHM,
  KEY_BYTES,
  IV_BYTES,
  TAG_BYTES,
  FORMAT_VERSION,
}
