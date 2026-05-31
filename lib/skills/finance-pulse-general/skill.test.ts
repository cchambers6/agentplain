/**
 * lib/skills/finance-pulse-general/skill.test.ts
 *
 * Pins the wave-4 finance-pulse skill:
 *   - Quiet weeks (no internal activity AND no QB connection) skip the
 *     LLM call and emit a templated body that NAMES the QB gap and
 *     surfaces a "connect QuickBooks" recommendation. Honesty bar: no
 *     fabricated AR.
 *   - Active weeks with QB connected call the LLM with the snapshot
 *     rendered into the user prompt and persist a proposal carrying
 *     the LLM's body.
 *   - Active weeks WITHOUT QB still fire: the prompt names the gap;
 *     the LLM body cannot reference AR.
 *   - Malformed LLM JSON falls back to a templated body so the row
 *     still lands.
 *   - The sink is called exactly once per active fire.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TestLlmProvider } from '@/lib/llm/test-provider';
import { runSkill } from './skill';
import { RecordingFinancePulseApprovalSink } from './approval-sink';
import type { FinancePulseSnapshot } from './types';

const WORKSPACE_ID = 'ws-finance-001';
const NOW = new Date('2026-06-01T13:05:00.000Z'); // Monday 9:05 ET

function snapshot(
  overrides: Partial<FinancePulseSnapshot> = {},
): FinancePulseSnapshot {
  return {
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme CPA',
    workspaceVertical: 'cpa',
    windowFrom: '2026-05-25T13:05:00.000Z',
    windowTo: NOW.toISOString(),
    internal: {
      invoiceChaseDrafts: 0,
      monthEndCloseDrafts: 0,
      financeApprovalsDecided: 0,
      financeApprovalsPending: 0,
      learnedNotes: 0,
    },
    quickbooks: {
      connected: false,
      reason: 'not-connected',
      detail: 'No active QuickBooks credential.',
    },
    ...overrides,
  };
}

describe('finance-pulse-general — skill', () => {
  it('quiet week + QB dark: skips LLM, emits templated body that names the QB gap', async () => {
    const llm = new TestLlmProvider();
    const sink = new RecordingFinancePulseApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot(),
      sink,
      llm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(llm.calls.length, 0, 'LLM must not be called on quiet-and-dark weeks');
    assert.equal(sink.calls.length, 1);
    const [recorded] = sink.calls;
    assert.match(recorded.proposal.body, /quiet finance week/i);
    assert.match(recorded.proposal.body, /QuickBooks is not connected/i);
    // Honesty bar — no AR numbers fabricated in the body.
    assert.doesNotMatch(recorded.proposal.body, /\$\d/);
    assert.ok(
      recorded.proposal.recommendations.some((r) => /Connect QuickBooks/i.test(r)),
      'quiet+dark recommendations should include connect-QuickBooks nudge',
    );
    assert.equal(recorded.proposal.llmComposed, false);
  });

  it('active week + QB connected: LLM called, body carries snapshot counts', async () => {
    const sink = new RecordingFinancePulseApprovalSink();
    const stubLlm: import('@/lib/llm/types').LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: true,
        value: {
          text: JSON.stringify({
            body:
              'Finance had a busy week — invoice-chasing produced 4 drafts you ' +
              'approved all of, month-end-close produced 2. QuickBooks shows 6 ' +
              'open invoices (2 overdue, 1 deeply aged).',
            recommendations: [
              'review the 1 deeply aged invoice — phone call, not another email',
              'consider connecting the AR aging dashboard to the morning briefing',
            ],
          }),
          stopReason: 'end_turn',
          usage: null,
          model: 'test-stub',
        },
      }),
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        workspaceVertical: 'real-estate',
        internal: {
          invoiceChaseDrafts: 4,
          monthEndCloseDrafts: 2,
          financeApprovalsDecided: 4,
          financeApprovalsPending: 1,
          learnedNotes: 0,
        },
        quickbooks: {
          connected: true,
          summary: {
            openInvoices: 6,
            overdueInvoices: 2,
            deeplyAgedInvoices: 1,
            activeCustomers: 14,
            recentExpenses: 8,
          },
        },
      }),
      sink,
      llm: stubLlm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    const [recorded] = sink.calls;
    assert.match(recorded.proposal.body, /invoice-chasing produced 4 drafts/);
    assert.equal(recorded.proposal.recommendations.length, 2);
    assert.equal(recorded.proposal.snapshot.internal.invoiceChaseDrafts, 4);
    assert.equal(recorded.proposal.llmComposed, true);
    // The snapshot's QB counts ride through to the proposal.
    assert.equal(
      (recorded.proposal.snapshot.quickbooks as { connected: true; summary: { openInvoices: number } }).summary
        .openInvoices,
      6,
    );
  });

  it('active week + QB dark: LLM IS called but prompt names the gap so body cannot fabricate AR', async () => {
    let capturedUserPrompt = '';
    const sink = new RecordingFinancePulseApprovalSink();
    const stubLlm: import('@/lib/llm/types').LlmProvider = {
      name: 'test',
      complete: async (req) => {
        capturedUserPrompt =
          typeof req.messages[0].content === 'string'
            ? req.messages[0].content
            : req.messages[0].content.map((b) => b.text).join('');
        return {
          ok: true,
          value: {
            text: JSON.stringify({
              body:
                'Finance had three drafts this week. QuickBooks is not connected, ' +
                'so I cannot read AR aging on your behalf. Connecting it gives next ' +
                "week's pulse the data to actually be useful.",
              recommendations: ['Connect QuickBooks from Settings → Integrations'],
            }),
            stopReason: 'end_turn',
            usage: null,
            model: 'test-stub',
          },
        };
      },
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        internal: {
          invoiceChaseDrafts: 3,
          monthEndCloseDrafts: 0,
          financeApprovalsDecided: 2,
          financeApprovalsPending: 1,
          learnedNotes: 0,
        },
      }),
      sink,
      llm: stubLlm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    // Prompt must NAME the gap so the LLM cannot fabricate AR.
    assert.match(capturedUserPrompt, /QuickBooks: NOT CONNECTED/);
    assert.match(capturedUserPrompt, /MUST instead name/i);
    const [recorded] = sink.calls;
    assert.match(recorded.proposal.body, /QuickBooks is not connected/i);
  });

  it('falls back to templated body when the LLM returns malformed JSON', async () => {
    const sink = new RecordingFinancePulseApprovalSink();
    const stubLlm: import('@/lib/llm/types').LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: true,
        value: {
          text: 'this is not JSON at all, just prose',
          stopReason: 'end_turn',
          usage: null,
          model: 'test-stub',
        },
      }),
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        internal: {
          invoiceChaseDrafts: 3,
          monthEndCloseDrafts: 1,
          financeApprovalsDecided: 2,
          financeApprovalsPending: 2,
          learnedNotes: 0,
        },
        quickbooks: {
          connected: true,
          summary: {
            openInvoices: 4,
            overdueInvoices: 1,
            deeplyAgedInvoices: 0,
            activeCustomers: 9,
            recentExpenses: 3,
          },
        },
      }),
      sink,
      llm: stubLlm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    const [recorded] = sink.calls;
    assert.match(recorded.proposal.body, /3 invoice chases drafted/);
    assert.match(recorded.proposal.body, /QuickBooks reports 4 open invoices/);
    assert.match(recorded.proposal.body, /pulse prose was not composed/i);
    assert.equal(recorded.proposal.llmComposed, false);
  });

  it('returns ok=false on hard LLM failures so the cron records the failure', async () => {
    const sink = new RecordingFinancePulseApprovalSink();
    const stubLlm: import('@/lib/llm/types').LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: false,
        error: { code: 'UPSTREAM_ERROR', message: 'anthropic 500' },
      }),
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        internal: {
          invoiceChaseDrafts: 1,
          monthEndCloseDrafts: 0,
          financeApprovalsDecided: 0,
          financeApprovalsPending: 0,
          learnedNotes: 0,
        },
      }),
      sink,
      llm: stubLlm,
      now: NOW,
    });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'UPSTREAM_LLM_ERROR');
    assert.equal(sink.calls.length, 0, 'sink must not be touched on hard failure');
  });
});
