/**
 * Contract tests parameterized over every `OpsControlPlane`
 * implementation. The production GitHub + Inngest adapters mock fetch
 * in-process (no msw — keeps the test runner pure node:test).
 *
 * Inngest pause/resume is now a real, exercised contract — it is no
 * longer a NOT_IMPLEMENTED carve-out. The Inngest adapter writes the
 * `INNGEST_FN_DISABLE_*` env var on Vercel via the REST API; the fake
 * Vercel fetch below mirrors the documented endpoint behavior closely
 * enough for the round-trip assertions to be meaningful.
 *
 * Run: `node --import tsx --test lib/ops/__tests__/contract.test.ts`
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import type { OpsControlPlane } from '../types'
import { TestOpsControlPlane } from '../test-ops'
import { GithubActionsVarsAdapter } from '../github/actions-vars'
import { InngestControlAdapter } from '../inngest/control'
import { InMemoryOpsFlagStore } from '../flag-store'
import { disableFlagEnvName } from '../../inngest/disable-flag'

// ---------------------------------------------------------------------------
// Fake fetch for the GitHub adapter. Maintains an in-memory variable store
// so behavior matches the real REST API closely enough for contract tests.
// ---------------------------------------------------------------------------

type FakeStore = Map<string, { value: string; updated_at: string }>

interface FakeFetchOpts {
  store?: FakeStore
  /** Override for specific URL patterns (e.g. force 401). */
  override?: (url: string, init: RequestInit) => Response | undefined
}

