/**
 * lib/plaino/memory/extract-from-conversation.test.ts
 *
 * Pins:
 *   - Durable-fact path: a turn containing a real customer preference
 *     produces a validated ProposedMemoryEntry with kind / title / body
 *     / justification populated, and the source-chat-message id is
 *     linked back to the customer's turn id.
 *   - Ephemeral chatter path: a "thanks!" / greeting return value of
 *     `{"entries": []}` is honored — no proposed entries.
 *   - PII guard: an entry whose title contains an email is dropped at
 *     the seam (defense-in-depth on top of the prompt instruction).
 *   - Malformed JSON / LLM error: returns no proposed entries (so the
 *     dispatcher doesn't crash on an upstream wobble).
 *   - System prompt is marked cacheable so each fire amortizes through
 *     the prompt cache.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractMemoryFromConversation } from './extract-from-conversation';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '../../llm/types';
import { llmError, llmOk } from '../../llm/types';

const WORKSPACE_ID = 'ws-memory-extract-0001';

class StubLlm implements LlmProvider {
  readonly name = 'test' as const;
  readonly calls: LlmCompletionRequest[] = [];
  constructor(
    private readonly response:
      | { kind: 'ok'; text: string }
      | { kind: 'err'; code: 'NETWORK' | 'UPSTREAM_ERROR' },
  ) {}
  async complete(req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    this.calls.push(req);
    if (this.response.kind === 'err') {
      return llmError(this.response.code, 'stub failure');
    }
    return llmOk({
      text: this.response.text,
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 25 },
      model: 'test-stub',
    });
  }
}

describe('extractMemoryFromConversation — durable-fact path', () => {
  it('produces a validated entry with kind / title / body / justification + links source-chat-message id', async () => {
    const llm = new StubLlm({
      kind: 'ok',
      text: JSON.stringify({
        entries: [
          {
            kind: 'FEEDBACK',
            title: 'always cc the team alias on buyer replies',
            body: 'When responding to buyer inquiries, cc the team alias so the rest of the team sees every reply, not just the broker-owner.',
            justification:
              'This is an explicit communication preference that should shape every future buyer-inquiry draft.',
          },
        ],
      }),
    });
    const result = await extractMemoryFromConversation({
      workspaceId: WORKSPACE_ID,
      turns: [
        {
          role: 'customer',
          body:
            'Heads up — always cc the team alias when you respond to buyer inquiries. The team wants to see every reply.',
          chatMessageId: 'msg-customer-0001',
        },
        {
          role: 'plaino',
          body:
            'Got it — I will include the team alias on every buyer reply I draft from here on.',
          chatMessageId: 'msg-plaino-0001',
        },
      ],
      llm,
    });

    assert.equal(result.proposed.length, 1);
    const p = result.proposed[0];
    assert.equal(p.kind, 'FEEDBACK');
    assert.match(p.title, /cc/);
    assert.match(p.body, /team alias/);
    assert.ok(p.justification.length > 0);
    // Source defaults to the latest customer turn when the LLM omitted it.
    assert.equal(p.sourceChatMessageId, 'msg-customer-0001');
    // System prompt was passed through cacheable.
    assert.equal(llm.calls[0].cacheSystem, true);
  });
});

describe('extractMemoryFromConversation — ephemeral chatter path', () => {
  it('returns empty when the LLM honestly says nothing is durable', async () => {
    const llm = new StubLlm({
      kind: 'ok',
      text: JSON.stringify({ entries: [] }),
    });
    const result = await extractMemoryFromConversation({
      workspaceId: WORKSPACE_ID,
      turns: [
        { role: 'customer', body: 'thanks!', chatMessageId: 'msg-c-1' },
        {
          role: 'plaino',
          body: 'happy to help.',
          chatMessageId: 'msg-p-1',
        },
      ],
      llm,
    });
    assert.equal(result.proposed.length, 0);
    assert.equal(result.meta.rawCount, 0);
  });
});

describe('extractMemoryFromConversation — PII guard', () => {
  it('drops entries whose title contains an email address', async () => {
    const llm = new StubLlm({
      kind: 'ok',
      text: JSON.stringify({
        entries: [
          {
            kind: 'USER',
            // Title contains an email — the prompt forbids this and the
            // seam-level guard catches the slip.
            title: 'send updates to jsmith@acme.example',
            body: 'Customer prefers updates via email.',
            justification: 'recurring channel preference',
          },
          {
            kind: 'FEEDBACK',
            title: 'short reports — bullets not paragraphs',
            body: 'Reports should be bullet lists, not prose.',
            justification: 'recurring formatting preference',
          },
        ],
      }),
    });
    const result = await extractMemoryFromConversation({
      workspaceId: WORKSPACE_ID,
      turns: [
        {
          role: 'customer',
          body: 'placeholder',
          chatMessageId: 'msg-c',
        },
      ],
      llm,
    });
    assert.equal(result.proposed.length, 1);
    assert.equal(result.proposed[0].kind, 'FEEDBACK');
    assert.equal(result.meta.droppedCount, 1);
    assert.equal(result.meta.rawCount, 2);
  });
});

describe('extractMemoryFromConversation — failure surface', () => {
  it('LLM error returns an empty proposed list', async () => {
    const llm = new StubLlm({ kind: 'err', code: 'UPSTREAM_ERROR' });
    const result = await extractMemoryFromConversation({
      workspaceId: WORKSPACE_ID,
      turns: [{ role: 'customer', body: 'x', chatMessageId: 'm' }],
      llm,
    });
    assert.equal(result.proposed.length, 0);
  });

  it('malformed JSON returns an empty proposed list', async () => {
    const llm = new StubLlm({
      kind: 'ok',
      text: 'not json at all — {{{',
    });
    const result = await extractMemoryFromConversation({
      workspaceId: WORKSPACE_ID,
      turns: [{ role: 'customer', body: 'x', chatMessageId: 'm' }],
      llm,
    });
    assert.equal(result.proposed.length, 0);
  });

  it('empty turns short-circuits — no LLM call', async () => {
    const llm = new StubLlm({ kind: 'ok', text: '{"entries":[]}' });
    const result = await extractMemoryFromConversation({
      workspaceId: WORKSPACE_ID,
      turns: [],
      llm,
    });
    assert.equal(result.proposed.length, 0);
    assert.equal(llm.calls.length, 0);
  });
});
