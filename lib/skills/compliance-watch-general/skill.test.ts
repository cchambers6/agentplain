/**
 * Pins the wave-3 compliance-watch-general skill:
 *   - Empty match set → no row written, ok=true, sunk=false.
 *   - Match set → digest row written with LLM-composed body.
 *   - LLM hard-failure → templated digest body, row STILL written
 *     (compliance is high-stakes; never lose the signal).
 *   - Malformed LLM output → falls back to templated digest body.
 *   - User prompt includes every match's ruleLabel + approvalKind so
 *     the LLM grounds on real findings, never fabricates.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { LlmProvider } from '@/lib/llm/types';
import { runSkill } from './skill';
import { RecordingComplianceApprovalSink } from './approval-sink';
import type { ComplianceMatch, ComplianceSnapshot } from './types';

const WORKSPACE_ID = 'ws-comp-001';
const NOW = new Date('2026-06-02T13:00:00.000Z');

function match(overrides: Partial<ComplianceMatch> = {}): ComplianceMatch {
  return {
    approvalItemId: 'approval-1',
    approvalKind: 'BUYER_INQUIRY_REPLY_DRAFT',
    ruleId: 'fair-housing-literal',
    ruleSeverity: 'MEDIUM',
    ruleLabel: 'Fair housing literal match',
    excerpt: 'we prefer families with children',
    ...overrides,
  };
}

function snapshot(
  matches: ComplianceMatch[] = [],
  overrides: Partial<ComplianceSnapshot> = {},
): ComplianceSnapshot {
  return {
    workspaceId: WORKSPACE_ID,
    workspaceName: 'Acme Brokerage',
    verticalSlug: 'real-estate',
    windowFrom: '2026-06-01T13:00:00.000Z',
    windowTo: NOW.toISOString(),
    matches,
    approvalsScanned: 12,
    ...overrides,
  };
}

function stubLlm(text: string): LlmProvider {
  return {
    name: 'test',
    complete: async () => ({
      ok: true,
      value: { text, stopReason: 'end_turn', usage: null, model: 'test-stub' },
    }),
  };
}

describe('compliance-watch-general — skill', () => {
  it('writes no row when no matches were found', async () => {
    const sink = new RecordingComplianceApprovalSink();
    const llm = stubLlm('should-not-be-called');
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot([]),
      sink,
      llm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 0);
    assert.equal(res.value.proposal, null);
    assert.equal(res.value.sunk, false);
  });

  it('writes one digest row when matches exist', async () => {
    const sink = new RecordingComplianceApprovalSink();
    const llm = stubLlm(
      JSON.stringify({ body: 'Plaino flagged one fair-housing literal match in a BUYER_INQUIRY_REPLY_DRAFT. Review the affected draft on /approvals before approving.' }),
    );
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot([match()]),
      sink,
      llm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    assert.ok(res.value.proposal);
    assert.match(res.value.proposal!.body, /fair-housing/i);
  });

  it('falls back to a templated body on hard LLM failure but STILL writes a row', async () => {
    const sink = new RecordingComplianceApprovalSink();
    const llm: LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: false,
        error: { code: 'NETWORK', message: 'connect ECONNRESET' },
      }),
    };
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot([match(), match({ ruleSeverity: 'HIGH', ruleLabel: 'PII — SSN' })]),
      sink,
      llm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(
      sink.calls.length,
      1,
      'compliance is high-stakes; the row must land even when the LLM fails',
    );
    const body = sink.calls[0].proposal.body;
    assert.match(body, /flagged 2 matches/);
    assert.match(body, /high-severity/);
  });

  it('falls back to a templated body when the LLM returns malformed JSON', async () => {
    const sink = new RecordingComplianceApprovalSink();
    const llm = stubLlm('this is not JSON');
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot([match()]),
      sink,
      llm,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    assert.match(sink.calls[0].proposal.body, /flagged 1 match/);
  });

  it('inlines every match into the LLM prompt for grounding', async () => {
    const sink = new RecordingComplianceApprovalSink();
    let capturedPrompt = '';
    const llm: LlmProvider = {
      name: 'test',
      complete: async (req) => {
        const last = req.messages[req.messages.length - 1];
        capturedPrompt = typeof last.content === 'string'
          ? last.content
          : last.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
        return {
          ok: true,
          value: { text: JSON.stringify({ body: 'ok' }), stopReason: 'end_turn', usage: null, model: 'test-stub' },
        };
      },
    };
    await runSkill({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot([
        match({ ruleLabel: 'Familial-status literal match' }),
        match({ ruleLabel: 'PII — SSN', ruleSeverity: 'HIGH', approvalKind: 'CHIEF_OF_STAFF_REPLY_DRAFT' }),
      ]),
      sink,
      llm,
      now: NOW,
    });
    assert.match(capturedPrompt, /Familial-status literal match/);
    assert.match(capturedPrompt, /PII — SSN/);
    assert.match(capturedPrompt, /CHIEF_OF_STAFF_REPLY_DRAFT/);
  });
});
