/**
 * Tests for the production lead-triage approval sink's side effects
 * (pilot dry-run 2026-07-11, P0-1 + P0-3): a NEWLY-staged lead credits
 * the saved-time ledger and fires the approval-ready notification; a
 * duplicate (re-sweep / webhook replay) does neither. Runs on the
 * caller-tx path with a fake transaction client — the same
 * buildLeadTriageApprovalRow + credit code the withRls path executes.
 */

// Valid 64-hex key so encryptPayloadForWrite works without infra. Set
// before importing the module under test.
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'a'.repeat(64);

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import {
  LEAD_TRIAGE_REF_TABLE,
  PrismaLeadTriageApprovalSink,
} from './prisma-approval-sink';
import type { TriagedLead } from './types';

const WS = '33333333-3333-3333-3333-333333333333';

/** A hot FUB lead as the hourly sweep (or a FUB webhook) presents it —
 *  the `fub-<personId>` lead id is the replay-dedupe key. */
function fubTriagedLead(overrides: Partial<TriagedLead> = {}): TriagedLead {
  return {
    leadId: 'fub-12345',
    leadName: 'Dana Buyer',
    scores: { motivation: 0.9, timeline: 0.8, preapproval: 0.7, composite: 0.82 },
    category: 'hot',
    routing: { type: 'agent', agentId: 'a-1', agentName: 'Riley Agent', rationale: 'hot lead, top closer' },
    firstTouchDraft: {
      draftId: 'draft-1',
      providerDraftId: null,
      subject: 'Re: 4BR in Decatur',
      body: 'Thanks for reaching out about the Decatur listing.',
      tone: 'casual',
      confidence: 0.85,
      persisted: false,
    },
    draftSkippedReason: null,
    ...overrides,
  };
}

interface FakeTx {
  tx: Prisma.TransactionClient;
  approvalCreates: Array<Record<string, unknown>>;
  ledgerCreates: Array<Record<string, unknown>>;
}

function fakeTx(opts: { existingApprovalId?: string } = {}): FakeTx {
  const approvalCreates: Array<Record<string, unknown>> = [];
  const ledgerCreates: Array<Record<string, unknown>> = [];
  const tx = {
    workApprovalQueueItem: {
      findFirst: async () =>
        opts.existingApprovalId ? { id: opts.existingApprovalId } : null,
      create: async (args: { data: Record<string, unknown> }) => {
        approvalCreates.push(args.data);
        return { id: 'approval-new' };
      },
    },
    timeSavingsEntry: {
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        ledgerCreates.push(...args.data);
        return { count: args.data.length };
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, approvalCreates, ledgerCreates };
}

function recordingNotify() {
  const calls: Array<{ workspaceId: string; count?: number }> = [];
  return {
    calls,
    notify: async (input: { workspaceId: string; count?: number }) => {
      calls.push(input);
      return { pushesDelivered: 0, emailsSent: 1, emailsHeldForDigest: 0 };
    },
  };
}

describe('PrismaLeadTriageApprovalSink — saved-time credit (P0-3)', () => {
  it('a NEW hot lead credits lead-enrichment + drafted-email, keyed on the FUB lead id', async () => {
    const { tx, approvalCreates, ledgerCreates } = fakeTx();
    const sink = new PrismaLeadTriageApprovalSink({ tx, notify: null });

    const res = await sink.record({ workspaceId: WS, triaged: fubTriagedLead() });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.skippedDuplicate, undefined);
    assert.equal(approvalCreates.length, 1);

    assert.equal(ledgerCreates.length, 2);
    const [enrich, draft] = ledgerCreates;
    assert.equal(enrich.actionType, 'lead-enrichment');
    assert.equal(enrich.minutesSaved, 5); // real-estate calibration
    assert.equal(draft.actionType, 'drafted-email');
    assert.equal(draft.minutesSaved, 10);
    for (const row of ledgerCreates) {
      assert.equal(row.workspaceId, WS);
      assert.equal(row.verticalSlug, 'real-estate');
      assert.equal(row.sourceTable, LEAD_TRIAGE_REF_TABLE);
      // The FUB event/lead id — a webhook replay hits the same key and
      // the unique constraint's skipDuplicates makes it a no-op.
      assert.equal(row.sourceId, 'fub-12345');
    }
  });

  it('a lead with no first-touch draft credits enrichment only', async () => {
    const { tx, ledgerCreates } = fakeTx();
    const sink = new PrismaLeadTriageApprovalSink({ tx, notify: null });

    const res = await sink.record({
      workspaceId: WS,
      triaged: fubTriagedLead({
        firstTouchDraft: null,
        draftSkippedReason: 'missing-email',
      }),
    });
    assert.equal(res.ok, true);
    assert.equal(ledgerCreates.length, 1);
    assert.equal(ledgerCreates[0].actionType, 'lead-enrichment');
  });

  it('a duplicate (re-sweep / replay) writes NO ledger rows', async () => {
    const { tx, approvalCreates, ledgerCreates } = fakeTx({
      existingApprovalId: 'approval-existing',
    });
    const sink = new PrismaLeadTriageApprovalSink({ tx, notify: null });

    const res = await sink.record({ workspaceId: WS, triaged: fubTriagedLead() });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.skippedDuplicate, true);
    assert.equal(approvalCreates.length, 0);
    assert.equal(ledgerCreates.length, 0);
  });

  it('creditSavedTime:false (the demo seed) writes no ledger rows', async () => {
    const { tx, approvalCreates, ledgerCreates } = fakeTx();
    const sink = new PrismaLeadTriageApprovalSink({
      tx,
      notify: null,
      creditSavedTime: false,
    });

    const res = await sink.record({ workspaceId: WS, triaged: fubTriagedLead() });
    assert.equal(res.ok, true);
    assert.equal(approvalCreates.length, 1);
    assert.equal(ledgerCreates.length, 0);
  });
});

describe('PrismaLeadTriageApprovalSink — approval-ready notify (P0-1)', () => {
  it('a NEW lead fires the notifier once for the workspace', async () => {
    const { tx } = fakeTx();
    const { notify, calls } = recordingNotify();
    const sink = new PrismaLeadTriageApprovalSink({ tx, notify });

    const res = await sink.record({ workspaceId: WS, triaged: fubTriagedLead() });
    assert.equal(res.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].workspaceId, WS);
    assert.equal(calls[0].count, 1);
  });

  it('a duplicate does NOT re-notify', async () => {
    const { tx } = fakeTx({ existingApprovalId: 'approval-existing' });
    const { notify, calls } = recordingNotify();
    const sink = new PrismaLeadTriageApprovalSink({ tx, notify });

    const res = await sink.record({ workspaceId: WS, triaged: fubTriagedLead() });
    assert.equal(res.ok, true);
    assert.equal(calls.length, 0);
  });

  it('a notifier failure never fails the record that already landed', async () => {
    const { tx, approvalCreates } = fakeTx();
    const sink = new PrismaLeadTriageApprovalSink({
      tx,
      notify: async () => {
        throw new Error('notify path down');
      },
    });

    const res = await sink.record({ workspaceId: WS, triaged: fubTriagedLead() });
    assert.equal(res.ok, true);
    assert.equal(approvalCreates.length, 1);
  });
});
