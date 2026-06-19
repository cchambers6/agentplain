/**
 * Tests for the saved-time ledger: idempotent recording, aggregation, and
 * the runtime outcome→action attribution.
 *
 * Uses an in-memory fake of the `timeSavingsEntry` Prisma delegate so the
 * dedupe + aggregation contracts are exercised without a database.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import type { SkillRunOutcome } from '../skills/types';
import {
  guaranteeActionForOutcome,
  readSavedTimeSummary,
  recordSavedTime,
} from './saved-time';

const WS = 'ws-1';

interface Row {
  workspaceId: string;
  actionType: string;
  verticalSlug: string;
  minutesSaved: number;
  sourceTable: string;
  sourceId: string;
  occurredAt: Date;
}

function fakeLedger() {
  const rows: Row[] = [];
  const keyOf = (r: Row) =>
    `${r.workspaceId}|${r.sourceTable}|${r.sourceId}|${r.actionType}`;
  const client = {
    timeSavingsEntry: {
      createMany: async (args: { data: Row[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const d of args.data) {
          if (args.skipDuplicates && rows.some((r) => keyOf(r) === keyOf(d))) {
            continue;
          }
          rows.push({ ...d });
          count += 1;
        }
        return { count };
      },
      aggregate: async (args: {
        where: { workspaceId: string; occurredAt?: { gte: Date } };
      }) => {
        let sel = rows.filter((r) => r.workspaceId === args.where.workspaceId);
        const gte = args.where.occurredAt?.gte;
        if (gte) sel = sel.filter((r) => r.occurredAt >= gte);
        const sum = sel.reduce((a, r) => a + r.minutesSaved, 0);
        return {
          _sum: { minutesSaved: sel.length ? sum : null },
          _count: { _all: sel.length },
        };
      },
      groupBy: async (args: { where: { workspaceId: string } }) => {
        const sel = rows.filter((r) => r.workspaceId === args.where.workspaceId);
        const byType = new Map<string, { minutes: number; count: number }>();
        for (const r of sel) {
          const cur = byType.get(r.actionType) ?? { minutes: 0, count: 0 };
          cur.minutes += r.minutesSaved;
          cur.count += 1;
          byType.set(r.actionType, cur);
        }
        return [...byType.entries()].map(([actionType, v]) => ({
          actionType,
          _sum: { minutesSaved: v.minutes },
          _count: { _all: v.count },
        }));
      },
    },
  };
  return { rows, client: client as unknown as Prisma.TransactionClient };
}

describe('recordSavedTime', () => {
  it('records distinct sources and credits calibrated minutes', async () => {
    const { rows, client } = fakeLedger();
    const a = await recordSavedTime({
      workspaceId: WS,
      actionType: 'drafted-email',
      verticalSlug: 'real-estate',
      source: { table: 'WebhookEvent', id: 'evt-1' },
      client,
    });
    const b = await recordSavedTime({
      workspaceId: WS,
      actionType: 'meeting-scheduled',
      verticalSlug: 'real-estate',
      source: { table: 'WebhookEvent', id: 'evt-2' },
      client,
    });
    assert.equal(a.recorded, true);
    assert.equal(a.minutesSaved, 10);
    assert.equal(b.recorded, true);
    assert.equal(b.minutesSaved, 8);
    assert.equal(rows.length, 2);
  });

  it('is idempotent — a duplicate (source, action) is a no-op', async () => {
    const { rows, client } = fakeLedger();
    const first = await recordSavedTime({
      workspaceId: WS,
      actionType: 'drafted-email',
      verticalSlug: 'real-estate',
      source: { table: 'WebhookEvent', id: 'evt-1' },
      client,
    });
    const second = await recordSavedTime({
      workspaceId: WS,
      actionType: 'drafted-email',
      verticalSlug: 'real-estate',
      source: { table: 'WebhookEvent', id: 'evt-1' },
      client,
    });
    assert.equal(first.recorded, true);
    assert.equal(second.recorded, false);
    assert.equal(rows.length, 1, 'counter must not double-count a re-fire');
  });
});

describe('readSavedTimeSummary', () => {
  it('sums all-time + trailing-week and breaks down by action', async () => {
    const now = new Date('2026-06-17T12:00:00Z');
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600_000);
    const { client } = fakeLedger();
    // Recent: 10 (draft) + 8 (meeting) within the week.
    await recordSavedTime({
      workspaceId: WS,
      actionType: 'drafted-email',
      verticalSlug: 'real-estate',
      source: { table: 'WebhookEvent', id: 'e1' },
      client,
      now,
    });
    await recordSavedTime({
      workspaceId: WS,
      actionType: 'meeting-scheduled',
      verticalSlug: 'real-estate',
      source: { table: 'WebhookEvent', id: 'e2' },
      client,
      now,
    });
    // Old: 10 (draft) outside the week.
    await recordSavedTime({
      workspaceId: WS,
      actionType: 'drafted-email',
      verticalSlug: 'real-estate',
      source: { table: 'WebhookEvent', id: 'e3' },
      client,
      now: tenDaysAgo,
    });

    const summary = await readSavedTimeSummary(client, WS, now);
    assert.equal(summary.totalMinutes, 28);
    assert.equal(summary.weekMinutes, 18);
    assert.equal(summary.totalActions, 3);
    const draft = summary.byAction.find((a) => a.actionType === 'drafted-email');
    assert.equal(draft?.minutes, 20);
    assert.equal(draft?.count, 2);
  });

  it('returns zeros for a workspace with no entries', async () => {
    const { client } = fakeLedger();
    const summary = await readSavedTimeSummary(client, 'empty-ws');
    assert.equal(summary.totalMinutes, 0);
    assert.equal(summary.weekMinutes, 0);
    assert.equal(summary.totalActions, 0);
    assert.deepEqual(summary.byAction, []);
  });
});

describe('guaranteeActionForOutcome', () => {
  const base: SkillRunOutcome = {
    category: 'noise',
    threadId: null,
    scheduledProposal: null,
    draft: null,
    markedProcessed: false,
    officeAdmin: null,
    officeAdminPayload: null,
    complianceFlags: null,
  };

  it('credits office-admin work', () => {
    const outcome = {
      ...base,
      officeAdminPayload: { category: 'verification', confidence: 0.9 },
    } as unknown as SkillRunOutcome;
    assert.equal(guaranteeActionForOutcome(outcome), 'admin-task-handled');
  });

  it('credits a scheduling proposal as a meeting scheduled', () => {
    const outcome = {
      ...base,
      category: 'scheduling-needed',
      scheduledProposal: {
        needsResponse: true,
        proposedSlots: [],
        reasoning: '',
        confidence: 0.8,
      },
    } as unknown as SkillRunOutcome;
    assert.equal(guaranteeActionForOutcome(outcome), 'meeting-scheduled');
  });

  it('credits a reply draft as a drafted email', () => {
    const outcome = {
      ...base,
      category: 'draft-needed',
      draft: {
        draftId: 'd1',
        providerDraftId: null,
        subject: 's',
        body: 'b',
        tone: 'formal',
        confidence: 0.9,
        persisted: true,
      },
    } as unknown as SkillRunOutcome;
    assert.equal(guaranteeActionForOutcome(outcome), 'drafted-email');
  });

  it('credits nothing for noise', () => {
    assert.equal(guaranteeActionForOutcome(base), null);
  });
});
