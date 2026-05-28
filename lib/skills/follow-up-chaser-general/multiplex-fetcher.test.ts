/**
 * Tests for `FollowUpMultiplexFetcher`. Mirrors the calendar-multiplex
 * tests in `lib/skills/scheduler/__tests__/`.
 *
 * Cases:
 *   1. Google preferred — when both Google + M365 active, Google fires.
 *   2. M365 fallback — when only M365 active, Outlook fires.
 *   3. NOT_CONFIGURED — when neither active, clean skill error.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FollowUpMultiplexFetcher } from './multiplex-fetcher';
import type { FollowUpFetcher, FollowUpSnapshot } from './types';
import { skillOk, type SkillResult } from '../types';

const WORKSPACE = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-05-28T12:00:00.000Z');

class TaggedFetcher implements FollowUpFetcher {
  readonly name: string;
  fired = false;
  constructor(name: string) {
    this.name = name;
  }
  async fetchSnapshot(): Promise<SkillResult<FollowUpSnapshot>> {
    this.fired = true;
    return skillOk({ outbound: [] });
  }
}

describe('FollowUpMultiplexFetcher — provider resolution', () => {
  it('prefers GOOGLE when both providers are active', async () => {
    const google = new TaggedFetcher('google');
    const outlook = new TaggedFetcher('outlook');
    const mux = new FollowUpMultiplexFetcher({
      workspaceId: WORKSPACE,
      testGoogle: google,
      testOutlook: outlook,
      testCredentials: [
        { provider: 'GOOGLE', accountEmail: 'op@example.com' },
        { provider: 'M365', accountEmail: 'op2@example.com' },
      ],
    });
    const res = await mux.fetchSnapshot({
      workspaceId: WORKSPACE,
      asOf: NOW,
      lookbackDays: 14,
    });
    assert.ok(res.ok);
    assert.equal(mux.provider, 'google');
    assert.equal(google.fired, true);
    assert.equal(outlook.fired, false);
  });

  it('falls back to M365 when only Outlook is active', async () => {
    const google = new TaggedFetcher('google');
    const outlook = new TaggedFetcher('outlook');
    const mux = new FollowUpMultiplexFetcher({
      workspaceId: WORKSPACE,
      testGoogle: google,
      testOutlook: outlook,
      testCredentials: [
        { provider: 'M365', accountEmail: 'op@example.com' },
      ],
    });
    const res = await mux.fetchSnapshot({
      workspaceId: WORKSPACE,
      asOf: NOW,
      lookbackDays: 14,
    });
    assert.ok(res.ok);
    assert.equal(mux.provider, 'm365');
    assert.equal(google.fired, false);
    assert.equal(outlook.fired, true);
  });

  it('returns NOT_CONFIGURED when neither provider is active', async () => {
    const mux = new FollowUpMultiplexFetcher({
      workspaceId: WORKSPACE,
      testGoogle: null,
      testOutlook: null,
      testCredentials: [],
    });
    const res = await mux.fetchSnapshot({
      workspaceId: WORKSPACE,
      asOf: NOW,
      lookbackDays: 14,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'NOT_CONFIGURED');
    }
    assert.equal(mux.provider, null);
  });
});
