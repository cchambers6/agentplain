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

interface FakeWorkspaceRow {
  setupDeactivatedAt: Date | null;
}

function stubContext(
  row: FakeSubRow | null,
  workspaceRow: FakeWorkspaceRow | null = { setupDeactivatedAt: null },
): SystemContextRunner {
  return async <T>(fn: (tx: never) => Promise<T>): Promise<T> => {
    const tx = {
      subscription: {
        findUnique: async () => row,
      },
      workspace: {
        findUnique: async () => workspaceRow,
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

  // Wave-4 — abandoned-signup gate. Workspaces typically have no
  // Subscription row at all when this fires (Checkout never completed).
  it('returns isPaused=true when workspace.setupDeactivatedAt is set (no Subscription)', async () => {
    const res = await isWorkspacePaused({
      workspaceId: 'ws-abandoned',
      systemContext: stubContext(null, {
        setupDeactivatedAt: new Date('2026-06-08T00:00:00.000Z'),
      }),
    });
    assert.equal(res.isPaused, true);
    assert.equal(res.status, null);
    assert.match(res.reason, /abandoned signup/i);
  });

  it('returns isPaused=true when setupDeactivatedAt is set AND Subscription is INCOMPLETE (defensive)', async () => {
    const res = await isWorkspacePaused({
      workspaceId: 'ws-abandoned',
      systemContext: stubContext(
        { status: 'INCOMPLETE' },
        { setupDeactivatedAt: new Date('2026-06-08T00:00:00.000Z') },
      ),
    });
    assert.equal(res.isPaused, true);
    assert.match(res.reason, /abandoned signup/i);
  });

  it('returns isPaused=false when setupDeactivatedAt is null AND Subscription is ACTIVE', async () => {
    const res = await isWorkspacePaused({
      workspaceId: 'ws-healthy',
      systemContext: stubContext({ status: 'ACTIVE' }, { setupDeactivatedAt: null }),
    });
    assert.equal(res.isPaused, false);
  });
});
