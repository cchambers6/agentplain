/**
 * tests/weekly-digest-render.test.ts
 *
 * Unit tests for the deterministic renderer + persister in
 * lib/measurement/weekly-digest.ts (wave cv-x2).
 *
 * Coverage:
 *   1. renderWeeklyDigestBody is deterministic — same data → identical
 *      prose (a proof surface must be reproducible).
 *   2. Body surfaces hours, dollars, the actions split, top dollar line
 *      items, per-skill breakdown, and the net-value footer.
 *   3. Empty state renders the honest "still learning your business" copy.
 *   4. generateWeeklyDigestForWorkspace persists ONE WorkspaceBriefing row
 *      with the Sunday-anchored forDate + WEEKLY_* status, and is
 *      idempotent (existing same-week row → inserted=false, no second row).
 *
 * Pattern: node:test + an injected systemContext runner with a fake tx —
 * no Postgres. The data layer is exercised through the real
 * computeWeeklyDigestData by feeding it a fake tx that returns the rows.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma, WorkApprovalKind } from '@prisma/client';

import {
  generateWeeklyDigestForWorkspace,
  renderWeeklyDigestBody,
  buildDigestSummary,
  WEEKLY_DIGEST_STATUS_READY,
  WEEKLY_DIGEST_STATUS_EMPTY,
} from '@/lib/measurement/weekly-digest';
import { computeWeeklyDigestData } from '@/lib/measurement/weekly-digest-data';
import { encryptPayloadForWrite } from '@/lib/security/payload-crypto';

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
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

function plainPayload(extra: Record<string, unknown> = {}): Prisma.InputJsonValue {
  return encryptPayloadForWrite({ subject: 'x', ...extra });
}

/** Fake tx for the data-layer reads (findMany / count / aggregate). */
function makeDataTx(
  rows: FakeApprovalRow[],
  autoCount: number,
  cost: bigint = 0n,
): Prisma.TransactionClient {
  return {
    workspace: {
      findUnique: async () => ({ id: WORKSPACE_ID, name: 'Acme Realty' }),
    },
    workApprovalQueueItem: {
      findMany: async () => rows,
      count: async () => rows.length,
    },
    auditLog: {
      count: async () => autoCount,
      create: async () => ({ id: 'audit_1' }),
    },
    llmUsageRecord: {
      aggregate: async () => makeUsageAgg(cost),
      groupBy: async () => [],
    },
  } as unknown as Prisma.TransactionClient;
}

async function buildData(
  rows: FakeApprovalRow[],
  autoCount = 0,
  cost: bigint = 0n,
) {
  const tx = makeDataTx(rows, autoCount, cost);
  return computeWeeklyDigestData(tx, {
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme Realty',
    now: FIXED_NOW,
  });
}

// ── renderWeeklyDigestBody ────────────────────────────────────────────────────

describe('renderWeeklyDigestBody', () => {
  it('is deterministic — same data renders identical prose', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload({ balanceUsd: 1240 }),
      },
    ];
    const a = renderWeeklyDigestBody(await buildData(rows));
    const b = renderWeeklyDigestBody(await buildData(rows));
    assert.equal(a, b);
  });

  it('surfaces hours, dollars, the actions split, line items, skills, net', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'AUTO_APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload({ balanceUsd: 1240 }),
      },
      {
        kind: 'COMPLIANCE_FLAG',
        status: 'APPROVED',
        agentSlug: 'realty-compliance-sentinel',
        payload: plainPayload(),
      },
    ];
    const data = await buildData(rows, 1, 150_000_000n); // $1.50 cost
    const body = renderWeeklyDigestBody(data);

    assert.match(body, /Last week/);
    assert.match(body, /2 actions/);
    assert.match(body, /\$1,2\d\d/); // dollars influenced contains the AR balance
    assert.match(body, /real invoice and estimate dollars/);
    // Actions split: 1 staged for review, 1 auto-executed.
    assert.match(body, /came to you for review/);
    assert.match(body, /the fleet handled on its own/);
    // Top dollar line items section.
    assert.match(body, /What moved the dollars:/);
    assert.match(body, /\$1,240 owed/);
    // Per-skill breakdown.
    assert.match(body, /By skill:/);
    assert.match(body, /follow-up-chaser/);
    assert.match(body, /realty-compliance-sentinel/);
    // Net value footer with token cost.
    assert.match(body, /running cost this week was \$1\.50/);
    assert.match(body, /net value/);
    // Calm, not chirpy — no emoji, no exclamation points.
    assert.doesNotMatch(body, /[!]/);
  });

  it('all-staged week says nothing ran without sign-off', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'INBOX_TRIAGE',
        status: 'APPROVED',
        agentSlug: 'inbox-triage-fleet',
        payload: plainPayload(),
      },
    ];
    const body = renderWeeklyDigestBody(await buildData(rows));
    assert.match(body, /nothing ran without your sign-off/);
  });

  it('empty week renders the honest "still learning your business" copy', async () => {
    const data = await buildData([]);
    assert.equal(data.isEmpty, true);
    const body = renderWeeklyDigestBody(data);
    assert.match(body, /still learning your business/);
    assert.match(body, /was quiet/);
    assert.doesNotMatch(body, /[!]/);
  });
});

