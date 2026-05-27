/**
 * scripts/encrypt-payloads-at-rest.ts
 *
 * One-off data backfill: encrypt every legacy plaintext
 * `WorkApprovalQueueItem.payload` + `HandoffLogEntry.payload` row using
 * the envelope-in-Json codec in `lib/security/payload-crypto.ts`. Closes
 * the deferred half of the data-privacy audit (§4 / §2.5) that PR #95
 * carved out (see lib/knowledge/body-crypto.ts:27-29).
 *
 * Idempotent: a row already wrapped as `{ enc: 'v1:...' }` is skipped.
 * Safe to re-run; safe to run before the code is deployed (everything
 * reading goes through `decryptPayloadForRead`, which passes legacy
 * plaintext through unchanged) AND safe to run after (encrypt-on-write
 * is itself idempotent).
 *
 * Resilient: a single row that fails to encrypt logs + continues so one
 * bad row does not block the rest of the backfill.
 *
 * Tenant scope: this is a system / operator pass. We run under
 * `withSystemContext()` so the RLS policies on both tables let us see +
 * UPDATE every workspace's rows. We touch only the `payload` column.
 *
 * Run:
 *   ENCRYPTION_KEY=<64-hex> DATABASE_URL=... npx tsx scripts/encrypt-payloads-at-rest.ts
 *
 * Flags:
 *   --dry-run            Count plaintext rows + sample, but do not write.
 *   --batch N            Override page size (default 200).
 *   --only approvals     Encrypt WorkApprovalQueueItem rows only.
 *   --only handoffs      Encrypt HandoffLogEntry rows only.
 */

import { prisma } from '@/lib/db/prisma';
import { withSystemContext } from '@/lib/db/rls';
import {
  backfillPayloads,
  type PayloadBackfillStats,
} from '@/lib/security/payload-crypto-backfill';
import { loadMasterKey } from '@/lib/security/encryption';

export type { PayloadBackfillStats };

type Target = 'approvals' | 'handoffs' | 'both';

function parseArgs(): { dryRun: boolean; batchSize: number; target: Target } {
  const argv = process.argv.slice(2);
  let dryRun = false;
  let batchSize = 200;
  let target: Target = 'both';
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--batch') {
      const next = argv[i + 1];
      if (!next) throw new Error('--batch requires a value');
      const n = Number.parseInt(next, 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--batch must be a positive integer, got ${next}`);
      }
      batchSize = n;
      i += 1;
    } else if (a === '--only') {
      const next = argv[i + 1];
      if (next === 'approvals' || next === 'handoffs') {
        target = next;
        i += 1;
      } else {
        throw new Error(`--only must be "approvals" or "handoffs", got ${next ?? '(none)'}`);
      }
    } else {
      throw new Error(`unknown arg: ${a}`)
    }
  }
  return { dryRun, batchSize, target };
}

async function backfillApprovals(
  dryRun: boolean,
  batchSize: number,
): Promise<PayloadBackfillStats> {
  return backfillPayloads({
    dryRun,
    batchSize,
    listPage: async (cursor) =>
      withSystemContext((tx) =>
        tx.workApprovalQueueItem.findMany({
          select: { id: true, payload: true },
          orderBy: { id: 'asc' },
          take: batchSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        }),
      ),
    updateRow: async (id, envelope) => {
      await withSystemContext((tx) =>
        tx.workApprovalQueueItem.update({
          where: { id },
          data: { payload: envelope },
        }),
      );
    },
    log: (line) => console.log(line),
  });
}

async function backfillHandoffs(
  dryRun: boolean,
  batchSize: number,
): Promise<PayloadBackfillStats> {
  return backfillPayloads({
    dryRun,
    batchSize,
    listPage: async (cursor) =>
      withSystemContext((tx) =>
        tx.handoffLogEntry.findMany({
          select: { id: true, payload: true },
          orderBy: { id: 'asc' },
          take: batchSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        }),
      ),
    updateRow: async (id, envelope) => {
      await withSystemContext((tx) =>
        tx.handoffLogEntry.update({
          where: { id },
          data: { payload: envelope },
        }),
      );
    },
    log: (line) => console.log(line),
  });
}

function summarize(label: string, stats: PayloadBackfillStats, dryRun: boolean): void {
  console.log(`\n--- ${label} summary ---`);
  console.log(`scanned          ${stats.scanned}`);
  console.log(`alreadyEncrypted ${stats.alreadyEncrypted}`);
  console.log(
    `encrypted        ${stats.encrypted}${dryRun ? '  (DRY RUN — not persisted)' : ''}`,
  );
  console.log(`skippedEmpty     ${stats.skippedEmpty}`);
  console.log(`failed           ${stats.failed}`);
}

async function main(): Promise<void> {
  const { dryRun, batchSize, target } = parseArgs();

  // Fail loudly if the key is missing — refuse to run rather than write
  // plaintext or skip every row silently.
  loadMasterKey();

  console.log(
    `encrypt-payloads-at-rest: dryRun=${dryRun} batchSize=${batchSize} target=${target} startedAt=${new Date().toISOString()}`,
  );

  let totalFailed = 0;

  if (target === 'approvals' || target === 'both') {
    console.log('\n>>> WorkApprovalQueueItem.payload');
    const stats = await backfillApprovals(dryRun, batchSize);
    summarize('WorkApprovalQueueItem', stats, dryRun);
    totalFailed += stats.failed;
  }

  if (target === 'handoffs' || target === 'both') {
    console.log('\n>>> HandoffLogEntry.payload');
    const stats = await backfillHandoffs(dryRun, batchSize);
    summarize('HandoffLogEntry', stats, dryRun);
    totalFailed += stats.failed;
  }

  console.log(`\ncompletedAt      ${new Date().toISOString()}`);

  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('encrypt-payloads-at-rest: uncaught', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
