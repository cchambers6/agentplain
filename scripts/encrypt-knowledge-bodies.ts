/**
 * scripts/encrypt-knowledge-bodies.ts
 *
 * One-off data backfill: encrypt every legacy plaintext
 * `KnowledgeDocument.body` row using AES-256-GCM via the same codec
 * the OAuth tokens use (`lib/security/encryption.ts`). Closes audit
 * MUST-CLOSE #4 in `docs/data-privacy-file-storage-audit-2026-05-26.md`
 * for rows that pre-date the code change.
 *
 * Idempotent: a row whose body already starts with the `v1:` marker
 * (`isEncrypted`) is skipped. Safe to re-run; safe to run before the
 * code is deployed (everything reading goes through
 * `decryptBodyForRead`, which passes legacy plaintext through unchanged)
 * AND safe to run after (encrypt-on-write is itself idempotent).
 *
 * Resilient: a single row that fails to encrypt (unexpected error type,
 * non-string body, DB conflict) logs + continues so one bad row does
 * not block the rest of the backfill.
 *
 * Tenant scope: this is a system / operator pass. We run under
 * `withSystemContext()` so the RLS policies on `KnowledgeDocument` let
 * us see + UPDATE every workspace's rows. We touch only the `body`
 * column; vector, metadata, workspaceId, contextKind all stay.
 *
 * Run:
 *   ENCRYPTION_KEY=<64-hex> DATABASE_URL=... npx tsx scripts/encrypt-knowledge-bodies.ts
 *
 * Flags:
 *   --dry-run   Count plaintext rows + sample, but do not write.
 *   --batch N   Override page size (default 200).
 */

import { prisma } from '@/lib/db/prisma'
import { withSystemContext } from '@/lib/db/rls'
import {
  backfillKnowledgeBodies,
  type BackfillStats,
} from '@/lib/knowledge/body-crypto-backfill'
import { loadMasterKey } from '@/lib/security/encryption'

export type { BackfillStats }

function parseArgs(): { dryRun: boolean; batchSize: number } {
  const argv = process.argv.slice(2)
  let dryRun = false
  let batchSize = 200
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dry-run') dryRun = true
    else if (a === '--batch') {
      const next = argv[i + 1]
      if (!next) throw new Error('--batch requires a value')
      const n = Number.parseInt(next, 10)
      if (!Number.isFinite(n) || n <= 0) throw new Error(`--batch must be a positive integer, got ${next}`)
      batchSize = n
      i += 1
    } else {
      throw new Error(`unknown arg: ${a}`)
    }
  }
  return { dryRun, batchSize }
}

async function main(): Promise<void> {
  const { dryRun, batchSize } = parseArgs()

  // Fail loudly if the key is missing — we'd rather refuse to run than
  // silently write plaintext or skip every row.
  loadMasterKey()

  console.log(
    `encrypt-knowledge-bodies: dryRun=${dryRun} batchSize=${batchSize} startedAt=${new Date().toISOString()}`,
  )

  const stats = await backfillKnowledgeBodies({
    dryRun,
    batchSize,
    listPage: async (cursor) =>
      withSystemContext((tx) =>
        tx.knowledgeDocument.findMany({
          select: { id: true, body: true },
          orderBy: { id: 'asc' },
          take: batchSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        }),
      ),
    updateRow: async (id, cipher) => {
      await withSystemContext((tx) =>
        tx.knowledgeDocument.update({
          where: { id },
          data: { body: cipher },
        }),
      )
    },
    log: (line) => console.log(line),
  })

  console.log('\n--- backfill summary ---')
  console.log(`scanned          ${stats.scanned}`)
  console.log(`alreadyEncrypted ${stats.alreadyEncrypted}`)
  console.log(`encrypted        ${stats.encrypted}${dryRun ? '  (DRY RUN — not persisted)' : ''}`)
  console.log(`skippedEmpty     ${stats.skippedEmpty}`)
  console.log(`failed           ${stats.failed}`)
  console.log(`completedAt      ${new Date().toISOString()}`)

  if (stats.failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error('encrypt-knowledge-bodies: uncaught', err)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
