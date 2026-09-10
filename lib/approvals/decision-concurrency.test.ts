/**
 * lib/approvals/decision-concurrency.test.ts
 *
 * The HIGH this file pins: `applyApprovalDecisionTx` guarded PENDING with a
 * `findFirst` followed by an unconditional `update` by id, and THREE separate
 * comments in two files asserted that this made concurrent decisions safe. It
 * did not.
 *
 * `isolationLevel` appears nowhere in this repo, so these transactions run at
 * Postgres' default READ COMMITTED. Under READ COMMITTED:
 *
 *   - every STATEMENT takes a fresh snapshot of committed data;
 *   - an UPDATE that blocks on a row another transaction has locked will,
 *     once the lock is released, RE-EVALUATE ITS WHERE CLAUSE against the
 *     updated row version.
 *
 * Those two facts are the whole defect and the whole fix. A read-then-write
 * loses, because the status it checked came from an earlier statement's
 * snapshot and is never re-evaluated. A conditional `updateMany` wins,
 * because its predicate IS re-evaluated at write time.
 *
 * -----------------------------------------------------------------------
 * HOW HONEST IS THIS TEST? Read this before trusting it.
 * -----------------------------------------------------------------------
 * It does NOT run Postgres. It runs a fake that implements the two READ
 * COMMITTED rules quoted above, and it drives the REAL
 * `applyApprovalDecisionTx` against that fake. So it validates the code
 * against a MODEL of Postgres, not against Postgres.
 *
 * What stops that from being worthless is the CONTROL test below. Before
 * asserting anything about production code, the suite drives the OLD
 * read-then-write shape against the same fake and asserts that it DOES
 * double-apply. If the fake were incapable of expressing the defect -- the
 * usual way a concurrency test passes either implementation -- that control
 * would fail and the suite would go red. The instrument is validated against
 * a known-positive before any negative is believed.
 *
 * What this test still cannot prove: that Postgres behaves as documented,
 * and that Prisma compiles `updateMany` to a single conditional UPDATE rather
 * than a select-then-update. Both are true, neither is checked here, and a
 * genuine end-to-end proof needs two real connections against a real
 * database. That gap is real and is named rather than papered over.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyApprovalDecisionTx,
  ApprovalDecisionError,
} from './decisions';

const WORKSPACE = 'ws-1111-2222-3333';
const ITEM = 'item-aaaa-bbbb-cccc';

interface Row {
  id: string;
  workspaceId: string;
  agentSlug: string;
  kind: string;
  refTable: string;
  refId: string;
  payload: unknown;
  status: string;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  decisionReason: string | null;
}

interface Audit {
  action: string;
  targetId: string | null;
  actorUserId: string | null;
}

function pendingRow(): Row {
  return {
    id: ITEM,
    workspaceId: WORKSPACE,
    agentSlug: 'follow-up-chaser-general',
    kind: 'FOLLOW_UP_NUDGE',
    refTable: 'FollowUpNudgeProposal',
    refId: 'proposal-1',
    payload: { subject: 'Invoice 1041', body: 'Just following up.' },
    status: 'PENDING',
    decidedAt: null,
    decidedByUserId: null,
    decisionReason: null,
  };
}

/**
 * A Prisma-shaped fake that implements exactly the two READ COMMITTED rules
 * this defect turns on, and nothing else.
 *
 *   findFirst   -> committed state AT STATEMENT TIME (plus this tx's own
 *                  uncommitted writes). Not a transaction-long snapshot:
 *                  READ COMMITTED re-snapshots per statement, and modelling
 *                  it any other way would make the race easier to detect
 *                  than it really is.
 *   updateMany  -> evaluates its WHERE against committed state AT WRITE
 *                  TIME. This is the "re-read the new row version after the
 *                  lock is released" behaviour, and it is what makes a
 *                  conditional update atomic without a stricter isolation
 *                  level.
 *   update      -> writes by id UNCONDITIONALLY. This is the buggy shape,
 *                  present only so the control test can exercise it.
 */
class FakeDb {
  rows: Row[] = [pendingRow()];
  audits: Audit[] = [];

  /** Fires once, after the next findFirst, so a test can commit a competing
   *  transaction inside the race window. */
  afterNextRead: (() => Promise<void>) | null = null;

  async transaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
    const tx = new FakeTx(this);
    try {
      const out = await fn(tx);
      tx.commit();
      return out;
    } catch (err) {
      tx.rollback();
      throw err;
    }
  }
}

