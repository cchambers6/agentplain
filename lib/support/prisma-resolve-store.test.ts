/**
 * lib/support/prisma-resolve-store.test.ts
 *
 * The P0 that this file pins: `/operator/support` "Approve and send"
 * sends a REAL outbound email via Resend and closes the SupportRequest,
 * and its queue-item transition used to be a bare
 * `workApprovalQueueItem.update({ status: "APPROVED" })`.
 *
 * That had two consequences:
 *
 *   1. No `work_approval.approved` AuditLog row. (There WAS a
 *      `support_reply.approved_sent` row, so the claim "no record at
 *      all" is false -- but it is keyed to targetTable=SupportRequest,
 *      so nothing reading the approval-decision stream by
 *      targetTable=WorkApprovalQueueItem could see this decision.)
 *   2. No status guard inside the writing transaction. The guard in
 *      resolve-reply.ts runs in an EARLIER, SEPARATE transaction, so it
 *      cannot stop two concurrent submits from both passing it.
 *
 * These tests drive the REAL `PrismaSupportReplyStore` against an
 * injected Prisma-shaped client, following the repo's existing
 * approval-transition convention (tests/wave5-approval-queue-
 * transitions.test.ts + tests/fixtures/_fake-prisma.ts): assert on the
 * recorded rows, never on a re-implementation of the code under test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';

import { PrismaSupportReplyStore } from './prisma-resolve-store';
import { ApprovalDecisionError } from '../approvals/decisions';

const WORKSPACE_ID = 'aaaa1111-2222-4333-8444-555555555555';
const OPERATOR_ID = 'user-operator-1';
const OTHER_OPERATOR_ID = 'user-operator-2';

interface FakeApproval {
  id: string;
  workspaceId: string;
  agentSlug: string;
  kind: string;
  status: string;
  refTable: string | null;
  refId: string | null;
  payload: unknown;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  decisionReason: string | null;
}

interface FakeAudit {
  actorUserId: string | null;
  workspaceId: string | null;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: unknown;
}

interface FakeSupportRequest {
  id: string;
  status: string;
  subject: string;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

/**
 * Prisma-shaped fake covering only what this store touches. Modelled on
 * tests/fixtures/_fake-prisma.ts; kept local because that fixture has no
 * supportRequest table and is shared by other suites.
 *
 * `$transaction` applies the callback against a STAGING copy and only
 * commits it if the callback resolves. That is what lets these tests
 * assert the real rollback semantics of a losing concurrent decision,
 * rather than assuming them.
 */
class FakeSupportPrisma {
  approvals: FakeApproval[] = [];
  audits: FakeAudit[] = [];
  requests: FakeSupportRequest[] = [];
  rlsCalls: Array<{ userId: string; workspaceId: string; isOperator: string }> = [];

  async $transaction<T>(cb: (tx: FakeSupportPrisma) => Promise<T>): Promise<T> {
    const staged = new FakeSupportPrisma();
    staged.approvals = this.approvals.map((r) => ({ ...r }));
    staged.audits = this.audits.map((r) => ({ ...r }));
    staged.requests = this.requests.map((r) => ({ ...r }));
    staged.rlsCalls = this.rlsCalls.slice();

    const out = await cb(staged); // throws => nothing below runs => rollback

    this.approvals = staged.approvals;
    this.audits = staged.audits;
    this.requests = staged.requests;
    this.rlsCalls = staged.rlsCalls;
    return out;
  }

  async $executeRawUnsafe(
    _sql: string,
    userId: string,
    workspaceId: string,
    isOperator: string,
  ): Promise<number> {
    this.rlsCalls.push({ userId, workspaceId, isOperator });
    return 0;
  }

