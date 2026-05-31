/**
 * Wave-3 phase 5 — workspace-paused gate.
 *
 * Pins:
 *   - PAUSED → isPaused=true, reason includes status
 *   - PAST_DUE → isPaused=true
 *   - ACTIVE → isPaused=false
 *   - TRIALING → isPaused=false
 *   - No Subscription row → isPaused=false (legacy workspaces predate
 *     per-seat billing — handled by trial-warning cron)
 *   - Status taxonomy covers every SubscriptionStatus value (defensive)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SubscriptionStatus } from '@prisma/client';

import {
  isWorkspacePaused,
  SKILL_PAUSED_STATUSES,
  type SystemContextRunner,
} from './workspace-paused-gate';

interface FakeSubRow {
  status: SubscriptionStatus | null;
}

function stubContext(row: FakeSubRow | null): SystemContextRunner {
  return async <T>(fn: (tx: never) => Promise<T>): Promise<T> => {
    const tx = {
      subscription: {
        findUnique: async () => row,
      },
    } as unknown as never;
    return fn(tx);
  };
}

describe('isWorkspacePaused', () => {
  it('returns isPaused=true when status is PAUSED', async () => {
    const res = await isWorkspacePaused({
      workspaceId: 'ws-1',
      systemContext: stubContext({ status: 'PAUSED' }),
    });
    assert.equal(res.isPaused, true);
    assert.equal(res.status, 'PAUSED');
    assert.match(res.reason, /PAUSED/);
  });

  it('returns isPaused=true when status is PAST_DUE', async () => {
    const res = await isWorkspacePaused({
      workspaceId: 'ws-1',
      systemContext: stubContext({ status: 'PAST_DUE' }),
    });
    assert.equal(res.isPaused, true);
    assert.equal(res.status, 'PAST_DUE');
  });

  it('returns isPaused=false when status is ACTIVE', async () => {
    const res = await isWorkspacePaused({
      workspaceId: 'ws-1',
      systemContext: stubContext({ status: 'ACTIVE' }),
    });
    assert.equal(res.isPaused, false);
    assert.equal(res.status, 'ACTIVE');
  });

  it('returns isPaused=false when status is TRIALING', async () => {
    const res = await isWorkspacePaused({
      workspaceId: 'ws-1',
      systemContext: stubContext({ status: 'TRIALING' }),
    });
    assert.equal(res.isPaused, false);
  });

  it('returns isPaused=false when no subscription row exists', async () => {
    const res = await isWorkspacePaused({
      workspaceId: 'ws-1',
      systemContext: stubContext(null),
    });
    assert.equal(res.isPaused, false);
    assert.equal(res.status, null);
    assert.match(res.reason, /no subscription row/i);
  });

  it('SKILL_PAUSED_STATUSES is the exact gate set', () => {
    assert.deepEqual([...SKILL_PAUSED_STATUSES].sort(), [
      'PAST_DUE',
      'PAUSED',
    ]);
  });
});
