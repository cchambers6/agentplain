import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { encrypt, decrypt } from './encryption'
import { rotateKeys, type RotationRecord } from './rotate-keys'

const oldKey = randomBytes(32)
const newKey = randomBytes(32)
const oldHex = oldKey.toString('hex')
const newHex = newKey.toString('hex')

describe('rotateKeys', () => {
  it('re-encrypts every record under the new key', async () => {
    const records: RotationRecord[] = [
      { id: 'a', ciphertext: encrypt('secret-a', oldKey) },
      { id: 'b', ciphertext: encrypt('secret-b', oldKey) },
      { id: 'c', ciphertext: encrypt('secret-c', oldKey) },
    ]
    const persisted = new Map<string, string>()

    const result = await rotateKeys(
      {
        fetchAll: async () => records,
        persist: async (id, ct) => {
          persisted.set(id, ct)
        },
      },
      oldHex,
      newHex,
    )

    assert.equal(result.total, 3)
    assert.equal(result.rotated, 3)
    assert.equal(result.errors.length, 0)
    for (const r of records) {
      const newCt = persisted.get(r.id)
      assert.ok(newCt, `${r.id} must be persisted`)
      assert.equal(decrypt(newCt!, newKey), `secret-${r.id}`)
      assert.notEqual(newCt, r.ciphertext, 'ciphertext must change after re-encryption')
    }
  })

  it('is idempotent — records already under the new key are skipped', async () => {
    const records: RotationRecord[] = [
      { id: 'mixed-old', ciphertext: encrypt('still-old', oldKey) },
      { id: 'mixed-new', ciphertext: encrypt('already-new', newKey) },
    ]
    const persisted: Array<{ id: string; ct: string }> = []

    const result = await rotateKeys(
      {
        fetchAll: async () => records,
        persist: async (id, ct) => {
          persisted.push({ id, ct })
        },
      },
      oldHex,
      newHex,
    )

    assert.equal(result.rotated, 1)
    assert.equal(result.skipped, 1)
    assert.equal(persisted.length, 1)
    assert.equal(persisted[0].id, 'mixed-old')
  })

  it('skips records that are not in the encrypted format', async () => {
    const records: RotationRecord[] = [{ id: 'plain', ciphertext: 'whsec_raw_value' }]
    const result = await rotateKeys(
      {
        fetchAll: async () => records,
        persist: async () => {
          throw new Error('should not persist')
        },
      },
      oldHex,
      newHex,
    )
    assert.equal(result.skipped, 1)
    assert.equal(result.rotated, 0)
  })

  it('records errors for ciphertexts that decrypt under neither key', async () => {
    const strayKey = randomBytes(32)
    const records: RotationRecord[] = [{ id: 'orphan', ciphertext: encrypt('orphan', strayKey) }]
    const result = await rotateKeys(
      {
        fetchAll: async () => records,
        persist: async () => {},
      },
      oldHex,
      newHex,
    )
    assert.equal(result.rotated, 0)
    assert.equal(result.errors.length, 1)
    assert.equal(result.errors[0].id, 'orphan')
  })

  it('refuses to rotate when old key equals new key', async () => {
    await assert.rejects(
      rotateKeys({ fetchAll: async () => [], persist: async () => {} }, oldHex, oldHex),
      /identical/,
    )
  })
})
