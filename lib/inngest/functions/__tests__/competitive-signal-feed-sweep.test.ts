/**
 * Contract test for the competitive-signal feed cron.
 *
 * Proves:
 *   - the happy path drafts a digest (sink receives it) from the fixture
 *     provider, with stable function-id + cron strings (Inngest contract);
 *   - the cron RESPECTS gateSkillFire: a denying gate skips the run entirely —
 *     no provider call, no sink, status='gated' with the gate reason;
 *   - default gate (no injected outcome, no fleet workspace configured) fails
 *     OPEN so internal GTM work is not blocked by the absence of a customer
 *     workspace.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  runCompetitiveSignalFeedSweep,
  COMPETITIVE_SIGNAL_FEED_SWEEP_FUNCTION_ID,
  COMPETITIVE_SIGNAL_FEED_SWEEP_CRON,
} from '../competitive-signal-feed-sweep';
import {
  FixtureSignalProvider,
  type CompetitiveSignalDigest,
  type CompetitiveSignalProvider,
} from '@/lib/competitive-signals';

const NOW = new Date('2026-06-07T00:00:00Z');

describe('competitive-signal feed cron', () => {
  it('function id + cron are stable strings (Inngest contract)', () => {
    assert.equal(
      COMPETITIVE_SIGNAL_FEED_SWEEP_FUNCTION_ID,
      'agentplain-competitive-signal-feed-sweep',
    );
    assert.equal(COMPETITIVE_SIGNAL_FEED_SWEEP_CRON, '0 16 * * MON');
  });

  it('drafts a digest from the fixture provider on the happy path', async () => {
    let captured: CompetitiveSignalDigest | null = null;
    const out = await runCompetitiveSignalFeedSweep({
      provider: new FixtureSignalProvider({ now: NOW }),
      gateFire: async () => ({ allowed: true }),
      sink: (digest) => {
        captured = digest;
      },
      now: NOW,
    });
    assert.equal(out.status, 'drafted');
    assert.equal(out.gated, false);
    assert.equal(out.providerName, 'fixture');
    assert.equal(out.providerIsLive, false);
    assert.ok(out.totalSignals > 0);
    assert.equal(out.sectionCount, 3);
    assert.ok(captured, 'sink should receive the drafted digest');
  });

  it('RESPECTS gateSkillFire — a denying gate skips the run', async () => {
    let providerCalled = false;
    const spyProvider: CompetitiveSignalProvider = {
      name: 'spy',
      isLive: false,
      async fetchSignals() {
        providerCalled = true;
        return { ok: true, value: [] };
      },
    };
    let sinkCalled = false;
    const out = await runCompetitiveSignalFeedSweep({
      provider: spyProvider,
      gateFire: async () => ({
        allowed: false,
        reason: 'workspace-paused',
        detail: 'Fleet paused through 2026-06-30T00:00:00.000Z.',
      }),
      sink: () => {
        sinkCalled = true;
      },
      now: NOW,
    });
    assert.equal(out.status, 'gated');
    assert.equal(out.gated, true);
    assert.match(out.gateReason ?? '', /Fleet paused/);
    assert.equal(out.totalSignals, 0);
    assert.equal(providerCalled, false, 'a gated run must not query the provider');
    assert.equal(sinkCalled, false, 'a gated run must not draft a digest');
  });

  it('fails OPEN by default when no gate override and no fleet workspace configured', async () => {
    const prev = process.env.COMPETITIVE_SIGNAL_FLEET_WORKSPACE_ID;
    delete process.env.COMPETITIVE_SIGNAL_FLEET_WORKSPACE_ID;
    try {
      const out = await runCompetitiveSignalFeedSweep({
        provider: new FixtureSignalProvider({ now: NOW }),
        now: NOW,
      });
      assert.equal(out.status, 'drafted', 'internal feed should run when no customer workspace gates it');
      assert.equal(out.gated, false);
    } finally {
      if (prev === undefined) {
        delete process.env.COMPETITIVE_SIGNAL_FLEET_WORKSPACE_ID;
      } else {
        process.env.COMPETITIVE_SIGNAL_FLEET_WORKSPACE_ID = prev;
      }
    }
  });
});
