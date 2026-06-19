/**
 * lib/team/performance.test.ts — pins the pure KPI math.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeMemberKpis,
  formatResponseMs,
  type DecidedItem,
  type KpiMember,
} from './performance';

const A = 'u-a';
const B = 'u-b';

const members: KpiMember[] = [
  { userId: A, label: 'Alice', role: 'OWNER' },
  { userId: B, label: 'Bob', role: 'MEMBER' },
];

function item(
  userId: string,
  status: DecidedItem['status'],
  proposedMs: number,
  decidedMs: number | null,
): DecidedItem {
  return {
    decidedByUserId: userId,
    proposedAt: new Date(proposedMs),
    decidedAt: decidedMs == null ? null : new Date(decidedMs),
    status,
  };
}

describe('computeMemberKpis', () => {
  it('counts tasks, averages response, computes approval proxy', () => {
    const items: DecidedItem[] = [
      item(A, 'APPROVED', 0, 60_000), // 1 min
      item(A, 'REJECTED', 0, 180_000), // 3 min
      item(B, 'APPROVED', 0, 120_000), // 2 min
    ];
    const rows = computeMemberKpis(items, members);
    const alice = rows.find((r) => r.userId === A)!;
    const bob = rows.find((r) => r.userId === B)!;

    assert.equal(alice.tasksCompleted, 2);
    assert.equal(alice.avgResponseMs, 120_000); // (1+3)/2 min
    assert.equal(alice.satisfactionProxy, 0.5); // 1 of 2 approved

    assert.equal(bob.tasksCompleted, 1);
    assert.equal(bob.satisfactionProxy, 1);
  });

  it('gives idle members a zero/null row', () => {
    const rows = computeMemberKpis([], members);
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.tasksCompleted, 0);
      assert.equal(r.avgResponseMs, null);
      assert.equal(r.satisfactionProxy, null);
    }
  });

  it('treats AUTO_APPROVED as positive and ignores negative skew', () => {
    const items: DecidedItem[] = [
      item(A, 'AUTO_APPROVED', 0, 60_000),
      // Clock-skew row: decided before proposed — excluded from avg.
      item(A, 'APPROVED', 100_000, 50_000),
    ];
    const rows = computeMemberKpis(items, members);
    const alice = rows.find((r) => r.userId === A)!;
    assert.equal(alice.tasksCompleted, 2);
    assert.equal(alice.avgResponseMs, 60_000); // only the valid timed row
    assert.equal(alice.satisfactionProxy, 1); // both positive
  });

  it('skips items with no decider', () => {
    const items: DecidedItem[] = [
      { decidedByUserId: null, proposedAt: new Date(0), decidedAt: new Date(1), status: 'APPROVED' },
    ];
    const rows = computeMemberKpis(items, members);
    assert.ok(rows.every((r) => r.tasksCompleted === 0));
  });
});

describe('formatResponseMs', () => {
  it('renders minutes, hours, days and a dash for null', () => {
    assert.equal(formatResponseMs(null), '—');
    assert.equal(formatResponseMs(120_000), '2m');
    assert.equal(formatResponseMs(2 * 60 * 60_000), '2h');
    assert.equal(formatResponseMs(72 * 60 * 60_000), '3d');
  });
});
