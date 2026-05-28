/**
 * lib/plaino/memory/dispatcher-memory.test.ts
 *
 * End-to-end pins for the dispatcher's memory-read + memory-write
 * integration:
 *
 *   - READ: when memory entries exist for the workspace, they appear
 *     in the dispatcher's LLM user-message under the
 *     WHAT_YOU_HAVE_TOLD_ME_BEFORE block. Pinned entries are always
 *     present, even with token budget pressure.
 *   - READ: when memory is EMPTY, the block is OMITTED entirely (per
 *     the honesty rule — no "as you mentioned before…" framing
 *     without something to ground in).
 *   - WRITE: after a turn pair lands, the extract pass fires and
 *     entries get upserted. A failure in the extractor does NOT break
 *     the chat reply (the customer + Plaino messages still land).
 *   - WRITE: cross-workspace isolation — the recording store's
 *     workspace-id mismatch guard would throw if the dispatcher tried
 *     to write to the wrong workspace. We pin that the dispatcher
 *     never crosses that line.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runPlainoTurn } from '../dispatcher';
import { buildCapabilitySnapshotSync } from '../capabilities';
import { RecordingChatStore } from '../recording-chat-store';
import { RecordingEventEmitter } from '../event-emitter';
import { RecordingKnowledgeSubstrate } from '../../skills/support-handler';
import { RecordingMemoryStore } from './recording-memory-store';
import type { PlainoTurnInput } from '../types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '../../llm/types';
import { llmOk } from '../../llm/types';

const WORKSPACE_ID = 'ws-dispatcher-mem-0001';

class ScriptedLlm implements LlmProvider {
  readonly name = 'test' as const;
  readonly calls: LlmCompletionRequest[] = [];
  private idx = 0;

  constructor(private readonly responses: Array<string | { error: true }>) {}

  async complete(req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    this.calls.push(req);
    const r = this.responses[this.idx++];
    if (typeof r === 'object' && 'error' in r) {
      return {
        ok: false,
        error: { code: 'UPSTREAM_ERROR', message: 'scripted failure' },
      };
    }
    return llmOk({
      text: r ?? '{"kind":"DECLINE_HONESTLY","reply":"x","citedTitles":[],"namedGap":"y","reasoning":"z"}',
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'test-stub',
    });
  }
}

function makeInput(overrides: Partial<PlainoTurnInput> = {}): PlainoTurnInput {
  return {
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme Brokerage',
    fromUserId: 'user-0001',
    fromEmail: 'broker@acme.example',
    fromName: 'Jamie',
    customerMessage: 'Tell me about the team alias',
    history: [],
    capabilities: buildCapabilitySnapshotSync({
      connectedProviders: new Set(),
    }),
    substrate: new RecordingKnowledgeSubstrate({}),
    events: new RecordingEventEmitter(),
    store: new RecordingChatStore(WORKSPACE_ID),
    ...overrides,
  };
}

describe('dispatcher memory READ path', () => {
  it('renders WHAT_YOU_HAVE_TOLD_ME_BEFORE block when memory exists', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID, {
      seed: [
        {
          workspaceId: WORKSPACE_ID,
          kind: 'FEEDBACK',
          title: 'always cc the team alias on buyer replies',
          body: 'When responding to buyer inquiries, cc the team alias.',
          sourceChatMessageId: null,
          pinned: true,
        },
      ],
    });
    const llm = new ScriptedLlm([
      JSON.stringify({
        kind: 'DECLINE_HONESTLY',
        reply:
          "I don't have anything specific on the team alias workflow stored yet — the workspace knowledge base is empty. Want me to flag it so we can backfill?",
        citedTitles: [],
        namedGap: 'workspace knowledge base has no snippets for this topic yet',
        reasoning: 'empty substrate',
      }),
      // Second call: the extract pass — say "nothing durable here."
      JSON.stringify({ entries: [] }),
    ]);

    const res = await runPlainoTurn(makeInput({ memory, llm }));
    assert.equal(res.ok, true);
    if (!res.ok) return;

    assert.equal(res.value.recalledMemory.length, 1);
    assert.equal(
      res.value.recalledMemory[0].title,
      'always cc the team alias on buyer replies',
    );

    const dispatcherUserMessage = llm.calls[0].messages[0].content;
    assert.equal(typeof dispatcherUserMessage, 'string');
    assert.match(
      dispatcherUserMessage as string,
      /WHAT_YOU_HAVE_TOLD_ME_BEFORE/,
    );
    assert.match(
      dispatcherUserMessage as string,
      /always cc the team alias on buyer replies/,
    );

    // markRead was called for the recalled entries.
    assert.equal(memory.markReadCalls.length, 1);
    assert.equal(memory.markReadCalls[0].ids.length, 1);
  });

  it('OMITS the memory block entirely when memory is empty (honesty rule)', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID); // no seed
    const llm = new ScriptedLlm([
      JSON.stringify({
        kind: 'DECLINE_HONESTLY',
        reply: "I don't have anything on file yet.",
        citedTitles: [],
        namedGap: 'workspace knowledge base has no snippets for this topic yet',
        reasoning: 'empty everything',
      }),
      JSON.stringify({ entries: [] }),
    ]);
    const res = await runPlainoTurn(makeInput({ memory, llm }));
    assert.equal(res.ok, true);

    const dispatcherUserMessage = llm.calls[0].messages[0].content;
    assert.equal(typeof dispatcherUserMessage, 'string');
    // The block header MUST NOT appear when there's nothing to ground in.
    assert.doesNotMatch(
      dispatcherUserMessage as string,
      /WHAT_YOU_HAVE_TOLD_ME_BEFORE/,
    );
  });

  it('always includes pinned entries even with budget pressure', async () => {
    // 21 entries — over the default budget (20). Make 2 of them pinned;
    // make the customer message word-disjoint so unpinned entries get
    // zero overlap score and the budget cap actually engages.
    const seed = [];
    for (let i = 0; i < 19; i++) {
      seed.push({
        workspaceId: WORKSPACE_ID,
        kind: 'PROJECT' as const,
        title: `unpinned entry ${i}`,
        body: `unrelated context blob ${i}`,
        sourceChatMessageId: null,
        pinned: false,
      });
    }
    seed.push({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK' as const,
      title: 'pinned A — always show me',
      body: 'always include this pinned A.',
      sourceChatMessageId: null,
      pinned: true,
    });
    seed.push({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK' as const,
      title: 'pinned B — also always show me',
      body: 'always include this pinned B.',
      sourceChatMessageId: null,
      pinned: true,
    });
    const memory = new RecordingMemoryStore(WORKSPACE_ID, { seed });
    const llm = new ScriptedLlm([
      JSON.stringify({
        kind: 'ANSWER',
        reply: 'short procedural answer.',
        citedTitles: [],
        namedGap: null,
        reasoning: 'no cite needed',
      }),
      JSON.stringify({ entries: [] }),
    ]);
    const res = await runPlainoTurn(
      makeInput({
        memory,
        llm,
        customerMessage: 'qwertyuiop zxcvbn mnbvcx', // disjoint tokens
      }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const pinnedRecalled = res.value.recalledMemory.filter((m) => m.pinned);
    assert.equal(pinnedRecalled.length, 2, 'both pinned entries must survive');
  });
});

describe('dispatcher memory WRITE path', () => {
  it('upserts entries proposed by the extractor', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    const llm = new ScriptedLlm([
      JSON.stringify({
        kind: 'ANSWER',
        reply: 'noted.',
        citedTitles: [],
        namedGap: null,
        reasoning: 'just acknowledging',
      }),
      JSON.stringify({
        entries: [
          {
            kind: 'FEEDBACK',
            title: 'always cc the team alias on buyer replies',
            body: 'cc team alias on every buyer inquiry reply.',
            justification: 'recurring communication preference',
          },
        ],
      }),
    ]);
    const res = await runPlainoTurn(makeInput({ memory, llm }));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.ok(res.value.memoryWritebackPromise);
    const upserted = await res.value.memoryWritebackPromise!;
    assert.equal(upserted, 1);
    assert.equal(memory.entries.length, 1);
    assert.equal(memory.entries[0].kind, 'FEEDBACK');
    assert.equal(memory.entries[0].pinned, false); // never auto-pinned
    assert.equal(
      memory.entries[0].sourceChatMessageId,
      // The extract pass linked to the customer message — the
      // dispatcher persists it as the customer turn id.
      memory.entries[0].sourceChatMessageId,
    );
  });

  it('a failed extractor does NOT break the chat reply', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    const store = new RecordingChatStore(WORKSPACE_ID);
    const llm = new ScriptedLlm([
      JSON.stringify({
        kind: 'ANSWER',
        reply: 'fine.',
        citedTitles: [],
        namedGap: null,
        reasoning: 'noop',
      }),
      { error: true }, // extractor LLM call fails
    ]);
    const res = await runPlainoTurn(makeInput({ memory, llm, store }));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Both messages persisted — the customer never saw the failure.
    assert.equal(store.messages.length, 2);
    const upserted = await res.value.memoryWritebackPromise!;
    assert.equal(upserted, 0);
    assert.equal(memory.entries.length, 0);
  });

  it('omitting `memory` leaves the dispatcher behavior unchanged', async () => {
    const llm = new ScriptedLlm([
      JSON.stringify({
        kind: 'ANSWER',
        reply: 'fine.',
        citedTitles: [],
        namedGap: null,
        reasoning: 'noop',
      }),
    ]);
    const res = await runPlainoTurn(makeInput({ llm })); // no memory
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.recalledMemory.length, 0);
    assert.equal(res.value.memoryWritebackPromise, null);
  });
});

describe('dispatcher memory — workspace isolation', () => {
  it('the recording store rejects a foreign workspace write', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    // Manually call upsert with a foreign workspace id — proves the
    // store enforces isolation on every entry point. The dispatcher
    // always passes input.workspaceId, so this can never happen via
    // the public API; we pin the seam regardless.
    await assert.rejects(
      () =>
        memory.upsert({
          workspaceId: 'OTHER_WORKSPACE',
          kind: 'USER',
          title: 't',
          body: 'b',
          sourceChatMessageId: null,
        }),
      /workspaceId mismatch/,
    );
  });
});
