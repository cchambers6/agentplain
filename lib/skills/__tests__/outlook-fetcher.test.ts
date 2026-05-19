/**
 * Tests for the OutlookMessageAdapter (MCP-backed MessageFetcher +
 * DraftPersister for the value loop). Symmetric peer of any GmailMessageAdapter
 * tests; we pin the same `fetchMessagesForEvent → fetchThreadMessages →
 * persistDraft` contract on Outlook-shaped fixtures.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildOutlookMcpServer } from '@/lib/integrations/outlook-mcp';
import { OutlookMessageAdapter } from '../outlook-fetcher';

const WORKSPACE_ID = '11111111-2222-3333-4444-555555555555';

function makeEvent(rawPayload: object) {
  return {
    id: 'webhook-event-id',
    subscriptionId: 'sub-id',
    rawPayload,
    receivedAt: new Date(),
    processed: false,
    processedAt: null,
    error: null,
  } as unknown as import('@prisma/client').WebhookEvent;
}

describe('OutlookMessageAdapter.fetchMessagesForEvent', () => {
  it('reads resourceData.id from the Graph notification envelope', async () => {
    const server = buildOutlookMcpServer({
      workspaceId: WORKSPACE_ID,
      preferTestImpl: true,
    });
    const adapter = new OutlookMessageAdapter({ workspaceId: WORKSPACE_ID, server });

    const event = makeEvent({
      value: [
        {
          subscriptionId: 'sub-1',
          clientState: 'irrelevant-here',
          resource: 'users/aad-oid-001/messages/AAMkAfixture-msg-001',
          resourceData: { id: 'AAMkAfixture-msg-001' },
        },
      ],
    });

    const res = await adapter.fetchMessagesForEvent(event);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.value.length, 1);
      assert.equal(res.value[0].id, 'AAMkAfixture-msg-001');
      assert.equal(res.value[0].fromEmail, 'jane.buyer@example.com');
    }
  });

  it('falls back to inbox tip on lifecycle-only events', async () => {
    const server = buildOutlookMcpServer({
      workspaceId: WORKSPACE_ID,
      preferTestImpl: true,
    });
    const adapter = new OutlookMessageAdapter({ workspaceId: WORKSPACE_ID, server });

    const event = makeEvent({
      value: [
        {
          subscriptionId: 'sub-1',
          clientState: 'irrelevant-here',
          lifecycleEvent: 'reauthorizationRequired',
          resource: 'users/aad-oid-001',
        },
      ],
    });

    const res = await adapter.fetchMessagesForEvent(event);
    assert.equal(res.ok, true);
    if (res.ok) {
      // Three fixture messages in TestOutlookMcpServer's defaultFixtures.
      assert.ok(res.value.length > 0);
    }
  });

  it('skips NOT_FOUND messages inside a batch without crashing', async () => {
    const server = buildOutlookMcpServer({
      workspaceId: WORKSPACE_ID,
      preferTestImpl: true,
    });
    const adapter = new OutlookMessageAdapter({ workspaceId: WORKSPACE_ID, server });

    const event = makeEvent({
      value: [
        { resourceData: { id: 'AAMkAfixture-msg-001' } },
        { resourceData: { id: 'does-not-exist' } },
        { resourceData: { id: 'AAMkAfixture-msg-002' } },
      ],
    });

    const res = await adapter.fetchMessagesForEvent(event);
    assert.equal(res.ok, true);
    if (res.ok) {
      // The missing id is skipped; the other two are fetched.
      assert.equal(res.value.length, 2);
      assert.equal(res.value[0].id, 'AAMkAfixture-msg-001');
      assert.equal(res.value[1].id, 'AAMkAfixture-msg-002');
    }
  });
});

describe('OutlookMessageAdapter.fetchThreadMessages', () => {
  it('returns all messages on a thread sorted by the MCP server', async () => {
    const server = buildOutlookMcpServer({
      workspaceId: WORKSPACE_ID,
      preferTestImpl: true,
    });
    const adapter = new OutlookMessageAdapter({ workspaceId: WORKSPACE_ID, server });

    const res = await adapter.fetchThreadMessages('AAQkAfixture-thread-001');
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.ok(res.value.length >= 2, 'thread has at least the inbound + outbound message');
      for (const msg of res.value) {
        assert.equal(msg.threadId, 'AAQkAfixture-thread-001');
      }
    }
  });
});

describe('OutlookMessageAdapter.persistDraft', () => {
  it('creates a draft and returns the provider draft id', async () => {
    const server = buildOutlookMcpServer({
      workspaceId: WORKSPACE_ID,
      preferTestImpl: true,
    });
    const adapter = new OutlookMessageAdapter({ workspaceId: WORKSPACE_ID, server });

    const res = await adapter.persistDraft({
      workspaceId: WORKSPACE_ID,
      threadId: 'AAQkAfixture-thread-001',
      inReplyToMessageId: '<lead-001@example.com>',
      toEmails: ['jane.buyer@example.com'],
      subject: 'Re: Interested in 123 Peachtree St',
      body: 'Hi Jane, see you Wednesday at 2pm.',
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.value.providerDraftId, /^AAMkAtest-/);
    }
  });

  it('rejects when workspaceId does not match the bound server', async () => {
    const server = buildOutlookMcpServer({
      workspaceId: WORKSPACE_ID,
      preferTestImpl: true,
    });
    const adapter = new OutlookMessageAdapter({ workspaceId: WORKSPACE_ID, server });

    const res = await adapter.persistDraft({
      workspaceId: '22222222-2222-2222-2222-222222222222',
      threadId: 'x',
      inReplyToMessageId: null,
      toEmails: ['who@example.com'],
      subject: 's',
      body: 'b',
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'INVALID_INPUT');
  });
});
