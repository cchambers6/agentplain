/**
 * Tests for the weekly report DATA aggregator. Uses a hand-rolled fake
 * Prisma TransactionClient — no DB. The fake dispatches `findMany` / `count`
 * by the shape of the `where` clause so it can serve the four distinct reads
 * this layer (and the digest it composes) issue.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { computeWeeklyReportData } from './weekly-report-data';

// Friday — resolveReportedWeek() reports the prior Mon–Sun (Jun 1–7).
const NOW = new Date('2026-06-12T12:00:00.000Z');
const WS = '11111111-1111-1111-1111-111111111111';

// Within-week timestamps (the fake ignores the date filters, but keep them
// honest so the fixture reads true).
const d = (iso: string) => new Date(iso);

const ACCEPTED_ROWS = [
  { kind: 'LEAD_TRIAGE', status: 'APPROVED', agentSlug: 'lead-triage-realestate', payload: {} },
  { kind: 'LEAD_TRIAGE', status: 'APPROVED', agentSlug: 'lead-triage-realestate', payload: {} },
  {
    kind: 'FOLLOW_UP_NUDGE',
    status: 'AUTO_APPROVED',
    agentSlug: 'follow-up-chaser-general',
    payload: { balanceUsd: 500 },
  },
];

const PROPOSED_ROWS = [
  { kind: 'LEAD_TRIAGE', discipline: 'sales-enablement', agentSlug: 'lead-triage-realestate', status: 'APPROVED', payload: {} },
  { kind: 'LEAD_TRIAGE', discipline: 'sales-enablement', agentSlug: 'lead-triage-realestate', status: 'APPROVED', payload: {} },
  { kind: 'LEAD_TRIAGE', discipline: 'sales-enablement', agentSlug: 'lead-triage-realestate', status: 'PENDING', payload: {} },
  { kind: 'INBOX_TRIAGE', discipline: 'operations', agentSlug: 'inbox-triage-general', status: 'PENDING', payload: {} },
  { kind: 'BUYER_INQUIRY_REPLY_DRAFT', discipline: null, agentSlug: 'buyer-inquiry-router', status: 'REJECTED', payload: {} },
];

const APPROVED_ROWS = [
  { proposedAt: d('2026-06-02T09:00:00Z'), decidedAt: d('2026-06-02T09:10:00Z') }, // 10 min
  { proposedAt: d('2026-06-03T09:00:00Z'), decidedAt: d('2026-06-03T09:20:00Z') }, // 20 min
];

const REJECTED_ROWS = [{ decisionReason: 'Too formal' }];

const PENDING_COUNT = 4;

/** The subset of a Prisma `where` this fake inspects. */
type WhereLike = {
  status?: string | { in?: string[] };
  proposedAt?: unknown;
  decidedAt?: unknown;
};
type FindArgs = { where?: WhereLike };

const ZERO_AGG = {
  _sum: {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costMicroCents: 0n,
  },
  _count: { _all: 0 },
};

function isInClause(s: WhereLike['status']): s is { in?: string[] } {
  return typeof s === 'object' && s !== null;
}

function fakeTx(): Prisma.TransactionClient {
  const tx = {
    workApprovalQueueItem: {
      findMany: async (args: FindArgs) => {
        const where = args.where ?? {};
        if (where.proposedAt && !where.status) return PROPOSED_ROWS;
        if (where.status === 'APPROVED') return APPROVED_ROWS;
        if (where.status === 'REJECTED') return REJECTED_ROWS;
        // status: { in: [...] } → the accepted reads (digest + ledger).
        if (isInClause(where.status)) return ACCEPTED_ROWS;
        return [];
      },
      count: async (args: FindArgs) => {
        const where = args.where ?? {};
        if (where.status === 'PENDING') return PENDING_COUNT;
        // ledger's ACTIONED count.
        if (isInClause(where.status)) {
          return ACCEPTED_ROWS.length + REJECTED_ROWS.length;
        }
        return 0;
      },
    },
    auditLog: {
      count: async () => 0, // no auto-execute audit rows in this fixture
    },
    llmUsageRecord: {
      aggregate: async () => ZERO_AGG,
      groupBy: async () => [],
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

describe('computeWeeklyReportData', () => {
  it('aggregates drafts, workflows, approvals, rejections, outcomes, look-ahead', async () => {
    const data = await computeWeeklyReportData(fakeTx(), {
      workspaceId: WS,
      workspaceName: 'Acme Realty',
      vertical: 'REAL_ESTATE',
      now: NOW,
    });

    // Window resolves to the prior Mon–Sun.
    assert.equal(data.forDate, '2026-06-07');
    assert.equal(data.weekLabel, 'Jun 1 – Jun 7');

    // Drafts created = all proposed rows.
    assert.equal(data.draftsCreated, PROPOSED_ROWS.length);

    // Per-discipline breakdown, sorted by count desc.
    const sales = data.draftsByDiscipline.find((r) => r.discipline === 'sales-enablement');
    assert.equal(sales?.count, 3);
    const other = data.draftsByDiscipline.find((r) => r.discipline === 'other');
    assert.equal(other?.count, 1); // the null-discipline rejected row

    // Workflows fired, grouped + labeled.
    const lead = data.workflowsFired.find((w) => w.agentSlug === 'lead-triage-realestate');
    assert.equal(lead?.count, 3);
    assert.equal(lead?.label, 'Lead triage');

    // Manual approvals + median time-to-approve (10, 20 → 15).
    assert.equal(data.approvalsApproved, 2);
    assert.equal(data.medianTimeToApproveMinutes, 15);

    // Rejections + reasons.
    assert.equal(data.approvalsRejected, 1);
    assert.equal(data.rejectionReasons[0].reason, 'Too formal');

    // Per-vertical outcomes (real estate → lead triage trade language).
    const labels = data.verticalOutcomes.map((o) => o.label).join(' | ');
    assert.match(labels, /leads triaged/);

    // Look-ahead reads the live pending count + names the rejection learning.
    assert.equal(data.lookAhead.pendingReviewCount, PENDING_COUNT);
    assert.ok(data.lookAhead.needsInput.some((n) => /4 drafts are waiting/.test(n)));
    assert.ok(data.lookAhead.needsInput.some((n) => /correction/.test(n)));

    assert.equal(data.isEmpty, false);
  });

  it('reports an empty week with no drafts and no decisions', async () => {
    const emptyTx = {
      workApprovalQueueItem: {
        findMany: async () => [],
        count: async () => 0,
      },
      auditLog: { count: async () => 0 },
      llmUsageRecord: {
        aggregate: async () => ZERO_AGG,
        groupBy: async () => [],
      },
    } as unknown as Prisma.TransactionClient;

    const data = await computeWeeklyReportData(emptyTx, {
      workspaceId: WS,
      workspaceName: 'Quiet Co',
      vertical: 'CPA',
      now: NOW,
    });
    assert.equal(data.isEmpty, true);
    assert.equal(data.draftsCreated, 0);
    assert.deepEqual(data.verticalOutcomes, []);
    assert.equal(data.lookAhead.needsInput.length, 0);
  });
});
