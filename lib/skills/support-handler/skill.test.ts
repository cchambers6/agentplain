/**
 * lib/skills/support-handler/skill.test.ts
 *
 * Pins the support-handler skill behavior:
 *   - High-confidence substrate hits → LLM-grounded draft with citations
 *   - Empty / low-confidence substrate → templated placeholder (NO fabrication)
 *   - Every proposal lands in the approval sink with status=PENDING
 *   - Citations are restricted to titles we actually passed in
 *   - LLM call structures system + user message correctly
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { RecordingApprovalSink } from './approval-sink';
import { RecordingKnowledgeSubstrate } from './knowledge-substrate';
import { __testing } from './skill';
import type {
  SupportContextSnippet,
  SupportHandlerInput,
  SupportRequestSnapshot,
} from './types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '../../llm/types';
import { llmOk } from '../../llm/types';

const WORKSPACE_ID = 'ws-support-0001';
const NOW = new Date('2026-05-28T15:00:00.000Z');

function makeRequest(
  overrides: Partial<SupportRequestSnapshot> = {},
): SupportRequestSnapshot {
  return {
    id: 'support-req-1',
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme Brokerage',
    verticalSlug: 'real-estate',
    fromEmail: 'broker@acme.example',
    fromName: 'Jamie Broker',
    subject: 'How do I disconnect a Gmail account?',
    body: 'I connected the wrong Gmail mailbox to my workspace and need to disconnect it without losing my AMS data.',
    partnerName: 'Plaino',
    receivedAt: NOW,
    ...overrides,
  };
}

function snippet(
  overrides: Partial<SupportContextSnippet> = {},
): SupportContextSnippet {
  return {
    title: 'Integrations: disconnecting an email account',
    bodyExcerpt:
      'To disconnect a Gmail or Microsoft 365 account from your workspace, open Settings → Integrations, find the connected mailbox row, and click "Disconnect." Your AMS data is stored separately and is not affected by disconnecting the mailbox.',
    sourceUrl: 'https://docs.agentplain.example/integrations/disconnect',
    similarity: 0.82,
    ...overrides,
  };
}

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

const GOOD_DRAFT_JSON = JSON.stringify({
  subject: 'Re: How do I disconnect a Gmail account?',
  body: [
    'Hi Jamie,',
    '',
    'You can disconnect the Gmail account from Settings → Integrations — find the connected mailbox row and click "Disconnect." Your AMS data lives on its own and is not affected by removing the mailbox.',
    '',
    '— Plaino',
    '   agentplain · your service partner',
  ].join('\n'),
  citedTitles: ['Integrations: disconnecting an email account'],
  reasoning:
    'Workspace doc directly answers the disconnect question; cited the integrations doc.',
});

describe('support-handler — high-confidence substrate path', () => {
  it('drafts a reply grounded in substrate snippets and tags it high confidence', async () => {
    const sink = new RecordingApprovalSink();
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [snippet()],
    });
    const llm = new StubLlm(GOOD_DRAFT_JSON);
    const input: SupportHandlerInput = {
      workspaceId: WORKSPACE_ID,
      request: makeRequest(),
      substrate,
      llm,
      sink,
      now: NOW,
    };
    const res = await runSkill(input);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.proposal.confidence, 'high');
    assert.equal(res.value.proposal.suggestedAction, 'approve');
    assert.equal(res.value.proposal.citations.length, 1);
    assert.equal(
      res.value.proposal.citations[0].title,
      'Integrations: disconnecting an email account',
    );
    assert.match(res.value.proposal.body, /Plaino/);
    assert.match(res.value.proposal.body, /Settings.*Integrations/);
    // Sink recorded exactly one proposal in PENDING-equivalent state.
    assert.equal(sink.calls.length, 1);
    assert.equal(sink.calls[0].workspaceId, WORKSPACE_ID);
    assert.equal(
      sink.calls[0].proposal.supportRequestId,
      'support-req-1',
    );
    // LLM saw a system prompt with the SUPPORT_HANDLER_V1 marker + vertical.
    assert.equal(llm.calls.length, 1);
    assert.match(llm.calls[0].system, /^SUPPORT_HANDLER_V1/);
    assert.match(llm.calls[0].system, /VERTICAL: real-estate/);
    // No outbound — sink is the recording sink.
    assert.equal(sink.name, 'recording');
  });

  it('emits a medium-confidence draft when only a mid-similarity hit is available', async () => {
    const sink = new RecordingApprovalSink();
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [snippet({ similarity: 0.42 })],
    });
    const llm = new StubLlm(GOOD_DRAFT_JSON);
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: makeRequest(),
      substrate,
      llm,
      sink,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.proposal.confidence, 'medium');
    assert.equal(res.value.proposal.suggestedAction, 'edit-then-send');
  });
});

describe('support-handler — honesty rule on empty substrate', () => {
  it('falls back to a templated placeholder when no snippets cross the medium floor', async () => {
    const sink = new RecordingApprovalSink();
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [],
    });
    let llmCalled = false;
    const llm: LlmProvider = {
      name: 'test',
      async complete() {
        llmCalled = true;
        return llmOk({
          text: '',
          stopReason: 'end_turn',
          usage: null,
          model: 'never-called',
        });
      },
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: makeRequest(),
      substrate,
      llm,
      sink,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.proposal.confidence, 'placeholder');
    assert.equal(res.value.proposal.suggestedAction, 'placeholder');
    assert.equal(res.value.proposal.citations.length, 0);
    assert.equal(llmCalled, false, 'LLM must not be invoked on the placeholder path');
    assert.match(res.value.proposal.body, /Plaino/);
    assert.match(
      res.value.proposal.body,
      /human is taking a closer look|closer look/i,
    );
    assert.equal(sink.calls.length, 1);
    assert.equal(sink.calls[0].proposal.confidence, 'placeholder');
  });

  it('also placeholders when substrate returns only low-similarity hits', async () => {
    const sink = new RecordingApprovalSink();
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [snippet({ similarity: 0.1 })],
    });
    const llm = new StubLlm(GOOD_DRAFT_JSON);
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: makeRequest(),
      substrate,
      llm,
      sink,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.proposal.confidence, 'placeholder');
    assert.equal(llm.calls.length, 0, 'LLM must not be invoked when no snippet beats the medium floor');
  });
});

describe('support-handler — citation guardrail', () => {
  it('drops cited titles that were never passed to the LLM', async () => {
    const known = snippet({ title: 'Real snippet', similarity: 0.7 });
    const llm = new StubLlm(
      JSON.stringify({
        subject: 'Re: x',
        body: 'Hi,\n\nHere is help.\n\n— Plaino',
        citedTitles: ['Hallucinated doc', 'Real snippet'],
        reasoning: 'mixed cite',
      }),
    );
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [known],
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: makeRequest(),
      substrate,
      llm,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.proposal.citations.length, 1);
    assert.equal(res.value.proposal.citations[0].title, 'Real snippet');
  });
});

describe('support-handler — cross-workspace isolation', () => {
  it('only retrieves snippets from the request workspace', async () => {
    // Substrate seeded with snippets for TWO workspaces. The skill running
    // for workspace A must never see workspace B's snippets — the port
    // contract is: searchForRequest takes workspaceId and the seed is
    // partitioned by it.
    const otherWorkspaceSnippet = snippet({
      title: 'Workspace-B private doc',
      bodyExcerpt: 'This is confidential to workspace B and must not leak.',
      similarity: 0.95,
    });
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [],
      'ws-other-0002': [otherWorkspaceSnippet],
    });
    const llm = new StubLlm(GOOD_DRAFT_JSON);
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: makeRequest(),
      substrate,
      llm,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Empty for ws-support-0001 → placeholder. LLM never sees the other
    // workspace's snippet because the substrate port partitions by id.
    assert.equal(res.value.proposal.confidence, 'placeholder');
    assert.equal(res.value.proposal.citations.length, 0);
    assert.equal(llm.calls.length, 0);
    // Substrate recorded one call, scoped to our workspace.
    assert.equal(substrate.calls.length, 1);
    assert.equal(substrate.calls[0].workspaceId, WORKSPACE_ID);
  });
});

describe('support-handler — no-outbound contract', () => {
  it('skill itself never sends — only the sink records a PENDING-equivalent proposal', async () => {
    const sink = new RecordingApprovalSink();
    const substrate = new RecordingKnowledgeSubstrate({
      [WORKSPACE_ID]: [snippet()],
    });
    const llm = new StubLlm(GOOD_DRAFT_JSON);
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: makeRequest(),
      substrate,
      llm,
      sink,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // The "noOutboundNote" surfaces in the run output so the audit log
    // sees the stance explicitly.
    assert.match(res.value.noOutboundNote, /No reply sent to the customer/);
    // Sink interface has only a record() method. Asserted at the type
    // level (no `send`, no `book`); asserted at runtime here:
    assert.equal(typeof (sink as unknown as { send?: unknown }).send, 'undefined');
  });
});

describe('support-handler — unit helpers', () => {
  it('parseLlmJson handles code fences', () => {
    const wrapped = '```json\n{"subject":"s","body":"b","citedTitles":[],"reasoning":"r"}\n```';
    const res = __testing.parseLlmJson(wrapped);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.subject, 's');
    assert.equal(res.value.body, 'b');
  });
  it('parseLlmJson rejects missing body', () => {
    const res = __testing.parseLlmJson('{"subject":"only subject"}');
    assert.equal(res.ok, false);
  });
  it('defaultReplySubject preserves existing Re: prefix', () => {
    assert.equal(__testing.defaultReplySubject('Re: hello'), 'Re: hello');
    assert.equal(__testing.defaultReplySubject('hello'), 'Re: hello');
  });
  it('truncateSnippet caps long bodies', () => {
    const long = 'x'.repeat(2000);
    const out = __testing.truncateSnippet({
      title: 't',
      bodyExcerpt: long,
      sourceUrl: null,
      similarity: 0.6,
    });
    assert.ok(out.bodyExcerpt.length < 2000);
    assert.match(out.bodyExcerpt, /…$/);
  });
});
