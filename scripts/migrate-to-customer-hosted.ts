#!/usr/bin/env tsx
/**
 * scripts/migrate-to-customer-hosted.ts
 *
 * Move a workspace's cold-tier memory objects from our managed Vercel Blob
 * store to the customer's own S3-compatible bucket, verify integrity, then
 * flip Workspace.memoryStorage = CUSTOMER. Optionally delete the source
 * copies afterward.
 *
 * PRECONDITION: the workspace already has a *verified* WorkspaceStorageConfig
 * row (the customer adds + verifies their bucket on the data settings page).
 * This script refuses to run against an unverified bucket — a misconfigured
 * target would silently lose memory.
 *
 * WALKTHROUGH (what a run does):
 *   1. Load workspace + storageConfig (system context).
 *   2. Resolve SOURCE = managed store, TARGET = customer store.
 *   3. List the workspace's COLD entries (those with archivedRef set).
 *   4. For each: GET from source → PUT to target → GET from target and
 *      compare a SHA-256 of the bytes (integrity check) → update archivedRef
 *      to the new ref → audit MIGRATE.
 *   5. Flip Workspace.memoryStorage = CUSTOMER (so future cold writes land in
 *      the customer bucket).
 *   6. With --delete-source: delete the source copies (only after every
 *      entry verified).
 *
 * Idempotent-ish: re-running after a partial failure re-copies entries whose
 * archivedRef still points at a source (mem://, blob URL) ref; entries already
 * pointing at s3:// are skipped.
 *
 * USAGE:
 *   tsx scripts/migrate-to-customer-hosted.ts --workspace <id|slug> [--dry-run] [--delete-source] [--yes]
 */

import { createHash } from 'node:crypto';
import { withSystemContext } from '../lib/db/rls';
import {
  buildManagedObjectStore,
  buildCustomerObjectStore,
  decryptStorageConfig,
} from '../lib/memory/byo-storage';
import { coldObjectKey } from '../lib/memory/byo-storage';
import { recordMemoryAccess } from '../lib/memory/audit';
import type { IObjectStore } from '../lib/storage/object-store';

interface Args {
  workspace: string;
  dryRun: boolean;
  deleteSource: boolean;
  yes: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const ws = get('--workspace');
  if (!ws) {
    console.error('error: --workspace <id|slug> is required');
    process.exit(2);
  }
  return {
    workspace: ws,
    dryRun: argv.includes('--dry-run'),
    deleteSource: argv.includes('--delete-source'),
    yes: argv.includes('--yes'),
  };
}

const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

function log(step: string, msg: string): void {
  console.log(`[migrate-byo] ${step.padEnd(10)} ${msg}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // 1. Load workspace + storageConfig.
  const workspace = await withSystemContext((tx) =>
    tx.workspace.findFirst({
      where: { OR: [{ id: args.workspace }, { slug: args.workspace }] },
      select: {
        id: true,
        slug: true,
        name: true,
        memoryStorage: true,
        dataRegion: true,
        storageConfig: true,
      },
    }),
  );
  if (!workspace) {
    console.error(`error: no workspace matching "${args.workspace}"`);
    process.exit(1);
  }
  log('workspace', `${workspace.name} (${workspace.slug}) — memoryStorage=${workspace.memoryStorage}`);

  if (!workspace.storageConfig) {
    console.error(
      'error: no WorkspaceStorageConfig — the customer must add + verify their bucket on the data page first.',
    );
    process.exit(1);
  }
  if (!workspace.storageConfig.verifiedAt) {
    console.error(
      'error: storage config is not verified (verifiedAt is null). Run the connectivity probe before migrating.',
    );
    process.exit(1);
  }

  // 2. Resolve source + target stores.
  const source: IObjectStore = buildManagedObjectStore(workspace.dataRegion);
  const decrypted = decryptStorageConfig(workspace.storageConfig);
  const target: IObjectStore = buildCustomerObjectStore(decrypted);
  log('stores', `source=${source.name} → target=${target.name} (${decrypted.bucket}@${decrypted.region})`);

  // 3. List COLD entries with an archivedRef.
  const cold = await withSystemContext((tx) =>
    tx.workspaceMemoryEntry.findMany({
      where: { workspaceId: workspace.id, tier: 'COLD', archivedRef: { not: null } },
      select: { id: true, archivedRef: true },
    }),
  );
  const toMove = cold.filter((e) => !e.archivedRef?.startsWith('s3://'));
  log('scan', `${cold.length} cold entries; ${toMove.length} to migrate (rest already on s3://)`);

  if (args.dryRun) {
    log('dry-run', 'no changes made. Re-run without --dry-run to migrate.');
    log('plan', `would copy ${toMove.length} objects, then set memoryStorage=CUSTOMER` + (args.deleteSource ? ' and delete source copies' : ''));
    return;
  }
  if (!args.yes && toMove.length > 0) {
    console.error('refusing to migrate without --yes (or use --dry-run to preview).');
    process.exit(2);
  }

  // 4. Copy + verify each entry.
  let migrated = 0;
  const failures: Array<{ id: string; reason: string }> = [];
  for (const entry of toMove) {
    const key = coldObjectKey(workspace.id, entry.id);
    const got = await source.get(key);
    if (!got.ok) {
      failures.push({ id: entry.id, reason: `source get: ${got.error.code}` });
      continue;
    }
    const put = await target.put(key, got.value.bytes, { contentType: 'application/octet-stream' });
    if (!put.ok) {
      failures.push({ id: entry.id, reason: `target put: ${put.error.code}` });
      continue;
    }
    // Integrity: read it back from the target and compare hashes.
    const verify = await target.get(key);
    if (!verify.ok || sha256(verify.value.bytes) !== sha256(got.value.bytes)) {
      failures.push({ id: entry.id, reason: 'integrity check failed (hash mismatch)' });
      continue;
    }
    await withSystemContext((tx) =>
      tx.workspaceMemoryEntry.update({
        where: { id: entry.id },
        data: { archivedRef: put.value.ref },
      }),
    );
    await recordMemoryAccess({
      workspaceId: workspace.id,
      actorType: 'HUMAN',
      actorId: 'operator:migrate-byo-script',
      action: 'MIGRATE',
      recordType: 'WorkspaceMemoryEntry',
      recordId: entry.id,
      intent: 'managed-to-customer-hosted-migration',
      source: 'scripts/migrate-to-customer-hosted.ts',
    });
    migrated += 1;
  }
  log('copy', `${migrated}/${toMove.length} migrated; ${failures.length} failed`);

  if (failures.length > 0) {
    console.error('migration incomplete — NOT flipping memoryStorage. Failures:');
    for (const f of failures) console.error(`  ${f.id}: ${f.reason}`);
    process.exit(1);
  }

  // 5. Flip the flag.
  await withSystemContext((tx) =>
    tx.workspace.update({ where: { id: workspace.id }, data: { memoryStorage: 'CUSTOMER' } }),
  );
  log('flip', 'memoryStorage = CUSTOMER (future cold writes go to the customer bucket)');

  // 6. Optionally delete source copies.
  if (args.deleteSource) {
    let deleted = 0;
    for (const entry of toMove) {
      const del = await source.delete(coldObjectKey(workspace.id, entry.id));
      if (del.ok && del.value.deleted) deleted += 1;
    }
    log('cleanup', `deleted ${deleted} source copies`);
  } else {
    log('cleanup', 'source copies RETAINED (re-run with --delete-source to remove)');
  }

  log('done', `workspace ${workspace.slug} is now customer-hosted.`);
}

main().catch((err) => {
  console.error('[migrate-byo] fatal:', err);
  process.exit(1);
});
