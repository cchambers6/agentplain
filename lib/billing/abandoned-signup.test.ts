/**
 * lib/billing/abandoned-signup.test.ts
 *
 * Wave-4 phase 4 — pins the Stripe abandoned-signup lifecycle. Verifies
 * the day-bucket decision function + the sweep's routing for each
 * action. No real Stripe / email / DB calls — all dependencies injected.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ABANDONED_ARCHIVE_AFTER_DAYS,
  ABANDONED_DEACTIVATE_AFTER_DAYS,
  ABANDONED_NUDGE_AFTER_DAYS,
  decideAction,
  runAbandonedSignupSweep,
  type AbandonedCandidate,
  type EmitAbandonedActionInput,
} from './abandoned-signup';

const NOW = new Date('2026-06-15T16:00:00.000Z');

function candidate(
  overrides: Partial<AbandonedCandidate> = {},
): AbandonedCandidate {
  return {
    workspaceId: 'ws-001',
    workspaceName: 'Acme Brokerage',
    workspaceSlug: 'acme',
    brokerOwnerEmail: 'owner@example.com',
    brokerOwnerName: 'Sam Owner',
    stripeCustomerId: 'cus_TEST',
    createdAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
    signupSetupCompletedAt: null,
    setupDeactivatedAt: null,
    lastNudgeAt: null,
    daysSinceSignup: 2,
    ...overrides,
  };
}

describe('decideAction — day-bucket boundaries (wave-4)', () => {
  it('completed signup → skip forever', () => {
    const action = decideAction({
      candidate: candidate({
        signupSetupCompletedAt: new Date(NOW.getTime() - 60_000),
        daysSinceSignup: 999,
      }),
      now: NOW,
    });
    assert.equal(action, 'skip');
  });

  it('< 24h since signup → skip (no nudge yet)', () => {
    const action = decideAction({
      candidate: candidate({ daysSinceSignup: 0 }),
      now: NOW,
    });
    assert.equal(action, 'skip');
  });

  it(`>= ${ABANDONED_NUDGE_AFTER_DAYS}d since signup AND no prior nudge → nudge`, () => {
    const action = decideAction({
      candidate: candidate({ daysSinceSignup: ABANDONED_NUDGE_AFTER_DAYS }),
      now: NOW,
    });
    assert.equal(action, 'nudge');
  });

  it('>= 1d since signup AND prior nudge exists → skip (no re-nudge)', () => {
    const action = decideAction({
      candidate: candidate({
        daysSinceSignup: 3,
        lastNudgeAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
      }),
      now: NOW,
    });
    assert.equal(action, 'skip');
  });

  it(`>= ${ABANDONED_DEACTIVATE_AFTER_DAYS}d AND not yet deactivated → deactivate`, () => {
    const action = decideAction({
      candidate: candidate({
        daysSinceSignup: ABANDONED_DEACTIVATE_AFTER_DAYS,
      }),
      now: NOW,
    });
    assert.equal(action, 'deactivate');
  });

  it(`>= ${ABANDONED_DEACTIVATE_AFTER_DAYS}d AND already deactivated → skip until archive boundary`, () => {
    const action = decideAction({
      candidate: candidate({
        daysSinceSignup: 14,
        setupDeactivatedAt: new Date(
          NOW.getTime() - 7 * 24 * 60 * 60 * 1000,
        ),
      }),
      now: NOW,
    });
    assert.equal(action, 'skip');
  });

  it(`>= ${ABANDONED_ARCHIVE_AFTER_DAYS}d since signup → archive (regardless of prior deactivation)`, () => {
    const action = decideAction({
      candidate: candidate({
        daysSinceSignup: ABANDONED_ARCHIVE_AFTER_DAYS,
        setupDeactivatedAt: new Date(
          NOW.getTime() - 23 * 24 * 60 * 60 * 1000,
        ),
      }),
      now: NOW,
    });
    assert.equal(action, 'archive');
  });
});

describe('runAbandonedSignupSweep — routes each candidate to the right emitter', () => {
  it('counts nudges, deactivations, archives, and skips separately', async () => {
    const captured: Array<{ workspaceId: string; action: string }> = [];
    const emit = async (input: EmitAbandonedActionInput) => {
      captured.push({
        workspaceId: input.candidate.workspaceId,
        action: input.action,
      });
    };
    const result = await runAbandonedSignupSweep({
      listCandidates: async () => [
        // active — < 1d, skip
        candidate({ workspaceId: 'ws-fresh', daysSinceSignup: 0 }),
        // 2d, no prior nudge — nudge
        candidate({ workspaceId: 'ws-nudge', daysSinceSignup: 2 }),
        // 2d, already nudged — skip
        candidate({
          workspaceId: 'ws-already-nudged',
          daysSinceSignup: 3,
          lastNudgeAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
        }),
        // 8d, not yet deactivated — deactivate
        candidate({ workspaceId: 'ws-deactivate', daysSinceSignup: 8 }),
        // 35d — archive
        candidate({ workspaceId: 'ws-archive', daysSinceSignup: 35 }),
      ],
      emit,
      now: NOW,
    });
    assert.equal(result.workspacesConsidered, 5);
    assert.equal(result.nudgesSent, 1);
    assert.equal(result.deactivated, 1);
    assert.equal(result.archived, 1);
    assert.equal(result.skipped, 2);
    assert.deepEqual(
      captured.sort((a, b) => a.workspaceId.localeCompare(b.workspaceId)),
      [
        { workspaceId: 'ws-archive', action: 'archive' },
        { workspaceId: 'ws-deactivate', action: 'deactivate' },
        { workspaceId: 'ws-nudge', action: 'nudge' },
      ],
    );
  });

  it('emit failures are counted, not thrown', async () => {
    const result = await runAbandonedSignupSweep({
      listCandidates: async () => [
        candidate({ workspaceId: 'ws-broken', daysSinceSignup: 2 }),
      ],
      emit: async () => {
        throw new Error('email provider down');
      },
      now: NOW,
    });
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0].reason, /email provider down/);
    assert.equal(result.nudgesSent, 0);
  });
});
