/**
 * lib/billing/sync-freshness.test.ts
 *
 * Stripe-sync freshness + the freeze seam (Conner-dead P0 #5). Bar: a
 * webhook outage that strands our billing state must be DETECTED and must
 * FREEZE billing-dependent auto-exec — never silently treated as a quiet,
 * healthy account.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryOpsFlagStore } from '@/lib/ops/flag-store';
import {
  stampWebhookOk,
  stampWebhookError,
  evaluateStripeSyncFreshness,
  isBillingSyncFrozen,
  setBillingSyncFrozen,
  STRIPE_WEBHOOK_LAST_OK_FLAG,
  STRIPE_WEBHOOK_LAST_ERROR_FLAG,
} from './sync-freshness';

const T0 = new Date('2026-06-11T00:00:00.000Z');
function at(msOffset: number): Date {
  return new Date(T0.getTime() + msOffset);
}
const HOUR = 60 * 60 * 1000;

describe('evaluateStripeSyncFreshness', () => {
  it('fresh when there are no errors on record (silence is not failure)', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookOk(store, T0);
    const v = await evaluateStripeSyncFreshness({ store, now: at(48 * HOUR) });
    // A healthy account emits no webhooks for days — that is NOT stale.
    assert.equal(v.stale, false);
  });

  it('fresh when the latest event SUCCEEDED after the last error (recovered)', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookError(store, T0, 'dispatch threw');
    await stampWebhookOk(store, at(5 * 60 * 1000)); // success 5m later
    const v = await evaluateStripeSyncFreshness({ store, now: at(3 * HOUR) });
    assert.equal(v.stale, false);
    assert.match(v.reason, /recovered/i);
  });

  it('STALE when an error persists past the grace window with no success since', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookOk(store, T0);
    await stampWebhookError(store, at(30 * 60 * 1000), 'signature secret rotated');
    // 4 hours after the error, still no success → stale (the simulation case).
    const v = await evaluateStripeSyncFreshness({ store, now: at(30 * 60 * 1000 + 4 * HOUR) });
    assert.equal(v.stale, true);
    assert.match(v.reason, /failing/i);
    assert.equal(v.lastErrorDetail, 'signature secret rotated');
  });

  it('not yet stale inside the grace window', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookError(store, T0, 'transient');
    const v = await evaluateStripeSyncFreshness({ store, now: at(30 * 60 * 1000) });
    assert.equal(v.stale, false);
  });

  it('FAIL_LOUD: a flag-store read error is treated as stale (cannot confirm healthy)', async () => {
    const store = new InMemoryOpsFlagStore();
    store.failNextRead = true;
    const v = await evaluateStripeSyncFreshness({ store, now: at(HOUR) });
    assert.equal(v.stale, true);
    assert.equal(v.storeError, true);
  });
});

describe('stamps land on the expected flags', () => {
  it('stampWebhookOk writes an ISO timestamp', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookOk(store, T0);
    assert.equal(store.peek(STRIPE_WEBHOOK_LAST_OK_FLAG)?.value, T0.toISOString());
  });

  it('stampWebhookError writes {at, detail} JSON', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookError(store, T0, 'boom');
    const raw = store.peek(STRIPE_WEBHOOK_LAST_ERROR_FLAG)?.value ?? '';
    const parsed = JSON.parse(raw);
    assert.equal(parsed.at, T0.toISOString());
    assert.equal(parsed.detail, 'boom');
  });
});

describe('freeze flag', () => {
  it('defaults to not-frozen', async () => {
    const store = new InMemoryOpsFlagStore();
    assert.equal(await isBillingSyncFrozen(store), false);
  });

  it('round-trips set/clear', async () => {
    const store = new InMemoryOpsFlagStore();
    await setBillingSyncFrozen(store, true, 'stale');
    assert.equal(await isBillingSyncFrozen(store), true);
    await setBillingSyncFrozen(store, false, 'recovered');
    assert.equal(await isBillingSyncFrozen(store), false);
  });

  it('returns false (does not over-freeze) on a transient read error', async () => {
    const store = new InMemoryOpsFlagStore();
    await setBillingSyncFrozen(store, true, 'stale');
    store.failNextRead = true;
    assert.equal(await isBillingSyncFrozen(store), false);
  });
});
