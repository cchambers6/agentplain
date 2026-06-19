import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseConversationIntelligenceWebhook,
  extractActionItems,
  writeVoiceActionItems,
  type VoiceActionPersistence,
} from './transcript-actions';

describe('parseConversationIntelligenceWebhook', () => {
  it('parses a multi-operator results array', () => {
    const payload = {
      callSid: 'CA123',
      conversationId: 'conv1',
      operatorResults: [
        { name: 'Summary', result: { text: 'Caller asked about a leaking water heater.' } },
        { name: 'Sentiment', result: { label: 'negative' } },
        {
          name: 'Action Items',
          result: {
            items: [
              {
                title: 'Call back re: water heater',
                summary: 'Unit 4B water heater is leaking onto the floor.',
                priority: 'urgent',
                callbackNumber: '+14155551212',
                nextSteps: ['Dispatch plumber', 'Notify tenant of ETA'],
              },
            ],
          },
        },
      ],
    };
    const parsed = parseConversationIntelligenceWebhook(payload);
    assert.ok(parsed);
    assert.equal(parsed!.callSid, 'CA123');
    assert.equal(parsed!.conversationId, 'conv1');
    assert.equal(parsed!.summary, 'Caller asked about a leaking water heater.');
    assert.equal(parsed!.sentiment, 'negative');
    assert.equal(parsed!.rawActionItems.length, 1);
    assert.equal(parsed!.rawActionItems[0].priority, 'urgent');
  });

  it('returns null without a call id', () => {
    assert.equal(parseConversationIntelligenceWebhook({ foo: 'bar' }), null);
    assert.equal(parseConversationIntelligenceWebhook(null), null);
  });

  it('tolerates a bare summary-only payload (PascalCase CallSid)', () => {
    const parsed = parseConversationIntelligenceWebhook({
      CallSid: 'CA9',
      result: { name: 'summary', text: 'Someone called about pricing.' },
    });
    assert.ok(parsed);
    assert.equal(parsed!.callSid, 'CA9');
  });
});

describe('extractActionItems', () => {
  it('maps raw items and normalizes priority/sentiment', () => {
    const items = extractActionItems({
      callSid: 'CA1',
      summary: 'sum',
      sentiment: 'mixed',
      rawActionItems: [
        { title: 'Do X', summary: 'details', priority: 'emergency' },
        { priority: 'whatever' }, // unknown priority → normal, falls back to summary
      ],
    });
    assert.equal(items.length, 2);
    assert.equal(items[0].priority, 'urgent'); // emergency → urgent
    assert.equal(items[0].sentiment, 'mixed');
    assert.equal(items[1].priority, 'normal');
    assert.equal(items[1].summary, 'sum'); // fell back to call summary
    assert.equal(items[1].title, 'Follow up on inbound call');
  });

  it('produces a single fallback card from a bare summary', () => {
    const items = extractActionItems({ callSid: 'CA1', summary: 'A caller asked about hours.', rawActionItems: [] });
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Follow up on inbound call');
  });

  it('produces nothing when there is no signal at all', () => {
    const items = extractActionItems({ callSid: 'CA1', rawActionItems: [] });
    assert.equal(items.length, 0);
  });
});

describe('writeVoiceActionItems', () => {
  it('writes one approvals-queue row per action item with stable refIds', async () => {
    const rows: Array<{ workspaceId: string; refId: string; payload: unknown }> = [];
    const persistence: VoiceActionPersistence = {
      async create(row) {
        rows.push(row);
        return { id: `row-${rows.length}` };
      },
    };
    const { created, items } = await writeVoiceActionItems({
      workspaceId: 'ws1',
      parsed: {
        callSid: 'CA123',
        summary: 'sum',
        rawActionItems: [
          { title: 'A', summary: 'a' },
          { title: 'B', summary: 'b' },
        ],
      },
      persistence,
    });
    assert.deepEqual(created, ['row-1', 'row-2']);
    assert.equal(items.length, 2);
    assert.deepEqual(
      rows.map((r) => r.refId),
      ['CA123:0', 'CA123:1'],
    );
    // Payload carries the callSid + the item fields for the approvals card.
    const p0 = rows[0].payload as Record<string, unknown>;
    assert.equal(p0.callSid, 'CA123');
    assert.equal(p0.type, 'voice-call-action-item');
    assert.equal(p0.title, 'A');
  });
});
