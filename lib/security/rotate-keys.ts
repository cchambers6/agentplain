import { decrypt, encrypt, isEncrypted, loadMasterKey } from './encryption'

export interface RotationRecord {
  id: string
  ciphertext: string
}

export interface RotationResult {
  total: number
  rotated: number
  skipped: number
  errors: Array<{ id: string; reason: string }>
}

export interface RotationDeps {
  fetchAll: () => Promise<RotationRecord[]>
  persist: (id: string, newCiphertext: string) => Promise<void>
  log?: (msg: string) => void
}

export async function rotateKeys(
  deps: RotationDeps,
  oldKeyHex?: string,
  newKeyHex?: string,
): Promise<RotationResult> {
  const oldKey = loadMasterKey(oldKeyHex ?? process.env.ENCRYPTION_KEY_OLD)
  const newKey = loadMasterKey(newKeyHex ?? process.env.ENCRYPTION_KEY_NEW)
  if (oldKey.equals(newKey)) {
    throw new Error('ENCRYPTION_KEY_OLD and ENCRYPTION_KEY_NEW are identical — rotation is a no-op')
  }
  const log = deps.log ?? (() => {})

  const records = await deps.fetchAll()
  const result: RotationResult = { total: records.length, rotated: 0, skipped: 0, errors: [] }

  for (const record of records) {
    if (!isEncrypted(record.ciphertext)) {
      result.skipped++
      log(`skip ${record.id}: not in encrypted format`)
      continue
    }
    try {
      let plaintext: string
      try {
        plaintext = decrypt(record.ciphertext, oldKey)
      } catch (errOld) {
        try {
          decrypt(record.ciphertext, newKey)
          result.skipped++
          log(`skip ${record.id}: already encrypted under new key`)
          continue
        } catch {
          throw errOld
        }
      }
      const newCiphertext = encrypt(plaintext, newKey)
      await deps.persist(record.id, newCiphertext)
      result.rotated++
      log(`rotated ${record.id}`)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      result.errors.push({ id: record.id, reason })
      log(`error ${record.id}: ${reason}`)
    }
  }

  return result
}