class FakeTx {
  private patches = new Map<string, Partial<Row>>();
  private stagedAudits: Audit[] = [];

  constructor(private readonly db: FakeDb) {}

  /** Committed row + this transaction's own uncommitted writes. */
  private view(id: string): Row | undefined {
    const committed = this.db.rows.find((r) => r.id === id);
    if (!committed) return undefined;
    return { ...committed, ...(this.patches.get(id) ?? {}) };
  }

  commit(): void {
    for (const [id, patch] of this.patches) {
      const row = this.db.rows.find((r) => r.id === id);
      if (row) Object.assign(row, patch);
    }
    this.db.audits.push(...this.stagedAudits);
  }

  rollback(): void {
    this.patches.clear();
    this.stagedAudits = [];
  }

  workApprovalQueueItem = {
    findFirst: async (args: {
      where: { id?: string; workspaceId?: string };
    }): Promise<Row | null> => {
      const row = args.where.id ? this.view(args.where.id) : undefined;
      const hit =
        row &&
        (args.where.workspaceId === undefined ||
          row.workspaceId === args.where.workspaceId)
          ? row
          : null;
      const hook = this.db.afterNextRead;
      if (hook) {
        this.db.afterNextRead = null;
        await hook();
      }
      return hit;
    },

    updateMany: async (args: {
      where: { id: string; workspaceId?: string; status?: string };
      data: Partial<Row>;
    }): Promise<{ count: number }> => {
      // Re-evaluated at WRITE time against current committed state.
      const row = this.view(args.where.id);
      if (!row) return { count: 0 };
      if (args.where.workspaceId && row.workspaceId !== args.where.workspaceId) {
        return { count: 0 };
      }
      if (args.where.status && row.status !== args.where.status) {
        return { count: 0 };
      }
      this.patches.set(args.where.id, {
        ...(this.patches.get(args.where.id) ?? {}),
        ...args.data,
      });
      return { count: 1 };
    },

    /** Unconditional write by id -- the shape the fix removed. */
    update: async (args: {
      where: { id: string };
      data: Partial<Row>;
    }): Promise<void> => {
      this.patches.set(args.where.id, {
        ...(this.patches.get(args.where.id) ?? {}),
        ...args.data,
      });
    },
  };

  auditLog = {
    create: async (args: {
      data: { action: string; targetId: string | null; actorUserId: string | null };
    }): Promise<void> => {
      this.stagedAudits.push({
        action: args.data.action,
        targetId: args.data.targetId,
        actorUserId: args.data.actorUserId,
      });
    },
  };
}

/**
 * CONTROL. The pre-fix shape, re-implemented here for one purpose only: to
 * prove this fake can express the defect. It is deliberately NOT used to
 * assert anything about production behaviour -- the subject tests below drive
 * the real function.
 */
async function legacyReadThenWrite(
  tx: FakeTx,
  params: { itemId: string; workspaceId: string; decision: string; actor: string },
): Promise<void> {
  const item = await tx.workApprovalQueueItem.findFirst({
    where: { id: params.itemId, workspaceId: params.workspaceId },
  });
  if (!item) throw new Error('NOT_FOUND');
  if (item.status !== 'PENDING') throw new Error('ALREADY_DECIDED');
  await tx.workApprovalQueueItem.update({
    where: { id: params.itemId },
    data: {
      status: params.decision,
      decidedAt: new Date(),
      decidedByUserId: params.actor,
      decisionReason: null,
    },
  });
  await tx.auditLog.create({
    data: {
      action: `work_approval.${params.decision.toLowerCase()}`,
      targetId: params.itemId,
      actorUserId: params.actor,
    },
  });
}

