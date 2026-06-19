/**
 * lib/storage/audit.ts
 *
 * Storage transparency hooks. Two kinds of event, both written to the
 * existing append-only `AuditLog` table (workspace-scoped, customer-
 * readable under RLS — the same table the data export already surfaces):
 *
 *   1. recordStorageWrite — "we wrote a row of <model> to your workspace at
 *      <time> because <reason>." Lets the customer see, on the storage
 *      surface, every time agentplain persisted something about them.
 *
 *   2. recordEphemeralFetch — "we fetched <n> items from your <provider>
 *      <resource> at <time> and did NOT store them." This is the positive
 *      proof of the pass-through commitment: a connector read leaves a
 *      breadcrumb that explicitly records the data was not persisted.
 *
 * Both are BEST-EFFORT and never throw: a transparency record failing must
 * not break the work it describes. Failures are reported to the logger and
 * swallowed. (The work itself is still gated/audited by its own domain
 * audit rows where correctness matters; this layer is additive.)
 *
 * Action namespace (dot-namespaced, matching the rest of the codebase):
 *   storage.write           — a persistence event
 *   storage.ephemeral_fetch — a pass-through read that stored nothing
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls, type RlsContext } from '../db/rls';
import { getLogger } from '../observability';

const SYSTEM_CTX: RlsContext = { userId: null, workspaceId: null, isOperator: true };

export const STORAGE_WRITE_ACTION = 'storage.write';
export const STORAGE_EPHEMERAL_FETCH_ACTION = 'storage.ephemeral_fetch';

export interface RecordStorageWriteArgs {
  workspaceId: string;
  /** Prisma model name the row was written to (e.g. "ChatMessage"). */
  model: string;
  /** create | update | upsert | delete. */
  operation: 'create' | 'update' | 'upsert' | 'delete';
  /** Why this persistence happened, in plain terms ("queued draft for your approval"). */
  reason: string;
  /** Optional id of the affected row. */
  recordId?: string;
  /** Data-category id from lib/storage/data-categories (for grouping on the surface). */
  category?: string;
  /** User who triggered the write, if any (NULL for system/cron writes). */
  actorUserId?: string | null;
  /** RLS context to write under. Defaults to system context (cron/runtime). */
  ctx?: RlsContext;
  /** Prisma client override (tests). */
  client?: PrismaClient;
}

export async function recordStorageWrite(
  args: RecordStorageWriteArgs,
): Promise<void> {
  try {
    const write = (tx: Prisma.TransactionClient) =>
      tx.auditLog.create({
        data: {
          actorUserId: args.actorUserId ?? args.ctx?.userId ?? null,
          workspaceId: args.workspaceId,
          action: STORAGE_WRITE_ACTION,
          targetTable: args.model,
          targetId: args.recordId ?? null,
          payload: {
            operation: args.operation,
            reason: args.reason,
            ...(args.category ? { category: args.category } : {}),
          },
        },
      });
    const ctx = args.ctx ?? SYSTEM_CTX;
    await withRls(ctx, write, args.client ? { client: args.client } : undefined);
  } catch (err) {
    getLogger().warn('storage.recordStorageWrite failed (non-fatal)', {
      workspace_id: args.workspaceId,
      model: args.model,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface RecordEphemeralFetchArgs {
  workspaceId: string;
  /** Connector the data was read from ("GOOGLE", "HUBSPOT", …). */
  provider: string;
  /** What was read ("inbox", "deals", "contacts"). */
  resource: string;
  /** How many items were returned to the caller (none persisted). */
  itemCount: number;
  /** Optional fetch duration in ms, for the transparency record. */
  durationMs?: number;
  /** Prisma client override (tests). */
  client?: PrismaClient;
}

/**
 * Record a pass-through connector read. The payload's `stored: false` is the
 * load-bearing assertion the storage surface renders back to the customer:
 * "we looked at X, we did not keep it."
 */
export async function recordEphemeralFetch(
  args: RecordEphemeralFetchArgs,
): Promise<void> {
  try {
    const fn = (tx: Prisma.TransactionClient) =>
      tx.auditLog.create({
        data: {
          actorUserId: null,
          workspaceId: args.workspaceId,
          action: STORAGE_EPHEMERAL_FETCH_ACTION,
          targetTable: null,
          targetId: null,
          payload: {
            provider: args.provider,
            resource: args.resource,
            itemCount: args.itemCount,
            stored: false,
            ...(args.durationMs !== undefined ? { durationMs: args.durationMs } : {}),
          },
        },
      });
    await withRls(SYSTEM_CTX, fn, args.client ? { client: args.client } : undefined);
  } catch (err) {
    getLogger().warn('storage.recordEphemeralFetch failed (non-fatal)', {
      workspace_id: args.workspaceId,
      provider: args.provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface StorageAuditEntry {
  id: string;
  kind: 'write' | 'ephemeral_fetch';
  occurredAt: string;
  model: string | null;
  payload: Record<string, unknown>;
}

/**
 * Read the recent storage-transparency trail for a workspace. Runs under the
 * caller's RLS context (customer reads their own workspace only).
 */
export async function readStorageAuditTrail(
  ctx: RlsContext,
  workspaceId: string,
  opts: { limit?: number; client?: PrismaClient } = {},
): Promise<StorageAuditEntry[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = await withRls(
    ctx,
    (tx) =>
      tx.auditLog.findMany({
        where: {
          workspaceId,
          action: { in: [STORAGE_WRITE_ACTION, STORAGE_EPHEMERAL_FETCH_ACTION] },
        },
        orderBy: { occurredAt: 'desc' },
        take: limit,
      }),
    opts.client ? { client: opts.client } : undefined,
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.action === STORAGE_EPHEMERAL_FETCH_ACTION ? 'ephemeral_fetch' : 'write',
    occurredAt: r.occurredAt.toISOString(),
    model: r.targetTable,
    payload:
      r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : {},
  }));
}
