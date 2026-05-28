/**
 * lib/plaino/dispatcher.test.ts
 *
 * Pins the Plaino dispatcher's three-path contract:
 *   - ANSWER  → substrate-grounded reply with citations
 *   - REGISTER → creates SupportRequest + emits Inngest event + stores
 *                supportRequestId on the Plaino message metadata
 *   - DECLINE_HONESTLY → reply names a specific gap (NOT a fabrication);
 *                        a `namedGap: null` decline is REJECTED
 *
 * Tests use the recording chat store + recording event emitter +
 * recording substrate so there's no DB/runtime coupling. Encryption
 * at rest is covered separately in encryption.test.ts (the prisma
 * store wraps the dispatcher; the dispatcher itself sees plaintext
 * via the IChatStore port).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runPlainoTurn } from './dispatcher';
import { buildCapabilitySnapshotSync } from './capabilities';
import { RecordingChatStore } from './recording-chat-store';
import { RecordingEventEmitter } from './event-emitter';
import { RecordingKnowledgeSubstrate } from '../skills/support-handler';
import { PLAINO_SYSTEM_PROMPT_VERSION } from './system-prompt';
import type {
  PlainoCapabilitySnapshot,
  PlainoTurnInput,
  SupportContextSnippet,
} from './types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '../llm/types';
import { llmOk } from '../llm/types';

const WORKSPACE_ID = 'ws-plaino-0001';
const OTHER_WORKSPACE_ID = 'ws-plaino-other-0002';

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

function snippet(
  overrides: Partial<SupportContextSnippet> = {},
): SupportContextSnippet {
  return {
    title: 'Workspace doc: disconnect Gmail',
    bodyExcerpt:
      'Open Settings → Integrations and click Disconnect next to the Gmail row. AMS data is unaffected.',
    sourceUrl: 'https://docs.agentplain.example/integrations/disconnect',
    similarity: 0.81,
    ...overrides,
  };
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
    fromUserId: 'user-0001',
    fromEmail: 'broker@acme.example',
    fromName: 'Jamie',
    customerMessage: 'How do I disconnect Gmail?',
    history: [],
    capabilities: emptyCapabilities(),
    substrate: new RecordingKnowledgeSubstrate({}),
    events: new RecordingEventEmitter(),
    store: new RecordingChatStore(WORKSPACE_ID),
    ...overrides,
  };
}

// ── ANSWER path ─────────────────────────────────────────────────────────

describe('plaino dispatcher — ANSWER path', () => {
  it('retrieves from substrate, persists Plaino reply with citations + ANSWER metadata', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [snippet()],
    });
    const events = new RecordingEventEmitter();
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'ANSWER',
        reply:
          'Open Settings → Integrations and click Disconnect next to the Gmail row. Your AMS data stays put.',
        citedTitles: ['Workspace doc: disconnect Gmail'],
        namedGap: null,
        reasoning: 'Workspace doc directly answers.',
      }),
    );
    const res = await runPlainoTurn(
      makeInput({ store, substrate, events, llm }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.classification.kind, 'ANSWER');
    assert.equal(res.value.citations.length, 1);
    assert.equal(
      res.value.citations[0].title,
      'Workspace doc: disconnect Gmail',
    );
    // Both messages persisted: customer + plaino reply.
    assert.equal(store.messages.length, 2);
    assert.equal(store.messages[0].role, 'customer');
    assert.equal(store.messages[1].role, 'plaino');
    // Metadata on the Plaino message exposes the dispatcher decision.
    const metadata = store.messages[1].metadata;
    assert.ok(metadata !== null);
    assert.equal(metadata?.kind, 'ANSWER');
    assert.ok(Array.isArray(metadata?.citations));
    // Substrate was called scoped to the workspace.
    assert.equal(substrate.calls.length, 1);
    assert.equal(substrate.calls[0].workspaceId, WORKSPACE_ID);
    // No support request created on the ANSWER path.
    assert.equal(store.createdSupportRequests.length, 0);
    // No Inngest events fired on the ANSWER path.
    assert.equal(events.events.length, 0);
    // System prompt was the cached Plaino V1 system prompt.
    assert.equal(llm.calls.length, 1);
    assert.match(
      llm.calls[0].system,
      new RegExp(`^${PLAINO_SYSTEM_PROMPT_VERSION}`),
    );
    assert.equal(llm.calls[0].cacheSystem, true);
  });

  it('drops cited titles the LLM hallucinated', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [snippet()],
    });
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'ANSWER',
        reply: 'Open settings.',
        citedTitles: ['Hallucinated doc', 'Workspace doc: disconnect Gmail'],
        namedGap: null,
        reasoning: 'mixed cite',
      }),
    );
    const res = await runPlainoTurn(makeInput({ store, substrate, llm }));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.citations.length, 1);
    assert.equal(
      res.value.citations[0].title,
      'Workspace doc: disconnect Gmail',
    );
  });
});

// ── REGISTER path ──────────────────────────────────────────────────────

describe('plaino dispatcher — REGISTER path', () => {
  it('creates SupportRequest, emits Inngest event, persists Plaino reply with the request id', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const events = new RecordingEventEmitter();
    const substrate = new RecordingKnowledgeSubstrate({});
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'REGISTER',
        reply:
          "Got it — I've handed this to the team. A drafted response will appear in your approval queue once it's ready.",
        citedTitles: [],
        namedGap: null,
        reasoning: 'Customer asked us to draft a follow-up; routing to support-handler.',
      }),
    );
    const res = await runPlainoTurn(
      makeInput({
        store,
        events,
        substrate,
        llm,
        customerMessage:
          'Please draft a follow-up email to Sandra about the Atlanta listing close date.',
      }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.classification.kind, 'REGISTER');
    assert.ok(res.value.supportRequestId);
    // Chat store recorded one SupportRequest.
    assert.equal(store.createdSupportRequests.length, 1);
    assert.equal(
      store.createdSupportRequests[0].id,
      res.value.supportRequestId,
    );
    assert.equal(
      store.createdSupportRequests[0].workspaceId,
      WORKSPACE_ID,
    );
    assert.equal(store.createdSupportRequests[0].fromUserId, 'user-0001');
    // Inngest event fired with the new SupportRequest id.
    assert.equal(events.events.length, 1);
    assert.equal(events.events[0].name, 'agentplain/support-request.created');
    assert.equal(
      events.events[0].data.supportRequestId,
      res.value.supportRequestId,
    );
    assert.equal(events.events[0].data.workspaceId, WORKSPACE_ID);
    // Plaino message metadata carries the SupportRequest id for the UI.
    const plainoMessage = store.messages[1];
    const metadata = plainoMessage.metadata;
    assert.ok(metadata !== null);
    assert.equal(metadata?.kind, 'REGISTER');
    assert.equal(metadata?.supportRequestId, res.value.supportRequestId);
  });

  it('rejects a REGISTER reply that claims completion', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const events = new RecordingEventEmitter();
    const substrate = new RecordingKnowledgeSubstrate({});
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'REGISTER',
        // The dispatcher explicitly rejects "I sent" / "I emailed" /
        // "Done." style claims — the no-outbound rule means Plaino
        // never claims completion.
        reply: "Done. I just sent the email to Sandra.",
        citedTitles: [],
        namedGap: null,
        reasoning: 'attempted to claim send completion',
      }),
    );
    const res = await runPlainoTurn(
      makeInput({ store, events, substrate, llm }),
    );
    assert.equal(res.ok, false);
    // Fallback placeholder must still land so the chat is not empty.
    assert.equal(store.messages.length, 2);
    assert.equal(store.messages[1].role, 'plaino');
    // No support request created on the rejected REGISTER path.
    assert.equal(store.createdSupportRequests.length, 0);
    assert.equal(events.events.length, 0);
  });
});

// ── DECLINE_HONESTLY path ──────────────────────────────────────────────

describe('plaino dispatcher — DECLINE_HONESTLY path', () => {
  it('persists a reply with a specific named capability gap', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const substrate = new RecordingKnowledgeSubstrate({});
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'DECLINE_HONESTLY',
        reply:
          "Right now I can't pull MLS comps for you because the MLS connector isn't wired yet — that's the next thing on the roadmap. Want me to flag this so you hear back when it lands?",
        citedTitles: [],
        namedGap: 'MLS comps connector not yet wired',
        reasoning: 'Customer asked for MLS comps; not in marketplace.',
      }),
    );
    const res = await runPlainoTurn(
      makeInput({
        store,
        substrate,
        llm,
        customerMessage: 'Pull me comps from MLS for 142 Peachtree St.',
      }),
    );
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.classification.kind, 'DECLINE_HONESTLY');
    assert.equal(
      res.value.classification.namedGap,
      'MLS comps connector not yet wired',
    );
    // Plaino reply names the SPECIFIC gap (not a generic "I can't").
    const plainoMessage = store.messages[1];
    assert.match(plainoMessage.body, /MLS/);
    assert.match(plainoMessage.body, /not yet wired|isn't wired|isn’t wired/);
    // Metadata carries the namedGap so the UI can render it.
    assert.equal(
      plainoMessage.metadata?.namedGap,
      'MLS comps connector not yet wired',
    );
    // No support request — decline does not generate work.
    assert.equal(store.createdSupportRequests.length, 0);
  });

  it('rejects a DECLINE_HONESTLY without a namedGap (no generic refusals)', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const substrate = new RecordingKnowledgeSubstrate({});
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'DECLINE_HONESTLY',
        reply: "Sorry, I can't help with that.",
        citedTitles: [],
        namedGap: null, // <-- this is what the dispatcher rejects
        reasoning: 'attempted a generic refusal',
      }),
    );
    const res = await runPlainoTurn(makeInput({ store, substrate, llm }));
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(
      res.error.code,
      'PARSE_ERROR',
      'dispatcher must reject a generic DECLINE_HONESTLY',
    );
    // Fallback placeholder still persists so the chat doesn't go silent.
    assert.equal(store.messages.length, 2);
  });
});

// ── Cross-workspace isolation ──────────────────────────────────────────

describe('plaino dispatcher — substrate isolation by workspace', () => {
  it('never sees snippets from another workspace', async () => {
    const store = new RecordingChatStore(WORKSPACE_ID);
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [],
      [OTHER_WORKSPACE_ID]: [
        snippet({
          title: 'OTHER WORKSPACE PRIVATE DOC',
          bodyExcerpt: 'this must never reach workspace A',
          similarity: 0.99,
        }),
      ],
    });
    const llm = new StubLlm(
      JSON.stringify({
        kind: 'DECLINE_HONESTLY',
        reply:
          "I don't have anything on file for that yet — the workspace knowledge base is empty. Want me to flag it so we can backfill?",
        citedTitles: [],
        namedGap: 'workspace knowledge base has no snippets for this topic yet',
        reasoning: 'empty substrate hits',
      }),
    );
    const res = await runPlainoTurn(makeInput({ store, substrate, llm }));
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Citations empty — we never saw the other workspace's snippet.
    assert.equal(res.value.citations.length, 0);
    // Substrate received exactly one call, scoped to OUR workspace.
    assert.equal(substrate.calls.length, 1);
    assert.equal(substrate.calls[0].workspaceId, WORKSPACE_ID);
  });
});

// ── Input validation ───────────────────────────────────────────────────

describe('plaino dispatcher — input guards', () => {
  it('rejects an empty customer message', async () => {
    const res = await runPlainoTurn(makeInput({ customerMessage: '   ' }));
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
  });
});