  workApprovalQueueItem = {
    findUnique: async (args: { where: { id: string } }) =>
      this.approvals.find((r) => r.id === args.where.id) ?? null,
    findFirst: async (args: { where: { id?: string; workspaceId?: string } }) =>
      this.approvals.find(
        (r) =>
          (args.where.id === undefined || r.id === args.where.id) &&
          (args.where.workspaceId === undefined || r.workspaceId === args.where.workspaceId),
      ) ?? null,
    update: async (args: { where: { id: string }; data: Partial<FakeApproval> }) => {
      const row = this.approvals.find((r) => r.id === args.where.id);
      if (!row) throw new Error(`approval ${args.where.id} not found`);
      Object.assign(row, args.data);
      return row;
    },
  };

  supportRequest = {
    findUnique: async (args: { where: { id: string } }) =>
      this.requests.find((r) => r.id === args.where.id) ?? null,
    update: async (args: { where: { id: string }; data: Partial<FakeSupportRequest> }) => {
      const row = this.requests.find((r) => r.id === args.where.id);
      if (!row) throw new Error(`request ${args.where.id} not found`);
      Object.assign(row, args.data);
      return row;
    },
  };

  auditLog = {
    create: async (args: { data: FakeAudit }) => {
      this.audits.push({ ...args.data });
      return args.data;
    },
  };
}

function seeded() {
  const db = new FakeSupportPrisma();
  db.requests.push({
    id: 'req-1',
    status: 'NEW',
    subject: 'Cannot connect Gmail',
    resolvedAt: null,
    resolvedBy: null,
  });
  db.approvals.push({
    id: 'queue-1',
    workspaceId: WORKSPACE_ID,
    agentSlug: 'support-handler',
    kind: 'SUPPORT_HANDLER_REPLY_DRAFT',
    status: 'PENDING',
    refTable: 'SupportRequest',
    refId: 'req-1',
    payload: { subject: 'Re: Cannot connect Gmail', body: 'Try reconnecting.' },
    decidedAt: null,
    decidedByUserId: null,
    decisionReason: null,
  });
  const store = new PrismaSupportReplyStore({
    client: db as unknown as PrismaClient,
  });
  return { db, store };
}

const resolvedArgs = {
  queueItemId: 'queue-1',
  workspaceId: WORKSPACE_ID,
  supportRequestId: 'req-1',
  operatorUserId: OPERATOR_ID,
  sentSubject: 'Re: Cannot connect Gmail',
  sentBody: 'Try reconnecting.',
  emailMessageId: 'resend-msg-1',
};

describe('PrismaSupportReplyStore.recordResolved - audit evidence', () => {
  it('writes a work_approval.approved row keyed to the queue item', async () => {
    const { db, store } = seeded();
    await store.recordResolved(resolvedArgs);

    const decision = db.audits.filter((a) => a.action === 'work_approval.approved');
    assert.equal(
      decision.length,
      1,
      'an approval that reached a customer must leave a work_approval.approved row',
    );
    assert.equal(decision[0].targetTable, 'WorkApprovalQueueItem');
    assert.equal(decision[0].targetId, 'queue-1');
    assert.equal(decision[0].workspaceId, WORKSPACE_ID);
    // The DB grant is the system-operator context (userId null); the
    // ACTOR must still be the real human who clicked approve.
    assert.equal(decision[0].actorUserId, OPERATOR_ID);
  });

  it('keeps the existing support_reply.approved_sent row as well', async () => {
    const { db, store } = seeded();
    await store.recordResolved(resolvedArgs);
    const sent = db.audits.filter((a) => a.action === 'support_reply.approved_sent');
    assert.equal(sent.length, 1, 'the send-specific audit row must not be lost');
    assert.equal(sent[0].targetTable, 'SupportRequest');
  });

  it('still performs the whole transition: queue APPROVED + request RESOLVED', async () => {
    const { db, store } = seeded();
    await store.recordResolved(resolvedArgs);

    assert.equal(db.approvals[0].status, 'APPROVED');
    assert.equal(db.approvals[0].decidedByUserId, OPERATOR_ID);
    assert.ok(db.approvals[0].decidedAt instanceof Date);
    assert.equal(db.approvals[0].decisionReason, 'approved + sent via /operator/support');
    assert.equal(db.requests[0].status, 'RESOLVED');
    assert.equal(db.requests[0].resolvedBy, OPERATOR_ID);
  });

  it('runs under the system-operator RLS grant', async () => {
    const { db, store } = seeded();
    await store.recordResolved(resolvedArgs);
    assert.equal(db.rlsCalls.length, 1);
    assert.equal(db.rlsCalls[0].isOperator, 'true');
  });
});