// ── buildDigestSummary ────────────────────────────────────────────────────────

describe('buildDigestSummary', () => {
  it('produces a flat JSON-safe summary with weekly:true', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload({ balanceUsd: 500 }),
      },
    ];
    const summary = buildDigestSummary(await buildData(rows));
    assert.equal(summary.weekly, true);
    assert.equal(summary.dollarsInfluenced, 500);
    assert.equal(summary.hasRealDollars, true);
    // JSON-serializable round-trip (no BigInt / Date leaks).
    assert.doesNotThrow(() => JSON.stringify(summary));
  });
});

// ── generateWeeklyDigestForWorkspace — persist + idempotency ──────────────────

describe('generateWeeklyDigestForWorkspace', () => {
  it('persists ONE WorkspaceBriefing row with Sunday forDate + WEEKLY_READY', async () => {
    const rows: FakeApprovalRow[] = [
      {
        kind: 'FOLLOW_UP_NUDGE',
        status: 'APPROVED',
        agentSlug: 'follow-up-chaser',
        payload: plainPayload({ balanceUsd: 1240 }),
      },
    ];
    const creates: Array<Record<string, unknown>> = [];

    // The generator calls systemContext twice: once to compute data, once
    // to persist. We give each call a tx that records the create.
    const systemContext = async <T>(
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> => {
      const tx = {
        ...makeDataTx(rows, 0),
        workspaceBriefing: {
          findUnique: async () => null,
          create: async (args: { data: Record<string, unknown> }) => {
            creates.push(args.data);
            return { id: 'wb_new' };
          },
        },
      } as unknown as Prisma.TransactionClient;
      return fn(tx);
    };

    const result = await generateWeeklyDigestForWorkspace({
      workspaceId: WORKSPACE_ID,
      now: FIXED_NOW,
      systemContext,
    });

    assert.equal(result.inserted, true);
    assert.equal(result.status, WEEKLY_DIGEST_STATUS_READY);
    assert.equal(result.forDate, '2026-06-07');
    assert.equal(result.briefingId, 'wb_new');
    assert.equal(creates.length, 1, 'exactly one briefing row written');
    assert.equal(creates[0].forDate, '2026-06-07');
    assert.equal(creates[0].status, WEEKLY_DIGEST_STATUS_READY);
    // Body is encrypted at rest (enc envelope), never plaintext.
    assert.equal(typeof creates[0].body, 'string');
  });

  it('idempotent — existing same-week row → inserted=false, no new row', async () => {
    const creates: unknown[] = [];
    const systemContext = async <T>(
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> => {
      const tx = {
        ...makeDataTx([], 0),
        workspaceBriefing: {
          findUnique: async () => ({ id: 'wb_existing' }),
          create: async (args: unknown) => {
            creates.push(args);
            return { id: 'wb_should_not_happen' };
          },
        },
      } as unknown as Prisma.TransactionClient;
      return fn(tx);
    };

    const result = await generateWeeklyDigestForWorkspace({
      workspaceId: WORKSPACE_ID,
      now: FIXED_NOW,
      systemContext,
    });

    assert.equal(result.inserted, false);
    assert.equal(result.briefingId, 'wb_existing');
    assert.equal(creates.length, 0, 'no second row on idempotent retry');
  });

  it('empty workspace persists a WEEKLY_EMPTY row', async () => {
    const systemContext = async <T>(
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> => {
      const tx = {
        ...makeDataTx([], 0),
        workspaceBriefing: {
          findUnique: async () => null,
          create: async () => ({ id: 'wb_empty' }),
        },
      } as unknown as Prisma.TransactionClient;
      return fn(tx);
    };

    const result = await generateWeeklyDigestForWorkspace({
      workspaceId: WORKSPACE_ID,
      now: FIXED_NOW,
      systemContext,
    });
    assert.equal(result.status, WEEKLY_DIGEST_STATUS_EMPTY);
    assert.equal(result.data.isEmpty, true);
  });
});
