/**
 * Prisma-backed `OpsFlagStore`. Production implementation.
 *
 * Every read/write goes through `withSystemContext` (lib/db/rls.ts) so
 * the `OpsFlag` table's operator-only RLS policy + FORCE binding is
 * satisfied uniformly. A bare `prisma.opsFlag.*` call from a non-system
 * code path would see zero rows (no GUC ⇒ policy USING = FALSE), which
 * is the desired fail-closed shape.
 *
 * Failure mode discipline (per `feedback_no_quick_fixes`): every Prisma
 * call is wrapped in try/catch and surfaced as a typed `OpsResult`
 * `UPSTREAM_ERROR` rather than allowed to throw past the adapter
 * boundary. That lets `lib/inngest/run-with-disable-gate.ts` cleanly
 * fall through to the env cold-start cache when the DB is unreachable
 * — without leaking a Prisma exception into the Inngest function body.
 */

import { withSystemContext } from '../db'
import type { OpsResult } from './types'
import { opsError, opsOk } from './types'
import type { OpsFlagRecord, OpsFlagStore } from './flag-store'

export interface PrismaFlagStoreConfig {
  /**
   * Injectable system-context runner. Defaults to the real
   * `withSystemContext`. Tests pass a fake to assert the policy GUC was
   * set before the DML ran (mirrors the seam used by every other
   * cron-side caller — see `findTrialWarningCandidates`).
   */
  systemContext?: typeof withSystemContext
}

export class PrismaOpsFlagStore implements OpsFlagStore {
  private readonly systemContext: typeof withSystemContext

  constructor(config: PrismaFlagStoreConfig = {}) {
    this.systemContext = config.systemContext ?? withSystemContext
  }

  async get(name: string): Promise<OpsResult<OpsFlagRecord | null>> {
    if (typeof name !== 'string' || name.length === 0) {
      return opsError('INVALID_ARGUMENT', 'OpsFlag.get: name must be a non-empty string')
    }
    try {
      const row = await this.systemContext(async (tx) =>
        tx.opsFlag.findUnique({ where: { name } }),
      )
      if (!row) return opsOk(null)
      return opsOk({
        name: row.name,
        value: row.value,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        note: row.note,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return opsError('UPSTREAM_ERROR', `OpsFlag.get failed: ${message}`)
    }
  }

  async set(
    name: string,
    value: string,
    opts: { updatedBy?: string | null; note?: string | null } = {},
  ): Promise<OpsResult<OpsFlagRecord>> {
    if (typeof name !== 'string' || name.length === 0) {
      return opsError('INVALID_ARGUMENT', 'OpsFlag.set: name must be a non-empty string')
    }
    if (typeof value !== 'string') {
      return opsError('INVALID_ARGUMENT', 'OpsFlag.set: value must be a string')
    }
    try {
      const row = await this.systemContext(async (tx) =>
        tx.opsFlag.upsert({
          where: { name },
          update: {
            value,
            updatedBy: opts.updatedBy ?? null,
            note: opts.note ?? null,
          },
          create: {
            name,
            value,
            updatedBy: opts.updatedBy ?? null,
            note: opts.note ?? null,
          },
        }),
      )
      return opsOk({
        name: row.name,
        value: row.value,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        note: row.note,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return opsError('UPSTREAM_ERROR', `OpsFlag.set failed: ${message}`)
    }
  }
}
