/**
 * lib/integrations/degraded-notify.test.ts
 *
 * Degraded mode: a NON-critical integration (Slack) being down must NEVER block
 * the primary action. The notification is held and flushed on reconnect.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notifyOrHold } from './degraded-notify';
import { resumeRetryableActions } from './retry-queue';
import { InMemoryRetryStore } from './retry-store';
import { entryCriticality, getMarketplaceEntry } from './marketplace';

const WS = '33333333-3333-3333-3333-333333333333';
const NOW = new Date('2026-06-10T00:00:00Z');

describe('degraded-notify — hold and flush', () => {
  it('delivers when the notify executor succeeds (no hold)', async () => {
    const store = new InMemoryRetryStore();
    const res = await notifyOrHold({
      workspaceId: WS, provider: 'SLACK', idempotencyKey: 'n1',
      payload: { channel: '#ops', text: 'hi' },
      notify: async () => ({ ok: true }),
      store,
      now: NOW,
    });
    assert.equal(res.delivered, true);
    assert.equal(res.held, false);
    assert.equal(store.rows.length, 0, 'nothing held when delivery succeeds');
  });

  it('HOLDS the notification when Slack is down, and it flushes on reconnect', async () => {
    const store = new InMemoryRetryStore();
    // Slack down → notify fails → the helper holds the ping.
    const res = await notifyOrHold({
      workspaceId: WS, provider: 'SLACK', idempotencyKey: 'n1',
      payload: { channel: '#ops', text: 'order shipped' },
      notify: async () => ({ ok: false, detail: 'slack 401' }),
      store,
      now: NOW,
    });
    assert.equal(res.delivered, false);
    assert.equal(res.held, true);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].status, 'HELD', 'held, not pending — primary action already ran');

    // On reconnect the resume sweep flushes the held ping exactly once.
    let posted = 0;
    const out = await resumeRetryableActions({
      provider: 'SLACK',
      registry: { 'slack.notify': async () => { posted += 1; return { ok: true }; } },
      store,
      now: NOW,
    });
    assert.equal(out.resolved, 1);
    assert.equal(posted, 1);
    assert.equal(store.rows[0].status, 'RESOLVED');
  });

  it('never throws even if the hold itself fails — the primary action is safe', async () => {
    const throwingStore = {
      async findByKey() { return null; },
      async upsert() { throw new Error('db down'); },
      async findEligible() { return []; },
      async update() {},
      async countByStatus() { return { waiting: 0, held: 0, dead: 0 }; },
    };
    const res = await notifyOrHold({
      workspaceId: WS, provider: 'SLACK', idempotencyKey: 'n1',
      payload: {}, notify: async () => ({ ok: false, detail: 'down' }),
      store: throwingStore as never, now: NOW,
    });
    assert.equal(res.delivered, false);
    assert.equal(res.held, false);
    assert.match(res.detail ?? '', /hold failed/);
  });
});

describe('marketplace criticality', () => {
  it('Slack + Notion are non-critical; Gmail + QuickBooks default to critical', () => {
    assert.equal(entryCriticality(getMarketplaceEntry('slack')!), 'non-critical');
    assert.equal(entryCriticality(getMarketplaceEntry('notion')!), 'non-critical');
    assert.equal(entryCriticality(getMarketplaceEntry('gmail')!), 'critical');
    assert.equal(entryCriticality(getMarketplaceEntry('quickbooks')!), 'critical');
  });
});
