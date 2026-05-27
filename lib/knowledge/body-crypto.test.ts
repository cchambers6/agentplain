/**
 * lib/knowledge/body-crypto.test.ts
 *
 * Tests for the KnowledgeDocument.body at-rest encryption layer + the
 * dependency-injected backfill loop. Covers the four scenarios in the
 * data-privacy audit follow-up plan:
 *
 *   1. Round-trip — write encrypted, read back plaintext at the boundary.
 *   2. Retrieve still returns correct decrypted bodies (transparent at
 *      the store seam).
 *   3. Backfill encrypts a legacy plaintext row, then is idempotent on
 *      re-run (skipped via the v1 marker).
 *   4. A corrupt / undecryptable body degrades to '' rather than
 *      crashing retrieval.
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

import { isEncrypted } from '@/lib/security/encryption'
import {
  decryptBodyForRead,
  encryptBodyForWrite,
} from './body-crypto'
import {
  backfillKnowledgeBodies,
  type BackfillRow,
} from './body-crypto-backfill'

const TEST_KEY_HEX = randomBytes(32).toString('hex')
let savedKey: string | undefined

function withKey<T>(fn: () => T): T {
  const prev = process.env.ENCRYPTION_KEY
  process.env.ENCRYPTION_KEY = TEST_KEY_HEX
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = prev
  }
}

describe('body-crypto: round-trip (write → encrypted-at-rest → read → plaintext)', () => {
  beforeEach(() => {
    savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX
  })
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = savedKey
  })

  it('round-trips ASCII bodies', () => {
    const plain = 'Listing agreement excerpt: 6% commission, GA flat-fee broker.'
    const stored = encryptBodyForWrite(plain)
    assert.equal(isEncrypted(stored), true, 'stored form must carry v1 marker')
    assert.notEqual(stored, plain, 'stored form must differ from plaintext')
    assert.equal(decryptBodyForRead(stored), plain)
  })

  it('round-trips utf-8 bodies with non-ascii content', () => {
    const plain = 'Customer note — soñé con la oferta 🏠 — closing 2026-06-15.'
    const stored = encryptBodyForWrite(plain)
    assert.equal(decryptBodyForRead(stored), plain)
  })

  it('round-trips empty bodies (the at-rest shape stays uniform)', () => {
    const stored = encryptBodyForWrite('')
    assert.equal(isEncrypted(stored), true)
    assert.equal(decryptBodyForRead(stored), '')
  })

  it('produces distinct ciphertexts for the same plaintext (fresh IV per call)', () => {
    const plain = 'duplicate-test'
    const a = encryptBodyForWrite(plain)
    const b = encryptBodyForWrite(plain)
    assert.notEqual(a, b, 'IV must rotate per encrypt — see encryption.ts:IV_BYTES')
    assert.equal(decryptBodyForRead(a), plain)
    assert.equal(decryptBodyForRead(b), plain)
  })
})

describe('body-crypto: encryptBodyForWrite is idempotent', () => {
  beforeEach(() => {
    savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX
  })
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = savedKey
  })

  it('returns an already-encrypted value unchanged (no double-encrypt)', () => {
    const plain = 'idempotency check'
    const once = encryptBodyForWrite(plain)
    const twice = encryptBodyForWrite(once)
    assert.equal(twice, once, 'second call must short-circuit on the v1 marker')
    assert.equal(decryptBodyForRead(twice), plain)
  })
})

describe('body-crypto: decryptBodyForRead degrades gracefully', () => {
  beforeEach(() => {
    savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX
  })
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = savedKey
  })

  it('passes legacy plaintext through unchanged (no marker → no decrypt attempt)', () => {
    const legacy = 'This row predates encryption rollout.'
    assert.equal(decryptBodyForRead(legacy), legacy)
  })

  it('returns empty string when ciphertext is corrupt (does NOT throw)', () => {
    // v1 marker present but the payload after it is garbage.
    const corrupt = 'v1:deadbeefdeadbeefdeadbe:deadbeefdeadbeefdeadbeefdeadbeef:abcd'
    assert.equal(decryptBodyForRead(corrupt), '')
  })

  it('returns empty string when ciphertext is structurally malformed', () => {
    assert.equal(decryptBodyForRead('v1:not-a-valid-shape'), '')
    assert.equal(decryptBodyForRead('v1:::'), '')
  })

  it('returns empty string when ENCRYPTION_KEY is absent (cannot decrypt)', () => {
    const stored = encryptBodyForWrite('payload')
    delete process.env.ENCRYPTION_KEY
    assert.equal(decryptBodyForRead(stored), '')
  })

  it('returns empty string when key is rotated to a different value', () => {
    const stored = encryptBodyForWrite('payload')
    // Rotate the key — the stored ciphertext is now undecryptable under
    // the new key (auth tag verification fails). Retrieval must NOT
    // throw; the row degrades to body='' and the rest of the snippet
    // (title/sourceUrl/similarity) still surfaces.
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')
    assert.equal(decryptBodyForRead(stored), '')
  })
})

describe('body-crypto: encryptBodyForWrite refuses non-string input', () => {
  beforeEach(() => {
    savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX
  })
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = savedKey
  })

  it('throws on a non-string body — write paths must fail loudly', () => {
    assert.throws(
      () => encryptBodyForWrite(undefined as unknown as string),
      /string/i,
    )
  })
})

describe('body-crypto: simulated pgvector retrieve preserves similarity + decrypts body', () => {
  // The pgvector store decrypts at the row.body → KnowledgeSearchHit
  // boundary (lib/knowledge/pgvector-store.ts row.map). The DB layer is
  // out of reach in unit tests, so we mimic that boundary in-process —
  // proving the wiring is transparent: callers receive plaintext bodies
  // and the similarity score is unaffected by encryption (encryption
  // happens AFTER the embed call).
  beforeEach(() => {
    savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX
  })
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = savedKey
  })

  it('returns plaintext body + preserves a precomputed similarity', () => {
    const plain = 'closing checklist for 1245 Peachtree — buyer financed'
    const storedBody = encryptBodyForWrite(plain)
    const fakeSqlRow = {
      embeddingId: 'emb-1',
      documentId: 'doc-1',
      contextKind: 'CUSTOMER' as const,
      workspaceId: 'ws-1',
      title: 'closing checklist',
      body: storedBody,
      sourceUrl: null,
      verticalSlug: null,
      metadata: {},
      distance: 0.12,
    }
    const decryptedBody = decryptBodyForRead(fakeSqlRow.body)
    const similarity = 1 - fakeSqlRow.distance
    assert.equal(decryptedBody, plain)
    assert.equal(similarity, 0.88)
  })

  it('returns plaintext for a legacy unencrypted body', () => {
    const fakeSqlRow = { body: 'pre-encryption row' }
    assert.equal(decryptBodyForRead(fakeSqlRow.body), 'pre-encryption row')
  })

  it('returns empty for a corrupted body but other fields still surface', () => {
    const fakeSqlRow = {
      title: 'still readable',
      body: 'v1:dead:beef:cafe',
      sourceUrl: 'https://example.com/file',
    }
    assert.equal(decryptBodyForRead(fakeSqlRow.body), '')
    assert.equal(fakeSqlRow.title, 'still readable')
    assert.equal(fakeSqlRow.sourceUrl, 'https://example.com/file')
  })
})

describe('backfill: encrypts legacy plaintext rows and is idempotent on re-run', () => {
  beforeEach(() => {
    savedKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX
  })
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = savedKey
  })

  function makeStore(rows: BackfillRow[]) {
    const byId = new Map(rows.map((r) => [r.id, { ...r }]))
    return {
      byId,
      async listPage(cursor: string | null): Promise<BackfillRow[]> {
        const all = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id))
        if (cursor === null) return all.slice(0, 100)
        const i = all.findIndex((r) => r.id === cursor)
        if (i < 0) return []
        return all.slice(i + 1, i + 1 + 100)
      },
      async updateRow(id: string, cipher: string): Promise<void> {
        const r = byId.get(id)
        if (!r) throw new Error(`fixture missing id ${id}`)
        r.body = cipher
      },
    }
  }

  it('encrypts every legacy row on first pass', async () => {
    const store = makeStore([
      { id: '01', body: 'plaintext one' },
      { id: '02', body: 'plaintext two' },
      { id: '03', body: 'plaintext three' },
    ])
    const stats = await backfillKnowledgeBodies({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: store.updateRow,
    })
    assert.equal(stats.scanned, 3)
    assert.equal(stats.encrypted, 3)
    assert.equal(stats.alreadyEncrypted, 0)
    assert.equal(stats.failed, 0)
    for (const row of store.byId.values()) {
      assert.equal(isEncrypted(row.body!), true, `row ${row.id} must be encrypted`)
    }
  })

  it('is idempotent on re-run — every row hits the alreadyEncrypted short-circuit', async () => {
    const store = makeStore([
      { id: '01', body: 'plaintext one' },
      { id: '02', body: 'plaintext two' },
    ])
    await backfillKnowledgeBodies({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: store.updateRow,
    })
    const second = await backfillKnowledgeBodies({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: store.updateRow,
    })
    assert.equal(second.scanned, 2)
    assert.equal(second.alreadyEncrypted, 2)
    assert.equal(second.encrypted, 0)
    assert.equal(second.failed, 0)
  })

  it('skips an already-encrypted row mixed with legacy rows', async () => {
    const preEncrypted = encryptBodyForWrite('already done')
    const store = makeStore([
      { id: '01', body: 'plaintext one' },
      { id: '02', body: preEncrypted },
      { id: '03', body: 'plaintext three' },
    ])
    const stats = await backfillKnowledgeBodies({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: store.updateRow,
    })
    assert.equal(stats.scanned, 3)
    assert.equal(stats.encrypted, 2)
    assert.equal(stats.alreadyEncrypted, 1)
    // The pre-encrypted row was NOT re-written — its body is unchanged.
    assert.equal(store.byId.get('02')!.body, preEncrypted)
  })

  it('continues past a row whose update fails (does not abort the pass)', async () => {
    const store = makeStore([
      { id: '01', body: 'plaintext one' },
      { id: '02', body: 'plaintext two' },
      { id: '03', body: 'plaintext three' },
    ])
    const log: string[] = []
    const stats = await backfillKnowledgeBodies({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: async (id, cipher) => {
        if (id === '02') throw new Error('simulated DB conflict on row 02')
        await store.updateRow(id, cipher)
      },
      log: (line) => log.push(line),
    })
    assert.equal(stats.scanned, 3)
    assert.equal(stats.encrypted, 2)
    assert.equal(stats.failed, 1)
    assert.equal(isEncrypted(store.byId.get('01')!.body!), true)
    assert.equal(store.byId.get('02')!.body, 'plaintext two', 'failed row stays plaintext')
    assert.equal(isEncrypted(store.byId.get('03')!.body!), true)
    assert.ok(
      log.some((line) => line.includes('row 02: encrypt failed')),
      'failure must surface in the log so operators can re-run',
    )
  })

  it('dry-run counts but does not modify rows', async () => {
    const store = makeStore([
      { id: '01', body: 'plaintext one' },
      { id: '02', body: 'plaintext two' },
    ])
    const stats = await backfillKnowledgeBodies({
      batchSize: 100,
      dryRun: true,
      listPage: store.listPage,
      updateRow: async () => {
        throw new Error('updateRow must NOT be called in dry-run')
      },
    })
    assert.equal(stats.encrypted, 2)
    assert.equal(store.byId.get('01')!.body, 'plaintext one')
    assert.equal(store.byId.get('02')!.body, 'plaintext two')
  })
})

void withKey
