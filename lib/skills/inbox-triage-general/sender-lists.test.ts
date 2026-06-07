/**
 * lib/skills/inbox-triage-general/sender-lists.test.ts
 *
 * Settings-behavior audit (feat/settings-behavior-audit-fix): proves the
 * /settings/skills → inbox-triage sender lists (`flagFromSenders`,
 * `autoArchiveSenders`) are now LOAD-BEARING at fire time, not just
 * persisted. Before this wave both keys were badged "saved" and the
 * classifier ignored them.
 *
 *   - flagFromSenders forces a message to `urgent` regardless of body cues
 *   - autoArchiveSenders demotes a message to `noise` (no auto-ack)
 *   - the allowlist wins when a sender appears on both
 *   - matching supports exact address, `@domain.com`, and bare `domain.com`
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill, __testing } from './skill';
import { JsonTriageFetcher } from './json-fetcher';
import type { TriageMessage, TriageSnapshot } from './types';

const WORKSPACE_ID = 'ws-triage-senders';
const NOW = new Date('2026-05-25T08:00:00.000Z');

function snapshot(overrides: Partial<TriageSnapshot> = {}): TriageSnapshot {
  return { inbox: [], ...overrides };
}

function inboxMsg(overrides: Partial<TriageMessage> = {}): TriageMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    fromEmail: 'sender@example.com',
    fromName: 'Sample Sender',
    subject: 'Hello',
    bodyText: 'Just a friendly note with no urgency cue at all.',
    receivedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    ...overrides,
  };
}

describe('inbox-triage — flagFromSenders forces urgent', () => {
  it('a flagged sender tops the queue even with a benign body', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            fromEmail: 'compliance@partner.com',
            subject: 'Quarterly filing',
            bodyText: 'Please find the quarterly filing attached for your records.',
          }),
        ],
      }),
    });
    // Baseline: with no sender list this benign note is NOT urgent.
    const baseline = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(baseline.ok);
    assert.notEqual(baseline.value.proposals[0].priority, 'urgent');

    // With the sender flagged, it becomes urgent.
    const fetcher2 = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            fromEmail: 'compliance@partner.com',
            subject: 'Quarterly filing',
            bodyText: 'Please find the quarterly filing attached for your records.',
          }),
        ],
      }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: fetcher2,
      now: NOW,
      flagFromSenders: ['compliance@partner.com'],
    });
    assert.ok(res.ok);
    assert.equal(res.value.proposals[0].priority, 'urgent');
    assert.match(res.value.proposals[0].reasoning, /Flagged sender/);
    // Urgent never carries an auto-ack.
    assert.equal(res.value.proposals[0].ackDraft, null);
  });
});

describe('inbox-triage — autoArchiveSenders demotes to noise', () => {
  it('a denylisted sender is filed as noise with no ack', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            // Body would otherwise classify as customer-active ("order").
            fromEmail: 'updates@newsletter.io',
            subject: 'Your weekly order digest',
            bodyText: 'thanks for your order — here is this week roundup',
          }),
        ],
      }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      now: NOW,
      autoArchiveSenders: ['@newsletter.io'],
    });
    assert.ok(res.ok);
    assert.equal(res.value.proposals[0].priority, 'noise');
    assert.match(res.value.proposals[0].reasoning, /Auto-archive sender/);
    assert.equal(res.value.proposals[0].ackDraft, null);
  });
});

describe('inbox-triage — allowlist wins over denylist', () => {
  it('a sender on both lists surfaces as urgent, never archived', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [inboxMsg({ fromEmail: 'vip@client.com' })],
      }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      now: NOW,
      flagFromSenders: ['vip@client.com'],
      autoArchiveSenders: ['client.com'],
    });
    assert.ok(res.ok);
    assert.equal(res.value.proposals[0].priority, 'urgent');
  });
});

describe('inbox-triage — senderMatches pattern forms', () => {
  it('matches exact address, @domain, and bare domain; rejects others', () => {
    const { senderMatches } = __testing;
    assert.ok(senderMatches('a@b.com', ['a@b.com']));
    assert.ok(senderMatches('a@b.com', ['@b.com']));
    assert.ok(senderMatches('a@b.com', ['b.com']));
    assert.ok(senderMatches('A@B.COM', ['a@b.com'])); // case-insensitive
    assert.equal(senderMatches('a@b.com', ['c@b.com']), null);
    assert.equal(senderMatches('a@b.com', ['other.com']), null);
    assert.equal(senderMatches('a@b.com', []), null);
    assert.equal(senderMatches('', ['a@b.com']), null);
  });
});
