/**
 * lib/plaino/instruction-handler.test.ts
 *
 * Pins the instruction-handler contract — reads a PLAINO_INSTRUCTION
 * approval queue item, drafts via the LLM honoring any matching
 * FEEDBACK rules, persists the draft back into the same row's payload.
 *
 * Uses the RecordingInstructionQueueStore + RecordingMemoryStore so the
 * tests are DB-free.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInstructionHandlerSystemPrompt,
  buildInstructionHandlerUserPrompt,
  INSTRUCTION_HANDLER_PROMPT_VERSION,
  RecordingInstructionQueueStore,
  RecordingMemoryStore,
  runInstructionHandler,
} from './index';
import {
  buildPreferenceMemoryBody,
  PREFERENCE_MEMORY_TITLE_PREFIX,
} from './preference-memory';
import { getDiscipline } from '../disciplines';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '../llm/types';
import { llmOk } from '../llm/types';

const WORKSPACE_ID = 'ws-instr-handler-0001';
const APPROVAL_ID = 'approval-instr-0001';

class StubLlm implements LlmProvider {
  readonly name = 'test' as const;
  readonly calls: LlmCompletionRequest[] = [];
  constructor(private readonly response: string) {}
  async complete(req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    this.calls.push(req);
    return llmOk({
      text: this.response,
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'test-stub',
    });
  }
}

describe('instruction-handler — discipline-tagged drafting', () => {
  it('drafts the work, persists into the approval queue, returns honored rules', async () => {
    const store = new RecordingInstructionQueueStore();
    store.seed({
      approvalQueueItemId: APPROVAL_ID,
      workspaceId: WORKSPACE_ID,
      instructionText:
        'Draft a follow-up to John about the Atlanta listing close date.',
      targetDiscipline: 'sales-enablement',
      sourceChatMessageId: 'chat-msg-0001',
      sourceUserId: 'user-0001',
      reasoning: 'sales-enablement follow-up draft',
    });

    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    // Pre-set a customer preference for email drafts — the handler
    // should pull this in via the email-draft scope mapped to
    // sales-enablement.
    await memory.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'FEEDBACK',
      title: `${PREFERENCE_MEMORY_TITLE_PREFIX}email-draft`,
      body: buildPreferenceMemoryBody({
        scope: 'email-draft',
        rule: "Always sign emails to clients with 'Warmly, Sarah' (not 'Best')",
      }),
      sourceChatMessageId: 'chat-msg-pref',
    });

    const llm = new StubLlm(
      JSON.stringify({
        draftBody:
          "Hi John,\n\nFollowing up on the Atlanta listing — wanted to confirm a close date that works for you.\n\nWarmly,\nSarah",
        reasoning:
          'Honored the email-draft preference (Warmly, Sarah sign-off).',
      }),
    );

    const res = await runInstructionHandler({
      approvalQueueItemId: APPROVAL_ID,
      store,
      memory,
      llm,
    });

    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.approvalQueueItemId, APPROVAL_ID);
    assert.match(res.value.draftBody, /Warmly,\nSarah/);
    assert.equal(res.value.honoredRules.length, 1);
    assert.equal(res.value.honoredRules[0].scope, 'email-draft');
    assert.match(res.value.honoredRules[0].rule, /Warmly, Sarah/);

    // Draft was persisted back.
    assert.equal(store.attachedDrafts.length, 1);
    assert.equal(store.attachedDrafts[0].approvalQueueItemId, APPROVAL_ID);

    // LLM call carried the system prompt + cacheSystem.
    assert.equal(llm.calls.length, 1);
    assert.match(
      llm.calls[0].system,
      new RegExp(`^${INSTRUCTION_HANDLER_PROMPT_VERSION}`),
    );
    assert.equal(llm.calls[0].cacheSystem, true);
    // System prompt included the rule text so the LLM saw it.
    assert.match(llm.calls[0].system, /Warmly, Sarah/);
  });

  it('returns ok with empty honoredRules when no FEEDBACK rules are set', async () => {
    const store = new RecordingInstructionQueueStore();
    store.seed({
      approvalQueueItemId: APPROVAL_ID,
      workspaceId: WORKSPACE_ID,
      instructionText: 'Summarize the latest contract terms.',
      targetDiscipline: 'legal',
      sourceChatMessageId: 'chat-msg-legal',
      sourceUserId: 'user-0001',
      reasoning: 'legal summary',
    });
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    const llm = new StubLlm(
      JSON.stringify({
        draftBody: 'Contract terms: ...',
        reasoning: 'fresh draft, no prefs',
      }),
    );
    const res = await runInstructionHandler({
      approvalQueueItemId: APPROVAL_ID,
      store,
      memory,
      llm,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.honoredRules.length, 0);
    assert.equal(store.attachedDrafts.length, 1);
  });

  it('re-fire on already-drafted item is a no-op (returns NOT_APPLICABLE)', async () => {
    const store = new RecordingInstructionQueueStore();
    store.seed({
      approvalQueueItemId: APPROVAL_ID,
      workspaceId: WORKSPACE_ID,
      instructionText: 'Draft something.',
      targetDiscipline: 'operations',
      sourceChatMessageId: 'chat-msg-ops',
      sourceUserId: 'user-0001',
      reasoning: 'ops draft',
    });
    const llm = new StubLlm(
      JSON.stringify({ draftBody: 'd', reasoning: 'r' }),
    );
    const first = await runInstructionHandler({
      approvalQueueItemId: APPROVAL_ID,
      store,
      llm,
    });
    assert.equal(first.ok, true);
    const second = await runInstructionHandler({
      approvalQueueItemId: APPROVAL_ID,
      store,
      llm,
    });
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.error.code, 'NOT_APPLICABLE');
  });

  it('rejects an invalid discipline on the queue item', async () => {
    const store = new RecordingInstructionQueueStore();
    store.seed({
      approvalQueueItemId: APPROVAL_ID,
      workspaceId: WORKSPACE_ID,
      instructionText: 'Do something.',
      targetDiscipline: 'made-up',
      sourceChatMessageId: 'chat-msg-bad',
      sourceUserId: 'user-0001',
      reasoning: 'bad discipline',
    });
    const llm = new StubLlm('{"draftBody":"x","reasoning":"y"}');
    const res = await runInstructionHandler({
      approvalQueueItemId: APPROVAL_ID,
      store,
      llm,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
  });

  it('renders prompts that pin discipline + customer-preferences block', () => {
    const discipline = getDiscipline('marketing');
    assert.ok(discipline);
    const system = buildInstructionHandlerSystemPrompt({
      discipline: discipline!,
      honoredRules: [
        { entryId: 'r1', scope: 'email-draft', rule: 'No exclamation marks' },
      ],
    });
    assert.match(system, /DISCIPLINE: marketing/);
    assert.match(system, /CUSTOMER PREFERENCES/);
    assert.match(system, /No exclamation marks/);
    const user = buildInstructionHandlerUserPrompt({
      item: {
        approvalQueueItemId: APPROVAL_ID,
        workspaceId: WORKSPACE_ID,
        instructionText: 'Draft a launch announcement',
        targetDiscipline: 'marketing',
        sourceChatMessageId: 'm',
        sourceUserId: 'u',
        reasoning: 'launch',
      },
    });
    assert.match(user, /Draft a launch announcement/);
  });
});