describe('PrismaSupportReplyStore.recordResolved - second submit cannot re-approve', () => {
  it('throws ALREADY_DECIDED on a second recordResolved', async () => {
    const { store } = seeded();
    await store.recordResolved(resolvedArgs);

    await assert.rejects(
      () => store.recordResolved(resolvedArgs),
      (err: unknown) => {
        assert.ok(err instanceof ApprovalDecisionError);
        assert.equal(err.code, 'ALREADY_DECIDED');
        return true;
      },
      'a double submit must not be able to re-approve an already-decided item',
    );
  });

  it('rolls the losing submit back entirely - no second audit row, no restamp', async () => {
    const { db, store } = seeded();
    await store.recordResolved(resolvedArgs);
    const firstDecidedAt = db.approvals[0].decidedAt;

    await assert.rejects(() =>
      store.recordResolved({ ...resolvedArgs, operatorUserId: OTHER_OPERATOR_ID }),
    );

    // Exactly one of each audit action, and the first operator keeps the
    // attribution. Without the in-transaction guard the second submit
    // would overwrite decidedByUserId and append a duplicate audit row.
    assert.equal(db.audits.filter((a) => a.action === 'work_approval.approved').length, 1);
    assert.equal(
      db.audits.filter((a) => a.action === 'support_reply.approved_sent').length,
      1,
    );
    assert.equal(db.approvals[0].decidedByUserId, OPERATOR_ID);
    assert.equal(db.approvals[0].decidedAt, firstDecidedAt);
  });

  it('refuses to decide an item belonging to a different workspace', async () => {
    const { db, store } = seeded();
    await assert.rejects(
      () => store.recordResolved({ ...resolvedArgs, workspaceId: 'bbbb1111-2222-4333-8444-555555555555' }),
      (err: unknown) => {
        assert.ok(err instanceof ApprovalDecisionError);
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      },
    );
    assert.equal(db.approvals[0].status, 'PENDING');
    assert.equal(db.audits.length, 0);
  });
});

describe('PrismaSupportReplyStore.recordRejected', () => {
  const rejectArgs = {
    queueItemId: 'queue-1',
    workspaceId: WORKSPACE_ID,
    supportRequestId: 'req-1',
    operatorUserId: OPERATOR_ID,
    reason: 'tone is off',
  };

  it('writes a work_approval.rejected row and returns the request to OPEN', async () => {
    const { db, store } = seeded();
    await store.recordRejected(rejectArgs);

    const decision = db.audits.filter((a) => a.action === 'work_approval.rejected');
    assert.equal(decision.length, 1);
    assert.equal(decision[0].targetId, 'queue-1');
    assert.equal(decision[0].actorUserId, OPERATOR_ID);
    assert.equal(db.approvals[0].status, 'REJECTED');
    assert.equal(db.approvals[0].decisionReason, 'tone is off');
    assert.equal(db.requests[0].status, 'OPEN');
  });

  it('cannot overwrite an already-APPROVED decision', async () => {
    const { db, store } = seeded();
    await store.recordResolved(resolvedArgs);

    await assert.rejects(
      () => store.recordRejected(rejectArgs),
      (err: unknown) => {
        assert.ok(err instanceof ApprovalDecisionError);
        assert.equal(err.code, 'ALREADY_DECIDED');
        return true;
      },
    );
    // The customer already received this reply. Its decision record must
    // not be rewritten to REJECTED, and the request must stay RESOLVED.
    assert.equal(db.approvals[0].status, 'APPROVED');
    assert.equal(db.requests[0].status, 'RESOLVED');
    assert.equal(db.audits.filter((a) => a.action === 'work_approval.rejected').length, 0);
  });
});
