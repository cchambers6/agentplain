/**
 * tests/measurement-value-impact.test.ts
 *
 * Unit tests for lib/measurement/value-impact.ts.
 *
 * Test coverage:
 *   1. Empty workspace → all zeros, approvalsActioned = 0.
 *   2. Single APPROVED item → correct hours + dollars computed.
 *   3. Mixed approvals → only APPROVED/AUTO_APPROVED earn hours;
 *      REJECTED counts toward approvalsActioned only.
 *   4. Multiple kinds → per-kind aggregation is correct.
 *   5. Token cost flows through from LlmUsageRecord aggregate.
 *   6. Net value = dollarsInfluenced − tokenCostUsd.
 *   7. Assumptions are always surfaced and carry the right periodDays.
 *
 * Pattern: follows `tests/billing-pricing.test.ts` — node:test + stub Prisma
 * client (FakeTx) that returns canned query results.
 *
 * Per `feedback_cold_start_safe_agents.md`: every test injects `now` so
 * results are deterministic and never depend on wall-clock time.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeWorkspaceValueLedger,
  MINUTES_SAVED_BY_KIND,
  LABOR_RATE_USD_PER_HOUR_BY_KIND,
} from '@/lib/measurement/value-impact';
import type { WorkApprovalKind } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// ── Fake Prisma transaction client ────────────────────────────────────────────
//
// We need to stub three queries:
//   1. tx.workApprovalQueueItem.findMany (accepted rows)
//   2. tx.workApprovalQueueItem.count    (actioned count)
//   3. tx.llmUsageRecord.aggregate       (cost + tokens, called by
//      getWorkspaceUsageReport)
//
// We also need stubs for the other queries `getWorkspaceUsageReport` fires
// (today window, last30d window, surface groupBy). All the non-period windows
// return zeros — we only care about the period window for these tests.

interface FakeApprovalRow {
  kind: WorkApprovalKind;
}

function makeUsageAgg(costMicroCents: bigint) {
  return {
    _sum: {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      costMicroCents,
    },
    _count: { _all: costMicroCents === 0n ? 0 : 1 },
  };
}

const ZERO_AGG = makeUsageAgg(0n);

function makeFakeTx(opts: {
  acceptedRows: FakeApprovalRow[];
  actionedCount: number;
  costMicroCents: bigint;
}): Prisma.TransactionClient {
  let approvalQueryCount = 0;

  return {
    workApprovalQueueItem: {
      findMany: async (_args: unknown) => {
        // First call = accepted items (APPROVED + AUTO_APPROVED).
        approvalQueryCount += 1;
        return opts.acceptedRows;
      },
      count: async (_args: unknown) => {
        return opts.actionedCount;
      },
    },
    llmUsageRecord: {
      // getWorkspaceUsageReport fires: today, period, last30d (aggregate each)
      // + groupBy for surface breakdown. We return cost on every aggregate call
      // so they're all non-trivially handled.
      aggregate: async (_args: unknown) => {
        return makeUsageAgg(opts.costMicroCents);
      },
      groupBy: async (_args: unknown) => {
        return [];
      },
    },
  } as unknown as Prisma.TransactionClient;
}

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const FIXED_NOW = new Date('2026-06-08T00:00:00.000Z');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeWorkspaceValueLedger — empty workspace', () => {
  it('returns all zeros when there are no approvals or usage', async () => {
    const tx = makeFakeTx({
      acceptedRows: [],
      actionedCount: 0,
      costMicroCents: 0n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 30,
      now: FIXED_NOW,
    });

    assert.equal(ledger.hoursSaved, 0);
    assert.equal(ledger.dollarsInfluenced, 0);
    assert.equal(ledger.approvalsActioned, 0);
    assert.equal(ledger.tokenCostUsd, 0);
    assert.equal(ledger.netValueUsd, 0);
    assert.deepEqual(ledger.byKind, {});
  });

  it('surfaces assumptions even when all numbers are zero', async () => {
    const tx = makeFakeTx({
      acceptedRows: [],
      actionedCount: 0,
      costMicroCents: 0n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 7,
      now: FIXED_NOW,
    });

    assert.equal(ledger.assumptions.periodDays, 7);
    assert.equal(
      typeof ledger.assumptions.dollarsInfluencedFormula,
      'string',
    );
    assert.ok(ledger.assumptions.dollarsInfluencedFormula.length > 0);
    assert.equal(ledger.assumptions.computedAt, FIXED_NOW.toISOString());
  });
});

describe('computeWorkspaceValueLedger — single APPROVED item', () => {
  it('computes correct hours and dollars for one INBOX_TRIAGE approval', async () => {
    const kind: WorkApprovalKind = 'INBOX_TRIAGE';
    const tx = makeFakeTx({
      acceptedRows: [{ kind }],
      actionedCount: 1,
      costMicroCents: 0n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 30,
      now: FIXED_NOW,
    });

    const expectedMinutes = MINUTES_SAVED_BY_KIND[kind]; // 8
    const expectedHours = expectedMinutes / 60;
    const expectedRate = LABOR_RATE_USD_PER_HOUR_BY_KIND[kind]; // 45
    const expectedDollars = expectedHours * expectedRate;

    assert.equal(ledger.approvalsActioned, 1);
    // hoursSaved is rounded to 2 decimal places; compare with 0.01 tolerance
    assert.ok(Math.abs(ledger.hoursSaved - expectedHours) < 0.01,
      `hoursSaved mismatch: got ${ledger.hoursSaved}, expected ~${expectedHours}`);
    assert.ok(Math.abs(ledger.dollarsInfluenced - expectedDollars) < 0.05,
      `dollarsInfluenced mismatch: got ${ledger.dollarsInfluenced}, expected ~${expectedDollars}`);
    assert.ok(ledger.byKind[kind], 'byKind should have INBOX_TRIAGE entry');
    assert.equal(ledger.byKind[kind]!.count, 1);
  });
});

describe('computeWorkspaceValueLedger — mixed approvals', () => {
  it('only accepted statuses earn hours; rejected items count toward actioned only', async () => {
    // We model "rejected" by having the actioned count be higher than accepted.
    // The acceptedRows represent APPROVED+AUTO_APPROVED (what findMany returns).
    const tx = makeFakeTx({
      acceptedRows: [
        { kind: 'INBOX_TRIAGE' },
        { kind: 'FOLLOW_UP_NUDGE' },
      ],
      // 3 actioned = 2 accepted + 1 rejected
      actionedCount: 3,
      costMicroCents: 0n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 30,
      now: FIXED_NOW,
    });

    assert.equal(ledger.approvalsActioned, 3);
    // Only 2 items earned hours
    const expectedHours =
      MINUTES_SAVED_BY_KIND['INBOX_TRIAGE'] / 60 +
      MINUTES_SAVED_BY_KIND['FOLLOW_UP_NUDGE'] / 60;
    // hoursSaved is rounded to 2 decimal places; use 0.01 tolerance
    assert.ok(
      Math.abs(ledger.hoursSaved - expectedHours) < 0.01,
      `hoursSaved should only include accepted items; got ${ledger.hoursSaved}, expected ~${expectedHours}`,
    );
    // byKind should have entries only for the 2 accepted kinds
    assert.ok(ledger.byKind['INBOX_TRIAGE'], 'INBOX_TRIAGE should be in byKind');
    assert.ok(ledger.byKind['FOLLOW_UP_NUDGE'], 'FOLLOW_UP_NUDGE should be in byKind');
  });
});

describe('computeWorkspaceValueLedger — multiple items of same kind', () => {
  it('aggregates count, hours, dollars correctly for repeated kinds', async () => {
    const kind: WorkApprovalKind = 'LEAD_TRIAGE';
    const tx = makeFakeTx({
      acceptedRows: [
        { kind },
        { kind },
        { kind },
      ],
      actionedCount: 3,
      costMicroCents: 0n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 30,
      now: FIXED_NOW,
    });

    const row = ledger.byKind[kind];
    assert.ok(row, 'should have LEAD_TRIAGE entry');
    assert.equal(row.count, 3);
    const expectedHours = (MINUTES_SAVED_BY_KIND[kind] / 60) * 3;
    assert.ok(
      Math.abs(row.hours - expectedHours) < 0.001,
      `hours should be 3× the per-item rate`,
    );
    const expectedDollars = expectedHours * LABOR_RATE_USD_PER_HOUR_BY_KIND[kind];
    assert.ok(
      Math.abs(row.dollars - expectedDollars) < 0.01,
      `dollars should be hours × rate`,
    );
  });
});

describe('computeWorkspaceValueLedger — token cost and net value', () => {
  it('tokenCostUsd is costMicroCents ÷ 100_000_000', async () => {
    // $1.50 = 150_000_000 micro-cents
    const tx = makeFakeTx({
      acceptedRows: [],
      actionedCount: 0,
      costMicroCents: 150_000_000n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 30,
      now: FIXED_NOW,
    });

    // getWorkspaceUsageReport sums period window — our fake returns same value for all windows.
    // The period sum is what we use; 150_000_000 / 100_000_000 = 1.5
    assert.equal(ledger.tokenCostUsd, 1.5);
  });

  it('netValueUsd = dollarsInfluenced − tokenCostUsd', async () => {
    const kind: WorkApprovalKind = 'PROCESS_DOC_DRAFT';
    // 25 min × $55/hr = 25/60 × 55 ≈ $22.92 per item
    const tx = makeFakeTx({
      acceptedRows: [{ kind }, { kind }],
      actionedCount: 2,
      // $5.00 token cost = 500_000_000 micro-cents
      costMicroCents: 500_000_000n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 30,
      now: FIXED_NOW,
    });

    const expectedNet = ledger.dollarsInfluenced - ledger.tokenCostUsd;
    assert.ok(
      Math.abs(ledger.netValueUsd - expectedNet) < 0.01,
      `netValueUsd should equal dollarsInfluenced − tokenCostUsd`,
    );
  });

  it('netValueUsd can be negative when cost exceeds modeled savings', async () => {
    // Zero accepted approvals, but high token cost
    const tx = makeFakeTx({
      acceptedRows: [],
      actionedCount: 0,
      costMicroCents: 1_000_000_000n, // $10
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 30,
      now: FIXED_NOW,
    });

    assert.equal(ledger.dollarsInfluenced, 0);
    assert.ok(ledger.tokenCostUsd > 0, 'tokenCostUsd should be positive');
    assert.ok(ledger.netValueUsd < 0, 'netValueUsd should be negative when cost > savings');
  });
});

describe('computeWorkspaceValueLedger — assumptions manifest', () => {
  it('assumptions carries all required fields', async () => {
    const tx = makeFakeTx({
      acceptedRows: [],
      actionedCount: 0,
      costMicroCents: 0n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      periodDays: 14,
      now: FIXED_NOW,
    });

    const a = ledger.assumptions;
    assert.equal(a.periodDays, 14);
    assert.equal(typeof a.computedAt, 'string');
    assert.ok(a.computedAt.startsWith('2026-06-08'));
    assert.ok(typeof a.dollarsInfluencedFormula === 'string');
    assert.ok(typeof a.tokenCostFormula === 'string');
    assert.ok(typeof a.netValueFormula === 'string');
    assert.ok(typeof a.acceptedStatusesOnly === 'string');
    // The table snapshots should match the exported constants
    assert.deepEqual(
      a.minutesSavedByKind,
      MINUTES_SAVED_BY_KIND,
    );
    assert.deepEqual(
      a.laborRateByKind,
      LABOR_RATE_USD_PER_HOUR_BY_KIND,
    );
  });

  it('periodDays defaults to 30 when not supplied', async () => {
    const tx = makeFakeTx({
      acceptedRows: [],
      actionedCount: 0,
      costMicroCents: 0n,
    });

    const ledger = await computeWorkspaceValueLedger(tx, {
      workspaceId: WORKSPACE_ID,
      now: FIXED_NOW,
    });

    assert.equal(ledger.assumptions.periodDays, 30);
  });
});

describe('computeWorkspaceValueLedger — compliance kind uses $75/hr rate', () => {
  it('COMPLIANCE_FLAG earns more dollars per item than INBOX_TRIAGE', async () => {
    const makeOneTx = (kind: WorkApprovalKind) =>
      makeFakeTx({ acceptedRows: [{ kind }], actionedCount: 1, costMicroCents: 0n });

    const compliance = await computeWorkspaceValueLedger(makeOneTx('COMPLIANCE_FLAG'), {
      workspaceId: WORKSPACE_ID, periodDays: 30, now: FIXED_NOW,
    });
    const inbox = await computeWorkspaceValueLedger(makeOneTx('INBOX_TRIAGE'), {
      workspaceId: WORKSPACE_ID, periodDays: 30, now: FIXED_NOW,
    });

    assert.ok(
      compliance.dollarsInfluenced > inbox.dollarsInfluenced,
      'Compliance (20 min × $75/hr) should exceed inbox triage (8 min × $45/hr)',
    );
  });
});
