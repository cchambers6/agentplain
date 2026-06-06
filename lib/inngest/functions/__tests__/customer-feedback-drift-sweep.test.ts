/**
 * Behavior tests for the wave-4 `customer-feedback-drift-sweep` (DI — no
 * DB).
 *
 * Behavior:
 *   - A skill+category group at/above the threshold queues one proposal.
 *   - Sub-threshold groups queue nothing.
 *   - An already-open proposal (idempotency) is skipped, not re-queued.
 *   - A writer failure is captured per-workspace, not fatal.
 *
 * Smoke:
 *   - Function id + cron schedule are the documented constants (Sun 07:00
 *     UTC ≈ 03:00 ET).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOMER_FEEDBACK_DRIFT_SWEEP_CRON,
  CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID,
  customerFeedbackDriftSweepFn,
  runCustomerFeedbackDriftSweep,
} from '../customer-feedback-drift-sweep';
import type { WorkspaceFeedbackBatch } from '@/lib/feedback';

const WS_A = '11111111-1111-1111-1111-111111111111';
const WS_B = '22222222-2222-2222-2222-222222222222';

function row(targetSkillSlug: string, category: string) {
  return {
    id: 'r',
    workspaceId: WS_A,
    userId: null,
    targetSkillSlug,
    category: category as never,
    reason: 'x',
    createdAt: new Date(),
  };
}

describe('runCustomerFeedbackDriftSweep', () => {
  it('queues one proposal per threshold-crossing group', async () => {
    const created: Array<{ workspaceId: string; skill: string }> = [];
    const batches: WorkspaceFeedbackBatch[] = [
      {
        workspaceId: WS_A,
        workspaceName: 'Acme',
        rows: [row('follow-up-chaser', 'tone'), row('follow-up-chaser', 'tone'), row('follow-up-chaser', 'tone')],
      },
    ];
    const result = await runCustomerFeedbackDriftSweep({
      listBatches: async () => batches,
      hasExisting: async () => false,
      createProposal: async (a) => {
        created.push({ workspaceId: a.workspaceId, skill: a.targetSkillSlug });
        return 'proposal-id';
      },
    });
    assert.equal(result.groupsOverThreshold, 1);
    assert.equal(result.proposalsQueued, 1);
    assert.equal(created.length, 1);
    assert.equal(created[0].skill, 'follow-up-chaser');
  });

  it('queues nothing for sub-threshold groups', async () => {
    const result = await runCustomerFeedbackDriftSweep({
      listBatches: async () => [
        {
          workspaceId: WS_B,
          workspaceName: 'Beta',
          rows: [row('content-calendar', 'length'), row('content-calendar', 'length')],
        },
      ],
      hasExisting: async () => false,
      createProposal: async () => 'x',
    });
    assert.equal(result.groupsOverThreshold, 0);
    assert.equal(result.proposalsQueued, 0);
  });

  it('skips an already-open proposal (idempotent)', async () => {
    let createdCount = 0;
    const result = await runCustomerFeedbackDriftSweep({
      listBatches: async () => [
        {
          workspaceId: WS_A,
          workspaceName: 'Acme',
          rows: [row('s', 'tone'), row('s', 'tone'), row('s', 'tone')],
        },
      ],
      hasExisting: async () => true,
      createProposal: async () => {
        createdCount += 1;
        return 'x';
      },
    });
    assert.equal(result.proposalsSkippedExisting, 1);
    assert.equal(result.proposalsQueued, 0);
    assert.equal(createdCount, 0);
  });

  it('captures a writer failure per-workspace without aborting', async () => {
    const result = await runCustomerFeedbackDriftSweep({
      listBatches: async () => [
        {
          workspaceId: WS_A,
          workspaceName: 'Acme',
          rows: [row('s', 'tone'), row('s', 'tone'), row('s', 'tone')],
        },
      ],
      hasExisting: async () => false,
      createProposal: async () => {
        throw new Error('db down');
      },
    });
    assert.equal(result.proposalsQueued, 0);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0].reason, /db down/);
  });
});

describe('customer-feedback-drift-sweep — smoke', () => {
  it('exposes the documented id + weekly Sunday cron', () => {
    assert.equal(
      CUSTOMER_FEEDBACK_DRIFT_SWEEP_FUNCTION_ID,
      'agentplain-customer-feedback-drift-sweep',
    );
    assert.equal(CUSTOMER_FEEDBACK_DRIFT_SWEEP_CRON, '0 7 * * SUN');
    assert.ok(customerFeedbackDriftSweepFn);
  });
});
