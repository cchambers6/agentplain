/**
 * tests/weekly-digest-data.test.ts
 *
 * Unit tests for lib/measurement/weekly-digest-data.ts — the data layer
 * behind the weekly proof-of-value digest (wave cv-x2).
 *
 * Coverage:
 *   1. Empty workspace → isEmpty=true, all zeros, honest empty data.
 *   2. Accepted approvals → hours/dollars/actions computed; ledger hours
 *      flow through.
 *   3. Real-dollar seam: a payload carrying `balanceUsd` overrides the
 *      time-based estimate AND is flagged real; `estimateAmountUsd` too.
 *   4. Tolerant fallback: missing/garbage dollar field → time-based
 *      estimate, real=false.
 *   5. Auto-execute split: AUTO_APPROVED rows + AuditLog count drive
 *      actionsAutoExecuted; the rest are actionsStaged.
 *   6. Per-skill breakdown aggregates by agentSlug.
 *   7. Top-3 dollar line items, descending, real-amounts surfaced.
 *   8. resolveReportedWeek returns a Sunday-anchored forDate that can
 *      never collide with a Mon–Fri daily briefing.
 *
 * Pattern mirrors tests/measurement-value-impact.test.ts: node:test + a
 * hand-rolled fake Prisma TransactionClient. Payloads are written through
 * the REAL payload-crypto encrypt seam so the decrypt path is exercised.
 *
 * Per feedback_cold_start_safe_agents.md: every test injects `now`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma, WorkApprovalKind } from '@prisma/client';

import {
  computeWeeklyDigestData,
  resolveReportedWeek,
  extractRealDollars,
} from '@/lib/measurement/weekly-digest-data';
import { encryptPayloadForWrite } from '@/lib/security/payload-crypto';
import {
  LABOR_RATE_USD_PER_HOUR_BY_KIND,
  MINUTES_SAVED_BY_KIND,
} from '@/lib/measurement/value-impact';

// Ensure an encryption key exists so encrypt/decrypt round-trips in-test.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
// A Wednesday — resolveReportedWeek reports the PRIOR completed week.
const FIXED_NOW = new Date('2026-06-10T12:00:00.000Z');

interface FakeApprovalRow {
  kind: WorkApprovalKind;
  status: 'APPROVED' | 'AUTO_APPROVED';
  agentSlug: string;
  payload: Prisma.InputJsonValue;
}

function makeUsageAgg(costMicroCents: bigint) {
  return {
    _sum: {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      costMicroCents,
    },
    _count: { _all: costMicroCents === 0n ? 0 : 1 },
  };
}

function makeFakeTx(opts: {
  acceptedRows: FakeApprovalRow[];
  autoExecutedAuditCount: number;
  costMicroCents?: bigint;
}): Prisma.TransactionClient {
  const cost = opts.costMicroCents ?? 0n;
  return {
    workApprovalQueueItem: {
      // computeWeeklyDigestData calls findMany once for accepted rows; the
      // ledger seam (computeWorkspaceValueLedger) also calls findMany once
      // (select kind only) + count once. We return the same accepted rows
      // for both findMany calls — the ledger only reads `.kind`.
      findMany: async (_args: unknown) => opts.acceptedRows,
      count: async (_args: unknown) => opts.acceptedRows.length,
    },
    auditLog: {
      count: async (_args: unknown) => opts.autoExecutedAuditCount,
    },
    llmUsageRecord: {
      aggregate: async (_args: unknown) => makeUsageAgg(cost),
      groupBy: async (_args: unknown) => [],
    },
  } as unknown as Prisma.TransactionClient;
}

function plainPayload(extra: Record<string, unknown> = {}): Prisma.InputJsonValue {
  return encryptPayloadForWrite({ subject: 'x', ...extra });
}

// ── resolveReportedWeek ───────────────────────────────────────────────────────

describe('resolveReportedWeek', () => {
  it('reports the prior completed Mon–Sun week, Sunday-anchored forDate', () => {
    // FIXED_NOW = Wed 2026-06-10. This week's Monday = 2026-06-08. The
    // reported (prior) week = 2026-06-01 (Mon) .. 2026-06-08 (excl).
    const w = resolveReportedWeek(FIXED_NOW);
    assert.equal(w.weekStart.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(w.weekEnd.toISOString(), '2026-06-08T00:00:00.000Z');
    // Sunday anchor = weekEnd − 1 day = 2026-06-07 (a Sunday).
    assert.equal(w.forDate, '2026-06-07');
    // The anchor day-of-week must be Sunday (0) so it can never collide
    // with a Mon–Fri daily briefing's forDate.
    assert.equal(new Date(`${w.forDate}T00:00:00.000Z`).getUTCDay(), 0);
  });

  it('a Monday `now` still reports the week that just ended', () => {
    const monday = new Date('2026-06-08T12:00:00.000Z');
    const w = resolveReportedWeek(monday);
    assert.equal(w.weekStart.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(w.weekEnd.toISOString(), '2026-06-08T00:00:00.000Z');
    assert.equal(w.forDate, '2026-06-07');
  });
});

// ── extractRealDollars ────────────────────────────────────────────────────────

describe('extractRealDollars', () => {
  it('reads balanceUsd off an encrypted payload', () => {
    const got = extractRealDollars(plainPayload({ balanceUsd: 1240 }));
    assert.deepEqual(got, { amount: 1240, field: 'balanceUsd' });
  });

  it('reads estimateAmountUsd when balanceUsd absent', () => {
    const got = extractRealDollars(plainPayload({ estimateAmountUsd: 5000 }));
    assert.deepEqual(got, { amount: 5000, field: 'estimateAmountUsd' });
  });

  it('prefers balanceUsd over estimateAmountUsd', () => {
    const got = extractRealDollars(
      plainPayload({ balanceUsd: 100, estimateAmountUsd: 999 }),
    );
    assert.equal(got?.field, 'balanceUsd');
    assert.equal(got?.amount, 100);
  });

  it('tolerant: missing fields → null', () => {
    assert.equal(extractRealDollars(plainPayload({})), null);
  });

  it('tolerant: non-numeric / non-positive → null', () => {
    assert.equal(extractRealDollars(plainPayload({ balanceUsd: 'oops' })), null);
    assert.equal(extractRealDollars(plainPayload({ balanceUsd: 0 })), null);
    assert.equal(extractRealDollars(plainPayload({ balanceUsd: -5 })), null);
  });
});

// ── computeWeeklyDigestData ───────────────────────────────────────────────────

describe('computeWeeklyDigestData — empty workspace', () => {
  it('isEmpty=true and all proof numbers zero', async () => {
    const tx = makeFakeTx({ acceptedRows: [], autoExecutedAuditCount: 0 });
    const data = await computeWeeklyDigestData(tx, {
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Quiet Co',
      now: FIXED_NOW,
    });
    assert.equal(data.isEmpty, true);
    assert.equal(data.actionsTaken, 0);
    assert.equal(data.hoursSaved, 0);
    assert.equal(data.dollarsInfluenced, 0);
    assert.equal(data.hasRealDollars, false);
    assert.deepEqual(data.topDollarLineItems, []);
    assert.deepEqual(data.bySkill, []);
    assert.equal(data.forDate, '2026-06-07');
  });
});

describe('computeWeeklyDigestData — accepted approvals', () => {
  it('computes hours, dollars, actions; ledger hours flow through', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'INBOX_TRIAGE',
        status: 'APPROVED',
        agentSlug: 'inbox-triage-fleet',
        payload: plainPayload(),
      },
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload(),
      },
    ];
    const tx = makeFakeTx({ acceptedRows: rows, autoExecutedAuditCount: 0 });
    const data = await computeWeeklyDigestData(tx, {
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Acme',
      now: FIXED_NOW,
    });

    assert.equal(data.isEmpty, false);
    assert.equal(data.actionsTaken, 2);
    assert.equal(data.actionsStaged, 2);
    assert.equal(data.actionsAutoExecuted, 0);
    // Ledger hours = sum of the two kinds' minutes/60.
    const expectedHours =
      MINUTES_SAVED_BY_KIND['INBOX_TRIAGE'] / 60 +
      MINUTES_SAVED_BY_KIND['FOLLOW_UP_NUDGE'] / 60;
    assert.ok(Math.abs(data.hoursSaved - expectedHours) < 0.01);
    // No real dollars → time-based estimate.
    assert.equal(data.hasRealDollars, false);
    const expectedDollars =
      (MINUTES_SAVED_BY_KIND['INBOX_TRIAGE'] / 60) *
        LABOR_RATE_USD_PER_HOUR_BY_KIND['INBOX_TRIAGE'] +
      (MINUTES_SAVED_BY_KIND['FOLLOW_UP_NUDGE'] / 60) *
        LABOR_RATE_USD_PER_HOUR_BY_KIND['FOLLOW_UP_NUDGE'];
    assert.ok(Math.abs(data.dollarsInfluenced - expectedDollars) < 0.05);
  });
});

describe('computeWeeklyDigestData — real-dollar seam', () => {
  it('balanceUsd payload overrides the time-based estimate and flags real', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload({ balanceUsd: 1240 }),
      },
    ];
    const tx = makeFakeTx({ acceptedRows: rows, autoExecutedAuditCount: 0 });
    const data = await computeWeeklyDigestData(tx, {
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Acme',
      now: FIXED_NOW,
    });

    assert.equal(data.hasRealDollars, true);
    // The real AR balance dominates the time-based ~$3.75 estimate.
    assert.equal(data.dollarsInfluenced, 1240);
    assert.equal(data.topDollarLineItems[0].real, true);
    assert.equal(data.topDollarLineItems[0].realField, 'balanceUsd');
    assert.equal(data.topDollarLineItems[0].dollars, 1240);
    assert.match(data.topDollarLineItems[0].label, /\$1,240 owed/);
  });

  it('estimateAmountUsd is read and labeled "quoted"', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload({ estimateAmountUsd: 5000 }),
      },
    ];
    const tx = makeFakeTx({ acceptedRows: rows, autoExecutedAuditCount: 0 });
    const data = await computeWeeklyDigestData(tx, {
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Acme',
      now: FIXED_NOW,
    });
    assert.equal(data.dollarsInfluenced, 5000);
    assert.equal(data.topDollarLineItems[0].realField, 'estimateAmountUsd');
    assert.match(data.topDollarLineItems[0].label, /\$5,000 quoted/);
  });
});

describe('computeWeeklyDigestData — auto-execute split', () => {
  it('AUTO_APPROVED rows + audit count drive actionsAutoExecuted', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'INBOX_TRIAGE',
        status: 'AUTO_APPROVED',
        agentSlug: 'inbox-triage-fleet',
        payload: plainPayload(),
      },
      {
        kind: 'INBOX_TRIAGE',
        status: 'AUTO_APPROVED',
        agentSlug: 'inbox-triage-fleet',
        payload: plainPayload(),
      },
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload(),
      },
    ];
    // Audit log recorded 2 auto-executes this week.
    const tx = makeFakeTx({ acceptedRows: rows, autoExecutedAuditCount: 2 });
    const data = await computeWeeklyDigestData(tx, {
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Acme',
      now: FIXED_NOW,
    });

    assert.equal(data.actionsTaken, 3);
    assert.equal(data.actionsAutoExecuted, 2);
    assert.equal(data.actionsStaged, 1);
  });

  it('clamps auto-executed to the in-window AUTO_APPROVED count', async () => {
    // Audit count is higher than AUTO_APPROVED rows (older targets re-touched).
    const rows: FakeApprovalRow[] = [
      {
        kind: 'INBOX_TRIAGE',
        status: 'AUTO_APPROVED',
        agentSlug: 'inbox-triage-fleet',
        payload: plainPayload(),
      },
    ];
    const tx = makeFakeTx({ acceptedRows: rows, autoExecutedAuditCount: 99 });
    const data = await computeWeeklyDigestData(tx, {
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Acme',
      now: FIXED_NOW,
    });
    assert.equal(data.actionsAutoExecuted, 1, 'never claims more than accepted');
    assert.equal(data.actionsStaged, 0);
  });
});

describe('computeWeeklyDigestData — per-skill breakdown', () => {
  it('aggregates by agentSlug, sorted by dollars desc', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'COMPLIANCE_FLAG', // 20 min × $75 = $25
        status: 'APPROVED',
        agentSlug: 'realty-compliance-sentinel',
        payload: plainPayload(),
      },
      {
        kind: 'INBOX_TRIAGE', // 8 min × $45 = $6
        status: 'APPROVED',
        agentSlug: 'inbox-triage-fleet',
        payload: plainPayload(),
      },
      {
        kind: 'INBOX_TRIAGE',
        status: 'APPROVED',
        agentSlug: 'inbox-triage-fleet',
        payload: plainPayload(),
      },
    ];
    const tx = makeFakeTx({ acceptedRows: rows, autoExecutedAuditCount: 0 });
    const data = await computeWeeklyDigestData(tx, {
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Acme',
      now: FIXED_NOW,
    });

    assert.equal(data.bySkill.length, 2);
    // Compliance ($25) ranks above inbox-triage (2×$6=$12).
    assert.equal(data.bySkill[0].agentSlug, 'realty-compliance-sentinel');
    assert.equal(data.bySkill[0].actions, 1);
    assert.equal(data.bySkill[1].agentSlug, 'inbox-triage-fleet');
    assert.equal(data.bySkill[1].actions, 2);
  });
});

describe('computeWeeklyDigestData — net value', () => {
  it('netValueUsd = dollarsInfluenced − tokenCostUsd', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload({ balanceUsd: 1000 }),
      },
    ];
    // $2.50 token cost = 250_000_000 micro-cents.
    const tx = makeFakeTx({
      acceptedRows: rows,
      autoExecutedAuditCount: 0,
      costMicroCents: 250_000_000n,
    });
    const data = await computeWeeklyDigestData(tx, {
      workspaceId: WORKSPACE_ID,
      workspaceName: 'Acme',
      now: FIXED_NOW,
    });
    assert.equal(data.dollarsInfluenced, 1000);
    assert.equal(data.tokenCostUsd, 2.5);
    assert.equal(data.netValueUsd, 997.5);
  });
});
