/**
 * Pins the wave-3 content-calendar-drafter skill:
 *   - Calls the LLM with the vertical + activity snapshot in the prompt.
 *   - Parses well-formed JSON into 3-5 daily entries.
 *   - Falls back to a templated proposal on malformed LLM output.
 *   - Returns UPSTREAM_LLM_ERROR (not a templated fallback) on hard LLM failures.
 *   - Sink persists the proposal exactly once per fire.
 *   - Honors FEEDBACK rules — the user prompt carries the block verbatim.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { LlmProvider } from '@/lib/llm/types';
import { runSkill } from './skill';
import { RecordingCalendarApprovalSink } from './approval-sink';
import type { CalendarSnapshot } from './types';

const WORKSPACE_ID = 'ws-cal-001';
const NOW = new Date('2026-06-01T13:00:00.000Z'); // Monday

function snapshot(overrides: Partial<CalendarSnapshot> = {}): CalendarSnapshot {
  return {
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme Brokerage',
    verticalSlug: 'real-estate',
    forWeekStarting: '2026-06-01',
    recentCounts: { approvalsCreated: 5, instructions: 1 },
    ...overrides,
  };
}

function stubLlm(text: string): LlmProvider {
  return {
    name: 'test',
    complete: async () => ({
      ok: true,
      value: {
        text,
        stopReason: 'end_turn',
        usage: null,
        model: 'test-stub',
      },
    }),
  };
}

describe('content-calendar-drafter-general — skill', () => {
  it('parses a well-formed JSON output into a calendar proposal', async () => {
    const sink = new RecordingCalendarApprovalSink();
    const llm = stubLlm(JSON.stringify({
      preamble: 'Five realty topics for the week.',
      days: [
        { date: '2026-06-01', channel: 'email', topic: 'Listing-coordinator hand-off', hook: 'A short check on what your listing coordinator handled last week.' },
        { date: '2026-06-02', channel: 'social', topic: 'Buyer-inquiry follow-up', hook: 'How fast we replied to first-touch inquiries.' },
        { date: '2026-06-03', channel: 'blog', topic: 'Closing-doc checklist', hook: 'A simple closing-coordinator checklist clients can save.' },
        { date: '2026-06-04', channel: 'email', topic: 'Compliance update', hook: 'Fair-housing reminder for new team members.' },
        { date: '2026-06-05', channel: 'newsletter', topic: 'Showing recap', hook: 'A weekly summary of what showed and what didn\'t.' },
      ],
    }));
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot(),
      sink,
      llm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    const proposal = sink.calls[0].proposal;
    assert.equal(proposal.days.length, 5);
    assert.equal(proposal.days[0].channel, 'email');
    assert.match(proposal.preamble, /realty/i);
    assert.equal(proposal.snapshot.verticalSlug, 'real-estate');
  });

  it('falls back to a templated proposal on malformed JSON', async () => {
    const sink = new RecordingCalendarApprovalSink();
    const llm = stubLlm('not JSON at all');
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot(),
      sink,
      llm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    const proposal = sink.calls[0].proposal;
    assert.equal(proposal.days.length, 5, 'templated fallback emits 5 days');
    assert.match(proposal.preamble, /safe defaults/i);
  });

  it('returns ok=false on hard LLM failure (no fake row written)', async () => {
    const sink = new RecordingCalendarApprovalSink();
    const llm: LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: false,
        error: { code: 'NETWORK', message: 'connect ECONNRESET' },
      }),
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot(),
      sink,
      llm,
      now: NOW,
    });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'UPSTREAM_LLM_ERROR');
    assert.equal(sink.calls.length, 0);
  });

  it('inlines the feedback-rules block in the user prompt verbatim', async () => {
    const sink = new RecordingCalendarApprovalSink();
    let capturedUserPrompt = '';
    const llm: LlmProvider = {
      name: 'test',
      complete: async (req) => {
        const last = req.messages[req.messages.length - 1];
        capturedUserPrompt = typeof last.content === 'string'
          ? last.content
          : last.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
        return {
          ok: true,
          value: {
            text: JSON.stringify({
              preamble: 'p',
              days: [
                { date: '2026-06-01', channel: 'email', topic: 't', hook: 'h' },
              ],
            }),
            stopReason: 'end_turn',
            usage: null,
            model: 'test-stub',
          },
        };
      },
    };
    const RULE_LINE = 'WORKSPACE FEEDBACK: avoid emojis in outbound emails.';
    await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot(),
      sink,
      llm,
      feedbackRulesBlock: RULE_LINE,
      now: NOW,
    });
    assert.ok(
      capturedUserPrompt.includes(RULE_LINE),
      'FEEDBACK rules must reach the LLM prompt verbatim',
    );
  });
});
