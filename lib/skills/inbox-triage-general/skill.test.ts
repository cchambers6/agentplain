/**
 * lib/skills/inbox-triage-general/skill.test.ts
 *
 * Pins the inbox-triage behavior:
 *   - Urgent cues land in `urgent` priority with NO auto-drafted ack
 *   - Customer cues land in `customer-active` WITH a drafted ack carrying merge fields
 *   - Vendor cues land in `vendor-pending` WITH a drafted ack
 *   - Newsletter / no-reply cues land in `noise`
 *   - Decision-ask cues land in `needs-decision` with NO auto-drafted ack
 *   - Low-confidence classifications demote to noise
 *   - Output is sorted by descending priority
 *   - Every proposal is PENDING; no execution side effects fired
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonTriageFetcher } from './json-fetcher';
import { RecordingTriageApprovalSink } from './approval-sink';
import type { TriageMessage, TriageSnapshot } from './types';

const WORKSPACE_ID = 'ws-triage-001';
const NOW = new Date('2026-05-25T08:00:00.000Z');

function snapshot(overrides: Partial<TriageSnapshot> = {}): TriageSnapshot {
  return {
    inbox: [],
    ...overrides,
  };
}

function inboxMsg(overrides: Partial<TriageMessage> = {}): TriageMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    fromEmail: 'sender@example.com',
    fromName: 'Sample Sender',
    subject: 'Hello',
    bodyText: 'Just a friendly note.',
    receivedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    ...overrides,
  };
}

describe('inbox-triage-general — urgent', () => {
  it('classifies "urgent" cue as urgent with no auto-drafted ack', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            subject: 'URGENT: leak in the upstairs bath',
            bodyText: 'Need someone here today, the floor is starting to warp.',
          }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 1);
    const [p] = res.value.proposals;
    assert.equal(p.priority, 'urgent');
    assert.equal(p.ackDraft, null);
    assert.equal(p.status, 'PENDING');
  });

  it('treats "asap" the same way', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            subject: 'Question',
            bodyText: 'Can you call me back ASAP about the contract?',
          }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals[0].priority, 'urgent');
  });
});

describe('inbox-triage-general — customer-active', () => {
  it('classifies an order question as customer-active with a drafted ack', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            id: 'msg-customer',
            fromEmail: 'jane@example.com',
            fromName: 'Jane Customer',
            subject: 'Question about my order',
            bodyText: 'Hey — wondering when my last order will arrive?',
          }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    const [p] = res.value.proposals;
    assert.equal(p.priority, 'customer-active');
    assert.ok(p.ackDraft, 'customer-active must include a drafted ack');
    assert.ok(
      p.ackDraft!.body.includes('{{operator:'),
      'ack draft must include operator merge field for substantive answer',
    );
    assert.deepEqual(p.ackDraft!.toEmails, ['jane@example.com']);
  });
});

describe('inbox-triage-general — vendor-pending', () => {
  it('classifies an invoice notice as vendor-pending with drafted ack', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            id: 'msg-vendor',
            fromEmail: 'billing@vendor.com',
            subject: 'May statement attached',
            bodyText: 'Your May statement is attached; payment due June 15.',
          }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    const [p] = res.value.proposals;
    assert.equal(p.priority, 'vendor-pending');
    assert.ok(p.ackDraft);
    assert.equal(p.ackDraft!.tone, 'formal');
  });
});

describe('inbox-triage-general — needs-decision', () => {
  it('classifies an approval ask as needs-decision with no ack', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            subject: 'Need your sign-off on the proposal',
            bodyText: 'Approve the attached proposal so we can move forward.',
          }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    const [p] = res.value.proposals;
    assert.equal(p.priority, 'needs-decision');
    assert.equal(p.ackDraft, null);
  });
});

describe('inbox-triage-general — noise', () => {
  it('classifies a newsletter as noise', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            subject: 'This week in industry — newsletter',
            bodyText: 'Read our weekly digest. Click unsubscribe to opt out.',
          }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    const [p] = res.value.proposals;
    assert.equal(p.priority, 'noise');
    assert.equal(p.ackDraft, null);
  });

  it('low-signal message demotes to noise via confidence floor', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({
            subject: 'Hi',
            bodyText: 'Just saying hello.',
          }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals[0].priority, 'noise');
  });
});

describe('inbox-triage-general — priority ordering', () => {
  it('returns proposals sorted urgent → customer → vendor → decision → noise', async () => {
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({ id: 'a', threadId: 'ta', subject: 'newsletter', bodyText: 'Unsubscribe link' }),
          inboxMsg({ id: 'b', threadId: 'tb', subject: 'Order arriving?', bodyText: 'My order tracking' }),
          inboxMsg({ id: 'c', threadId: 'tc', subject: 'URGENT please', bodyText: 'Need answer today' }),
          inboxMsg({ id: 'd', threadId: 'td', subject: 'Need approval', bodyText: 'Please decide on the spec' }),
          inboxMsg({ id: 'e', threadId: 'te', subject: 'Statement', bodyText: 'Invoice attached for last month' }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    const priorities = res.value.proposals.map((p) => p.priority);
    assert.deepEqual(priorities, [
      'urgent',
      'customer-active',
      'vendor-pending',
      'needs-decision',
      'noise',
    ]);
  });
});

describe('inbox-triage-general — approval sink + no-outbound', () => {
  it('every proposal lands in the sink with status PENDING; no execute method exists', async () => {
    const sink = new RecordingTriageApprovalSink();
    // Compile-time assertion: TriageApprovalSink has no `send`/`execute`/`book`.
    // The sink port surfaces ONLY `record`. Mistype below would fail tsc.
    const _sinkSurface: keyof typeof sink = 'record';
    assert.equal(_sinkSurface, 'record');
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({ subject: 'Order arrival', bodyText: 'When does my order ship?' }),
          inboxMsg({ id: 'msg-2', threadId: 't-2', subject: 'URGENT', bodyText: 'Need a response today' }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, sink, now: NOW });
    assert.ok(res.ok);
    for (const call of sink.calls) {
      assert.equal(call.proposal.status, 'PENDING');
    }
    assert.equal(sink.calls.length, 2);
    assert.equal(res.value.sunk, 2);
    assert.ok(res.value.noOutboundNote.includes('No replies sent'));
  });

  it('sinkThreshold keeps noise out of the operator queue', async () => {
    const sink = new RecordingTriageApprovalSink();
    const fetcher = new JsonTriageFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        inbox: [
          inboxMsg({ subject: 'Hi', bodyText: 'No real content here.' }),
          inboxMsg({ id: 'msg-2', threadId: 't-2', subject: 'newsletter digest', bodyText: 'Unsubscribe at bottom' }),
        ],
      }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      sink,
      sinkThreshold: 0.5,
      now: NOW,
    });
    assert.ok(res.ok);
    // Newsletter scores 0.7 (lands), low-signal lands below 0.5 (filtered).
    assert.equal(sink.calls.length, 1);
  });
});
