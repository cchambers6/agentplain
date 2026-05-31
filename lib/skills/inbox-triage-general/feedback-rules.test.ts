/**
 * lib/skills/inbox-triage-general/feedback-rules.test.ts
 *
 * Wave-4 — pins the LLM-refinement seam on inbox-triage. Proves:
 *   - When no LLM is provided, the heuristic output is byte-for-byte
 *     unchanged (back-compat).
 *   - When an LLM is provided but FEEDBACK rules are empty, no LLM
 *     call is made (cost guard).
 *   - When BOTH are provided AND the LLM returns an override, the
 *     proposal's priority changes to match the override.
 *   - When the LLM errors, the heuristic output passes through
 *     unchanged + a note is appended to noOutboundNote (graceful
 *     degrade).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { RecordingTriageApprovalSink } from './approval-sink';
import { skillOk, type SkillResult } from '../types';
import type { LlmProvider } from '@/lib/llm/types';
import type {
  TriageFetcher,
  TriageMessage,
  TriageSnapshot,
} from './types';

const WORKSPACE_ID = 'ws-triage-001';

class StubFetcher implements TriageFetcher {
  readonly name = 'stub-triage';
  constructor(private readonly snapshot: TriageSnapshot) {}
  async fetchSnapshot(): Promise<SkillResult<TriageSnapshot>> {
    return skillOk(this.snapshot);
  }
}

function msg(overrides: Partial<TriageMessage> = {}): TriageMessage {
  return {
    id: 'msg-1',
    threadId: 'thr-1',
    fromEmail: 'clerk@county.gov',
    fromName: 'County Clerk',
    subject: 'Recording confirmation — your filing',
    bodyText:
      'Your most recent county filing has been recorded. Please verify the attached receipt.',
    receivedAt: new Date('2026-05-30T12:00:00.000Z'),
    hasOpenReplyDraft: false,
    ...overrides,
  };
}

describe('inbox-triage — LLM refinement seam (wave-4)', () => {
  it('when no LLM is provided, heuristic output is unchanged', async () => {
    const snapshot: TriageSnapshot = { inbox: [msg()] };
    const sink = new RecordingTriageApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher(snapshot),
      sink,
      now: new Date('2026-05-30T12:00:00.000Z'),
    });
    assert.ok(res.ok);
    // Heuristic alone has no county-clerk rule — the message falls
    // through to noise (low confidence).
    const [proposal] = res.value.proposals;
    assert.notEqual(proposal.priority, 'urgent');
  });

  it('with LLM provided but empty FEEDBACK rules block, NO LLM call is made (cost guard)', async () => {
    let llmCalls = 0;
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async () => {
        llmCalls += 1;
        return {
          ok: true,
          value: {
            text: '{"overrides":[]}',
            stopReason: 'end_turn',
            usage: null,
            model: 'test-stub',
          },
        };
      },
    };
    const snapshot: TriageSnapshot = { inbox: [msg()] };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher(snapshot),
      llm: stubLlm,
      feedbackRulesBlock: '   ', // whitespace-only — treated as empty
      now: new Date('2026-05-30T12:00:00.000Z'),
    });
    assert.ok(res.ok);
    assert.equal(llmCalls, 0, 'LLM must not be called when FEEDBACK is empty');
  });

  it('FEEDBACK rule + LLM override changes priority to URGENT', async () => {
    let capturedSystem = '';
    let capturedUser = '';
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async (req) => {
        capturedSystem = req.system;
        capturedUser =
          typeof req.messages[0].content === 'string'
            ? req.messages[0].content
            : req.messages[0].content.map((b) => b.text).join('');
        return {
          ok: true,
          value: {
            text: JSON.stringify({
              overrides: [
                {
                  messageId: 'msg-1',
                  newPriority: 'urgent',
                  ruleApplied:
                    'Always flag mail from county clerks as URGENT.',
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
    const snapshot: TriageSnapshot = { inbox: [msg()] };
    const sink = new RecordingTriageApprovalSink();
    const feedbackRulesBlock = [
      'CUSTOMER PREFERENCES:',
      '- inbox-triage: Always flag mail from county clerks as URGENT.',
    ].join('\n');
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher(snapshot),
      sink,
      llm: stubLlm,
      feedbackRulesBlock,
      now: new Date('2026-05-30T12:00:00.000Z'),
    });
    assert.ok(res.ok);
    // The refiner system prompt must mention 'inbox-triage refiner' so
    // we know the right seam fired.
    assert.match(capturedSystem, /inbox-triage refiner/);
    assert.match(capturedUser, /county clerk/i);
    const [proposal] = res.value.proposals;
    assert.equal(proposal.priority, 'urgent');
    assert.match(proposal.reasoning, /FEEDBACK override:.*county clerks/i);
    assert.match(res.value.noOutboundNote, /FEEDBACK override/);
  });

  it('LLM error degrades gracefully — heuristic output passes through + note appended', async () => {
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: false,
        error: { code: 'UPSTREAM_ERROR', message: 'anthropic 500' },
      }),
    };
    const snapshot: TriageSnapshot = { inbox: [msg()] };
    const sink = new RecordingTriageApprovalSink();
    const feedbackRulesBlock =
      'CUSTOMER PREFERENCES:\n- inbox-triage: Always flag X as urgent.';
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher(snapshot),
      sink,
      llm: stubLlm,
      feedbackRulesBlock,
      now: new Date('2026-05-30T12:00:00.000Z'),
    });
    assert.ok(res.ok);
    // Heuristic preserved — county-clerk message is noise without LLM.
    const [proposal] = res.value.proposals;
    assert.notEqual(proposal.priority, 'urgent');
    assert.match(res.value.noOutboundNote, /LLM refine failed/);
  });
});
