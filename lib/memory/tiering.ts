/**
 * lib/memory/tiering.ts
 *
 * Memory tiering: keep the hot working set in Postgres and offload the long
 * tail to object storage so the WorkspaceMemoryEntry table stays small and
 * fast as we scale 100 → 10K customers.
 *
 *   HOT  (≤ 7 days, or pinned)  — body inline in Postgres, indexed.
 *   WARM (7–90 days)            — still inline; flagged for eviction pressure.
 *   COLD (90+ days, unpinned)   — ciphertext body offloaded to the workspace's
 *                                 object store (managed Vercel Blob, or the
 *                                 customer's BYO bucket); the inline body is
 *                                 replaced with COLD_TOMBSTONE and archivedRef
 *                                 points at the object. Read re-hydrates.
 *
 * Pinned entries NEVER leave HOT — the dispatcher always wants them and a
 * cold round-trip on a pinned entry would be a latency regression.
 *
 * The body that moves is ALREADY the v1 AES-256-GCM ciphertext (memory
 * bodies are encrypted at rest), so offloading keeps the bytes encrypted in
 * the object store too — and on the BYO+KMS path, the object store layers
 * its own SSE on top. Plaintext never touches the object store.
 *
 * The decision logic (classifyTier / desiredTier) is pure and unit-tested.
 * The object-store offload/hydrate helpers are tested against
 * InMemoryObjectStore. The DB-mutating archive/restore/sweep compose those
 * with withRls + the audit trail; they're exercised by the live-DB
 * integration test (guarded on DATABASE_URL).
 */

import type { MemoryTier, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma';
import { withRls, type RlsContext } from '../db/rls';
import { IObjectStore } from '../storage/object-store';
import { coldObjectKey } from './byo-storage';
import { recordMemoryAccess } from './audit';

export const HOT_MAX_AGE_DAYS = 7;
export const WARM_MAX_AGE_DAYS = 90;
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sentinel placed in WorkspaceMemoryEntry.body when the real ciphertext has
 * been offloaded to cold storage. Non-secret; deliberately NOT a valid v1
 * envelope so a decrypt attempt on an un-hydrated cold entry fails loudly
 * rather than surfacing garbage.
 */
export const COLD_TOMBSTONE = '§cold-archived§';

/** The age-bearing fields the tiering decision reads. */
export interface TieringClock {
  createdAt: Date;
  updatedAt: Date;
  lastReadAt: Date | null;
}

/** Most-recent-activity instant: the freshest of read / update / create. */
export function lastActivityAt(entry: TieringClock): Date {
  const candidates = [entry.createdAt, entry.updatedAt, entry.lastReadAt].filter(
    (d): d is Date => d instanceof Date,
  );
  return candidates.reduce((a, b) => (b.getTime() > a.getTime() ? b : a), entry.createdAt);
}

export function ageDaysOf(entry: TieringClock, now: Date): number {
  return (now.getTime() - lastActivityAt(entry).getTime()) / DAY_MS;
}

/** Pure tier classification from age + pinned state. */
export function classifyTier(ageDays: number, pinned: boolean): MemoryTier {
  if (pinned) return 'HOT';
  if (ageDays < HOT_MAX_AGE_DAYS) return 'HOT';
  if (ageDays < WARM_MAX_AGE_DAYS) return 'WARM';
  return 'COLD';
}

/** The tier an entry SHOULD be in right now. */
export function desiredTier(
  entry: TieringClock & { pinned: boolean },
  now: Date,
): MemoryTier {
  return classifyTier(ageDaysOf(entry, now), entry.pinned);
}

// =====================================================================
// Object-store offload / hydrate (DB-free; testable with InMemoryObjectStore)
// =====================================================================

/** Write a memory entry's ciphertext to the object store. */
export async function offloadBody(args: {
  store: IObjectStore;
  workspaceId: string;
  entryId: string;
  ciphertext: string;
  kmsKeyId?: string;
}): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const key = coldObjectKey(args.workspaceId, args.entryId);
  const res = await args.store.put(key, args.ciphertext, {
    contentType: 'application/octet-stream',
    kmsKeyId: args.kmsKeyId,
  });
  if (!res.ok) return { ok: false, error: `${res.error.code}: ${res.error.message}` };
  return { ok: true, ref: res.value.ref };
}

