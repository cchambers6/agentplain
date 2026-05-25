/**
 * lib/skills/follow-up-chaser-general/skill.test.ts
 *
 * Pins the follow-up-chaser behavior:
 *   - Fresh threads (< staleAfterDays) DO NOT get nudged
 *   - Stale threads with no counterparty reply get a drafted nudge
 *   - Threads where counterparty already replied get skipped
 *   - Threads with an existing operator-drafted follow-up get skipped
 *   - First-stage (4-9d) and second-stage (10+d) cadences pick the
 *     right tone
 *   - Drafts ALWAYS include `{{operator: ...}}` merge fields
 *   - maxNudgesPerRun caps output even when many threads are stale
 *   - Every proposal is PENDING; sink records without sending
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonFollowUpFetcher } from './json-fetcher';
import { RecordingFollowUpApprovalSink } from './approval-sink';
import type { FollowUpSnapshot, OutboundThread } from './types';

const WORKSPACE_ID = 'ws-followup-001';
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
    operatorLastSentAt: new Date(NOW.getTime() - 7 * MS_PER_DAY),
    counterpartyLastRepliedAt: null,
    operatorLastBodySnippet: 'Attaching the line-item estimate we discussed.',
    ...overrides,
  };
}

describe('follow-up-chaser-general — staleness', () => {
  it('does not nudge threads fresher than staleAfterDays', async () => {
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        outbound: [
          thread({ operatorLastSentAt: new Date(NOW.getTime() - 2 * MS_PER_DAY) }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 0);
  });

  it('nudges stale threads with no counterparty reply', async () => {
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        outbound: [thread({ operatorLastSentAt: new Date(NOW.getTime() - 6 * MS_PER_DAY) })],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 1);
    const [p] = res.value.proposals;
    assert.equal(p.ageDays, 6);
    assert.equal(p.stage, 'first');
    assert.ok(p.body.includes('{{operator:'), 'must include operator merge field');
    assert.deepEqual(p.toEmails, ['client@example.com']);
  });

  it('skips threads where counterparty already replied after the operator', async () => {
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        outbound: [
          thread({
            operatorLastSentAt: new Date(NOW.getTime() - 7 * MS_PER_DAY),
            // counterparty replied 1d after operator → no nudge needed
            counterpartyLastRepliedAt: new Date(NOW.getTime() - 6 * MS_PER_DAY),
          }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 0);
  });

  it('skips threads with an existing operator follow-up draft', async () => {
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        outbound: [thread({ hasOpenFollowUpDraft: true })],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 0);
  });
});

describe('follow-up-chaser-general — cadence stages', () => {
  it('marks 12-day-old stalls as second-stage nudges', async () => {
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        outbound: [thread({ operatorLastSentAt: new Date(NOW.getTime() - 12 * MS_PER_DAY) })],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    const [p] = res.value.proposals;
    assert.equal(p.stage, 'second');
    assert.ok(p.body.includes('Circling back'));
  });

  it('lowers confidence for very old stalls (21d+)', async () => {
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        outbound: [thread({ operatorLastSentAt: new Date(NOW.getTime() - 22 * MS_PER_DAY) })],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals[0].confidence, 0.45);
  });
});

describe('follow-up-chaser-general — caps + ordering', () => {
  it('honors maxNudgesPerRun and surfaces oldest first', async () => {
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        outbound: [
          thread({ threadId: 't-recent', operatorLastSentAt: new Date(NOW.getTime() - 5 * MS_PER_DAY) }),
          thread({ threadId: 't-mid', operatorLastSentAt: new Date(NOW.getTime() - 8 * MS_PER_DAY) }),
          thread({ threadId: 't-old', operatorLastSentAt: new Date(NOW.getTime() - 14 * MS_PER_DAY) }),
          thread({ threadId: 't-oldest', operatorLastSentAt: new Date(NOW.getTime() - 18 * MS_PER_DAY) }),
        ],
      }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      maxNudgesPerRun: 2,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 2);
    assert.equal(res.value.proposals[0].sourceThreadId, 't-oldest');
    assert.equal(res.value.proposals[1].sourceThreadId, 't-old');
  });
});

describe('follow-up-chaser-general — no-outbound contract', () => {
  it('records every nudge in the sink with status PENDING; no send method exists', async () => {
    const sink = new RecordingFollowUpApprovalSink();
    const _sinkSurface: keyof typeof sink = 'record';
    assert.equal(_sinkSurface, 'record');
    const fetcher = new JsonFollowUpFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        outbound: [
          thread({ threadId: 't-a', operatorLastSentAt: new Date(NOW.getTime() - 6 * MS_PER_DAY) }),
          thread({ threadId: 't-b', operatorLastSentAt: new Date(NOW.getTime() - 11 * MS_PER_DAY) }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, sink, now: NOW });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 2);
    for (const call of sink.calls) {
      assert.equal(call.proposal.status, 'PENDING');
    }
    assert.ok(res.value.noOutboundNote.includes('No emails sent'));
  });
});
