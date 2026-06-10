/**
 * lib/integrations/retry-store.ts
 *
 * Storage seam for RetryableAction rows (pfd-2). Same rationale as
 * health-store: the queue's load-bearing logic (idempotent enqueue, backoff,
 * dead-letter, resume) lives in retry-queue.ts and must be testable offline, so
 * the DB access hides behind this interface. Prisma store = production; the
 * in-memory store satisfies the two-implementation rule + powers the tests.
 */

import type {
  IntegrationProvider,
  Prisma,
  RetryableAction,
  RetryableActionStatus,
} from '@prisma/client';
import { withSystemContext } from '@/lib/db/rls';

export interface RetryUpsertInput {
  workspaceId: string;
  provider: IntegrationProvider;
  actionKind: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey: string;
  status: RetryableActionStatus;
  nextAttemptAt: Date | null;
  /** When true (terminal revival) reset the attempt budget. */
  resetAttempts: boolean;
}

export interface RetryEligibleQuery {
  provider?: IntegrationProvider;
  workspaceId?: string;
  now: Date;
  limit: number;
}

/** The mutable fields the resume path writes back. */
export interface RetryRowUpdate {
  status?: RetryableActionStatus;
  attempts?: number;
  incrementAttempts?: boolean;
  nextAttemptAt?: Date | null;
  lastError?: string | null;
  diedAt?: Date | null;
  resolvedAt?: Date | null;
}

export interface RetryStore {
  findByKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<RetryableAction | null>;
  upsert(input: RetryUpsertInput): Promise<RetryableAction>;
  /** Eligible PENDING/HELD rows whose backoff has elapsed. */
  findEligible(q: RetryEligibleQuery): Promise<RetryableAction[]>;
  update(id: string, patch: RetryRowUpdate): Promise<void>;
  countByStatus(
    workspaceId: string,
    provider: IntegrationProvider,
  ): Promise<{ waiting: number; held: number; dead: number }>;
}

export class PrismaRetryStore implements RetryStore {
  async findByKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<RetryableAction | null> {
    const row = await withSystemContext((tx) =>
      tx.retryableAction.findUnique({
        where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } },
      }),
    );
    return row ?? null;
  }

  async upsert(input: RetryUpsertInput): Promise<RetryableAction> {
    return withSystemContext((tx) =>
      tx.retryableAction.upsert({
        where: {
          workspaceId_idempotencyKey: {
            workspaceId: input.workspaceId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          actionKind: input.actionKind,
          payload: input.payload,
          idempotencyKey: input.idempotencyKey,
          status: input.status,
          nextAttemptAt: input.nextAttemptAt,
        },
        update: {
          provider: input.provider,
          actionKind: input.actionKind,
          payload: input.payload,
          status: input.status,
          nextAttemptAt: input.nextAttemptAt,
          lastError: null,
          ...(input.resetAttempts
            ? { attempts: 0, diedAt: null, resolvedAt: null }
            : {}),
        },
      }),
    );
  }

  async findEligible(q: RetryEligibleQuery): Promise<RetryableAction[]> {
    return withSystemContext((tx) =>
      tx.retryableAction.findMany({
        where: {
          status: { in: ['PENDING', 'HELD'] },
          ...(q.provider ? { provider: q.provider } : {}),
          ...(q.workspaceId ? { workspaceId: q.workspaceId } : {}),
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: q.now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: q.limit,
      }),
    );
  }

  async update(id: string, patch: RetryRowUpdate): Promise<void> {
    const data: Prisma.RetryableActionUpdateInput = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.incrementAttempts) data.attempts = { increment: 1 };
    else if (patch.attempts !== undefined) data.attempts = patch.attempts;
    if (patch.nextAttemptAt !== undefined) data.nextAttemptAt = patch.nextAttemptAt;
    if (patch.lastError !== undefined) data.lastError = patch.lastError;
    if (patch.diedAt !== undefined) data.diedAt = patch.diedAt;
    if (patch.resolvedAt !== undefined) data.resolvedAt = patch.resolvedAt;
    await withSystemContext((tx) =>
      tx.retryableAction.update({ where: { id }, data }),
    );
  }

  async countByStatus(
    workspaceId: string,
    provider: IntegrationProvider,
  ): Promise<{ waiting: number; held: number; dead: number }> {
    const rows = await withSystemContext((tx) =>
      tx.retryableAction.groupBy({
        by: ['status'],
        where: { workspaceId, provider, status: { in: ['PENDING', 'HELD', 'DEAD'] } },
        _count: { _all: true },
      }),
    ).catch(() => [] as Array<{ status: RetryableActionStatus; _count: { _all: number } }>);
    let waiting = 0;
    let held = 0;
    let dead = 0;
    for (const r of rows) {
      if (r.status === 'PENDING') waiting = r._count._all;
      else if (r.status === 'HELD') held = r._count._all;
      else if (r.status === 'DEAD') dead = r._count._all;
    }
    return { waiting, held, dead };
  }
}

