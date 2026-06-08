/**
 * lib/skills/pre-call-brief/run-upcoming.test.ts
 *
 * Wave-5 (theme #15). Proves the calendar windowing selects intro calls
 * ~30 min out (and skips non-intro events + out-of-window calls), and that
 * the fan-out collects briefs + failures without throwing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  selectImminentCalls,
  isIntroCall,
  buildBriefsForUpcomingCalls,
} from './run-upcoming';
import type { UpcomingCall } from './types';
import type { PreCallBriefResult } from './types';

const NOW = new Date('2026-06-08T15:00:00Z');

function ev(id: string, title: string, minutesFromNow: number): UpcomingCall {
  return {
    id,
    title,
    startUtc: new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString(),
  };
}

describe('selectImminentCalls', () => {
  it('selects intro calls ~30 min out within tolerance', () => {
    const events = [
      ev('a', 'Intro call — Acme', 30), // in window
      ev('b', 'Discovery: Beta', 25), // in window (lead-tol)
      ev('c', 'Demo with Gamma', 40), // in window (lead+tol)
      ev('d', 'Intro — Delta', 5), // too soon
      ev('e', 'Intro — Epsilon', 90), // too far
      ev('f', 'Team standup', 30), // in window but not an intro call
    ];
    const selected = selectImminentCalls({ events, now: NOW });
    const ids = selected.map((s) => s.id).sort();
    assert.deepEqual(ids, ['a', 'b', 'c']);
  });

  it('honors introOnly=false to brief every event in window', () => {
    const events = [ev('f', 'Team standup', 30)];
    const selected = selectImminentCalls({ events, now: NOW, introOnly: false });
    assert.equal(selected.length, 1);
  });
});

describe('isIntroCall', () => {
  it('matches intro / discovery / demo titles', () => {
    assert.equal(isIntroCall('Intro call — Acme'), true);
    assert.equal(isIntroCall('Quarterly review'), false);
  });
});

describe('buildBriefsForUpcomingCalls', () => {
  it('builds a brief per selected call and collects failures', async () => {
    const events = [
      ev('a', 'Intro call — Acme', 30),
      ev('b', 'Discovery: Beta', 30),
    ];
    const compose = async (c: UpcomingCall): Promise<PreCallBriefResult> => {
      if (c.id === 'b') {
        return { ok: false, error: { code: 'UPSTREAM_LLM_ERROR', message: 'x' } };
      }
      return {
        ok: true,
        value: {
          callId: c.id,
          subject: 'Acme',
          startUtc: c.startUtc,
          bullets: ['1', '2', '3', '4', '5'],
          citations: [],
          groundingIsLive: false,
        },
      };
    };
    const out = await buildBriefsForUpcomingCalls({
      events,
      // substrate unused because compose is injected
      substrate: { name: 'noop', searchForResearch: async () => [] },
      workspaceId: 'ws',
      now: NOW,
      compose,
    });
    assert.equal(out.considered, 2);
    assert.equal(out.selected, 2);
    assert.equal(out.briefs.length, 1);
    assert.equal(out.briefs[0].bullets.length, 5);
    assert.equal(out.failures.length, 1);
  });
});
