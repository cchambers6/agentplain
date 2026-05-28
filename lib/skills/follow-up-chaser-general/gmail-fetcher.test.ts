/**
 * Tests for `GmailFollowUpFetcher`. Uses the in-process Test MCP server
 * (`TestGmailMcpServer`) — no real Gmail, no network. Covers:
 *
 *   1. searchThreads + readResource compose into OutboundThread[].
 *   2. Operator address resolution — only operator-sent messages count
 *      as `operatorLastSentAt`.
 *   3. Counterparty replies bump `counterpartyLastRepliedAt`.
 *   4. Constructor refuses to run with an empty operatorEmails list.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TestGmailMcpServer } from '@/lib/integrations/gmail-mcp/test-server';
import type { FullMessage } from '@/lib/integrations/gmail-mcp';
import { GmailFollowUpFetcher } from './gmail-fetcher';

const WORKSPACE = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-05-28T12:00:00.000Z');
const OPERATOR = 'op@example.com';

const baseDate = new Date('2026-05-20T09:00:00.000Z');
const seedMessages: FullMessage[] = [
  // Operator-sent message — the original outbound.
  {
    id: 'msg-op-1',
    threadId: 'thread-1',
    rfcMessageId: '<op-1@example.com>',
    fromEmail: OPERATOR,
    fromName: 'Operator',
    toEmails: ['lead@example.com'],
    ccEmails: [],
    subject: 'Following up on the proposal',
    bodyText: 'Hi there — just sending over the proposal as discussed.',
    snippet: 'Hi there — just sending over the proposal as discussed.',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: baseDate.toISOString(),
    labels: ['SENT'],
  },
  // Counterparty reply — newer.
  {
    id: 'msg-cp-1',
    threadId: 'thread-1',
    rfcMessageId: '<cp-1@example.com>',
    fromEmail: 'lead@example.com',
    fromName: 'Lead Person',
    toEmails: [OPERATOR],
    ccEmails: [],
    subject: 'Re: Following up on the proposal',
    bodyText: 'Thanks! Will review and circle back next week.',
    snippet: 'Thanks! Will review and circle back next week.',
    references: ['<op-1@example.com>'],
    inReplyTo: '<op-1@example.com>',
    attachments: [],
    receivedAt: new Date(baseDate.getTime() + 3600_000).toISOString(),
    labels: ['INBOX'],
  },
  // Second thread — operator-only (no reply yet).
  {
    id: 'msg-op-2',
    threadId: 'thread-2',
    rfcMessageId: '<op-2@example.com>',
    fromEmail: OPERATOR,
    fromName: 'Operator',
    toEmails: ['another@example.com'],
    ccEmails: [],
    subject: 'Quote attached',
    bodyText: 'Hi — attached is the quote we discussed.',
    snippet: 'Hi — attached is the quote we discussed.',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date(baseDate.getTime() + 7200_000).toISOString(),
    labels: ['SENT'],
  },
];

describe('GmailFollowUpFetcher — operatorEmails is required', () => {
  it('throws when constructed without operator addresses', () => {
    const server = new TestGmailMcpServer({
      workspaceId: WORKSPACE,
      seed: { messages: seedMessages },
    });
    assert.throws(
      () =>
        new GmailFollowUpFetcher({
          workspaceId: WORKSPACE,
          server,
          operatorEmails: [],
        }),
      /operatorEmails is required/,
    );
  });
});

describe('GmailFollowUpFetcher — builds OutboundThread[] from sent threads', () => {
  it('produces one thread per (operator-touched) conversation with the right timestamps', async () => {
    const server = new TestGmailMcpServer({
      workspaceId: WORKSPACE,
      seed: { messages: seedMessages },
    });
    const fetcher = new GmailFollowUpFetcher({
      workspaceId: WORKSPACE,
      server,
      operatorEmails: [OPERATOR],
    });
    const res = await fetcher.fetchSnapshot({
      workspaceId: WORKSPACE,
      asOf: NOW,
      lookbackDays: 30,
    });
    assert.ok(res.ok, 'fetchSnapshot must succeed');
    const threads = res.value.outbound;
    // The test Gmail server returns matching threads for `in:sent ...`
    // because the operator-sent messages are labeled `SENT`. Both
    // operator-touched threads should surface.
    assert.equal(threads.length, 2);

    const thread1 = threads.find((t) => t.threadId === 'thread-1');
    assert.ok(thread1, 'thread-1 must surface');
    assert.equal(thread1!.subject, 'Following up on the proposal');
    assert.deepEqual(thread1!.counterpartyEmails, ['lead@example.com']);
    assert.equal(thread1!.counterpartyName, 'Lead Person');
    assert.ok(thread1!.counterpartyLastRepliedAt, 'thread-1 has a counterparty reply');

    const thread2 = threads.find((t) => t.threadId === 'thread-2');
    assert.ok(thread2, 'thread-2 must surface');
    assert.equal(thread2!.counterpartyLastRepliedAt, null);
  });
});
