/**
 * lib/skills/process-doc-drafter-general/feedback-rules.test.ts
 *
 * Wave-4 — pins the LLM-refinement seam on process-doc-drafter. Proves
 * a FEEDBACK rule + LLM retitle actually changes the SOP title.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonProcessDocFetcher } from './json-fetcher';
import { RecordingProcessDocApprovalSink } from './approval-sink';
import type { LlmProvider } from '@/lib/llm/types';
import type { PastAction, ProcessDocSnapshot } from './types';

const WORKSPACE_ID = 'ws-pd-001';
const NOW = new Date('2026-05-31T15:00:00.000Z');

function action(
  i: number,
  overrides: Partial<PastAction> = {},
): PastAction {
  return {
    id: `act-${i}`,
    occurredAt: new Date(`2026-05-${10 + i}T13:00:00.000Z`),
    kind: 'send-receipt',
    triggerHint: 'deposit-paid',
    subject: 'Deposit receipt',
    bodySnippet: 'Confirming your deposit has been received...',
    ...overrides,
  };
}

function snapshot(): ProcessDocSnapshot {
  return {
    pastActions: [action(1), action(2), action(3), action(4)],
    existingProcessDocs: [],
  };
}

describe('process-doc-drafter — LLM refinement seam (wave-4)', () => {
  it('without LLM, the heuristic SOP title is unchanged', async () => {
    const sink = new RecordingProcessDocApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new JsonProcessDocFetcher({
        workspaceId: WORKSPACE_ID,
        snapshot: snapshot(),
      }),
      sink,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 1);
    assert.match(res.value.proposals[0].title, /^SOP: Send Receipt/);
  });

  it('FEEDBACK rule + LLM retitle changes the SOP title', async () => {
    let llmCalls = 0;
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async (req) => {
        llmCalls += 1;
        const userText =
          typeof req.messages[0].content === 'string'
            ? req.messages[0].content
            : req.messages[0].content.map((b) => b.text).join('');
        const m = /proposalId: ([0-9a-f-]+)/.exec(userText);
        const proposalId = m?.[1] ?? '';
        return {
          ok: true,
          value: {
            text: JSON.stringify({
              drops: [],
              retitles: [
                {
                  proposalId,
                  newTitle: 'Runbook: Deposit Receipt Workflow',
                  ruleApplied:
                    'All SOP titles must start with "Runbook:" not "SOP:".',
                },
              ],
            }),
            stopReason: 'end_turn',
            usage: null,
            model: 'test-stub',
          },
        };
      },
    };
    const sink = new RecordingProcessDocApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new JsonProcessDocFetcher({
        workspaceId: WORKSPACE_ID,
        snapshot: snapshot(),
      }),
      sink,
      llm: stubLlm,
      feedbackRulesBlock:
        'CUSTOMER PREFERENCES:\n- content: All SOP titles must start with "Runbook:" not "SOP:".',
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(llmCalls, 1);
    assert.equal(res.value.proposals.length, 1);
    assert.match(res.value.proposals[0].title, /^Runbook:/);
    assert.match(res.value.noOutboundNote, /retitled 1/);
  });

  it('LLM error degrades gracefully — heuristic title kept', async () => {
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: false,
        error: { code: 'UPSTREAM_ERROR', message: 'anthropic 500' },
      }),
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new JsonProcessDocFetcher({
        workspaceId: WORKSPACE_ID,
        snapshot: snapshot(),
      }),
      llm: stubLlm,
      feedbackRulesBlock:
        'CUSTOMER PREFERENCES:\n- content: All SOP titles must start with "Runbook:".',
      now: NOW,
    });
    assert.ok(res.ok);
    assert.match(res.value.proposals[0].title, /^SOP:/);
  });
});
