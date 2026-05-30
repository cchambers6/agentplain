/**
 * lib/plaino/dispatcher-instruct-preference.test.ts
 *
 * Pins the V2 dispatcher contract for the two new honest paths:
 *
 *   INSTRUCT  — customer asks the fleet to DO concrete work. Dispatcher
 *               classifies a targetDiscipline, creates a
 *               PLAINO_INSTRUCTION approval queue item via the chat
 *               store, fires `agentplain/instruction.created`, and
 *               attaches the approval id to the Plaino message metadata
 *               so the chat surface can render the WORK_LINK tile.
 *
 *   PREFERENCE — customer tells the fleet HOW they want things done.
 *               Dispatcher extracts the rule + scope, upserts a FEEDBACK
 *               WorkspaceMemoryEntry via the memory store, and replies
 *               with a calm confirmation.
 *
 * Mirrors the recording-store + stub-LLM pattern from dispatcher.test.ts.
 * Tests run with the existing RecordingChatStore / RecordingEventEmitter
 * /  RecordingMemoryStore — no DB / runtime dependency.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runPlainoTurn } from './dispatcher';
import { buildCapabilitySnapshotSync } from './capabilities';
import { RecordingChatStore } from './recording-chat-store';
import { RecordingEventEmitter } from './event-emitter';
import { RecordingMemoryStore } from './memory';
import {
  parsePreferenceMemoryBody,
  PREFERENCE_MEMORY_TITLE_PREFIX,
} from './preference-memory';
import { RecordingKnowledgeSubstrate } from '../skills/support-handler';
import type {
  PlainoCapabilitySnapshot,
  PlainoTurnInput,
} from './types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '../llm/types';
import { llmOk } from '../llm/types';

const WORKSPACE_ID = 'ws-plaino-instruct-0001';

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

function emptyCapabilities(): PlainoCapabilitySnapshot {
  return buildCapabilitySnapshotSync({ connectedProviders: new Set() });
}

function makeInput(
  overrides: Partial<PlainoTurnInput> = {},
): PlainoTurnInput {
  return {
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme Brokerage',
    fromUserId: 'user-instr-0001',
    fromEmail: 'broker@acme.example',
    fromName: 'Jamie',
    customerMessage: 'Draft a follow-up to John about the Atlanta listing.',
    history: [],
    capabilities: emptyCapabilities(),
    substrate: new RecordingKnowledgeSubstrate({}),
    events: new RecordingEventEmitter(),
    store: new RecordingChatStore(WORKSPACE_ID),
    ...overrides,
  };
}

// ── INSTRUCT path ───────────────────────────────────────────────────────

describe('plaino dispatcher V2 — INSTRUCT path', () => {
  it('creates a PLAINO_INSTRUCTION approval, fires the inngest event, stores the approval id on the Plaino message', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const events = new RecordingEventEmitter();
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'INSTRUCT',
        reply:
          "Got it — I'll herd this through the sales-enablement team. The draft will land in your approval queue in a few minutes.",
        citedTitles: [],
        namedGap: null,
        targetDiscipline: 'sales-enablement',
        preferenceRule: null,
        preferenceScope: null,
        reasoning: 'Customer asked the fleet to draft a follow-up email.',
      }),
    );
    const res = await runPlainoTurn(
      makeInput({
        store,
        events,
        llm,
        customerMessage:
          'Draft a follow-up to John about the Atlanta listing close date.',
      }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.classification.kind, 'INSTRUCT');
    assert.equal(
      res.value.classification.targetDiscipline,
      'sales-enablement',
    );
    assert.ok(res.value.instructionApprovalId);

    // Chat store recorded the instruction-approval row.
    assert.equal(store.createdInstructionApprovals.length, 1);
    const recorded = store.createdInstructionApprovals[0];
    assert.equal(recorded.id, res.value.instructionApprovalId);
    assert.equal(recorded.workspaceId, WORKSPACE_ID);
    assert.equal(recorded.targetDiscipline, 'sales-enablement');
    assert.equal(recorded.fromUserId, 'user-instr-0001');
    assert.equal(
      recorded.instructionText,
      'Draft a follow-up to John about the Atlanta listing close date.',
    );
    assert.equal(recorded.sourceChatMessageId, store.messages[0].id);

    // Inngest event fired with the approval id.
    assert.equal(events.events.length, 1);
    assert.equal(events.events[0].name, 'agentplain/instruction.created');
    assert.equal(
      events.events[0].data.approvalQueueItemId,
      res.value.instructionApprovalId,
    );
    assert.equal(events.events[0].data.workspaceId, WORKSPACE_ID);
    assert.equal(
      events.events[0].data.targetDiscipline,
      'sales-enablement',
    );

    // Plaino message metadata carries the approval id + discipline.
    const plainoMessage = store.messages[1];
    const metadata = plainoMessage.metadata;
    assert.ok(metadata);
    assert.equal(metadata?.kind, 'INSTRUCT');
    assert.equal(
      metadata?.instructionApprovalId,
      res.value.instructionApprovalId,
    );
    assert.equal(metadata?.targetDiscipline, 'sales-enablement');

    // No SupportRequest created — INSTRUCT is its own path.
    assert.equal(store.createdSupportRequests.length, 0);
  });

  it('rejects INSTRUCT with no targetDiscipline', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const events = new RecordingEventEmitter();
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'INSTRUCT',
        reply: "Sure — handing this off now.",
        citedTitles: [],
        namedGap: null,
        targetDiscipline: null,
        preferenceRule: null,
        preferenceScope: null,
        reasoning: 'forgot to set discipline',
      }),
    );
    const res = await runPlainoTurn(
      makeInput({ store, events, llm }),
    );
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'PARSE_ERROR');
    // Placeholder reply persists so the chat is not silent.
    assert.equal(store.messages.length, 2);
    assert.equal(store.createdInstructionApprovals.length, 0);
    assert.equal(events.events.length, 0);
  });

  it('rejects INSTRUCT with a discipline outside the locked 8', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const events = new RecordingEventEmitter();
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'INSTRUCT',
        reply: "Handing this off.",
        citedTitles: [],
        namedGap: null,
        targetDiscipline: 'made-up-discipline',
        preferenceRule: null,
        preferenceScope: null,
        reasoning: 'tried to pass a non-discipline',
      }),
    );
    const res = await runPlainoTurn(
      makeInput({ store, events, llm }),
    );
    assert.equal(res.ok, false);
    assert.equal(store.createdInstructionApprovals.length, 0);
  });

  it('rejects INSTRUCT whose reply claims completion', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'INSTRUCT',
        reply: "Done. I just sent it.",
        citedTitles: [],
        namedGap: null,
        targetDiscipline: 'sales-enablement',
        preferenceRule: null,
        preferenceScope: null,
        reasoning: 'attempted completion claim',
      }),
    );
    const res = await runPlainoTurn(makeInput({ store, llm }));
    assert.equal(res.ok, false);
    assert.equal(store.createdInstructionApprovals.length, 0);
  });
});

// ── PREFERENCE path ────────────────────────────────────────────────────

describe('plaino dispatcher V2 — PREFERENCE path', () => {
  it('upserts a FEEDBACK memory entry with the scope-encoded body and confirms in chat', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    const events = new RecordingEventEmitter();
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'PREFERENCE',
        reply:
          "Got it — I've saved that for the team. Plaino will herd by that rule from now on.",
        citedTitles: [],
        namedGap: null,
        targetDiscipline: null,
        preferenceRule:
          'Flag mail from county clerks as high priority',
        preferenceScope: 'inbox-triage',
        reasoning: 'Customer set a triage rule.',
      }),
    );
    const res = await runPlainoTurn(
      makeInput({
        store,
        events,
        llm,
        memory,
        customerMessage:
          'Next time, flag legal mail from county clerks as high priority.',
      }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.classification.kind, 'PREFERENCE');
    assert.equal(
      res.value.classification.preferenceScope,
      'inbox-triage',
    );
    assert.ok(res.value.preferenceMemoryId);

    // Memory store saw the upsert.
    const entries = await memory.listForWorkspace({
      workspaceId: WORKSPACE_ID,
    });
    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.equal(entry.kind, 'FEEDBACK');
    assert.equal(
      entry.title,
      `${PREFERENCE_MEMORY_TITLE_PREFIX}inbox-triage`,
    );
    const parsed = parsePreferenceMemoryBody(entry.body);
    assert.ok(parsed);
    assert.equal(parsed?.scope, 'inbox-triage');
    assert.equal(
      parsed?.rule,
      'Flag mail from county clerks as high priority',
    );
    assert.equal(entry.sourceChatMessageId, store.messages[0].id);

    // Plaino message metadata exposes the memory entry id + scope.
    const plainoMessage = store.messages[1];
    assert.equal(plainoMessage.metadata?.kind, 'PREFERENCE');
    assert.equal(
      plainoMessage.metadata?.preferenceMemoryId,
      res.value.preferenceMemoryId,
    );
    assert.equal(plainoMessage.metadata?.preferenceScope, 'inbox-triage');

    // No approval queue item — PREFERENCE is memory-only.
    assert.equal(store.createdInstructionApprovals.length, 0);
    assert.equal(store.createdSupportRequests.length, 0);
    // No Inngest event — PREFERENCE is synchronous to the memory store.
    assert.equal(events.events.length, 0);
  });

  it('rejects PREFERENCE without a preferenceRule', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'PREFERENCE',
        reply: "Sure.",
        citedTitles: [],
        namedGap: null,
        targetDiscipline: null,
        preferenceRule: null,
        preferenceScope: 'inbox-triage',
        reasoning: 'forgot rule',
      }),
    );
    const res = await runPlainoTurn(makeInput({ llm, memory }));
    assert.equal(res.ok, false);
    const entries = await memory.listForWorkspace({
      workspaceId: WORKSPACE_ID,
    });
    assert.equal(entries.length, 0);
  });

  it('rejects PREFERENCE with a scope outside the locked 8', async () => {
    const memory = new RecordingMemoryStore(WORKSPACE_ID);
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'PREFERENCE',
        reply: "Saved.",
        citedTitles: [],
        namedGap: null,
        targetDiscipline: null,
        preferenceRule: 'use first names',
        preferenceScope: 'made-up-scope',
        reasoning: 'invalid scope',
      }),
    );
    const res = await runPlainoTurn(makeInput({ llm, memory }));
    assert.equal(res.ok, false);
    const entries = await memory.listForWorkspace({
      workspaceId: WORKSPACE_ID,
    });
    assert.equal(entries.length, 0);
  });

  it('PREFERENCE without an attached memory store returns ok but does not persist', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'PREFERENCE',
        reply: "Got it.",
        citedTitles: [],
        namedGap: null,
        targetDiscipline: null,
        preferenceRule: 'always sign as Warmly, Sarah',
        preferenceScope: 'email-draft',
        reasoning: 'sign-off preference',
      }),
    );
    const res = await runPlainoTurn(makeInput({ store, llm }));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.preferenceMemoryId, null);
  });
});
