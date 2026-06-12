/**
 * lib/inngest/functions/fleet-freshness-sweep.test.ts
 *
 * The hourly watchdog (Conner-dead P0 #5 + #6). Bar: a stale Stripe sync
 * FREEZES billing-dependent auto-exec + pages within the hour; a missed daily
 * heartbeat pages within the hour; a healthy fleet stays quiet.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryOpsFlagStore } from '@/lib/ops/flag-store';
import {
  stampWebhookOk,
  stampWebhookError,
  isBillingSyncFrozen,
  setBillingSyncFrozen,
  BILLING_SYNC_FROZEN_FLAG,
} from '@/lib/billing/sync-freshness';
import { FLEET_HEALTH_LAST_SUCCESS_FLAG } from './fleet-health-check';
import {
  runFleetFreshnessSweep,
  HEARTBEAT_STALE_LAST_PAGED_FLAG,
} from './fleet-freshness-sweep';
import type { PageHumanInput, PageHumanResult } from '@/lib/ops/page-human';

/** Recording fake pager. Resolves delivered (a real inbox exists, since the
 *  hardcoded fallback guarantees one — mode #1). */
function recordingPager() {
  const pages: PageHumanInput[] = [];
  const page = async (input: PageHumanInput): Promise<PageHumanResult> => {
    pages.push(input);
    return {
      delivered: true,
      recipients: ['ops@agentplain.com'],
      usedFallbackRecipient: false,
      usedHardcodedFallback: false,
      recipientTier: 'trusted-human',
      persisted: true,
      auditLogId: 'audit_1',
    };
  };
  return { page, pages };
}

const T0 = new Date('2026-06-11T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

describe('runFleetFreshnessSweep — billing sync (#5)', () => {
  it('freezes + pages on transition into stale', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookOk(store, new Date(T0.getTime() - 10 * HOUR));
    await stampWebhookError(store, new Date(T0.getTime() - 5 * HOUR), 'dispatch 500');
    // Heartbeat is fresh so only the billing path fires.
    await store.set(FLEET_HEALTH_LAST_SUCCESS_FLAG, new Date(T0.getTime() - HOUR).toISOString());

    const { page, pages } = recordingPager();
    const report = await runFleetFreshnessSweep({ flagStore: store, page, now: T0 });

    assert.equal(report.billingSyncStale, true);
    assert.equal(report.billingFroze, true);
    assert.equal(await isBillingSyncFrozen(store), true);
    assert.ok(report.pagedFor.includes('billing-sync'));
    assert.equal(pages.length, 1);
    assert.equal(pages[0].severity, 'critical');
    assert.match(pages[0].summary, /Stripe billing sync is STALE/);
  });

  it('does NOT re-page when already frozen (coalesced on the transition)', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookError(store, new Date(T0.getTime() - 5 * HOUR), 'dispatch 500');
    await setBillingSyncFrozen(store, true, 'already frozen');
    await store.set(FLEET_HEALTH_LAST_SUCCESS_FLAG, new Date(T0.getTime() - HOUR).toISOString());

    const { page, pages } = recordingPager();
    const report = await runFleetFreshnessSweep({ flagStore: store, page, now: T0 });

    assert.equal(report.billingSyncStale, true);
    assert.equal(report.billingFroze, false); // not a NEW freeze
    assert.equal(pages.length, 0);
  });

  it('clears the freeze on recovery', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookError(store, new Date(T0.getTime() - 5 * HOUR), 'was broken');
    await stampWebhookOk(store, new Date(T0.getTime() - HOUR)); // recovered
    await setBillingSyncFrozen(store, true, 'frozen earlier');
    await store.set(FLEET_HEALTH_LAST_SUCCESS_FLAG, new Date(T0.getTime() - HOUR).toISOString());

    const { page, pages } = recordingPager();
    const report = await runFleetFreshnessSweep({ flagStore: store, page, now: T0 });

    assert.equal(report.billingSyncStale, false);
    assert.equal(report.billingUnfroze, true);
    assert.equal(store.peek(BILLING_SYNC_FROZEN_FLAG)?.value, 'false');
    assert.equal(pages[0]?.severity, 'info');
  });
});

describe('runFleetFreshnessSweep — heartbeat missed-cron (#6)', () => {
  it('pages when the daily heartbeat is stale past cadence', async () => {
    const store = new InMemoryOpsFlagStore();
    // Last heartbeat 30h ago — past the 26h cadence+grace.
    await store.set(FLEET_HEALTH_LAST_SUCCESS_FLAG, new Date(T0.getTime() - 30 * HOUR).toISOString());

    const { page, pages } = recordingPager();
    const report = await runFleetFreshnessSweep({ flagStore: store, page, now: T0 });

    assert.equal(report.heartbeatStale, true);
    assert.ok(report.pagedFor.includes('heartbeat'));
    assert.match(pages[0].summary, /heartbeat has NOT run/);
    // Coalesce flag stamped so it won't re-page next hour.
    assert.ok(store.peek(HEARTBEAT_STALE_LAST_PAGED_FLAG));
  });

  it('does NOT re-page a still-stale heartbeat within the coalesce window', async () => {
    const store = new InMemoryOpsFlagStore();
    await store.set(FLEET_HEALTH_LAST_SUCCESS_FLAG, new Date(T0.getTime() - 30 * HOUR).toISOString());
    // Paged 1h ago — inside the 12h coalesce.
    await store.set(HEARTBEAT_STALE_LAST_PAGED_FLAG, new Date(T0.getTime() - HOUR).toISOString());

    const { page, pages } = recordingPager();
    const report = await runFleetFreshnessSweep({ flagStore: store, page, now: T0 });

    assert.equal(report.heartbeatStale, true);
    assert.equal(pages.length, 0);
  });

  it('stays quiet when both billing sync and heartbeat are healthy', async () => {
    const store = new InMemoryOpsFlagStore();
    await stampWebhookOk(store, new Date(T0.getTime() - HOUR));
    await store.set(FLEET_HEALTH_LAST_SUCCESS_FLAG, new Date(T0.getTime() - 2 * HOUR).toISOString());

    const { page, pages } = recordingPager();
    const report = await runFleetFreshnessSweep({ flagStore: store, page, now: T0 });

    assert.equal(report.billingSyncStale, false);
    assert.equal(report.heartbeatStale, false);
    assert.equal(pages.length, 0);
  });
});
