/**
 * Ops flag store — DB-backed source of truth for ops-managed flags
 * (Inngest pause/resume in particular — P0-4).
 *
 * Adapter pattern per `feedback_no_silent_vendor_lock` +
 * `feedback_runner_portability`. Every flag-store category has at least
 * two implementations: the Prisma-backed production store
 * (`./prisma-flag-store.ts`) and the in-memory store below (used by
 * `lib/inngest/run-with-disable-gate.ts` tests, the
 * `lib/ops/__tests__/contract.test.ts` Inngest factory, and the
 * `--dry-run` CLI path).
 *
 * Why a small dedicated interface rather than extending OpsControlPlane
 * with a `getOpsFlag` / `setOpsFlag` method: the gate
 * (`lib/inngest/run-with-disable-gate.ts`) only needs a read primitive,
 * does not care about Vercel or GitHub or any other vendor surface, and
 * lives in the Inngest function critical path. Carving the flag store
 * out as its own interface keeps the gate's import graph small (no
 * pulled-in GitHub / Vercel transitive deps) and makes the gate trivial
 * to test with the in-memory implementation. The InngestControlAdapter
 * COMPOSES this store with its existing Vercel-env mirror — see
 * `lib/ops/inngest/control.ts`.
 */

import type { OpsResult } from './types'
import { opsError, opsOk } from './types'

/**
 * One row from the `OpsFlag` table — exposed as a vendor-neutral shape so
 * the gate / CLI never imports `@prisma/client` directly.
 */
export interface OpsFlagRecord {
  name: string
  value: string
  updatedAt: Date
  updatedBy: string | null
  note: string | null
}

/**
 * Vendor-neutral flag store contract.
 *
 * `get` returns `null` (NOT an error) for a missing flag — that is the
 * dominant case in production and surfacing it as an error code would
 * force every caller to branch on `code === 'NOT_FOUND'`. A failure to
 * even reach the store (DB unreachable, mis-configured, etc.) still
 * comes back as `OpsResult` failure so callers can decide between
 * "treat as missing" (gate: fall back to env) and "fail loud" (CLI:
 * surface a blocker).
 */
export interface OpsFlagStore {
  get(name: string): Promise<OpsResult<OpsFlagRecord | null>>
  set(
    name: string,
    value: string,
    opts?: { updatedBy?: string | null; note?: string | null },
  ): Promise<OpsResult<OpsFlagRecord>>
}

/**
 * In-memory `OpsFlagStore` for tests + `--dry-run`. Satisfies the
 * two-implementation rule and mirrors the production-store behavior
 * (single-writer, last-write-wins on a single name).
 *
 * NOT a mock — exposed as a real, parallel implementation just like
 * `TestOpsControlPlane`. The contract test in `flag-store.test.ts`
 * pins the shared invariants for both implementations.
 */
export class InMemoryOpsFlagStore implements OpsFlagStore {
  private readonly rows: Map<string, OpsFlagRecord> = new Map()
  /** Toggle to simulate a DB-down condition in fallback tests. */
  public failNextRead: boolean = false

  constructor(seed: Record<string, string> = {}) {
    const now = new Date()
    for (const [name, value] of Object.entries(seed)) {
      this.rows.set(name, {
        name,
        value,
        updatedAt: now,
        updatedBy: 'seed',
        note: null,
      })
    }
  }

  async get(name: string): Promise<OpsResult<OpsFlagRecord | null>> {
    if (this.failNextRead) {
      this.failNextRead = false
      return opsError('UPSTREAM_ERROR', 'simulated flag-store outage')
    }
    return opsOk(this.rows.get(name) ?? null)
  }

  async set(
    name: string,
    value: string,
    opts?: { updatedBy?: string | null; note?: string | null },
  ): Promise<OpsResult<OpsFlagRecord>> {
    const record: OpsFlagRecord = {
      name,
      value,
      updatedAt: new Date(),
      updatedBy: opts?.updatedBy ?? null,
      note: opts?.note ?? null,
    }
    this.rows.set(name, record)
    return opsOk(record)
  }

  /** Test helper — peek at the current row without going through `get`. */
  peek(name: string): OpsFlagRecord | undefined {
    return this.rows.get(name)
  }
}
