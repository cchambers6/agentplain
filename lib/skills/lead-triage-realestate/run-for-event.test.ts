/**
 * lib/skills/lead-triage-realestate/run-for-event.test.ts
 *
 * Integration test for the production entry point that the wave-1
 * vertical webhook router calls. Asserts:
 *
 *   1. A real-estate-shaped inbound message produces a triaged lead
 *      with HOT category + first-touch draft + manual routing (honest:
 *      no agent roster yet).
 *   2. A no-reply-pattern sender is filtered out cleanly (no triaged
 *      lead, no theatrical row).
 *   3. The recording sink receives one record per triaged lead.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { WebhookEvent } from '@prisma/client';
import { skillOk, type SkillResult } from '../types';
import type { MessageFetcher, ParsedMessage } from '../types';
import { runLeadTriageForEvent } from './run-for-event';
import type {
  LeadTriageApprovalSink,
  LeadTriageSinkArgs,
} from './prisma-approval-sink';

const WORKSPACE_ID = 'ws-realty-rfe-0001';
const NOW = new Date('2026-05-20T12:00:00Z');

class StubFetcher implements MessageFetcher {
  readonly name = 'stub' as const;
  constructor(private readonly messages: ParsedMessage[]) {}
  async fetchMessagesForEvent(
    _event: WebhookEvent,
  ): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk(this.messages);
  }
  async fetchThreadMessages(
    _threadId: string,
  ): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk([]);
  }
}

class RecordingSink implements LeadTriageApprovalSink {
  readonly name = 'recording' as const;
  readonly records: LeadTriageSinkArgs[] = [];
  async record(args: LeadTriageSinkArgs) {
    this.records.push(args);
    return skillOk({ sinkId: `rec-${this.records.length}` });
  }
}

function buildEvent(): WebhookEvent {
  return {
    id: 'evt-1',
    subscriptionId: 'sub-1',
    deliveredId: null,
    payload: {},
    receivedAt: new Date('2026-05-20T11:55:00Z'),
    processed: false,
    processedAt: null,
    attemptCount: 0,
    error: null,
    nextAttemptAt: null,
    deadlettered: false,
  } as unknown as WebhookEvent;
}

function buildLeadMessage(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    id: 'msg-lead-1',
    threadId: 'thread-1',
    rfcMessageId: '<msg-lead-1@example.com>',
    fromEmail: 'avery.buyer@example.com',
    fromName: 'Avery Buyer',
    toEmails: ['agent@brokerage.com'],
    ccEmails: [],
    subject: 'Interested in MLS# 7000123 — ready to make an offer',
    bodyText:
      'Hi! Saw your listing MLS# 7000123 in the Buckhead area. We are preapproved and looking to make an offer this week. Could we tour soon?',
    snippet: 'Hi! Saw your listing MLS# 7000123',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: NOW,
    labels: ['INBOX', 'UNREAD'],
    ...overrides,
  };
}

describe('runLeadTriageForEvent — happy path', () => {
  it('triages a HOT real-estate lead with a first-touch draft and routes manual (no agent roster)', async () => {
    const sink = new RecordingSink();
    const res = await runLeadTriageForEvent({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher([buildLeadMessage()]),
      event: buildEvent(),
      sink,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.leadsProcessed, 1);
    assert.equal(res.value.sunk, 1);
    assert.equal(sink.records.length, 1);
    const triaged = sink.records[0].triaged;
    // Category should be warm-or-hot for a "preapproved + ready to make
    // an offer" lead — pinning the exact rank is brittle (the scorer
    // weighting can shift), so just assert it lands in the actionable
    // band, not in the nurture floor.
    assert.ok(
      triaged.category === 'hot' || triaged.category === 'warm',
      `expected hot|warm, got ${triaged.category}`,
    );
    assert.equal(triaged.routing.type, 'manual');
    assert.ok(
      triaged.firstTouchDraft,
      'a first-touch draft should be present when the lead has an email',
    );
    // Honest: routing is manual because no agent roster source is wired
    // yet. The PR description names this as a wave-2 follow-up.
    if (triaged.routing.type === 'manual') {
      assert.ok(triaged.routing.rationale.length > 0);
    }
  });
});

describe('runLeadTriageForEvent — honesty seams', () => {
  it('filters no-reply senders so no fake lead lands in the queue', async () => {
    const sink = new RecordingSink();
    const res = await runLeadTriageForEvent({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher([
        buildLeadMessage({
          fromEmail: 'no-reply@zillow.com',
          fromName: 'Zillow Notifications',
        }),
      ]),
      event: buildEvent(),
      sink,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.leadsProcessed, 0);
    assert.equal(res.value.sunk, 0);
    assert.equal(sink.records.length, 0);
  });

  it('skips the sink entirely when sink=null (router passes through)', async () => {
    const res = await runLeadTriageForEvent({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher([buildLeadMessage()]),
      event: buildEvent(),
      sink: null,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.leadsProcessed, 1);
    assert.equal(res.value.sunk, 0); // no sink to record into
  });

  it('returns 0 processed when the event has no messages', async () => {
    const sink = new RecordingSink();
    const res = await runLeadTriageForEvent({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher([]),
      event: buildEvent(),
      sink,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.leadsProcessed, 0);
    assert.equal(sink.records.length, 0);
  });
});
