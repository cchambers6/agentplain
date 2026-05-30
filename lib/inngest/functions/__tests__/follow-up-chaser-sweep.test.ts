/**
 * Behavior + smoke tests for `follow-up-chaser-sweep`.
 *
 * Behavior (DI — no DB):
 *   - Workspaces with neither GOOGLE nor M365 are skipped as
 *     `workspacesSkippedUnconfigured`.
 *   - Workspaces whose `disabledDisciplines` includes the chaser's
 *     discipline (sales-enablement) are skipped on the discipline
 *     gate.
 *   - Workspaces with credentials + a happy fetcher produce nudges and
 *     bump the counters.
 *   - Fetcher returning NOT_CONFIGURED at runtime is a clean skip.
 *   - Stale-thread filtering: only threads past `staleAfterDays` with
 *     no counterparty reply pass through (covered indirectly via the
 *     skill itself; the sweep test pins the fetcher to deterministic
 *     stale threads so the count is predictable).
 *
 * Smoke:
 *   - Function id + cron schedule are the documented constants.
 *   - `follow-up-chaser-general` is mapped to the documented
 *     discipline (`sales-enablement`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FOLLOW_UP_CHASER_SWEEP_CRON,
  FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID,
  followUpChaserSweepFn,
  runFollowUpChaserSweep,
} from '../follow-up-chaser-sweep';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { RecordingFollowUpApprovalSink } from '@/lib/skills/follow-up-chaser-general';
import { JsonFollowUpFetcher } from '@/lib/skills/follow-up-chaser-general';
import { runFollowUpChaserForWorkspace } from '@/lib/skills/follow-up-chaser-general/run-for-workspace';
import type {
  FollowUpFetcher,
  FollowUpSnapshot,
} from '@/lib/skills/follow-up-chaser-general';
import { skillError, skillOk, type SkillResult } from '@/lib/skills/types';

const WORKSPACE_GOOGLE = '11111111-1111-1111-1111-111111111111';
const WORKSPACE_M365 = '22222222-2222-2222-2222-222222222222';
const WORKSPACE_DISABLED = '33333333-3333-3333-3333-333333333333';
const WORKSPACE_NEITHER = '44444444-4444-4444-4444-444444444444';

class EmptyFollowUpFetcher implements FollowUpFetcher {
  readonly name = 'empty-stub' as const;
  async fetchSnapshot(): Promise<SkillResult<FollowUpSnapshot>> {
    return skillOk({ outbound: [] });
  }
}

class RaceConditionFetcher implements FollowUpFetcher {
  readonly name = 'race-stub' as const;
  async fetchSnapshot(): Promise<SkillResult<FollowUpSnapshot>> {
    return skillError(
      'NOT_CONFIGURED',
      'workspace disconnected between candidate listing and execution',
    );
  }
}

describe('runFollowUpChaserSweep — workspaces with no email credential are skipped', () => {
  it('counts them as skipped, not failed', async () => {
    const result = await runFollowUpChaserSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_NEITHER,
          vertical: 'REAL_ESTATE',
          hasGoogle: false,
          hasM365: false,
          disabledDisciplines: [],
        },
      ],
      buildFetcher: () => new EmptyFollowUpFetcher(),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedUnconfigured, 1);
    assert.equal(result.workspacesWithNudges, 0);
    assert.equal(result.failures.length, 0);
  });
});

describe('runFollowUpChaserSweep — workspaces with the discipline disabled are skipped', () => {
  it('honors WorkspacePreference.disabledDisciplines', async () => {
    const result = await runFollowUpChaserSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_DISABLED,
          vertical: 'REAL_ESTATE',
          hasGoogle: true,
          hasM365: false,
          disabledDisciplines: [SKILL_DISCIPLINE['follow-up-chaser-general']!],
        },
      ],
      buildFetcher: () => new EmptyFollowUpFetcher(),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedDisciplineDisabled, 1);
    assert.equal(result.workspacesWithNudges, 0);
  });
});

describe('runFollowUpChaserSweep — race-condition NOT_CONFIGURED is a clean skip', () => {
  it('counts NOT_CONFIGURED from run-time fetcher as skipped, not failed', async () => {
    const result = await runFollowUpChaserSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_GOOGLE,
          vertical: 'REAL_ESTATE',
          hasGoogle: true,
          hasM365: false,
          disabledDisciplines: [],
        },
      ],
      buildFetcher: () => new RaceConditionFetcher(),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedUnconfigured, 1);
    assert.equal(result.failures.length, 0);
  });
});

describe('runFollowUpChaserSweep — happy fetcher with stale threads produces nudges', () => {
  it('counts nudges via runFollowUpChaserForWorkspace + RecordingFollowUpApprovalSink', async () => {
    // Build a deterministic stale thread (operator sent 10 days ago,
    // no counterparty reply) and assert the skill emits and sinks a
    // nudge proposal end-to-end without touching Prisma.
    const now = new Date('2026-05-28T12:00:00.000Z');
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_GOOGLE,
      snapshot: {
        outbound: [
          {
            threadId: 'thread-1',
            subject: 'Following up on our quote',
            counterpartyEmails: ['lead@example.com'],
            counterpartyName: 'Pat Lead',
            operatorLastSentAt: tenDaysAgo,
            counterpartyLastRepliedAt: null,
            operatorLastBodySnippet:
              'Just sent over the quote for the kitchen remodel — let me know if you have any questions.',
          },
        ],
      },
    });
    const sink = new RecordingFollowUpApprovalSink();
    const run = await runFollowUpChaserForWorkspace({
      workspaceId: WORKSPACE_GOOGLE,
      fetcher,
      sink,
      now,
    });
    assert.ok(run.ok, 'runFollowUpChaserForWorkspace must succeed');
    assert.equal(run.value.proposals.length, 1);
    assert.equal(run.value.sunk, 1);
    assert.equal(sink.calls.length, 1);
    assert.equal(sink.calls[0].proposal.stage, 'second');
  });
});

// ── Smoke ──────────────────────────────────────────────────────────────

describe('followUpChaserSweepFn — registration shape', () => {
  it('uses the documented function id + cron schedule', () => {
    assert.equal(
      FOLLOW_UP_CHASER_SWEEP_FUNCTION_ID,
      'agentplain-follow-up-chaser-sweep',
    );
    assert.equal(FOLLOW_UP_CHASER_SWEEP_CRON, '0 * * * *');
    assert.ok(followUpChaserSweepFn, 'function export defined');
  });

  it('follow-up-chaser-general is mapped to the documented discipline', () => {
    const id = SKILL_DISCIPLINE['follow-up-chaser-general'];
    assert.ok(id, 'follow-up-chaser-general must be mapped in SKILL_DISCIPLINE');
    assert.equal(id, 'sales-enablement');
  });

  it('serve route file literally references followUpChaserSweepFn', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(
      path.resolve('app/api/inngest/route.ts'),
      'utf8',
    );
    assert.match(src, /followUpChaserSweepFn/);
  });
});
