/**
 * lib/skills/chief-of-staff-scheduler/feedback-rules.test.ts
 *
 * Wave-4 — pins the LLM-refinement seam on chief-of-staff-scheduler.
 * Proves a FEEDBACK rule + LLM override changes the output (in this
 * case: drops a meeting proposal the rule rejects).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonChiefOfStaffFetcher } from './json-fetcher';
import { RecordingApprovalSink } from './approval-sink';
import type { LlmProvider } from '@/lib/llm/types';
import type {
  ChiefOfStaffSnapshot,
  InboxMessage,
  TodoItem,
} from './types';

const WORKSPACE_ID = 'ws-cos-001';
const NOW = new Date('2026-05-31T15:00:00.000Z'); // Sunday — work hours
const TUESDAY = new Date('2026-06-02T15:00:00.000Z');

function msg(overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: 'inbox-1',
    threadId: 'thr-1',
    fromEmail: 'sales@vendor-xyz.com',
    fromName: 'Vendor XYZ Sales',
    subject: 'Find a time to walk through our offering',
    bodyText:
      'Hi — can we find a time next week for a brief call to walk you through Vendor XYZ?',
    receivedAt: new Date('2026-05-29T13:00:00.000Z'),
    needsMeeting: true,
    hasOpenReplyDraft: false,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<ChiefOfStaffSnapshot> = {},
): ChiefOfStaffSnapshot {
  return {
    localTimezone: 'America/New_York',
    events: [],
    inbox: [msg()],
    todos: [],
    ...overrides,
  };
}

describe('chief-of-staff — LLM refinement seam (wave-4)', () => {
  it('when no LLM is provided, heuristic output unchanged (existing meeting still proposed)', async () => {
    const sink = new RecordingApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new JsonChiefOfStaffFetcher({
        workspaceId: WORKSPACE_ID,
        snapshot: snapshot(),
      }),
      sink,
      now: TUESDAY,
      lookaheadDays: 7,
    });
    assert.ok(res.ok);
    assert.ok(
      res.value.meetingProposals.length > 0,
      'heuristic should propose at least one meeting from the scheduling-needed inbound',
    );
  });

  it('FEEDBACK rule + LLM drops the meeting proposal that violates the rule', async () => {
    let llmCalls = 0;
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async (req) => {
        llmCalls += 1;
        // Parse the user prompt to grab whichever proposalId the
        // heuristic minted — drop it. (Deterministic — there's only
        // one meeting proposal in this snapshot.)
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
              drops: [proposalId],
              rewordings: [],
            }),
            stopReason: 'end_turn',
            usage: null,
            model: 'test-stub',
          },
        };
      },
    };
    const sink = new RecordingApprovalSink();
    const feedbackRulesBlock =
      'CUSTOMER PREFERENCES:\n- scheduling: Never propose meetings with vendor cold outreach (Vendor XYZ etc).';
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: new JsonChiefOfStaffFetcher({
        workspaceId: WORKSPACE_ID,
        snapshot: snapshot(),
      }),
      sink,
      llm: stubLlm,
      feedbackRulesBlock,
      now: TUESDAY,
      lookaheadDays: 7,
    });
    assert.ok(res.ok);
    assert.equal(llmCalls, 1);
    assert.equal(
      res.value.meetingProposals.length,
      0,
      'FEEDBACK rule should have dropped the vendor meeting proposal',
    );
    assert.match(res.value.noOutboundNote, /dropped 1/);
  });
});
