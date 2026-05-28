/**
 * lib/support/recent-status.test.ts
 *
 * Pins the /help status-banner query.
 *   - 'none' when the user has no SupportRequest in the lookback window
 *   - 'submitted' when a SupportRequest exists but no draft has been queued
 *   - 'drafted-under-review' when a WorkApprovalQueueItem exists for it
 *
 * The wider tests/fixtures/_fake-prisma helper doesn't model
 * SupportRequest yet, so we use a tiny inline fake here — adding the
 * shape to the shared fixture is a follow-up cleanup.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getSupportRecentStatus } from './recent-status';
import type { Prisma, PrismaClient } from '@prisma/client';

interface FakeSupportRequest {
  id: string;
  workspaceId: string;
  fromUserId: string | null;
  subject: string;
  body: string;
  createdAt: Date;
}

interface FakeApprovalQueueItem {
  id: string;
  workspaceId: string;
  refTable: string;
  refId: string;
  kind: string;
  proposedAt: Date;
}

function buildFakeClient(args: {
  supportRequests: FakeSupportRequest[];
  approvals: FakeApprovalQueueItem[];
}): PrismaClient {
  const tx = {
    async $executeRawUnsafe(): Promise<number> {
      return 0;
    },
    supportRequest: {
      async findFirst(q: {
        where: {
          workspaceId: string;
          fromUserId: string;
          createdAt?: { gte: Date };
        };
      }): Promise<FakeSupportRequest | null> {
        const rows = args.supportRequests
          .filter(
            (r) =>
              r.workspaceId === q.where.workspaceId &&
              r.fromUserId === q.where.fromUserId &&
              (!q.where.createdAt ||
                r.createdAt.getTime() >= q.where.createdAt.gte.getTime()),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return rows[0] ?? null;
      },
    },
    workApprovalQueueItem: {
      async findFirst(q: {
        where: {
          workspaceId: string;
          refTable: string;
          refId: string;
          kind: string;
        };
      }): Promise<FakeApprovalQueueItem | null> {
        const rows = args.approvals
          .filter(
            (r) =>
              r.workspaceId === q.where.workspaceId &&
              r.refTable === q.where.refTable &&
              r.refId === q.where.refId &&
              r.kind === q.where.kind,
          )
          .sort((a, b) => b.proposedAt.getTime() - a.proposedAt.getTime());
        return rows[0] ?? null;
      },
    },
  };
  const client = {
    $transaction<T>(
      cb: (t: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
      return cb(tx as unknown as Prisma.TransactionClient);
    },
  };
  return client as unknown as PrismaClient;
}

const WORKSPACE_A = 'ws-a';
const WORKSPACE_B = 'ws-b';
const USER_A = 'user-a';
const NOW = new Date('2026-05-28T15:00:00.000Z');
const CTX_A = { userId: USER_A, workspaceId: WORKSPACE_A, isOperator: false };

describe('getSupportRecentStatus', () => {
  it("returns 'none' when the user has no SupportRequest in the lookback", async () => {
    const client = buildFakeClient({ supportRequests: [], approvals: [] });
    const res = await getSupportRecentStatus({
      ctx: CTX_A,
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      now: NOW,
      client,
    });
    assert.equal(res.state, 'none');
    assert.equal(res.supportRequestId, null);
    assert.equal(res.subject, null);
    assert.equal(res.submittedAt, null);
    assert.equal(res.draftedAt, null);
  });

  it("returns 'submitted' when a SupportRequest exists but no draft has been queued", async () => {
    const supportReq: FakeSupportRequest = {
      id: 'req-1',
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      subject: 'How do I disconnect Gmail?',
      body: 'I connected the wrong inbox.',
      createdAt: new Date(NOW.getTime() - 10 * 60 * 1000),
    };
    const client = buildFakeClient({
      supportRequests: [supportReq],
      approvals: [],
    });
    const res = await getSupportRecentStatus({
      ctx: CTX_A,
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      now: NOW,
      client,
    });
    assert.equal(res.state, 'submitted');
    assert.equal(res.supportRequestId, 'req-1');
    assert.equal(res.subject, 'How do I disconnect Gmail?');
    assert.equal(res.draftedAt, null);
  });

  it("returns 'drafted-under-review' when a WorkApprovalQueueItem exists for it", async () => {
    const supportReq: FakeSupportRequest = {
      id: 'req-1',
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      subject: 'How do I disconnect Gmail?',
      body: '',
      createdAt: new Date(NOW.getTime() - 10 * 60 * 1000),
    };
    const draftedAt = new Date(NOW.getTime() - 2 * 60 * 1000);
    const approval: FakeApprovalQueueItem = {
      id: 'wa-1',
      workspaceId: WORKSPACE_A,
      refTable: 'SupportRequest',
      refId: 'req-1',
      kind: 'SUPPORT_HANDLER_REPLY_DRAFT',
      proposedAt: draftedAt,
    };
    const client = buildFakeClient({
      supportRequests: [supportReq],
      approvals: [approval],
    });
    const res = await getSupportRecentStatus({
      ctx: CTX_A,
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      now: NOW,
      client,
    });
    assert.equal(res.state, 'drafted-under-review');
    assert.equal(res.supportRequestId, 'req-1');
    assert.equal(res.draftedAt?.toISOString(), draftedAt.toISOString());
  });

  it("does NOT return another workspace's SupportRequest", async () => {
    // Workspace B's request must not surface when querying as A.
    const otherWorkspaceReq: FakeSupportRequest = {
      id: 'req-other',
      workspaceId: WORKSPACE_B,
      fromUserId: USER_A,
      subject: "Workspace B's question",
      body: '',
      createdAt: new Date(NOW.getTime() - 10 * 60 * 1000),
    };
    const client = buildFakeClient({
      supportRequests: [otherWorkspaceReq],
      approvals: [],
    });
    const res = await getSupportRecentStatus({
      ctx: CTX_A,
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      now: NOW,
      client,
    });
    assert.equal(res.state, 'none');
  });

  it("excludes requests older than the lookback window", async () => {
    const stale: FakeSupportRequest = {
      id: 'old',
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      subject: 'old',
      body: '',
      createdAt: new Date(NOW.getTime() - 72 * 60 * 60 * 1000), // 72h ago, beyond 48h default
    };
    const client = buildFakeClient({
      supportRequests: [stale],
      approvals: [],
    });
    const res = await getSupportRecentStatus({
      ctx: CTX_A,
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      now: NOW,
      client,
    });
    assert.equal(res.state, 'none');
  });

  it("returns the MOST RECENT request when multiple exist", async () => {
    const older: FakeSupportRequest = {
      id: 'req-older',
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      subject: 'older',
      body: '',
      createdAt: new Date(NOW.getTime() - 90 * 60 * 1000),
    };
    const newer: FakeSupportRequest = {
      id: 'req-newer',
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      subject: 'newer',
      body: '',
      createdAt: new Date(NOW.getTime() - 5 * 60 * 1000),
    };
    const client = buildFakeClient({
      supportRequests: [older, newer],
      approvals: [],
    });
    const res = await getSupportRecentStatus({
      ctx: CTX_A,
      workspaceId: WORKSPACE_A,
      fromUserId: USER_A,
      now: NOW,
      client,
    });
    assert.equal(res.supportRequestId, 'req-newer');
    assert.equal(res.subject, 'newer');
  });
});
