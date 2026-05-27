/**
 * lib/knowledge/body-crypto-backfill.ts
 *
 * Dependency-injected core of the one-off backfill that encrypts legacy
 * plaintext `KnowledgeDocument.body` rows. The script in
 * `scripts/encrypt-knowledge-bodies.ts` wires `listPage` + `updateRow`
 * to Prisma + `withSystemContext`; the tests in
 * `lib/knowledge/body-crypto.test.ts` wire them to an in-memory fixture
 * so the loop's idempotency + resilience guarantees can be asserted
 * without a database.
 *
 * Invariants:
 *   - Idempotent: a row already carrying the `v1:` marker is skipped.
 *     Running the backfill N times produces the same final state as
 *     running it once.
 *   - Resilient: a single `updateRow` failure logs + continues. The
 *     loop never aborts mid-pass — leaving the rest of the workspace
 *     bodies un-encrypted because of one bad row would be worse than
 *     skipping the bad row.
 *   - Page-bounded: rows are paged via `(cursor, take)` rather than a
 *     single findMany over the whole table, so a workspace with
 *     ten-thousand chunks does not blow memory.
 */

import { encryptBodyForWrite, isEncrypted } from './body-crypto'

export interface BackfillStats {
  scanned: number
  alreadyEncrypted: number
  encrypted: number
  skippedEmpty: number
  failed: number
}

export interface BackfillRow {
  id: string
  body: string | null
}

export interface BackfillOptions {
  dryRun?: boolean
  batchSize: number
  listPage: (cursor: string | null) => Promise<BackfillRow[]>
  updateRow: (id: string, cipher: string) => Promise<void>
  log?: (line: string) => void
}

export async function backfillKnowledgeBodies(
  opts: BackfillOptions,
): Promise<BackfillStats> {
  const dryRun = opts.dryRun ?? false
  const log = opts.log ?? (() => {})
  const stats: BackfillStats = {
    scanned: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    skippedEmpty: 0,
    failed: 0,
  }

  let cursor: string | null = null
  let page = 0
  while (true) {
    const rows = await opts.listPage(cursor)
    if (rows.length === 0) break
    page += 1

    for (const row of rows) {
      stats.scanned += 1
      try {
        if (typeof row.body !== 'string') {
          stats.skippedEmpty += 1
          continue
        }
        if (isEncrypted(row.body)) {
          stats.alreadyEncrypted += 1
          continue
        }
        if (dryRun) {
          stats.encrypted += 1
          continue
        }
        const cipher = encryptBodyForWrite(row.body)
        await opts.updateRow(row.id, cipher)
        stats.encrypted += 1
      } catch (err) {
        stats.failed += 1
        const msg = err instanceof Error ? err.message : String(err)
        log(`  row ${row.id}: encrypt failed — ${msg}`)
      }
    }
    cursor = rows[rows.length - 1].id
    log(
      `  page ${page}: scanned=${stats.scanned} encrypted=${stats.encrypted} already=${stats.alreadyEncrypted} skipped=${stats.skippedEmpty} failed=${stats.failed}`,
    )
    if (rows.length < opts.batchSize) break
  }

  return stats
}