describe('applyApprovalDecisionTx -- concurrent decisions (READ COMMITTED)', () => {
  it('CONTROL: the pre-fix read-then-write DOES double-apply (instrument check)', async () => {
    const db = new FakeDb();

    // T2 opens, reads PENDING, and is then interrupted: T1 approves and
    // commits inside the race window. T2 resumes and writes anyway, because
    // nothing re-checks the status it read.
    db.afterNextRead = async () => {
      await db.transaction((t1) =>
        legacyReadThenWrite(t1, {
          itemId: ITEM,
          workspaceId: WORKSPACE,
          decision: 'APPROVED',
          actor: 'user-1',
        }),
      );
    };

    await db.transaction((t2) =>
      legacyReadThenWrite(t2, {
        itemId: ITEM,
        workspaceId: WORKSPACE,
        decision: 'REJECTED',
        actor: 'user-2',
      }),
    );

    // Both "succeeded". This is the defect, and the fake reproduces it.
    assert.equal(
      db.rows[0]!.status,
      'REJECTED',
      'control must show the second decision overwriting the first',
    );
    assert.equal(db.rows[0]!.decidedByUserId, 'user-2');
    assert.equal(
      db.audits.length,
      2,
      'control must show two work_approval audit rows for one item',
    );
  });

  it('SUBJECT: the real function makes the losing decision throw ALREADY_DECIDED', async () => {
    const db = new FakeDb();

    db.afterNextRead = async () => {
      await db.transaction((t1) =>
        applyApprovalDecisionTx(t1 as never, {
          workspaceId: WORKSPACE,
          itemId: ITEM,
          decision: 'APPROVED',
          reason: null,
          actorUserId: 'user-1',
        }),
      );
    };

    await assert.rejects(
      () =>
        db.transaction((t2) =>
          applyApprovalDecisionTx(t2 as never, {
            workspaceId: WORKSPACE,
            itemId: ITEM,
            decision: 'REJECTED',
            reason: 'too pushy',
            actorUserId: 'user-2',
          }),
        ),
      (err: unknown) =>
        err instanceof ApprovalDecisionError && err.code === 'ALREADY_DECIDED',
      'the losing transaction must throw ALREADY_DECIDED, not apply',
    );

    // The first decision stands, untouched.
    assert.equal(db.rows[0]!.status, 'APPROVED');
    assert.equal(db.rows[0]!.decidedByUserId, 'user-1');
    assert.equal(db.rows[0]!.decisionReason, null);

    // And the loser wrote no audit row: its whole transaction rolled back.
    assert.equal(
      db.audits.length,
      1,
      'exactly one work_approval audit row for one decided item',
    );
    assert.equal(db.audits[0]!.action, 'work_approval.approved');
  });

  it('SUBJECT: the sequential case still reports ALREADY_DECIDED from the read', async () => {
    const db = new FakeDb();
    db.rows[0]!.status = 'APPROVED';

    await assert.rejects(
      () =>
        db.transaction((tx) =>
          applyApprovalDecisionTx(tx as never, {
            workspaceId: WORKSPACE,
            itemId: ITEM,
            decision: 'REJECTED',
            reason: null,
            actorUserId: 'user-2',
          }),
        ),
      (err: unknown) =>
        err instanceof ApprovalDecisionError && err.code === 'ALREADY_DECIDED',
    );
    assert.equal(db.audits.length, 0);
  });

  it('AUTO_APPROVED is not PENDING, so it cannot be re-decided either', async () => {
    const db = new FakeDb();
    db.rows[0]!.status = 'AUTO_APPROVED';

    await assert.rejects(
      () =>
        db.transaction((tx) =>
          applyApprovalDecisionTx(tx as never, {
            workspaceId: WORKSPACE,
            itemId: ITEM,
            decision: 'APPROVED',
            reason: null,
            actorUserId: 'user-2',
          }),
        ),
      (err: unknown) =>
        err instanceof ApprovalDecisionError && err.code === 'ALREADY_DECIDED',
    );
    assert.equal(db.rows[0]!.status, 'AUTO_APPROVED');
  });

  it('a workspace mismatch cannot decide across a tenant boundary', async () => {
    const db = new FakeDb();

    await assert.rejects(
      () =>
        db.transaction((tx) =>
          applyApprovalDecisionTx(tx as never, {
            workspaceId: 'ws-someone-else',
            itemId: ITEM,
            decision: 'APPROVED',
            reason: null,
            actorUserId: 'user-3',
          }),
        ),
      (err: unknown) =>
        err instanceof ApprovalDecisionError && err.code === 'NOT_FOUND',
    );
    assert.equal(db.rows[0]!.status, 'PENDING');
  });

  it('returns the decrypted payload so dispatch acts on the decided row', async () => {
    const db = new FakeDb();
    const applied = await db.transaction((tx) =>
      applyApprovalDecisionTx(tx as never, {
        workspaceId: WORKSPACE,
        itemId: ITEM,
        decision: 'APPROVED',
        reason: null,
        actorUserId: 'user-1',
      }),
    );

    assert.equal(applied.kind, 'FOLLOW_UP_NUDGE');
    assert.equal(applied.agentSlug, 'follow-up-chaser-general');
    assert.equal(applied.refTable, 'FollowUpNudgeProposal');
    assert.equal(applied.refId, 'proposal-1');
    assert.equal(applied.payload.subject, 'Invoice 1041');
  });
});
