/**
 * lib/inngest/functions/__tests__/pre-call-brief-sweep.test.ts
 *
 * Wave-5 (theme #15). Proves the pre-call-brief sweep honors the fire gate
 * (vacation pause / off-window) and the billing-paused gate before doing
 * any brief work, and that it briefs the imminent intro calls otherwise.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runPreCallBriefSweep } from '../b2b-sales-rep-pre-call-brief';
import { RecordingResearchSubstrate } from '@/lib/skills/research-on-demand-general';
import type { UpcomingCall } from '@/lib/skills/pre-call-brief';

const NOW = new Date('2026-06-08T15:00:00Z');

function introIn(minutes: number): UpcomingCall {
  return {
    id: `evt-${minutes}`,
    title: 'Intro call — Acme Realty',
    startUtc: new Date(NOW.getTime() + minutes * 60_000).toISOString(),
  };
}

describe('runPreCallBriefSweep — fire gate', () => {
  it('skips a workspace when the fire gate denies (no briefs)', async () => {
    const out = await runPreCallBriefSweep({
      now: NOW,
      listCandidates: async () => [{ id: 'ws-1' }],
      isPaused: async () => ({ isPaused: false }),
      gateFire: async () => ({
        allowed: false,
        reason: 'off-window',
        detail: 'outside window',
      }),
      fetchEvents: async () => [introIn(30)],
      buildSubstrate: () =>
        new RecordingResearchSubstrate({
          'ws-1': [{ title: 't', bodyExcerpt: 'b', sourceUrl: null, similarity: 0.5 }],
        }),
    });
    assert.equal(out.workspacesSkippedFireGate, 1);
    assert.equal(out.callsBriefed, 0);
  });

  it('skips a paused workspace', async () => {
    const out = await runPreCallBriefSweep({
      now: NOW,
      listCandidates: async () => [{ id: 'ws-1' }],
      isPaused: async () => ({ isPaused: true }),
      gateFire: async () => ({ allowed: true }),
      fetchEvents: async () => [introIn(30)],
      buildSubstrate: () => new RecordingResearchSubstrate({}),
    });
    assert.equal(out.workspacesSkippedPaused, 1);
    assert.equal(out.callsBriefed, 0);
  });

  it('briefs imminent intro calls when gates allow', async () => {
    const out = await runPreCallBriefSweep({
      now: NOW,
      listCandidates: async () => [{ id: 'ws-1' }],
      isPaused: async () => ({ isPaused: false }),
      gateFire: async () => ({ allowed: true }),
      fetchEvents: async () => [introIn(30), introIn(5) /* too soon */],
      buildSubstrate: () =>
        new RecordingResearchSubstrate({
          'ws-1': [
            {
              title: 'Acme profile',
              bodyExcerpt: 'Independent brokerage in Atlanta.',
              sourceUrl: 'https://example.com/acme',
              similarity: 0.8,
            },
          ],
        }),
    });
    assert.equal(out.workspacesConsidered, 1);
    assert.equal(out.callsBriefed, 1);
    assert.equal(out.failures.length, 0);
  });
});
