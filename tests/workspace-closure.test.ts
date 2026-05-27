/**
 * tests/workspace-closure.test.ts
 *
 * Pins the customer-initiated workspace closure state machine:
 *
 *   1. Typed-confirmation MUST match the workspace name exactly. A
 *      mismatch throws TypedConfirmationMismatchError and writes no
 *      Workspace.update + no AuditLog row.
 *   2. A successful initiate transitions Workspace.closureStatus
 *      ACTIVE → CLOSING, sets closingInitiatedAt + scheduledHardPurgeAt,
 *      and writes a single AuditLog row.
 *   3. The grace window is now + graceDays * 24h (default 7).
 *   4. Cancel transitions CLOSING → ACTIVE and clears the closure stamps.
 *   5. Initiate refuses to act on workspaces not in ACTIVE state.
 *   6. The hard-purge scheduler picks ONLY rows whose
 *      scheduledHardPurgeAt is in the past AND closureStatus === CLOSING.
 *      A cancelled-mid-window workspace is invisible to the sweep.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

import {
  initiateWorkspaceClosure,
  cancelWorkspaceClosure,
  findWorkspacesDueForHardPurge,
  TypedConfirmationMismatchError,
  DEFAULT_GRACE_DAYS,
  getGraceDays,
} from '@/lib/customer-data';

// ─── Tiny stand-in for the slice of Prisma the closure module touches ─────

interface MockWorkspaceRow {
  id: string;
  name: string;
  closureStatus: 'ACTIVE' | 'CLOSING' | 'CLOSED';
  closingInitiatedAt: Date | null;
  closingInitiatedByUserId: string | null;
  scheduledHardPurgeAt: Date | null;
  closedAt: Date | null;
  closureReason: string | null;
}

interface MockAuditRow {
  actorUserId: string | null;
  workspaceId: string | null;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: unknown;
}

class ClosureMockClient {
  workspaces: MockWorkspaceRow[] = [];
  audits: MockAuditRow[] = [];

  seed(row: Partial<MockWorkspaceRow> & { id: string; name: string }): MockWorkspaceRow {
    const w: MockWorkspaceRow = {
      id: row.id,
      name: row.name,
      closureStatus: row.closureStatus ?? 'ACTIVE',
      closingInitiatedAt: row.closingInitiatedAt ?? null,
      closingInitiatedByUserId: row.closingInitiatedByUserId ?? null,
      scheduledHardPurgeAt: row.scheduledHardPurgeAt ?? null,
      closedAt: row.closedAt ?? null,
      closureReason: row.closureReason ?? null,
    };
    this.workspaces.push(w);
    return w;
  }

  workspace = {
    findUnique: async (args: { where: { id: string }; select?: unknown }) => {
      const row = this.workspaces.find((w) => w.id === args.where.id);
      return row ?? null;
    },
    update: async (args: {
      where: { id: string };
      data: Partial<MockWorkspaceRow>;
    }) => {
      const row = this.workspaces.find((w) => w.id === args.where.id);
      if (!row) throw new Error(`workspace ${args.where.id} not found`);
      Object.assign(row, args.data);
      return row;
    },
    findMany: async (args: {
      where: {
        closureStatus?: string;
        scheduledHardPurgeAt?: { lt: Date };
      };
      orderBy?: unknown;
      take?: number;
      select?: unknown;
    }) => {
      let rows = this.workspaces;
      if (args.where.closureStatus !== undefined) {
        rows = rows.filter((w) => w.closureStatus === args.where.closureStatus);
      }
      if (args.where.scheduledHardPurgeAt?.lt) {
        const cutoff = args.where.scheduledHardPurgeAt.lt;
        rows = rows.filter(
          (w) => w.scheduledHardPurgeAt !== null && w.scheduledHardPurgeAt < cutoff,
        );
      }
      if (args.take) rows = rows.slice(0, args.take);
      return rows;
    },
  };

  auditLog = {
    create: async (args: { data: MockAuditRow }) => {
      this.audits.push(args.data);
      return { id: 'audit_' + this.audits.length, occurredAt: new Date(), ...args.data };
    },
  };

  async $transaction<T>(cb: (tx: ClosureMockClient) => Promise<T>): Promise<T> {
    return cb(this);
  }
}

const asTx = (m: ClosureMockClient): Prisma.TransactionClient =>
  m as unknown as Prisma.TransactionClient;

const WS_A = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Tenant A Realty',
};
const WS_B = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Tenant B CPAs',
};
const USER_A = '99999999-aaaa-4aaa-9aaa-aaaaaaaaaaaa';

let mock: ClosureMockClient;

beforeEach(() => {
  mock = new ClosureMockClient();
});

describe('initiateWorkspaceClosure', () => {
  it('moves ACTIVE → CLOSING when the typed confirmation matches', async () => {
    mock.seed({ id: WS_A.id, name: WS_A.name });
    const now = new Date('2026-05-27T12:00:00.000Z');
    const result = await initiateWorkspaceClosure({
      workspaceId: WS_A.id,
      actorUserId: USER_A,
      typedConfirmation: WS_A.name,
      now,
      client: asTx(mock),
    });
    assert.equal(result.closureStatus, 'CLOSING');
    assert.equal(result.closingInitiatedAt.toISOString(), now.toISOString());
    const expectedPurge = new Date(now.getTime() + DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000);
    assert.equal(result.scheduledHardPurgeAt.toISOString(), expectedPurge.toISOString());

    const row = mock.workspaces.find((w) => w.id === WS_A.id)!;
    assert.equal(row.closureStatus, 'CLOSING');
    assert.equal(row.closingInitiatedByUserId, USER_A);
    assert.equal(row.scheduledHardPurgeAt?.toISOString(), expectedPurge.toISOString());
    assert.equal(mock.audits.length, 1);
    assert.equal(mock.audits[0].action, 'workspace.closure.initiated');
    assert.equal(mock.audits[0].actorUserId, USER_A);
    assert.equal(mock.audits[0].targetTable, 'Workspace');
  });

  it('rejects a typed confirmation that does not match the workspace name', async () => {
    mock.seed({ id: WS_A.id, name: WS_A.name });
    await assert.rejects(
      initiateWorkspaceClosure({
        workspaceId: WS_A.id,
        actorUserId: USER_A,
        typedConfirmation: 'Tenant A Realt', // typo
        client: asTx(mock),
      }),
      (err) => err instanceof TypedConfirmationMismatchError,
    );
    // Mismatch writes nothing.
    const row = mock.workspaces.find((w) => w.id === WS_A.id)!;
    assert.equal(row.closureStatus, 'ACTIVE');
    assert.equal(mock.audits.length, 0);
  });

  it('rejects a typed confirmation that differs only in case', async () => {
    mock.seed({ id: WS_A.id, name: WS_A.name });
    await assert.rejects(
      initiateWorkspaceClosure({
        workspaceId: WS_A.id,
        actorUserId: USER_A,
        typedConfirmation: WS_A.name.toLowerCase(),
        client: asTx(mock),
      }),
      (err) => err instanceof TypedConfirmationMismatchError,
    );
  });

  it('refuses to re-initiate on a workspace already in CLOSING', async () => {
    mock.seed({ id: WS_A.id, name: WS_A.name, closureStatus: 'CLOSING' });
    await assert.rejects(
      initiateWorkspaceClosure({
        workspaceId: WS_A.id,
        actorUserId: USER_A,
        typedConfirmation: WS_A.name,
        client: asTx(mock),
      }),
      /CLOSING, cannot initiate closure/,
    );
  });

  it('refuses unknown workspaces (defense-in-depth; membership precheck owns existence)', async () => {
    await assert.rejects(
      initiateWorkspaceClosure({
        workspaceId: WS_A.id,
        actorUserId: USER_A,
        typedConfirmation: WS_A.name,
        client: asTx(mock),
      }),
      /not found/,
    );
  });
});

describe('cancelWorkspaceClosure', () => {
  it('moves CLOSING → ACTIVE and clears the closure stamps', async () => {
    mock.seed({
      id: WS_A.id,
      name: WS_A.name,
      closureStatus: 'CLOSING',
      closingInitiatedAt: new Date('2026-05-20T10:00:00.000Z'),
      closingInitiatedByUserId: USER_A,
      scheduledHardPurgeAt: new Date('2026-05-27T10:00:00.000Z'),
      closureReason: 'changed our mind',
    });
    const result = await cancelWorkspaceClosure({
      workspaceId: WS_A.id,
      actorUserId: USER_A,
      client: asTx(mock),
    });
    assert.equal(result.closureStatus, 'ACTIVE');

    const row = mock.workspaces.find((w) => w.id === WS_A.id)!;
    assert.equal(row.closureStatus, 'ACTIVE');
    assert.equal(row.closingInitiatedAt, null);
    assert.equal(row.scheduledHardPurgeAt, null);
    assert.equal(row.closureReason, null);
    assert.equal(mock.audits.length, 1);
    assert.equal(mock.audits[0].action, 'workspace.closure.cancelled');
  });

  it('refuses ACTIVE workspaces (nothing to cancel)', async () => {
    mock.seed({ id: WS_A.id, name: WS_A.name });
    await assert.rejects(
      cancelWorkspaceClosure({
        workspaceId: WS_A.id,
        actorUserId: USER_A,
        client: asTx(mock),
      }),
      /ACTIVE, nothing to cancel/,
    );
  });

  it('refuses CLOSED workspaces (purge already ran — irreversible)', async () => {
    mock.seed({ id: WS_A.id, name: WS_A.name, closureStatus: 'CLOSED' });
    await assert.rejects(
      cancelWorkspaceClosure({
        workspaceId: WS_A.id,
        actorUserId: USER_A,
        client: asTx(mock),
      }),
      /CLOSED, cancellation no longer possible/,
    );
  });
});

describe('findWorkspacesDueForHardPurge', () => {
  const systemRunner = (m: ClosureMockClient) =>
    async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
      fn(asTx(m));

  it('returns only CLOSING workspaces whose scheduledHardPurgeAt is in the past', async () => {
    const now = new Date('2026-06-05T00:00:00.000Z');
    mock.seed({
      id: WS_A.id,
      name: WS_A.name,
      closureStatus: 'CLOSING',
      closingInitiatedAt: new Date('2026-05-27T00:00:00.000Z'),
      scheduledHardPurgeAt: new Date('2026-06-03T00:00:00.000Z'), // past — eligible
    });
    mock.seed({
      id: WS_B.id,
      name: WS_B.name,
      closureStatus: 'CLOSING',
      closingInitiatedAt: new Date('2026-06-01T00:00:00.000Z'),
      scheduledHardPurgeAt: new Date('2026-06-08T00:00:00.000Z'), // future — NOT eligible
    });
    // A third workspace in ACTIVE: never touched.
    mock.seed({ id: '33333333-3333-4333-8333-333333333333', name: 'Active' });
    // A fourth workspace already CLOSED: never re-purged.
    mock.seed({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Done',
      closureStatus: 'CLOSED',
      closedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const due = await findWorkspacesDueForHardPurge(now, systemRunner(mock));
    assert.equal(due.length, 1);
    assert.equal(due[0].workspaceId, WS_A.id);
  });

  it('returns nothing when a CLOSING workspace gets cancelled mid-window', async () => {
    const now = new Date('2026-06-05T00:00:00.000Z');
    mock.seed({
      id: WS_A.id,
      name: WS_A.name,
      closureStatus: 'CLOSING',
      closingInitiatedAt: new Date('2026-05-27T00:00:00.000Z'),
      scheduledHardPurgeAt: new Date('2026-06-03T00:00:00.000Z'),
    });
    // Customer cancels.
    await cancelWorkspaceClosure({
      workspaceId: WS_A.id,
      actorUserId: USER_A,
      client: asTx(mock),
    });
    const due = await findWorkspacesDueForHardPurge(now, systemRunner(mock));
    assert.equal(due.length, 0);
  });
});

describe('grace window env override', () => {
  it('honors WORKSPACE_CLOSURE_GRACE_DAYS within bounds', () => {
    assert.equal(getGraceDays('14'), 14);
    assert.equal(getGraceDays('1'), 1);
    assert.equal(getGraceDays('90'), 90);
  });
  it('falls back to default for out-of-bounds / non-numeric values', () => {
    assert.equal(getGraceDays('0'), DEFAULT_GRACE_DAYS);
    assert.equal(getGraceDays('91'), DEFAULT_GRACE_DAYS);
    assert.equal(getGraceDays('garbage'), DEFAULT_GRACE_DAYS);
    assert.equal(getGraceDays(undefined), DEFAULT_GRACE_DAYS);
  });
  it('uses the override when initiating', async () => {
    mock.seed({ id: WS_A.id, name: WS_A.name });
    const now = new Date('2026-05-27T12:00:00.000Z');
    const result = await initiateWorkspaceClosure({
      workspaceId: WS_A.id,
      actorUserId: USER_A,
      typedConfirmation: WS_A.name,
      now,
      graceDays: 14,
      client: asTx(mock),
    });
    const expected = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    assert.equal(result.scheduledHardPurgeAt.toISOString(), expected.toISOString());
  });
});
