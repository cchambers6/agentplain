/**
 * lib/security/payload-crypto-backfill.ts
 *
 * Dependency-injected core of the one-off back-fills that encrypt
 * legacy plaintext `WorkApprovalQueueItem.payload` +
 * `HandoffLogEntry.payload` rows. The script in
 * `scripts/encrypt-payloads-at-rest.ts` wires `listPage` + `updateRow`
 * to Prisma + `withSystemContext`; the test in
 * `lib/security/payload-crypto-backfill.test.ts` wires them to an
 * in-memory fixture so the loop's idempotency + resilience guarantees
 * can be asserted without a database.
 *
 * Mirrors `lib/knowledge/body-crypto-backfill.ts` shape so the two
 * backfills behave the same way under operator pressure (page-bounded,
 * idempotent, resilient per-row).
 */

import type { Prisma } from '@prisma/client';
import { encryptPayloadForWrite, isEncryptedPayload } from './payload-crypto';

export interface PayloadBackfillStats {
  scanned: number;
  alreadyEncrypted: number;
  encrypted: number;
  skippedEmpty: number;
  failed: number;
}

export interface PayloadBackfillRow {
  id: string;
  payload: unknown;
}

export interface PayloadBackfillOptions {
  dryRun?: boolean;
  batchSize: number;
  listPage: (cursor: string | null) => Promise<PayloadBackfillRow[]>;
  updateRow: (id: string, envelope: Prisma.InputJsonValue) => Promise<void>;
  log?: (line: string) => void;
}

export async function backfillPayloads(
  opts: PayloadBackfillOptions,
): Promise<PayloadBackfillStats> {
  const dryRun = opts.dryRun ?? false;
  const log = opts.log ?? (() => {});
  const stats: PayloadBackfillStats = {
    scanned: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    skippedEmpty: 0,
    failed: 0,
  };

  let cursor: string | null = null;
  let page = 0;
  while (true) {
    const rows = await opts.listPage(cursor);
    if (rows.length === 0) break;
    page += 1;

    for (const row of rows) {
      stats.scanned += 1;
      try {
        if (row.payload === null || row.payload === undefined) {
          stats.skippedEmpty += 1;
          continue;
        }
        if (isEncryptedPayload(row.payload)) {
          stats.alreadyEncrypted += 1;
          continue;
        }
        if (dryRun) {
          stats.encrypted += 1;
          continue;
        }
        const envelope = encryptPayloadForWrite(row.payload);
        await opts.updateRow(row.id, envelope);
        stats.encrypted += 1;
      } catch (err) {
        stats.failed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        log(`  row ${row.id}: encrypt failed — ${msg}`);
      }
    }
    cursor = rows[rows.length - 1].id;
    log(
      `  page ${page}: scanned=${stats.scanned} encrypted=${stats.encrypted} already=${stats.alreadyEncrypted} skipped=${stats.skippedEmpty} failed=${stats.failed}`,
    );
    if (rows.length < opts.batchSize) break;
  }

  return stats;
}