/** Fetch a previously offloaded ciphertext back from the object store. */
export async function fetchArchivedBody(args: {
  store: IObjectStore;
  workspaceId: string;
  entryId: string;
}): Promise<{ ok: true; ciphertext: string } | { ok: false; error: string }> {
  const key = coldObjectKey(args.workspaceId, args.entryId);
  const res = await args.store.get(key);
  if (!res.ok) return { ok: false, error: `${res.error.code}: ${res.error.message}` };
  return { ok: true, ciphertext: res.value.bytes.toString('utf8') };
}

// =====================================================================
// DB-mutating transitions
// =====================================================================

export interface TieringEntry {
  id: string;
  workspaceId: string;
  /** Current at-rest body (ciphertext for HOT/WARM; tombstone for COLD). */
  body: string;
  tier: MemoryTier;
  pinned: boolean;
  archivedRef: string | null;
}

export interface TieringDeps {
  store: IObjectStore;
  ctx: RlsContext;
  client?: PrismaClient;
  /** Audit actor — defaults to the SYSTEM tiering sweep. */
  actorId?: string;
  source?: string;
  /** KMS key id to pass through on cold writes (BYO SSE-KMS). */
  kmsKeyId?: string;
}

const rlsClientOpt = (deps: TieringDeps) =>
  deps.client ? { client: deps.client } : undefined;

/**
 * Move an entry to COLD: offload its ciphertext, clear the inline body, set
 * tier + archivedRef, and audit. No-op (returns archived:false) for pinned
 * entries or entries already COLD.
 */
export async function archiveEntry(
  entry: TieringEntry,
  deps: TieringDeps,
): Promise<{ archived: boolean; reason?: string }> {
  if (entry.pinned) return { archived: false, reason: 'pinned' };
  if (entry.tier === 'COLD') return { archived: false, reason: 'already-cold' };
  if (entry.body === COLD_TOMBSTONE) return { archived: false, reason: 'no-inline-body' };

  const off = await offloadBody({
    store: deps.store,
    workspaceId: entry.workspaceId,
    entryId: entry.id,
    ciphertext: entry.body,
    kmsKeyId: deps.kmsKeyId,
  });
  if (!off.ok) return { archived: false, reason: off.error };

  await withRls(
    deps.ctx,
    (tx) =>
      tx.workspaceMemoryEntry.update({
        where: { id: entry.id },
        data: {
          tier: 'COLD',
          archivedRef: off.ref,
          archivedAt: new Date(),
          body: COLD_TOMBSTONE,
        },
      }),
    rlsClientOpt(deps),
  );

  await recordMemoryAccess({
    workspaceId: entry.workspaceId,
    actorType: 'SYSTEM',
    actorId: deps.actorId ?? 'tiering-sweep',
    action: 'ARCHIVE',
    recordType: 'WorkspaceMemoryEntry',
    recordId: entry.id,
    intent: 'cold-tier-offload',
    source: deps.source ?? 'lib/memory/tiering.ts#archiveEntry',
  });

  return { archived: true };
}

/**
 * Bring a COLD entry back inline (default tier WARM; the next sweep re-rates
 * it). No-op for entries that aren't COLD.
 */
export async function restoreEntry(
  entry: TieringEntry,
  deps: TieringDeps,
  toTier: Exclude<MemoryTier, 'COLD'> = 'WARM',
): Promise<{ restored: boolean; reason?: string }> {
  if (entry.tier !== 'COLD') return { restored: false, reason: 'not-cold' };

  const fetched = await fetchArchivedBody({
    store: deps.store,
    workspaceId: entry.workspaceId,
    entryId: entry.id,
  });
  if (!fetched.ok) return { restored: false, reason: fetched.error };

  await withRls(
    deps.ctx,
    (tx) =>
      tx.workspaceMemoryEntry.update({
        where: { id: entry.id },
        data: {
          tier: toTier,
          body: fetched.ciphertext,
          archivedRef: null,
          archivedAt: null,
        },
      }),
    rlsClientOpt(deps),
  );

  await recordMemoryAccess({
    workspaceId: entry.workspaceId,
    actorType: 'SYSTEM',
    actorId: deps.actorId ?? 'tiering-sweep',
    action: 'RESTORE',
    recordType: 'WorkspaceMemoryEntry',
    recordId: entry.id,
    intent: 'cold-tier-rehydrate',
    source: deps.source ?? 'lib/memory/tiering.ts#restoreEntry',
  });

  return { restored: true };
}

