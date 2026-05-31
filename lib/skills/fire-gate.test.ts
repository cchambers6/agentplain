/**
 * lib/skills/fire-gate.test.ts
 *
 * Pins the customer-control gate. Uses an in-memory Prisma-shaped fake
 * (same pattern as skill-scorecard.test.ts) so the test is pure — no
 * DB. Covers pause + auto-resume + discipline-narrowed pause, window
 * skip in off-hours + fire in window, overnight windows, TZ projection
 * (America/New_York vs UTC, including DST), and the degenerate-window
 * corner.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { gateSkillFire, isHourInWindow, localHourAndDay } from './fire-gate';

const WORKSPACE_ID = 'ws-firegate-0001';
const SKILL_SLUG = 'invoice-chasing-realestate';
const DISCIPLINE = 'finance';

interface PauseRow {
  workspaceId: string;
  pausedFrom: Date;
  pausedUntil: Date;
  pausedDisciplineIds: string[];
}

interface WindowRow {
  workspaceId: string;
  skillSlug: string;
  daysOfWeek: number[];
  startHourLocal: number;
  endHourLocal: number;
  workspaceTimezone: string;
}

function fakeTx(args: {
  pauses?: PauseRow[];
  windows?: WindowRow[];
}) {
  const pauses = args.pauses ?? [];
  const windows = args.windows ?? [];
  return {
    workspacePauseConfig: {
      async findMany(q: {
        where: {
          workspaceId: string;
          pausedFrom: { lte: Date };
          pausedUntil: { gt: Date };
        };
      }) {
        return pauses.filter(
          (p) =>
            p.workspaceId === q.where.workspaceId &&
            p.pausedFrom <= q.where.pausedFrom.lte &&
            p.pausedUntil > q.where.pausedUntil.gt,
        );
      },
    },
    skillScheduleWindow: {
      async findUnique(q: {
        where: { workspaceId_skillSlug: { workspaceId: string; skillSlug: string } };
      }) {
        return (
          windows.find(
            (w) =>
              w.workspaceId === q.where.workspaceId_skillSlug.workspaceId &&
              w.skillSlug === q.where.workspaceId_skillSlug.skillSlug,
          ) ?? null
        );
      },
    },
  } as never;
}

describe('gateSkillFire — pause', () => {
  it('allows when no pause and no window is configured', async () => {
    const res = await gateSkillFire({
      tx: fakeTx({}),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: DISCIPLINE,
      now: new Date('2026-05-15T15:00:00Z'),
    });
    assert.equal(res.allowed, true);
  });

  it('denies when an all-disciplines pause is active', async () => {
    const res = await gateSkillFire({
      tx: fakeTx({
        pauses: [
          {
            workspaceId: WORKSPACE_ID,
            pausedFrom: new Date('2026-05-14T00:00:00Z'),
            pausedUntil: new Date('2026-05-20T00:00:00Z'),
            pausedDisciplineIds: [],
          },
        ],
      }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: DISCIPLINE,
      now: new Date('2026-05-15T15:00:00Z'),
    });
    assert.equal(res.allowed, false);
    if (!res.allowed) {
      assert.equal(res.reason, 'workspace-paused');
      assert.match(res.detail, /Workspace paused through/);
    }
  });

  it('auto-resumes at pausedUntil — a fire AT or AFTER pausedUntil is allowed', async () => {
    const res = await gateSkillFire({
      tx: fakeTx({
        pauses: [
          {
            workspaceId: WORKSPACE_ID,
            pausedFrom: new Date('2026-05-14T00:00:00Z'),
            pausedUntil: new Date('2026-05-20T00:00:00Z'),
            pausedDisciplineIds: [],
          },
        ],
      }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: DISCIPLINE,
      // Exactly at pausedUntil → pausedUntil is exclusive (gt now)
      now: new Date('2026-05-20T00:00:00Z'),
    });
    assert.equal(res.allowed, true);
  });

  it('discipline-narrowed pause denies matching discipline, allows others', async () => {
    const pauses: PauseRow[] = [
      {
        workspaceId: WORKSPACE_ID,
        pausedFrom: new Date('2026-05-14T00:00:00Z'),
        pausedUntil: new Date('2026-05-20T00:00:00Z'),
        pausedDisciplineIds: ['customer-success'],
      },
    ];
    // customer-success skill → denied
    const blocked = await gateSkillFire({
      tx: fakeTx({ pauses }),
      workspaceId: WORKSPACE_ID,
      skillSlug: 'support-handler',
      disciplineId: 'customer-success',
      now: new Date('2026-05-15T15:00:00Z'),
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.reason, 'workspace-paused-discipline');
    // finance skill → allowed
    const ok = await gateSkillFire({
      tx: fakeTx({ pauses }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: 'finance',
      now: new Date('2026-05-15T15:00:00Z'),
    });
    assert.equal(ok.allowed, true);
  });
});

describe('gateSkillFire — scheduling window', () => {
  // 2026-05-15 is a Friday (day=5).
  // 15:00 UTC = 11:00 EDT (America/New_York DST in May).
  const FRIDAY_15Z = new Date('2026-05-15T15:00:00Z');

  it('fires in-window during NY business hours (9..17 ET, Mon-Fri)', async () => {
    const res = await gateSkillFire({
      tx: fakeTx({
        windows: [
          {
            workspaceId: WORKSPACE_ID,
            skillSlug: SKILL_SLUG,
            daysOfWeek: [1, 2, 3, 4, 5],
            startHourLocal: 9,
            endHourLocal: 17,
            workspaceTimezone: 'America/New_York',
          },
        ],
      }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: DISCIPLINE,
      now: FRIDAY_15Z,
    });
    assert.equal(res.allowed, true);
  });

  it('skips off-window (Friday night 03:00 UTC = 23:00 ET Thursday)', async () => {
    // 03:00 UTC Friday = 23:00 ET Thursday (day=4, hour=23)
    const res = await gateSkillFire({
      tx: fakeTx({
        windows: [
          {
            workspaceId: WORKSPACE_ID,
            skillSlug: SKILL_SLUG,
            daysOfWeek: [1, 2, 3, 4, 5],
            startHourLocal: 9,
            endHourLocal: 17,
            workspaceTimezone: 'America/New_York',
          },
        ],
      }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: DISCIPLINE,
      now: new Date('2026-05-15T03:00:00Z'),
    });
    assert.equal(res.allowed, false);
    if (!res.allowed) {
      assert.equal(res.reason, 'off-window');
      assert.match(res.detail, /excludes hour/);
    }
  });

  it('day-of-week filter blocks weekend fires (Saturday)', async () => {
    // 2026-05-16 is a Saturday. 15:00 UTC = 11:00 ET → in-hours but
    // wrong day.
    const res = await gateSkillFire({
      tx: fakeTx({
        windows: [
          {
            workspaceId: WORKSPACE_ID,
            skillSlug: SKILL_SLUG,
            daysOfWeek: [1, 2, 3, 4, 5],
            startHourLocal: 9,
            endHourLocal: 17,
            workspaceTimezone: 'America/New_York',
          },
        ],
      }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: DISCIPLINE,
      now: new Date('2026-05-16T15:00:00Z'),
    });
    assert.equal(res.allowed, false);
    if (!res.allowed) assert.match(res.detail, /does not include day/);
  });

  it('handles a Tokyo-TZ workspace correctly (Friday 15:00 UTC = Saturday 00:00 JST)', async () => {
    // Wider window so the hour check passes (00 is in 0..23). The
    // weekday test now becomes the discriminator: it's Saturday in
    // Tokyo, not Friday — should skip if daysOfWeek excludes 6.
    const res = await gateSkillFire({
      tx: fakeTx({
        windows: [
          {
            workspaceId: WORKSPACE_ID,
            skillSlug: SKILL_SLUG,
            daysOfWeek: [1, 2, 3, 4, 5],
            startHourLocal: 0,
            endHourLocal: 23,
            workspaceTimezone: 'Asia/Tokyo',
          },
        ],
      }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: DISCIPLINE,
      now: new Date('2026-05-15T15:00:00Z'),
    });
    assert.equal(res.allowed, false);
  });
});

describe('isHourInWindow + localHourAndDay — primitives', () => {
  it('isHourInWindow handles overnight windows', () => {
    assert.equal(isHourInWindow(23, 22, 6), true);
    assert.equal(isHourInWindow(2, 22, 6), true);
    assert.equal(isHourInWindow(10, 22, 6), false);
    assert.equal(isHourInWindow(22, 22, 6), true);
    assert.equal(isHourInWindow(6, 22, 6), false, 'end is exclusive');
  });

  it('isHourInWindow treats start===end as off-window (degenerate)', () => {
    assert.equal(isHourInWindow(9, 9, 9), false);
  });

  it('localHourAndDay projects DST correctly — March 2026 spring-forward in NY', () => {
    // 2026-03-08 06:00 UTC = 01:00 EST (UTC-5, before spring-forward)
    // 2026-03-08 07:00 UTC = 03:00 EDT (UTC-4, 02 was skipped by the
    //   spring-forward jump at local 02:00 → 03:00)
    const before = localHourAndDay(new Date('2026-03-08T06:00:00Z'), 'America/New_York');
    assert.equal(before.hour, 1);
    assert.equal(before.day, 0, 'Sunday');
    const after = localHourAndDay(new Date('2026-03-08T07:00:00Z'), 'America/New_York');
    assert.equal(after.hour, 3, 'spring-forward → 02 becomes 03');
    assert.equal(after.day, 0);
  });
});
