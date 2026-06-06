/**
 * lib/skills/follow-up-chaser-general/nudge-tone.test.ts
 *
 * Settings-behavior audit (feat/settings-behavior-audit-fix): proves the
 * /settings/skills → follow-up-chaser `nudgeTone` knob is now LOAD-BEARING.
 * Before this wave the field was badged "saved" and the nudge body ignored
 * it. Now each tone produces materially different wording on every fire.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonFollowUpFetcher } from './json-fetcher';
import type { FollowUpSnapshot, OutboundThread } from './types';

const WORKSPACE_ID = 'ws-followup-tone';
const NOW = new Date('2026-05-25T08:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function snapshot(overrides: Partial<FollowUpSnapshot> = {}): FollowUpSnapshot {
  return { outbound: [], ...overrides };
}

function thread(overrides: Partial<OutboundThread> = {}): OutboundThread {
  return {
    threadId: 'thread-1',
    subject: 'Quote on your remodel',
    counterpartyEmails: ['client@example.com'],
    counterpartyName: 'Sam Client',
    // 7 days stale → first-stage nudge.
    operatorLastSentAt: new Date(NOW.getTime() - 7 * MS_PER_DAY),
    counterpartyLastRepliedAt: null,
    operatorLastBodySnippet: 'Attaching the line-item estimate we discussed.',
    ...overrides,
  };
}

async function nudgeBody(nudgeTone?: 'professional' | 'warm' | 'firm') {
  const fetcher = new JsonFollowUpFetcher({
    workspaceId: WORKSPACE_ID,
    snapshot: snapshot({ outbound: [thread()] }),
  });
  const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW, nudgeTone });
  assert.ok(res.ok);
  assert.equal(res.value.proposals.length, 1);
  return res.value.proposals[0].body;
}

describe('follow-up-chaser — nudgeTone changes the draft body', () => {
  it('professional (default) keeps the original "bumping this up" line', async () => {
    const body = await nudgeBody('professional');
    assert.match(body, /bumping this up/);
    // Default with no tone passed must match explicit professional.
    const def = await nudgeBody(undefined);
    assert.equal(def, body);
  });

  it('warm softens the wording (no rush / gently)', async () => {
    const body = await nudgeBody('warm');
    assert.match(body, /gently|no rush/i);
    assert.doesNotMatch(body, /bumping this up/);
  });

  it('firm makes the ask direct (where this stands)', async () => {
    const body = await nudgeBody('firm');
    assert.match(body, /where this stands/i);
    assert.doesNotMatch(body, /bumping this up/);
  });

  it('all three tones still carry the operator merge fields (no-outbound)', async () => {
    for (const tone of ['professional', 'warm', 'firm'] as const) {
      const body = await nudgeBody(tone);
      assert.match(body, /\{\{operator:/);
    }
  });
});
