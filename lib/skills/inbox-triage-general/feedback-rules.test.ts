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

  it('wave-2: LLM IS called for per-message classification even when FEEDBACK is empty', async () => {
    // Wave-2 changed the contract: the LLM is the PRIMARY per-message
    // classifier, so it fires on every snapshot regardless of FEEDBACK
    // rules. The refine seam (FEEDBACK overrides) remains separately gated
    // on a non-empty rules block — but classification is unconditional.
    let classifyCalls = 0;
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async (req) => {
        // The classify call carries the classifier system prompt; the
        // refine call carries the refiner prompt. Empty FEEDBACK → only
        // the classify call should ever land.
        if (/inbox-triage classifier/i.test(req.system)) classifyCalls += 1;
        return {
          ok: true,
          value: {
            text: JSON.stringify({
              classifications: [
                {
                  messageId: 'msg-1',
                  priority: 'needs-decision',
                  confidence: 0.8,
                  reason: 'County clerk requesting verification of a filing.',
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
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new StubFetcher(snapshot),
      llm: stubLlm,
      feedbackRulesBlock: '   ', // whitespace-only — refine stays skipped
      now: new Date('2026-05-30T12:00:00.000Z'),
    });
    assert.ok(res.ok);
    assert.equal(classifyCalls, 1, 'classifier must fire once for the snapshot');
    // The LLM classification drives the priority (keyword alone would be noise).
    const [proposal] = res.value.proposals;
    assert.equal(proposal.priority, 'needs-decision');
    assert.match(proposal.reasoning, /LLM:/);
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