/**
 * Read-time hydration: return the ciphertext for an entry, fetching from
 * cold storage if needed WITHOUT mutating the row. This is the seam the
 * dispatcher/memory-store read path calls before decrypt when it encounters
 * a COLD entry. (Wiring it into PrismaMemoryStore is the one-line follow-up
 * tracked in the PR — until the sweep runs, no COLD entries exist, so the
 * existing read path is unaffected.)
 */
export async function hydrateBody(
  entry: TieringEntry,
  store: IObjectStore,
): Promise<{ ok: true; ciphertext: string } | { ok: false; error: string }> {
  if (entry.tier !== 'COLD' && entry.body !== COLD_TOMBSTONE) {
    return { ok: true, ciphertext: entry.body };
  }
  return fetchArchivedBody({ store, workspaceId: entry.workspaceId, entryId: entry.id });
}

export interface SweepResult {
  scanned: number;
  archived: number;
  restored: number;
  relabeled: number;
  skipped: number;
  errors: Array<{ id: string; reason: string }>;
}

/**
 * Run a tiering pass over one workspace's unpinned entries. Reads candidates
 * under the caller's RLS context, then applies the minimal transition each
 * needs to reach its desired tier:
 *   - desired COLD, not COLD          → archiveEntry
 *   - desired HOT/WARM, currently COLD → restoreEntry
 *   - desired ≠ current label, both inline → cheap label update (no I/O)
 *
 * `now` is injectable for deterministic tests.
 */
export async function runTieringSweep(args: {
  workspaceId: string;
  ctx: RlsContext;
  store: IObjectStore;
  now?: Date;
  client?: PrismaClient;
  /** Max entries to process this pass (back-pressure). */
  limit?: number;
  kmsKeyId?: string;
}): Promise<SweepResult> {
  const now = args.now ?? new Date();
  const take = Math.min(Math.max(args.limit ?? 500, 1), 5000);
  const clientOpt = args.client ? { client: args.client } : undefined;

  const candidates = await withRls(
    args.ctx,
    (tx) =>
      tx.workspaceMemoryEntry.findMany({
        where: { workspaceId: args.workspaceId, pinned: false },
        select: {
          id: true,
          workspaceId: true,
          body: true,
          tier: true,
          pinned: true,
          archivedRef: true,
          createdAt: true,
          updatedAt: true,
          lastReadAt: true,
        },
        orderBy: { updatedAt: 'asc' },
        take,
      }),
    clientOpt,
  );

  const result: SweepResult = {
    scanned: candidates.length,
    archived: 0,
    restored: 0,
    relabeled: 0,
    skipped: 0,
    errors: [],
  };

  const deps: TieringDeps = {
    store: args.store,
    ctx: args.ctx,
    client: args.client,
    kmsKeyId: args.kmsKeyId,
  };

  for (const c of candidates) {
    const want = desiredTier(c, now);
    if (want === c.tier) {
      result.skipped += 1;
      continue;
    }
    if (want === 'COLD') {
      const r = await archiveEntry(c, deps);
      if (r.archived) result.archived += 1;
      else result.errors.push({ id: c.id, reason: r.reason ?? 'archive-failed' });
    } else if (c.tier === 'COLD') {
      const r = await restoreEntry(c, deps, want);
      if (r.restored) result.restored += 1;
      else result.errors.push({ id: c.id, reason: r.reason ?? 'restore-failed' });
    } else {
      // HOT ↔ WARM relabel — both inline, no object I/O.
      await withRls(
        args.ctx,
        (tx) => tx.workspaceMemoryEntry.update({ where: { id: c.id }, data: { tier: want } }),
        clientOpt,
      );
      result.relabeled += 1;
    }
  }

  return result;
}
