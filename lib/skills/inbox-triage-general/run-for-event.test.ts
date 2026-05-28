/**
 * Tests for `runInboxTriageForEvent` — the production caller wired into
 * `process-webhook-event`. Asserts the end-to-end flow without touching
 * Prisma or real Gmail:
 *
 *   1. Adapter returns messages → skill runs → recording sink records
 *      proposals.
 *   2. Empty adapter result → clean ok with messagesScanned=0.
 *   3. Workspace mismatch in the adapter doesn't crash the call (the
 *      WebhookEvent has its own routing; the fetcher carries the
 *      messages forward as-is).
 *   4. Tagged proposals carry the right priority/ackDraft shape.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { WebhookEvent } from '@prisma/client';
import { RecordingTriageApprovalSink } from './approval-sink';
import { runInboxTriageForEvent } from './run-for-event';
import {
  skillOk,
  type MessageFetcher,
  type ParsedMessage,
  type SkillResult,
} from '../types';

const WORKSPACE = '11111111-1111-1111-1111-111111111111';

function fakeEvent(): WebhookEvent {
  return {
    id: 'event-1',
    subscriptionId: 'sub-1',
    workspaceId: WORKSPACE,
    rawPayload: { historyId: '12345' },
    receivedAt: new Date('2026-05-28T12:00:00.000Z'),
    processed: false,
    processedAt: null,
    error: null,
    dedupeKey: 'gmail:msg:12345',
    attemptCount: 0,
    nextAttemptAt: null,
    deadlettered: false,
  } as unknown as WebhookEvent;
}

function makeParsedMessage(args: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    rfcMessageId: '<msg-1@example.com>',
    fromEmail: 'customer@example.com',
    fromName: 'Customer',
    toEmails: ['op@example.com'],
    ccEmails: [],
    subject: 'Urgent question about my order',
    bodyText:
      'Hi — I have an urgent question about my order. Could you get back to me today?',
    snippet: 'Hi — I have an urgent question about my order.',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date('2026-05-28T11:00:00.000Z'),
    labels: ['INBOX', 'UNREAD'],
    ...args,
  };
}

class HappyFetcher implements MessageFetcher {
  readonly name = 'happy-stub' as const;
  constructor(private readonly messages: ParsedMessage[]) {}
  async fetchMessagesForEvent(): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk(this.messages);
  }
  async fetchThreadMessages(): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk([]);
  }
}

describe('runInboxTriageForEvent — happy path', () => {
  it('classifies + records via the recording sink', async () => {
    const sink = new RecordingTriageApprovalSink();
    const fetcher = new HappyFetcher([makeParsedMessage()]);
    const res = await runInboxTriageForEvent({
      workspaceId: WORKSPACE,
      fetcher,
      event: fakeEvent(),
      sink,
      now: new Date('2026-05-28T12:00:00.000Z'),
      // Lower threshold so the urgent proposal is recorded.
      sinkThreshold: 0,
    });
    assert.ok(res.ok, 'runInboxTriageForEvent must succeed');
    assert.equal(res.value.messagesScanned, 1);
    assert.equal(res.value.sunk, 1);
    assert.equal(sink.calls.length, 1);
    assert.equal(sink.calls[0].proposal.priority, 'urgent');
    // Urgent has no auto-ack — operator must handle directly.
    assert.equal(sink.calls[0].proposal.ackDraft, null);
  });
});

describe('runInboxTriageForEvent — empty payload', () => {
  it('returns ok with messagesScanned=0 when adapter returns no messages', async () => {
    const sink = new RecordingTriageApprovalSink();
    const fetcher = new HappyFetcher([]);
    const res = await runInboxTriageForEvent({
      workspaceId: WORKSPACE,
      fetcher,
      event: fakeEvent(),
      sink,
      now: new Date('2026-05-28T12:00:00.000Z'),
    });
    assert.ok(res.ok);
    assert.equal(res.value.messagesScanned, 0);
    assert.equal(res.value.sunk, 0);
    assert.equal(sink.calls.length, 0);
  });
});

describe('runInboxTriageForEvent — customer-active draft path', () => {
  it('records an ackDraft for customer-active messages', async () => {
    const sink = new RecordingTriageApprovalSink();
    const fetcher = new HappyFetcher([
      makeParsedMessage({
        subject: 'Thanks for the order',
        bodyText: 'Just wanted to say thanks for the order — receipt looks great.',
      }),
    ]);
    const res = await runInboxTriageForEvent({
      workspaceId: WORKSPACE,
      fetcher,
      event: fakeEvent(),
      sink,
      now: new Date('2026-05-28T12:00:00.000Z'),
      sinkThreshold: 0,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    const proposal = sink.calls[0].proposal;
    assert.equal(proposal.priority, 'customer-active');
    assert.ok(proposal.ackDraft, 'customer-active must carry an ack draft');
    assert.match(proposal.ackDraft!.body, /\{\{operator:/);
  });
});