function makeFakeGithubFetch(opts: FakeFetchOpts = {}): typeof fetch {
  const store = opts.store ?? new Map()
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    const overridden = opts.override?.(url, init ?? {})
    if (overridden) return overridden

    const m = url.match(/\/repos\/[^/]+\/[^/]+\/actions\/variables(?:\/([^/?]+))?$/)
    if (!m) return new Response('not found', { status: 404 })
    const name = m[1]

    if (method === 'GET' && name) {
      const entry = store.get(name)
      if (!entry) {
        return new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(
        JSON.stringify({ name, value: entry.value, updated_at: entry.updated_at }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (method === 'POST' && !name) {
      const body = JSON.parse((init?.body as string) ?? '{}')
      if (store.has(body.name)) {
        return new Response(
          JSON.stringify({ message: 'Variable already exists' }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        )
      }
      store.set(body.name, { value: body.value, updated_at: new Date().toISOString() })
      return new Response(null, { status: 201 })
    }

    if (method === 'PATCH' && name) {
      if (!store.has(name)) {
        return new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const body = JSON.parse((init?.body as string) ?? '{}')
      store.set(name, { value: body.value, updated_at: new Date().toISOString() })
      return new Response(null, { status: 204 })
    }

    return new Response('method not allowed', { status: 405 })
  }
}

// ---------------------------------------------------------------------------
// Fake fetch for the Vercel-backed Inngest adapter. Maintains an in-memory
// env-var store keyed by var id, mirroring the documented Vercel REST shape:
//   POST /v9/projects/:id/env?upsert=true   create-or-update single var
//   GET  /v9/projects/:id/env               list { envs: [...] }
// ---------------------------------------------------------------------------

interface FakeVercelEnv {
  id: string
  key: string
  value: string
  type: string
  target: string[]
}

function makeFakeVercelFetch(store: Map<string, FakeVercelEnv> = new Map()): typeof fetch {
  let nextId = 1
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    const m = url.match(/\/v9\/projects\/([^/?]+)\/env(?:\?(.*))?$/)
    if (!m) return new Response('not found', { status: 404 })

    if (method === 'GET') {
      return new Response(
        JSON.stringify({ envs: Array.from(store.values()) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (method === 'POST') {
      const qs = new URLSearchParams(m[2] ?? '')
      const upsert = qs.get('upsert') === 'true'
      const body = JSON.parse((init?.body as string) ?? '{}') as Partial<FakeVercelEnv>
      if (typeof body.key !== 'string' || typeof body.value !== 'string') {
        return new Response(
          JSON.stringify({ error: { message: 'key and value required' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const existing = Array.from(store.values()).find((e) => e.key === body.key)
      if (existing && !upsert) {
        return new Response(
          JSON.stringify({ error: { message: 'env var already exists' } }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const id = existing?.id ?? `env_${nextId++}`
      const record: FakeVercelEnv = {
        id,
        key: body.key,
        value: body.value,
        type: body.type ?? 'plain',
        target: body.target ?? ['production'],
      }
      store.set(id, record)
      return new Response(JSON.stringify(record), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('method not allowed', { status: 405 })
  }
}

// ---------------------------------------------------------------------------
// Shared contract: every implementation must satisfy these invariants for
// the surfaces it claims to support. The two adapters cover disjoint
// surfaces (GH = repo vars; Inngest = pause), so each gets its own
// `supports*` flag and the contract test branches on capability rather
// than carving out NOT_IMPLEMENTED expectations.
// ---------------------------------------------------------------------------

interface ImplFactory {
  name: string
  make: () => OpsControlPlane
  supportsRepoVariables: boolean
  supportsPause: boolean
}

const factories: ImplFactory[] = [
  {
    name: 'TestOpsControlPlane',
    make: () => new TestOpsControlPlane(),
    supportsRepoVariables: true,
    supportsPause: true,
  },
  {
    name: 'GithubActionsVarsAdapter (fake fetch)',
    make: () =>
      new GithubActionsVarsAdapter({
        owner: 'cchambers6',
        repo: 'flatsbo',
        token: 'gh-test-token',
        fetchImpl: makeFakeGithubFetch({ store: new Map() }),
      }),
    supportsRepoVariables: true,
    supportsPause: false,
  },
  {
    name: 'InngestControlAdapter (fake Vercel fetch + in-memory flag store)',
    make: () =>
      new InngestControlAdapter({
        flagStore: new InMemoryOpsFlagStore(),
        vercelProjectId: 'prj_fake_test',
        vercelToken: 'vercel-test-token',
        appId: 'flatsbo-prod',
        fetchImpl: makeFakeVercelFetch(),
      }),
    supportsRepoVariables: false,
    supportsPause: true,
  },
]

for (const f of factories) {
  describe(`OpsControlPlane contract — ${f.name}`, () => {
    let ops: OpsControlPlane
    beforeEach(() => {
      ops = f.make()
    })

    if (f.supportsRepoVariables) {
      it('getRepoVariable returns NOT_FOUND for missing key', async () => {
        const res = await ops.getRepoVariable('NEVER_SET_VAR')
        assert.equal(res.ok, false)
        if (!res.ok) assert.equal(res.error.code, 'NOT_FOUND')
      })

      it('setRepoVariable creates a new variable, then read returns it', async () => {
        const set = await ops.setRepoVariable('USE_GHA_CRON', 'false')
        assert.equal(set.ok, true)
        if (set.ok) {
          assert.equal(set.value.name, 'USE_GHA_CRON')
          assert.equal(set.value.value, 'false')
        }
        const got = await ops.getRepoVariable('USE_GHA_CRON')
        assert.equal(got.ok, true)
        if (got.ok) assert.equal(got.value.value, 'false')
      })

      it('setRepoVariable updates an existing variable in place', async () => {
        await ops.setRepoVariable('USE_GHA_CRON', 'true')
        await ops.setRepoVariable('USE_GHA_CRON', 'false')
        const got = await ops.getRepoVariable('USE_GHA_CRON')
        assert.equal(got.ok, true)
        if (got.ok) assert.equal(got.value.value, 'false')
      })

      it('rejects invalid variable names with INVALID_ARGUMENT', async () => {
        const res = await ops.setRepoVariable('GITHUB_FORBIDDEN', 'x')
        // GH adapter validates locally; TestOps always accepts. Verify
        // the GH adapter alone here — TestOps has no name validation
        // (it's a test impl, not a security boundary).
        if (f.name.startsWith('GithubActionsVarsAdapter')) {
          assert.equal(res.ok, false)
          if (!res.ok) assert.equal(res.error.code, 'INVALID_ARGUMENT')
        } else {
          assert.equal(res.ok, true)
        }
      })
    } else {
      it('repo-variable methods return NOT_IMPLEMENTED (composition signal)', async () => {
        const a = await ops.getRepoVariable('USE_GHA_CRON')
        assert.equal(a.ok, false)
        if (!a.ok) assert.equal(a.error.code, 'NOT_IMPLEMENTED')
        const b = await ops.setRepoVariable('USE_GHA_CRON', 'false')
        assert.equal(b.ok, false)
        if (!b.ok) assert.equal(b.error.code, 'NOT_IMPLEMENTED')
      })
    }

    if (f.supportsPause) {
      it('pause/resume round-trip is observable via status', async () => {
        const fnId = 'flatsbo-capability-builder-morning'
        const initial = await ops.getInngestFunctionStatus(fnId)
        assert.equal(initial.ok, true)
        if (initial.ok) assert.equal(initial.value.pauseState, 'active')

        const paused = await ops.pauseInngestFunction(fnId)
        assert.equal(paused.ok, true)

        const afterPause = await ops.getInngestFunctionStatus(fnId)
        assert.equal(afterPause.ok, true)
        if (afterPause.ok) assert.equal(afterPause.value.pauseState, 'paused')

        const resumed = await ops.resumeInngestFunction(fnId)
        assert.equal(resumed.ok, true)

        const afterResume = await ops.getInngestFunctionStatus(fnId)
        assert.equal(afterResume.ok, true)
        if (afterResume.ok) assert.equal(afterResume.value.pauseState, 'active')
      })
    } else {
      it('pause/resume return NOT_IMPLEMENTED on this adapter', async () => {
        const a = await ops.pauseInngestFunction('any-fn')
        assert.equal(a.ok, false)
        if (!a.ok) assert.equal(a.error.code, 'NOT_IMPLEMENTED')
        const b = await ops.resumeInngestFunction('any-fn')
        assert.equal(b.ok, false)
        if (!b.ok) assert.equal(b.error.code, 'NOT_IMPLEMENTED')
      })
    }
  })
}

// ---------------------------------------------------------------------------
// GitHub adapter: edge cases beyond the shared contract.
// ---------------------------------------------------------------------------

describe('GithubActionsVarsAdapter — edge cases', () => {
  it('maps 401 to UNAUTHORIZED', async () => {
    const adapter = new GithubActionsVarsAdapter({
      owner: 'cchambers6',
      repo: 'flatsbo',
      token: 'bad-token',
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ message: 'Bad credentials', documentation_url: 'https://docs.github.com/x' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          ),
        ) as unknown as ReturnType<typeof fetch>,
    })
    const res = await adapter.getRepoVariable('USE_GHA_CRON')
    assert.equal(res.ok, false)
    if (!res.ok) {
      assert.equal(res.error.code, 'UNAUTHORIZED')
      assert.equal(res.error.status, 401)
      assert.equal(res.error.reference, 'https://docs.github.com/x')
    }
  })

  it('maps 403 with x-ratelimit-remaining: 0 to RATE_LIMITED with retryAfterMs', async () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 60
    const adapter = new GithubActionsVarsAdapter({
      owner: 'cchambers6',
      repo: 'flatsbo',
      token: 't',
      fetchImpl: () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(resetEpoch),
            },
          }),
        ) as unknown as ReturnType<typeof fetch>,
    })
    const res = await adapter.getRepoVariable('USE_GHA_CRON')
    assert.equal(res.ok, false)
    if (!res.ok) {
      assert.equal(res.error.code, 'RATE_LIMITED')
      assert.ok(res.error.retryAfterMs !== undefined)
      assert.ok((res.error.retryAfterMs ?? 0) > 0)
    }
  })

  it('maps 403 without rate-limit headers to FORBIDDEN', async () => {
    const adapter = new GithubActionsVarsAdapter({
      owner: 'cchambers6',
      repo: 'flatsbo',
      token: 't',
      fetchImpl: () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Resource not accessible by integration' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
        ) as unknown as ReturnType<typeof fetch>,
    })
    const res = await adapter.getRepoVariable('USE_GHA_CRON')
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.error.code, 'FORBIDDEN')
  })

  it('maps malformed JSON success to MALFORMED_RESPONSE', async () => {
    const adapter = new GithubActionsVarsAdapter({
      owner: 'cchambers6',
      repo: 'flatsbo',
      token: 't',
      fetchImpl: () =>
        Promise.resolve(
          new Response('{broken-json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ) as unknown as ReturnType<typeof fetch>,
    })
    const res = await adapter.getRepoVariable('USE_GHA_CRON')
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.error.code, 'MALFORMED_RESPONSE')
  })

  it('maps a 200 with unexpected shape to MALFORMED_RESPONSE', async () => {
    const adapter = new GithubActionsVarsAdapter({
      owner: 'cchambers6',
      repo: 'flatsbo',
      token: 't',
      fetchImpl: () =>
        Promise.resolve(
          new Response(JSON.stringify({ unrelated: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ) as unknown as ReturnType<typeof fetch>,
    })
    const res = await adapter.getRepoVariable('USE_GHA_CRON')
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.error.code, 'MALFORMED_RESPONSE')
  })

  it('maps a network throw to NETWORK error', async () => {
    const adapter = new GithubActionsVarsAdapter({
      owner: 'cchambers6',
      repo: 'flatsbo',
      token: 't',
      fetchImpl: (() => {
        throw new Error('ECONNRESET')
      }) as unknown as typeof fetch,
    })
    const res = await adapter.getRepoVariable('USE_GHA_CRON')
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.error.code, 'NETWORK')
  })

  it('throws on construction without owner/repo', () => {
    assert.throws(
      () =>
        new GithubActionsVarsAdapter({
          owner: '',
          repo: 'flatsbo',
          token: 't',
        }),
    )
  })

  it('throws on construction without a token (env unset, none passed)', () => {
    const prevPat = process.env.GH_PAT
    const prevTok = process.env.GITHUB_TOKEN
    delete process.env.GH_PAT
    delete process.env.GITHUB_TOKEN
    try {
      assert.throws(
        () => new GithubActionsVarsAdapter({ owner: 'cchambers6', repo: 'flatsbo' }),
      )
    } finally {
      if (prevPat !== undefined) process.env.GH_PAT = prevPat
      if (prevTok !== undefined) process.env.GITHUB_TOKEN = prevTok
    }
  })
})

// ---------------------------------------------------------------------------
// InngestControlAdapter — edge cases beyond the shared contract.
// ---------------------------------------------------------------------------

describe('InngestControlAdapter — edge cases', () => {
  it('writes the DB flag (source of truth) AND mirrors to Vercel under the documented name', async () => {
    const envStore = new Map<string, FakeVercelEnv>()
    const flagStore = new InMemoryOpsFlagStore()
    const adapter = new InngestControlAdapter({
      flagStore,
      vercelProjectId: 'prj_fake',
      vercelToken: 'tok',
      appId: 'flatsbo-prod',
      fetchImpl: makeFakeVercelFetch(envStore),
    })
    const fnId = 'flatsbo-capability-builder-morning'
    const res = await adapter.pauseInngestFunction(fnId)
    assert.equal(res.ok, true)
    const expectedKey = disableFlagEnvName(fnId)
    // DB row is the source of truth.
    const dbRow = flagStore.peek(expectedKey)
    assert.ok(dbRow, 'DB flag must be written as the source of truth')
    assert.equal(dbRow?.value, 'true')
    // Env mirror reflects the same value (cold-start cache).
    const stored = Array.from(envStore.values()).find((e) => e.key === expectedKey)
    assert.ok(stored, `expected env mirror ${expectedKey} to be written`)
    assert.equal(stored?.value, 'true')
    assert.equal(stored?.type, 'plain')
  })

  it('DB-only mode (no Vercel credentials) still flips pause without an env mirror', async () => {
    // P0-4 path: in environments without a Vercel admin token, the
    // adapter should still operate on the DB — the gate reads it on the
    // next tick regardless.
    const flagStore = new InMemoryOpsFlagStore()
    const adapter = new InngestControlAdapter({
      flagStore,
      // No vercelProjectId → env mirror disabled.
      appId: 'agentplain-dev',
    })
    const fnId = 'agentplain-trial-warnings'
    const res = await adapter.pauseInngestFunction(fnId)
    assert.equal(res.ok, true)
    const row = flagStore.peek(disableFlagEnvName(fnId))
    assert.ok(row)
    assert.equal(row?.value, 'true')

    const status = await adapter.getInngestFunctionStatus(fnId)
    assert.equal(status.ok, true)
    if (status.ok) assert.equal(status.value.pauseState, 'paused')
  })

  it('resume sets the value to "false" rather than deleting (both DB and env mirror)', async () => {
    const envStore = new Map<string, FakeVercelEnv>()
    const flagStore = new InMemoryOpsFlagStore()
    const adapter = new InngestControlAdapter({
      flagStore,
      vercelProjectId: 'prj_fake',
      vercelToken: 'tok',
      fetchImpl: makeFakeVercelFetch(envStore),
    })
    const fnId = 'flatsbo-capability-builder-morning'
    await adapter.pauseInngestFunction(fnId)
    await adapter.resumeInngestFunction(fnId)
    assert.equal(flagStore.peek(disableFlagEnvName(fnId))?.value, 'false')
    const stored = Array.from(envStore.values()).find(
      (e) => e.key === disableFlagEnvName(fnId),
    )
    assert.ok(stored)
    assert.equal(stored?.value, 'false')
  })

  it('DB write failure aborts the call WITHOUT touching the env mirror (no half-mutation)', async () => {
    const envStore = new Map<string, FakeVercelEnv>()
    const flagStore = new InMemoryOpsFlagStore()
    flagStore.failNextRead = false
    // Monkey-patch set to simulate a DB write failure.
    const originalSet = flagStore.set.bind(flagStore)
    flagStore.set = async () => ({
      ok: false,
      error: { code: 'UPSTREAM_ERROR', message: 'simulated DB outage' },
    })
    const adapter = new InngestControlAdapter({
      flagStore,
      vercelProjectId: 'prj_fake',
      vercelToken: 'tok',
      fetchImpl: makeFakeVercelFetch(envStore),
    })
    const res = await adapter.pauseInngestFunction('flatsbo-capability-builder-morning')
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.error.code, 'UPSTREAM_ERROR')
    // Critical: env mirror was NOT touched — no half-mutation.
    assert.equal(envStore.size, 0)
    // Restore for any later assertions.
    flagStore.set = originalSet
  })

  it('env-mirror failure is downgraded to a warning — call succeeds because DB is source of truth', async () => {
    const flagStore = new InMemoryOpsFlagStore()
    const observed: string[] = []
    const adapter = new InngestControlAdapter({
      flagStore,
      vercelProjectId: 'prj_fake',
      vercelToken: 'tok',
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: { message: 'vercel rate limit' } }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'retry-after': '30' } },
          ),
        ) as unknown as ReturnType<typeof fetch>,
      onEnvMirrorFailure: (err) => observed.push(err.code),
    })
    const fnId = 'flatsbo-capability-builder-morning'
    const res = await adapter.pauseInngestFunction(fnId)
    // The call still succeeds — DB is the gate.
    assert.equal(res.ok, true)
    // DB has the new value.
    assert.equal(flagStore.peek(disableFlagEnvName(fnId))?.value, 'true')
    // And the operator-visible hook saw the env mirror's RATE_LIMITED.
    assert.deepEqual(observed, ['RATE_LIMITED'])
  })

  it('repo-variable methods return NOT_IMPLEMENTED (composition signal)', async () => {
    const adapter = new InngestControlAdapter({
      flagStore: new InMemoryOpsFlagStore(),
      vercelProjectId: 'prj_fake',
      vercelToken: 'tok',
      fetchImpl: makeFakeVercelFetch(),
    })
    const a = await adapter.getRepoVariable('USE_GHA_CRON')
    const b = await adapter.setRepoVariable('USE_GHA_CRON', 'false')
    assert.equal(a.ok, false)
    assert.equal(b.ok, false)
  })

  it('throws on construction without flagStore (P0-4 contract)', () => {
    assert.throws(
      () =>
        new InngestControlAdapter({
          // @ts-expect-error — exercising the runtime guard
          flagStore: undefined,
          vercelProjectId: 'prj_x',
          vercelToken: 'tok',
        }),
      /flagStore is required/,
    )
  })

  it('throws on construction when vercelProjectId is set but no token (env unset, none passed)', () => {
    const prev = process.env.VERCEL_TOKEN
    delete process.env.VERCEL_TOKEN
    try {
      assert.throws(
        () =>
          new InngestControlAdapter({
            flagStore: new InMemoryOpsFlagStore(),
            vercelProjectId: 'prj_x',
          }),
      )
    } finally {
      if (prev !== undefined) process.env.VERCEL_TOKEN = prev
    }
  })

  it('rejects empty functionId with INVALID_ARGUMENT', async () => {
    const adapter = new InngestControlAdapter({
      flagStore: new InMemoryOpsFlagStore(),
      vercelProjectId: 'prj_fake',
      vercelToken: 'tok',
      fetchImpl: makeFakeVercelFetch(),
    })
    const res = await adapter.pauseInngestFunction('')
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.error.code, 'INVALID_ARGUMENT')
  })
})
