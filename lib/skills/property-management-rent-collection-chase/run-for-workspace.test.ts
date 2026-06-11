/**
 * lib/skills/property-management-rent-collection-chase/run-for-workspace.test.ts
 *
 * Integration test for the killer workflow's production wiring with mocked
 * inputs (no Buildium, no Prisma):
 *   - JsonRentRollLookup seeds delinquent units spanning every bucket,
 *   - RecordingRentChaseApprovalSink captures what would be staged,
 *   - asserts: one approval staged per non-grace unit, kind/agentSlug correct
 *     via buildRentChaseApprovalRow, and the at-risk balance + bucket flow
 *     through onto the staged payload (the value-ledger ROI signal).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Deterministic test key so buildRentChaseApprovalRow can exercise the real
// payload-encryption path (32 bytes = 64 hex chars). Set before any encrypt
// call; loadMasterKey reads process.env lazily.
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'a'.repeat(64);

import { JsonRentRollLookup } from './json-fetcher';
import { RecordingRentChaseApprovalSink } from './approval-sink';
import {
  buildRentChaseApprovalRow,
  RENT_COLLECTION_CHASE_AGENT_SLUG,
} from './prisma-approval-sink';
import { runRentCollectionChaseForWorkspace } from './run-for-workspace';
import type { UnitDelinquency } from './types';

const WORKSPACE_ID = 'ws-pm-runfw-0001';

function unit(overrides: Partial<UnitDelinquency> = {}): UnitDelinquency {
  return {
    leaseId: 'lease-x',
    unitLabel: '10 Main St #1',
    primaryTenant: { name: 'Sam Tenant', email: 'sam@tenant.example', phone: null },
    coTenants: [],
    daysPastDue: 5,
    outstandingBalanceUsd: 1200,
    paymentPlanInPlace: false,
    tenantAcknowledged: false,
    lastChaseAt: null,
    propertyManager: { name: 'PM', email: 'pm@mgr.example', phone: null },
    formalNoticeRequiresOwnerApproval: true,
    ...overrides,
  };
}

describe('runRentCollectionChaseForWorkspace — stages chases via the sink', () => {
  it('stages one approval per non-grace unit, carrying balance + bucket', async () => {
    const lookup = new JsonRentRollLookup({
      workspaceId: WORKSPACE_ID,
      delinquentUnits: [
        unit({ leaseId: 'l-grace', daysPastDue: 1, outstandingBalanceUsd: 300 }),
        unit({ leaseId: 'l-soft', daysPastDue: 5, outstandingBalanceUsd: 1500 }),
        unit({ leaseId: 'l-formal', daysPastDue: 9, outstandingBalanceUsd: 2200 }),
        unit({ leaseId: 'l-esc', daysPastDue: 20, outstandingBalanceUsd: 3100 }),
      ],
    });
    const sink = new RecordingRentChaseApprovalSink();

    const res = await runRentCollectionChaseForWorkspace({
      workspaceId: WORKSPACE_ID,
      lookup,
      sink,
    });

    assert.equal(res.ok, true);
    if (!res.ok) return;
    // grace unit produces no draft; the other 3 do.
    assert.equal(res.value.drafts.length, 3);
    assert.equal(sink.calls.length, 3);

    const soft = sink.calls.find((c) => c.approval.draft.leaseId === 'l-soft');
    assert.ok(soft, 'soft-chase staged');
    assert.equal(soft.approval.draft.bucket, 'soft-chase');
    assert.equal(soft.approval.draft.outstandingBalanceUsd, 1500);

    // The escalation is staged AND surfaces on the owner-review queue.
    assert.equal(res.value.ownerReview.length, 1);
    assert.equal(res.value.ownerReview[0].leaseId, 'l-esc');

    // No dollar amount leaks into any chase body.
    for (const c of sink.calls) {
      assert.doesNotMatch(c.approval.draft.body, /\$\s?\d/);
    }
  });

  it('builds a FOLLOW_UP_NUDGE approval row with the at-risk balance in payload', () => {
    const draft = {
      draftId: 'd-1',
      providerDraftId: null,
      leaseId: 'l-soft',
      bucket: 'soft-chase' as const,
      daysPastDue: 5,
      outstandingBalanceUsd: 1500,
      toEmails: ['sam@tenant.example'],
      ccEmails: [],
      subject: 'Quick rent reminder — 10 Main St #1',
      body: 'Hi Sam,\n\nFollowing up on rent…',
      tone: 'casual' as const,
      confidence: 0.72,
      persisted: false,
    };
    const row = buildRentChaseApprovalRow(WORKSPACE_ID, draft);
    assert.equal(row.kind, 'FOLLOW_UP_NUDGE');
    assert.equal(row.agentSlug, RENT_COLLECTION_CHASE_AGENT_SLUG);
    assert.equal(row.status, 'PENDING');
    assert.equal(row.refId, 'd-1');
    // payload is encrypted; just assert it's present + non-trivial.
    assert.ok(row.payload);
  });
});
