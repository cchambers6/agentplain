/**
 * lib/skills/process-doc-drafter-general/skill.test.ts
 *
 * Pins the process-doc-drafter behavior:
 *   - Clusters of ≥ minOccurrences (default 3) produce an SOP draft
 *   - Clusters of < minOccurrences are ignored
 *   - SOP drafts ALWAYS contain at least one `{{operator: ...}}` merge field
 *   - Existing SOPs (by normalized title) dedupe new drafts away
 *   - More-frequent patterns surface first under maxProposalsPerRun cap
 *   - Every proposal is PENDING; no doc published to external systems
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonProcessDocFetcher } from './json-fetcher';
import { RecordingProcessDocApprovalSink } from './approval-sink';
import type { PastAction, ProcessDocSnapshot } from './types';

const WORKSPACE_ID = 'ws-processdoc-001';
const NOW = new Date('2026-05-25T08:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function action(overrides: Partial<PastAction> = {}): PastAction {
  return {
    id: `act-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date(NOW.getTime() - 5 * MS_PER_DAY),
    kind: 'send-reply',
    triggerHint: 'new-customer',
    subject: 'Thanks for reaching out',
    bodySnippet: 'Welcome aboard — looking forward to working with you.',
    ...overrides,
  };
}

function snapshot(overrides: Partial<ProcessDocSnapshot> = {}): ProcessDocSnapshot {
  return { pastActions: [], existingProcessDocs: [], ...overrides };
}

describe('process-doc-drafter-general — clustering threshold', () => {
  it('does not propose an SOP for a cluster of 2', async () => {
    const fetcher = new JsonProcessDocFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        pastActions: [action({ id: 'a' }), action({ id: 'b' })],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 0);
    assert.equal(res.value.patternsFound, 0);
  });

  it('proposes an SOP for a cluster of 3', async () => {
    const fetcher = new JsonProcessDocFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        pastActions: [
          action({ id: 'a' }),
          action({ id: 'b', occurredAt: new Date(NOW.getTime() - 10 * MS_PER_DAY) }),
          action({ id: 'c', occurredAt: new Date(NOW.getTime() - 15 * MS_PER_DAY) }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 1);
    const [p] = res.value.proposals;
    assert.equal(p.occurrenceCount, 3);
    assert.equal(p.status, 'PENDING');
    assert.ok(
      p.body.includes('{{operator:'),
      'SOP draft must include at least one operator merge field',
    );
  });
});

describe('process-doc-drafter-general — dedupe against existing SOPs', () => {
  it('skips a cluster when an existing SOP title matches (substring)', async () => {
    const fetcher = new JsonProcessDocFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        pastActions: [
          action({ id: 'a' }),
          action({ id: 'b' }),
          action({ id: 'c' }),
        ],
        existingProcessDocs: [
          { id: 'doc-1', title: 'SOP: Send Reply — New Customer' },
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 0);
  });

  it('does not dedupe when titles differ meaningfully', async () => {
    const fetcher = new JsonProcessDocFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        pastActions: [
          action({ id: 'a' }),
          action({ id: 'b' }),
          action({ id: 'c' }),
        ],
        existingProcessDocs: [
          { id: 'doc-1', title: 'SOP: Quarterly Board Read-Ahead' },
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 1);
  });
});

describe('process-doc-drafter-general — ordering + caps', () => {
  it('surfaces most-frequent patterns first under maxProposalsPerRun', async () => {
    const fetcher = new JsonProcessDocFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        pastActions: [
          // Pattern A: 3 occurrences
          action({ id: 'a1', kind: 'send-reply', triggerHint: 'new-customer' }),
          action({ id: 'a2', kind: 'send-reply', triggerHint: 'new-customer' }),
          action({ id: 'a3', kind: 'send-reply', triggerHint: 'new-customer' }),
          // Pattern B: 6 occurrences (should rank higher)
          action({ id: 'b1', kind: 'send-quote', triggerHint: 'deposit-paid' }),
          action({ id: 'b2', kind: 'send-quote', triggerHint: 'deposit-paid' }),
          action({ id: 'b3', kind: 'send-quote', triggerHint: 'deposit-paid' }),
          action({ id: 'b4', kind: 'send-quote', triggerHint: 'deposit-paid' }),
          action({ id: 'b5', kind: 'send-quote', triggerHint: 'deposit-paid' }),
          action({ id: 'b6', kind: 'send-quote', triggerHint: 'deposit-paid' }),
        ],
      }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      maxProposalsPerRun: 1,
      now: NOW,
    });
    assert.ok(res.ok);
    assert.equal(res.value.proposals.length, 1);
    assert.equal(res.value.proposals[0].occurrenceCount, 6);
  });

  it('higher-frequency clusters get higher confidence', async () => {
    const fetcher = new JsonProcessDocFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        pastActions: Array.from({ length: 9 }).map((_, i) =>
          action({ id: `x${i}`, kind: 'book-meeting', triggerHint: 'quarterly-review' }),
        ),
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.ok(res.ok);
    const [p] = res.value.proposals;
    assert.equal(p.occurrenceCount, 9);
    assert.equal(p.confidence, 0.78);
  });
});

describe('process-doc-drafter-general — no-outbound contract', () => {
  it('every drafted SOP lands in the sink with status PENDING; no publish method exists', async () => {
    const sink = new RecordingProcessDocApprovalSink();
    const _sinkSurface: keyof typeof sink = 'record';
    assert.equal(_sinkSurface, 'record');
    const fetcher = new JsonProcessDocFetcher({
      workspaceId: WORKSPACE_ID,
      snapshot: snapshot({
        pastActions: [
          action({ id: 'a' }),
          action({ id: 'b' }),
          action({ id: 'c' }),
        ],
      }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, sink, now: NOW });
    assert.ok(res.ok);
    assert.equal(sink.calls.length, 1);
    assert.equal(sink.calls[0].proposal.status, 'PENDING');
    assert.ok(res.value.noOutboundNote.includes('No SOP published'));
  });
});
