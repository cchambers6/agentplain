/**
 * lib/skills/mortgage-document-chase/skill.test.ts
 *
 * Pins the deterministic mortgage doc-chase behavior:
 *   - one batched borrower email per file, not one-per-doc
 *   - cadence buckets fresh → pending → late → stuck
 *   - stuck items trigger an LO phone-call nudge
 *   - never quotes rate / APR / DTI — defers via merge fields
 *   - wire-fraud disclaimer always present
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonLoanFileLookup } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type { LoanFile, OutstandingDoc } from './types';

const WORKSPACE_ID = 'ws-mortgage-0001';
const LOAN_ID = 'loan-2026-0451';
const NOW = new Date('2026-05-24T15:00:00Z');

function file(overrides: Partial<LoanFile> = {}): LoanFile {
  return {
    loanId: LOAN_ID,
    borrower: { name: 'Pat Ruiz', email: 'pat@borrower.example' },
    coBorrower: { name: 'Alex Ruiz', email: 'alex@borrower.example' },
    loanOfficer: { name: 'Marcus Lee', email: 'marcus@brokerage.example' },
    propertyAddress: '4012 Highland Ave, Decatur GA',
    purpose: 'purchase',
    estimatedClosingDate: '2026-06-25',
    ...overrides,
  };
}

function doc(overrides: Partial<OutstandingDoc> = {}): OutstandingDoc {
  return {
    id: 'doc-paystub',
    label: 'Most recent 30 days of pay stubs',
    category: 'income',
    requestedAt: new Date('2026-05-20T15:00:00Z'),
    borrowerAcknowledged: false,
    conditionAttached: false,
    ...overrides,
  };
}

function lookup(opts: { docs?: OutstandingDoc[]; loanFile?: LoanFile }): JsonLoanFileLookup {
  return new JsonLoanFileLookup({
    workspaceId: WORKSPACE_ID,
    loanId: LOAN_ID,
    file: opts.loanFile ?? file(),
    outstandingDocs: opts.docs ?? [],
  });
}

describe('mortgage-document-chase — bucketing', () => {
  it('classifies fresh / pending / late / stuck against the cadence floor', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({
        docs: [
          doc({ id: 'd-fresh', requestedAt: new Date('2026-05-24T08:00:00Z') }),
          doc({ id: 'd-pending', requestedAt: new Date('2026-05-22T15:00:00Z') }),
          doc({ id: 'd-late', requestedAt: new Date('2026-05-18T15:00:00Z') }),
          doc({ id: 'd-stuck', requestedAt: new Date('2026-05-10T15:00:00Z') }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.value.bucketCounts, {
      fresh: 1,
      pending: 1,
      late: 1,
      stuck: 1,
    });
  });
});

describe('mortgage-document-chase — single batched borrower email', () => {
  it('produces ONE borrower draft for a multi-doc file (never one-per-doc)', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({
        docs: [
          doc({ id: 'd-id', category: 'identity', label: 'Driver license, both sides' }),
          doc({ id: 'd-paystub', category: 'income' }),
          doc({ id: 'd-statement', category: 'assets', label: 'Most recent two bank statements' }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.ok(res.value.borrowerChase);
    assert.equal(res.value.borrowerChase!.toEmails.length, 1);
    assert.equal(res.value.borrowerChase!.ccEmails.length, 1, 'co-borrower CC');
    assert.match(res.value.borrowerChase!.body, /Identity:/);
    assert.match(res.value.borrowerChase!.body, /Income verification:/);
    assert.match(res.value.borrowerChase!.body, /Assets:/);
  });

  it('returns no draft when no documents are outstanding', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({ docs: [] }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.borrowerChase, null);
  });
});

describe('mortgage-document-chase — never quotes rate / APR / DTI', () => {
  it('defers rate / APR with operator merge fields', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({ docs: [doc()] }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.borrowerChase!.body, /\{\{operator: rate\/APR\}\}/);
    // No promissory language — never use the word "guarantee" in a draft.
    assert.doesNotMatch(res.value.borrowerChase!.body, /guarantee/i);
  });

  it('includes the wire-confirmation disclaimer on every chase', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({ docs: [doc()] }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(
      res.value.borrowerChase!.body,
      /\{\{operator: closing wire confirmation channel\}\}/,
    );
  });
});

describe('mortgage-document-chase — LO nudge on stuck items', () => {
  it('flags an LO phone-call nudge when at least one item is stuck', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({
        docs: [
          doc({ id: 'd-stuck', requestedAt: new Date('2026-05-08T15:00:00Z') }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.loNudge.needed, true);
    assert.equal(res.value.loNudge.stuckDocIds.length, 1);
    assert.match(res.value.loNudge.message, /Call Pat on the/);
  });

  it('does NOT flag a nudge when nothing is stuck', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({ docs: [doc()] }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.loNudge.needed, false);
  });
});

describe('mortgage-document-chase — UW condition urgency', () => {
  it('flags underwriter conditions in the draft body and tightens tone', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({
        docs: [
          doc({
            id: 'd-cond',
            category: 'declarations',
            label: 'Letter of explanation — recent inquiry on credit report',
            conditionAttached: true,
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.match(res.value.borrowerChase!.body, /\(underwriter condition\)/);
    assert.match(res.value.borrowerChase!.body, /clearing them unlocks the next milestone/);
  });
});

describe('mortgage-document-chase — persistence', () => {
  it('persists the borrower chase to the recording persister above threshold', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({ docs: [doc()] }),
      now: NOW,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 1);
    assert.equal(res.value.borrowerChase!.persisted, true);
  });

  it('suppresses persistence when confidence drops below threshold (stuck items)', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: LOAN_ID,
      lookup: lookup({
        docs: [doc({ id: 'd-stuck', requestedAt: new Date('2026-05-08T15:00:00Z') })],
      }),
      now: NOW,
      persister,
      persistThreshold: 0.6,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 0);
    assert.equal(res.value.borrowerChase!.persisted, false);
  });
});

describe('mortgage-document-chase — workspace mismatch', () => {
  it('returns INVALID_INPUT when the seed is for a different workspace', async () => {
    const res = await runSkill({
      workspaceId: 'ws-other',
      loanId: LOAN_ID,
      lookup: lookup({ docs: [doc()] }),
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });
});
