/**
 * lib/skills/vertical-router.test.ts
 *
 * Integration test for the wave-1 vertical webhook router. Pins:
 *
 *   1. A `real_estate` workspace's inbound message dispatches the
 *      lead-triage-realestate skill alongside the generic chain.
 *   2. An `insurance` workspace's inbound message dispatches ZERO
 *      vertical skills (honest — no wave-1 adapter for insurance yet).
 *   3. A disabled `sales-enablement` discipline on a real-estate
 *      workspace skips the lead-triage dispatch cleanly (the gap is
 *      named in the outcomes list, no fake row lands).
 *   4. The `registeredVerticalSkillsFor` helper returns the correct
 *      set per vertical.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { WebhookEvent, Workspace } from '@prisma/client';
import { skillOk, type SkillResult } from './types';
import type { MessageFetcher, ParsedMessage } from './types';
import {
  registeredVerticalSkillsFor,
  runVerticalRouter,
  type RouterDispatchOutcome,
} from './vertical-router';

const WORKSPACE_ID = 'ws-realty-router-test-0001';
const NOW = new Date('2026-05-20T12:00:00Z');

function buildWorkspace(vertical: Workspace['vertical']): Pick<
  Workspace,
  'id' | 'slug' | 'name' | 'vertical'
> {
  return {
    id: WORKSPACE_ID,
    slug: 'realty-router',
    name: 'Realty Router Test',
    vertical,
  };
}

function buildEvent(): WebhookEvent {
  // Minimal stub — fields the router and skill don't read are filled
  // with sensible defaults.
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

function buildMessage(): ParsedMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    rfcMessageId: '<msg-1@example.com>',
    fromEmail: 'lead@example.com',
    fromName: 'Avery Lead',
    toEmails: ['agent@brokerage.com'],
    ccEmails: [],
    subject: 'Interested in MLS# 7000123',
    bodyText:
      'Hi — I saw MLS# 7000123 and want to schedule a tour. I am preapproved with my lender. Looking to make an offer this month.',
    snippet: 'Hi — I saw MLS# 7000123',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: NOW,
    labels: ['INBOX', 'UNREAD'],
  };
}

class StubMessageFetcher implements MessageFetcher {
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

describe('vertical-router — registry helper', () => {
  it('returns lead-triage-realestate for REAL_ESTATE workspaces', () => {
    assert.deepEqual(registeredVerticalSkillsFor('REAL_ESTATE'), [
      'lead-triage-realestate',
    ]);
  });

  it('returns empty array for other verticals (no wave-1 adapter yet)', () => {
    assert.deepEqual(registeredVerticalSkillsFor('INSURANCE'), []);
    assert.deepEqual(registeredVerticalSkillsFor('CPA'), []);
    assert.deepEqual(registeredVerticalSkillsFor('LAW'), []);
  });
});

describe('vertical-router — dispatch by vertical', () => {
  it('dispatches lead-triage-realestate on a REAL_ESTATE workspace', async () => {
    const fetcher = new StubMessageFetcher([buildMessage()]);
    const result = await runVerticalRouter({
      workspace: buildWorkspace('REAL_ESTATE'),
      event: buildEvent(),
      fetcher,
      disabledDisciplineIds: [],
      now: NOW,
    });
    assert.equal(result.dispatched, 1);
    assert.equal(result.skipped, 0);
    const dispatched = result.outcomes.find(
      (o) => o.status === 'dispatched',
    ) as Extract<RouterDispatchOutcome, { status: 'dispatched' }> | undefined;
    assert.ok(dispatched, 'expected one dispatched outcome');
    assert.equal(dispatched.skillSlug, 'lead-triage-realestate');
  });

  it('dispatches ZERO vertical skills on an INSURANCE workspace (no wave-1 adapter)', async () => {
    const fetcher = new StubMessageFetcher([buildMessage()]);
    const result = await runVerticalRouter({
      workspace: buildWorkspace('INSURANCE'),
      event: buildEvent(),
      fetcher,
      disabledDisciplineIds: [],
      now: NOW,
    });
    assert.equal(result.dispatched, 0);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.outcomes, []);
  });

  it('dispatches ZERO vertical skills on a CPA workspace', async () => {
    const fetcher = new StubMessageFetcher([buildMessage()]);
    const result = await runVerticalRouter({
      workspace: buildWorkspace('CPA'),
      event: buildEvent(),
      fetcher,
      disabledDisciplineIds: [],
      now: NOW,
    });
    assert.equal(result.dispatched, 0);
    assert.deepEqual(result.outcomes, []);
  });
});

describe('vertical-router — discipline-disable gate', () => {
  it('skips lead-triage-realestate when sales-enablement is disabled', async () => {
    const fetcher = new StubMessageFetcher([buildMessage()]);
    const result = await runVerticalRouter({
      workspace: buildWorkspace('REAL_ESTATE'),
      event: buildEvent(),
      fetcher,
      disabledDisciplineIds: ['sales-enablement'],
      now: NOW,
    });
    assert.equal(result.dispatched, 0);
    assert.equal(result.skipped, 1);
    const skip = result.outcomes.find(
      (o) => o.status === 'skipped-discipline-disabled',
    );
    assert.ok(skip, 'expected one skip outcome');
    assert.equal(skip.skillSlug, 'lead-triage-realestate');
  });

  it('runs the skill when an unrelated discipline is disabled', async () => {
    const fetcher = new StubMessageFetcher([buildMessage()]);
    const result = await runVerticalRouter({
      workspace: buildWorkspace('REAL_ESTATE'),
      event: buildEvent(),
      fetcher,
      disabledDisciplineIds: ['legal'],
      now: NOW,
    });
    assert.equal(result.dispatched, 1);
    assert.equal(result.skipped, 0);
  });
});
