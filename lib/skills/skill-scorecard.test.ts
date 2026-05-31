/**
 * lib/skills/skill-scorecard.test.ts
 *
 * Pins the scorecard rollup that the discipline detail page renders.
 * Uses an in-memory Prisma-shaped fake (the same approach
 * lib/skills/feedback-rules.test.ts takes with RecordingMemoryStore) so
 * the test is pure — no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildSkillScorecard } from './skill-scorecard';

const WORKSPACE_ID = 'ws-scorecard-0001';
const SKILL_SLUG = 'invoice-chasing-realestate';
const NOW = new Date('2026-05-15T15:00:00Z');

interface ApprovalRow {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED' | 'EXPIRED';
  proposedAt: Date;
  decidedAt: Date | null;
  agentSlug: string;
  workspaceId: string;
}

interface InstallRow {
  workspaceId: string;
  skillSlug: string;
  disabledAt: Date | null;
}

interface MemoryRow {
  workspaceId: string;
  kind: 'FEEDBACK';
  title: string;
}

function fakeTx(args: {
  approvals: ApprovalRow[];
  installations: InstallRow[];
  memory: MemoryRow[];
}) {
  return {
    workApprovalQueueItem: {
      async findMany(q: {
        where: {
          workspaceId: string;
          agentSlug: string;
          proposedAt?: { gte: Date };
        };
        select?: unknown;
      }) {
        return args.approvals.filter(
          (r) =>
            r.workspaceId === q.where.workspaceId &&
            r.agentSlug === q.where.agentSlug &&
            (q.where.proposedAt?.gte ? r.proposedAt >= q.where.proposedAt.gte : true),
        );
      },
      async findFirst(q: {
        where: { workspaceId: string; agentSlug: string };
      }) {
        const rows = args.approvals
          .filter(
            (r) =>
              r.workspaceId === q.where.workspaceId &&
              r.agentSlug === q.where.agentSlug,
          )
          .sort((a, b) => b.proposedAt.getTime() - a.proposedAt.getTime());
        return rows[0] ?? null;
      },
    },
    workspaceSkillInstallation: {
      async findUnique(q: {
        where: { workspaceId_skillSlug: { workspaceId: string; skillSlug: string } };
      }) {
        return (
          args.installations.find(
            (r) =>
              r.workspaceId === q.where.workspaceId_skillSlug.workspaceId &&
              r.skillSlug === q.where.workspaceId_skillSlug.skillSlug,
          ) ?? null
        );
      },
    },
    workspaceMemoryEntry: {
      async findMany(q: {
        where: { workspaceId: string; kind: string; title: { in: string[] } };
      }) {
        return args.memory.filter(
          (r) =>
            r.workspaceId === q.where.workspaceId &&
            r.kind === q.where.kind &&
            q.where.title.in.includes(r.title),
        );
      },
    },
  } as never;
}

describe('buildSkillScorecard — empty workspace', () => {
  it('returns never-installed when no install row exists', async () => {
    const card = await buildSkillScorecard({
      tx: fakeTx({ approvals: [], installations: [], memory: [] }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: 'finance',
      now: NOW,
    });
    assert.equal(card.installState, 'never-installed');
    assert.equal(card.draftsLast7d, 0);
    assert.equal(card.acceptanceRate7d, null);
    assert.equal(card.lastFireIso, null);
    assert.equal(card.feedbackRuleCount, 0);
  });
});

describe('buildSkillScorecard — installed + activity', () => {
  it('counts 7-day drafts + computes acceptance rate + names last fire', async () => {
    const card = await buildSkillScorecard({
      tx: fakeTx({
        approvals: [
          // Within 7d, approved
          {
            workspaceId: WORKSPACE_ID,
            agentSlug: SKILL_SLUG,
            status: 'APPROVED',
            proposedAt: new Date('2026-05-13T10:00:00Z'),
            decidedAt: new Date('2026-05-13T12:00:00Z'),
          },
          // Within 7d, rejected
          {
            workspaceId: WORKSPACE_ID,
            agentSlug: SKILL_SLUG,
            status: 'REJECTED',
            proposedAt: new Date('2026-05-14T10:00:00Z'),
            decidedAt: new Date('2026-05-14T12:00:00Z'),
          },
          // Within 7d, pending (decidedAt null — should NOT count in acceptance denom)
          {
            workspaceId: WORKSPACE_ID,
            agentSlug: SKILL_SLUG,
            status: 'PENDING',
            proposedAt: new Date('2026-05-15T09:00:00Z'),
            decidedAt: null,
          },
          // Outside 7d window
          {
            workspaceId: WORKSPACE_ID,
            agentSlug: SKILL_SLUG,
            status: 'APPROVED',
            proposedAt: new Date('2026-04-30T10:00:00Z'),
            decidedAt: new Date('2026-04-30T12:00:00Z'),
          },
          // Different skill → ignored
          {
            workspaceId: WORKSPACE_ID,
            agentSlug: 'some-other-skill',
            status: 'APPROVED',
            proposedAt: new Date('2026-05-14T10:00:00Z'),
            decidedAt: new Date('2026-05-14T12:00:00Z'),
          },
        ],
        installations: [
          { workspaceId: WORKSPACE_ID, skillSlug: SKILL_SLUG, disabledAt: null },
        ],
        memory: [
          { workspaceId: WORKSPACE_ID, kind: 'FEEDBACK', title: 'pref:finance' },
          { workspaceId: WORKSPACE_ID, kind: 'FEEDBACK', title: 'pref:general' },
          // Wrong scope → not counted under finance discipline
          { workspaceId: WORKSPACE_ID, kind: 'FEEDBACK', title: 'pref:legal-flagging' },
        ],
      }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: 'finance',
      now: NOW,
    });
    assert.equal(card.installState, 'installed');
    // 3 rows within 7d (the outside-window + other-skill ones drop)
    assert.equal(card.draftsLast7d, 3);
    // 2 decided in 7d → 1 approved → 0.5
    assert.equal(card.acceptanceRate7d, 0.5);
    // Most recent IS the within-7d-pending row (2026-05-15)
    assert.equal(card.lastFireIso, '2026-05-15T09:00:00.000Z');
    // pref:general + pref:finance → 2
    assert.equal(card.feedbackRuleCount, 2);
  });

  it('uninstalled state when disabledAt is non-null', async () => {
    const card = await buildSkillScorecard({
      tx: fakeTx({
        approvals: [],
        installations: [
          {
            workspaceId: WORKSPACE_ID,
            skillSlug: SKILL_SLUG,
            disabledAt: new Date('2026-05-10T00:00:00Z'),
          },
        ],
        memory: [],
      }),
      workspaceId: WORKSPACE_ID,
      skillSlug: SKILL_SLUG,
      disciplineId: 'finance',
      now: NOW,
    });
    assert.equal(card.installState, 'uninstalled');
  });
});
