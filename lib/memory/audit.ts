/**
 * lib/memory/audit.ts
 *
 * Append-only audit trail for every read AND write to a workspace's memory.
 * One MemoryAuditLog row per access: who (actorType + actorId), what
 * (recordType + recordId), when (createdAt), why (intent + source).
 *
 * This is the evidence behind the isolation + data-residency commitments —
 * a customer or auditor can answer "what touched my memory, and why?".
 *
 * Writes run under withSystemContext so the `memory_audit_write` RLS policy
 * (is_operator='true') resolves to TRUE — the same discipline the wave5
 * isolation test enforces for AuditLog. Reads run under the caller's
 * RlsContext so the `memory_audit_read` policy scopes to their workspace.
 *
 * NEVER call prisma.memoryAuditLog directly from a route/lib — go through
 * recordMemoryAccess so the system context (and the GUC) is guaranteed.
 */

import type { MemoryAuditAction, MemoryAuditActorType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { withRls, withSystemContext, type RlsContext } from '../db/rls';

export interface MemoryAccessEvent {
  workspaceId: string;
  actorType: MemoryAuditActorType;
  /** userId (HUMAN), skill/cron name (AGENT), or component name (SYSTEM). */
  actorId: string;
  action: MemoryAuditAction;
  /** e.g. "WorkspaceMemoryEntry" or "ColdObject". */
  recordType: string;
  recordId: string;
  /** Why — the calling intent, e.g. "dispatcher-prompt-assembly". */
  intent: string;
  /** Where — surface/route/cron name for traceability. */
  source: string;
}

/** Validate + normalize an access event before persisting. Pure; testable. */
export function buildMemoryAuditInput(event: MemoryAccessEvent): MemoryAccessEvent {
  const required: Array<keyof MemoryAccessEvent> = [
    'workspaceId',
    'actorId',
    'recordType',
    'recordId',
    'intent',
    'source',
  ];
  for (const field of required) {
    const value = event[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`memory audit: "${String(field)}" is required and must be non-empty`);
    }
  }
  return {
    ...event,
    actorId: event.actorId.trim(),
    recordType: event.recordType.trim(),
    recordId: event.recordId.trim(),
    intent: event.intent.trim(),
    source: event.source.trim(),
  };
}

/**
 * Record a single memory-access event. Best-effort by design: auditing must
 * never break the operation it's auditing, so a failed insert is swallowed
 * after being surfaced to the logger. (The trail losing one row is far less
 * bad than a customer read 500-ing because the audit write failed.)
 */
export async function recordMemoryAccess(
  event: MemoryAccessEvent,
  options?: { client?: typeof prisma },
): Promise<{ ok: boolean }> {
  let input: MemoryAccessEvent;
  try {
    input = buildMemoryAuditInput(event);
  } catch (err) {
    // A malformed audit event is a programming error — surface loudly but
    // don't throw into the caller's hot path.
    console.error('[memory-audit] invalid event:', err);
    return { ok: false };
  }
  try {
    await withSystemContext((tx) =>
      tx.memoryAuditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorType: input.actorType,
          actorId: input.actorId,
          action: input.action,
          recordType: input.recordType,
          recordId: input.recordId,
          intent: input.intent,
          source: input.source,
        },
      }),
    );
    return { ok: true };
  } catch (err) {
    console.error('[memory-audit] write failed:', err);
    return { ok: false };
  }
}

/** Record many access events in one transaction (e.g. a bulk archive sweep). */
export async function recordMemoryAccessBatch(
  events: MemoryAccessEvent[],
): Promise<{ ok: boolean; written: number }> {
  if (events.length === 0) return { ok: true, written: 0 };
  let inputs: MemoryAccessEvent[];
  try {
    inputs = events.map(buildMemoryAuditInput);
  } catch (err) {
    console.error('[memory-audit] invalid batch:', err);
    return { ok: false, written: 0 };
  }
  try {
    const res = await withSystemContext((tx) =>
      tx.memoryAuditLog.createMany({ data: inputs }),
    );
    return { ok: true, written: res.count };
  } catch (err) {
    console.error('[memory-audit] batch write failed:', err);
    return { ok: false, written: 0 };
  }
}

export interface MemoryAuditQuery {
  limit?: number;
  recordId?: string;
  action?: MemoryAuditAction;
}

/**
 * Read a workspace's audit trail under the caller's RLS context. The
 * `memory_audit_read` policy guarantees cross-tenant rows are invisible even
 * if a bug passed the wrong workspaceId here.
 */
export async function listMemoryAudit(
  ctx: RlsContext,
  workspaceId: string,
  query: MemoryAuditQuery = {},
) {
  const take = Math.min(Math.max(query.limit ?? 100, 1), 500);
  return withRls(ctx, (tx) =>
    tx.memoryAuditLog.findMany({
      where: {
        workspaceId,
        ...(query.recordId ? { recordId: query.recordId } : {}),
        ...(query.action ? { action: query.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    }),
  );
}
