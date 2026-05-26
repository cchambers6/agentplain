/**
 * `OpsFlagStore` contract tests.
 *
 * Two implementations exist: `InMemoryOpsFlagStore` (lib/ops/flag-store.ts)
 * and `PrismaOpsFlagStore` (lib/ops/prisma-flag-store.ts). The in-memory
 * one is exercised directly here. The Prisma one is exercised against an
 * injected `systemContext` shim that records the GUC handoff and a fake
 * Prisma client — that is enough to pin the application-layer contract
 * without standing up a real database (live DB exercise belongs in the
 * deploy-time smoke pass; see prisma/migrations/20260526120000_add_ops_flag).
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { InMemoryOpsFlagStore, type OpsFlagRecord } from '../flag-store'
import { PrismaOpsFlagStore } from '../prisma-flag-store'

describe('InMemoryOpsFlagStore', () => {
  it('get returns null for an unknown name', async () => {
    const store = new InMemoryOpsFlagStore()
    const res = await store.get('NEVER_SET')
    assert.equal(res.ok, true)
    if (res.ok) assert.equal(res.value, null)
  })

  it('set then get round-trips with metadata', async () => {
    const store = new InMemoryOpsFlagStore()
    const set = await store.set('INNGEST_FN_DISABLE_TEST', 'true', {
      updatedBy: 'cli:throttle.ts',
      note: 'pausing trial sweep for incident',
    })
    assert.equal(set.ok, true)
    if (set.ok) {
      assert.equal(set.value.name, 'INNGEST_FN_DISABLE_TEST')
      assert.equal(set.value.value, 'true')
      assert.equal(set.value.updatedBy, 'cli:throttle.ts')
      assert.equal(set.value.note, 'pausing trial sweep for incident')
    }
    const get = await store.get('INNGEST_FN_DISABLE_TEST')
    assert.equal(get.ok, true)
    if (get.ok && get.value) {
      assert.equal(get.value.value, 'true')
      assert.equal(get.value.updatedBy, 'cli:throttle.ts')
    }
  })

  it('set is last-write-wins on the same name', async () => {
    const store = new InMemoryOpsFlagStore()
    await store.set('FLAG', 'true', { updatedBy: 'first' })
    await store.set('FLAG', 'false', { updatedBy: 'second' })
    const get = await store.get('FLAG')
    assert.equal(get.ok, true)
    if (get.ok && get.value) {
      assert.equal(get.value.value, 'false')
      assert.equal(get.value.updatedBy, 'second')
    }
  })

  it('failNextRead surfaces an UPSTREAM_ERROR once, then self-clears', async () => {
    const store = new InMemoryOpsFlagStore({ FLAG: 'true' })
    store.failNextRead = true
    const r1 = await store.get('FLAG')
    assert.equal(r1.ok, false)
    if (!r1.ok) assert.equal(r1.error.code, 'UPSTREAM_ERROR')
    const r2 = await store.get('FLAG')
    assert.equal(r2.ok, true)
    if (r2.ok && r2.value) assert.equal(r2.value.value, 'true')
  })

  it('seed values are visible to a subsequent get', async () => {
    const store = new InMemoryOpsFlagStore({ A: 'true', B: 'false' })
    const a = await store.get('A')
    const b = await store.get('B')
    assert.equal(a.ok, true)
    if (a.ok && a.value) assert.equal(a.value.value, 'true')
    assert.equal(b.ok, true)
    if (b.ok && b.value) assert.equal(b.value.value, 'false')
  })
})

// ---------------------------------------------------------------------------
// PrismaOpsFlagStore — injected systemContext + fake Prisma client.
// Pins the GUC-handoff contract: every read/write runs through
// withSystemContext (operator GUC set before DML), so the OpsFlag table's
// operator-only RLS policy is satisfied uniformly.
// ---------------------------------------------------------------------------

interface FakeOpsFlagRow {
  name: string
  value: string
  updatedAt: Date
  updatedBy: string | null
  note: string | null
}

class FakeTx {
  public rows: Map<string, FakeOpsFlagRow> = new Map()
  public reads: string[] = []
  public writes: Array<{ name: string; value: string; updatedBy: string | null }> = []
  public throwOnNext: 'read' | 'write' | null = null

  get opsFlag() {
    return {
      findUnique: async ({ where }: { where: { name: string } }) => {
        if (this.throwOnNext === 'read') {
          this.throwOnNext = null
          throw new Error('simulated prisma read error')
        }
        this.reads.push(where.name)
        return this.rows.get(where.name) ?? null
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { name: string }
        create: FakeOpsFlagRow
        update: Partial<FakeOpsFlagRow>
      }) => {
        if (this.throwOnNext === 'write') {
          this.throwOnNext = null
          throw new Error('simulated prisma write error')
        }
        const existing = this.rows.get(where.name)
        const row: FakeOpsFlagRow = existing
          ? {
              name: where.name,
              value: update.value ?? existing.value,
              updatedAt: new Date(),
              updatedBy:
                update.updatedBy !== undefined ? update.updatedBy : existing.updatedBy,
              note: update.note !== undefined ? update.note : existing.note,
            }
          : { ...create, updatedAt: new Date() }
        this.rows.set(where.name, row)
        this.writes.push({ name: row.name, value: row.value, updatedBy: row.updatedBy })
        return row
      },
    }
  }
}

interface RecordedSystemCall {
  ran: boolean
}

function makeFakeSystemContext(tx: FakeTx, recorder: RecordedSystemCall[]) {
  // Mimic the real `withSystemContext` signature so the store can pass
  // through unchanged. Records that the helper was entered before the
  // DML closure ran — that is the GUC-handoff invariant we are pinning.
  return async <T>(fn: (txArg: unknown) => Promise<T>): Promise<T> => {
    recorder.push({ ran: true })
    return fn(tx)
  }
}

describe('PrismaOpsFlagStore — system-context wrapping + error surfacing', () => {
  let fakeTx: FakeTx
  let calls: RecordedSystemCall[]
  let store: PrismaOpsFlagStore

  beforeEach(() => {
    fakeTx = new FakeTx()
    calls = []
    store = new PrismaOpsFlagStore({
      // We're passing in a custom systemContext so the production
      // `withSystemContext` (which would need a live DB) is never invoked.
      systemContext: makeFakeSystemContext(fakeTx, calls) as never,
    })
  })

  it('get goes through withSystemContext on every read', async () => {
    const res = await store.get('FLAG')
    assert.equal(res.ok, true)
    if (res.ok) assert.equal(res.value, null)
    assert.equal(calls.length, 1, 'system-context wrapper must run for the read')
    assert.deepEqual(fakeTx.reads, ['FLAG'])
  })

  it('set goes through withSystemContext on every write', async () => {
    const res = await store.set('FLAG', 'true', { updatedBy: 'cli' })
    assert.equal(res.ok, true)
    assert.equal(calls.length, 1, 'system-context wrapper must run for the write')
    assert.equal(fakeTx.writes.length, 1)
    assert.equal(fakeTx.writes[0]?.name, 'FLAG')
    assert.equal(fakeTx.writes[0]?.value, 'true')
    assert.equal(fakeTx.writes[0]?.updatedBy, 'cli')
  })

  it('a Prisma read failure becomes UPSTREAM_ERROR, not a thrown exception', async () => {
    fakeTx.throwOnNext = 'read'
    const res = await store.get('FLAG')
    assert.equal(res.ok, false)
    if (!res.ok) {
      assert.equal(res.error.code, 'UPSTREAM_ERROR')
      assert.match(res.error.message, /OpsFlag\.get failed/)
    }
  })

  it('a Prisma write failure becomes UPSTREAM_ERROR, not a thrown exception', async () => {
    fakeTx.throwOnNext = 'write'
    const res = await store.set('FLAG', 'true')
    assert.equal(res.ok, false)
    if (!res.ok) {
      assert.equal(res.error.code, 'UPSTREAM_ERROR')
      assert.match(res.error.message, /OpsFlag\.set failed/)
    }
  })

  it('rejects empty name with INVALID_ARGUMENT (no DB round-trip)', async () => {
    const r1 = await store.get('')
    assert.equal(r1.ok, false)
    if (!r1.ok) assert.equal(r1.error.code, 'INVALID_ARGUMENT')
    const r2 = await store.set('', 'true')
    assert.equal(r2.ok, false)
    if (!r2.ok) assert.equal(r2.error.code, 'INVALID_ARGUMENT')
    assert.equal(calls.length, 0, 'no system-context call should be made for invalid args')
  })

  it('round-trips a written row through a subsequent read', async () => {
    await store.set('FLAG', 'true', { updatedBy: 'cli:throttle.ts', note: 'P0 incident' })
    const got = await store.get('FLAG')
    assert.equal(got.ok, true)
    if (got.ok && got.value) {
      const record: OpsFlagRecord = got.value
      assert.equal(record.value, 'true')
      assert.equal(record.updatedBy, 'cli:throttle.ts')
      assert.equal(record.note, 'P0 incident')
    }
  })
})