/** In-memory store for tests — no DB. */
export class InMemoryRetryStore implements RetryStore {
  rows: RetryableAction[] = [];
  private counter = 0;
  constructor(seed: RetryableAction[] = []) {
    this.rows = [...seed];
  }
  private key(workspaceId: string, idempotencyKey: string): string {
    return `${workspaceId}:${idempotencyKey}`;
  }
  async findByKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<RetryableAction | null> {
    return (
      this.rows.find(
        (r) => this.key(r.workspaceId, r.idempotencyKey) === this.key(workspaceId, idempotencyKey),
      ) ?? null
    );
  }
  async upsert(input: RetryUpsertInput): Promise<RetryableAction> {
    const existing = await this.findByKey(input.workspaceId, input.idempotencyKey);
    const now = new Date();
    if (existing) {
      existing.provider = input.provider;
      existing.actionKind = input.actionKind;
      existing.payload = input.payload as RetryableAction['payload'];
      existing.status = input.status;
      existing.nextAttemptAt = input.nextAttemptAt;
      existing.lastError = null;
      existing.updatedAt = now;
      if (input.resetAttempts) {
        existing.attempts = 0;
        existing.diedAt = null;
        existing.resolvedAt = null;
      }
      return existing;
    }
    this.counter += 1;
    const row: RetryableAction = {
      id: `retry-${this.counter}`,
      workspaceId: input.workspaceId,
      provider: input.provider,
      actionKind: input.actionKind,
      payload: input.payload as RetryableAction['payload'],
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      attempts: 0,
      nextAttemptAt: input.nextAttemptAt,
      lastError: null,
      diedAt: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }
  async findEligible(q: RetryEligibleQuery): Promise<RetryableAction[]> {
    return this.rows
      .filter(
        (r) =>
          (r.status === 'PENDING' || r.status === 'HELD') &&
          (q.provider ? r.provider === q.provider : true) &&
          (q.workspaceId ? r.workspaceId === q.workspaceId : true) &&
          (r.nextAttemptAt === null || r.nextAttemptAt.getTime() <= q.now.getTime()),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, q.limit);
  }
  async update(id: string, patch: RetryRowUpdate): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.incrementAttempts) row.attempts += 1;
    else if (patch.attempts !== undefined) row.attempts = patch.attempts;
    if (patch.nextAttemptAt !== undefined) row.nextAttemptAt = patch.nextAttemptAt;
    if (patch.lastError !== undefined) row.lastError = patch.lastError;
    if (patch.diedAt !== undefined) row.diedAt = patch.diedAt;
    if (patch.resolvedAt !== undefined) row.resolvedAt = patch.resolvedAt;
    row.updatedAt = new Date();
  }
  async countByStatus(
    workspaceId: string,
    provider: IntegrationProvider,
  ): Promise<{ waiting: number; held: number; dead: number }> {
    const mine = this.rows.filter(
      (r) => r.workspaceId === workspaceId && r.provider === provider,
    );
    return {
      waiting: mine.filter((r) => r.status === 'PENDING').length,
      held: mine.filter((r) => r.status === 'HELD').length,
      dead: mine.filter((r) => r.status === 'DEAD').length,
    };
  }
}
