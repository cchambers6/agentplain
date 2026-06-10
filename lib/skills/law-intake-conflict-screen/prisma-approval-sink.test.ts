/**
 * lib/skills/law-intake-conflict-screen/prisma-approval-sink.test.ts
 *
 * Pins the approval-row shape for both outcome paths:
 *   - CLEAR → PROCESS_DOC_DRAFT with engagement letter in payload.
 *   - FLAGGED / NEEDS-COUNSEL-REVIEW → COMPLIANCE_FLAG with conflict matches.
 *
 * Uses `buildConflictApprovalRow` (pure, no DB) to assert the shape
 * without a Prisma instance.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// buildConflictApprovalRow calls encryptPayloadForWrite, which requires
// ENCRYPTION_KEY. Seed a deterministic test key (same pattern as sibling
// prisma-approval-sink tests in support-handler / analytics-weekly-pulse).
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import {
  buildConflictApprovalRow,
  RecordingConflictApprovalSink,
} from './prisma-approval-sink';
import { renderEngagementLetter } from './engagement-letter';
import type { IntakeConflictScreenOutput, LedgerEntry } from './types';

const WORKSPACE_ID = 'ws-law-sink-test';
const FIXED_NOW = new Date('2026-06-09T12:00:00.000Z');

function clearScreen(): IntakeConflictScreenOutput {
  return {
    matterId: 'matter-test-001',
    prospectName: 'Jane Roe',
    status: 'clear',
    conflicts: [],
    attorneyNotice: {
      draftId: 'draft-abc',
      providerDraftId: null,
      toEmails: ['sarah@firm.example'],
      ccEmails: [],
      subject: 'Conflict screen — clear — Jane Roe (matter matter-test-001)',
      body: 'No conflicts found.',
      tone: 'formal',
      confidence: 0.8,
      persisted: false,
    },
  };
}

function flaggedScreen(status: 'flagged' | 'needs-counsel-review'): IntakeConflictScreenOutput {
  const existing: LedgerEntry = {
    clientName: 'Acme Industries LLC',
    status: 'active',
    matterLabel: 'Acme — IP licensing',
  };
  return {
    matterId: 'matter-test-002',
    prospectName: 'Jane Roe',
    status,
    conflicts: [
      {
        severity: status === 'needs-counsel-review' ? 'adverse' : 'former-adverse',
        matchedAgainst: 'opposing-party',
        opposingPartyText: 'Acme Industries LLC',
        existingClient: existing,
        normalizedMatch: 'acme industries',
      },
    ],
    attorneyNotice: {
      draftId: 'draft-xyz',
      providerDraftId: null,
      toEmails: ['sarah@firm.example'],
      ccEmails: [],
      subject: `Conflict screen — counsel review REQUIRED — Jane Roe (matter matter-test-002)`,
      body: 'ADVERSE conflict found.',
      tone: 'formal',
      confidence: 0.5,
      persisted: false,
    },
  };
}

describe('buildConflictApprovalRow — clear path', () => {
  it('builds a PROCESS_DOC_DRAFT row for status=clear', () => {
    const screen = clearScreen();
    const letter = renderEngagementLetter({
      intake: {
        matterId: screen.matterId,
        prospectName: screen.prospectName,
        prospectEmail: 'jane@example.com',
        opposingParties: [],
        matterDescription: 'Estate planning',
        responsibleAttorney: { name: 'Sarah Hill', email: 'sarah@firm.example' },
      },
      matterId: screen.matterId,
      firmContext: { firmName: 'Hill & Associates' },
      now: FIXED_NOW,
    });
    const row = buildConflictApprovalRow(WORKSPACE_ID, screen, letter);

    assert.equal(row.kind, 'PROCESS_DOC_DRAFT');
    assert.equal(row.refTable, 'LawMatter');
    assert.equal(row.refId, screen.matterId);
    assert.equal(row.status, 'PENDING');
    assert.equal(row.discipline, 'legal');
    assert.equal(row.agentSlug, 'law-intake-conflict-screen');
    // Payload is an encrypted envelope object { enc: <ciphertext> }.
    // Per the sibling test pattern in support-handler/prisma-approval-sink.test.ts:
    // assert that the encryption layer produced a non-null object.
    assert.ok(row.payload !== null && typeof row.payload === 'object');
  });

  it('builds a PROCESS_DOC_DRAFT row with null engagementLetter gracefully', () => {
    const row = buildConflictApprovalRow(WORKSPACE_ID, clearScreen(), null);
    assert.equal(row.kind, 'PROCESS_DOC_DRAFT');
  });
});

describe('buildConflictApprovalRow — flagged paths', () => {
  it('builds a COMPLIANCE_FLAG row for status=flagged', () => {
    const screen = flaggedScreen('flagged');
    const row = buildConflictApprovalRow(WORKSPACE_ID, screen, null);

    assert.equal(row.kind, 'COMPLIANCE_FLAG');
    assert.equal(row.refTable, 'LawMatter');
    assert.equal(row.refId, screen.matterId);
    assert.equal(row.status, 'PENDING');
    assert.equal(row.discipline, 'legal');
  });

  it('builds a COMPLIANCE_FLAG row for status=needs-counsel-review', () => {
    const screen = flaggedScreen('needs-counsel-review');
    const row = buildConflictApprovalRow(WORKSPACE_ID, screen, null);
    assert.equal(row.kind, 'COMPLIANCE_FLAG');
  });
});

describe('RecordingConflictApprovalSink', () => {
  it('captures record() calls and returns a sinkId', async () => {
    const sink = new RecordingConflictApprovalSink();
    const screen = clearScreen();
    const res = await sink.record({
      workspaceId: WORKSPACE_ID,
      screen,
      engagementLetter: null,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.ok(res.value.sinkId.startsWith('test-sink-'));
    assert.equal(sink.calls.length, 1);
    assert.equal(sink.calls[0].workspaceId, WORKSPACE_ID);
    assert.equal(sink.calls[0].screen.status, 'clear');
  });

  it('increments sinkId across calls', async () => {
    const sink = new RecordingConflictApprovalSink();
    const r1 = await sink.record({ workspaceId: WORKSPACE_ID, screen: clearScreen(), engagementLetter: null });
    const r2 = await sink.record({ workspaceId: WORKSPACE_ID, screen: clearScreen(), engagementLetter: null });
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    if (!r1.ok || !r2.ok) return;
    assert.notEqual(r1.value.sinkId, r2.value.sinkId);
  });
});
