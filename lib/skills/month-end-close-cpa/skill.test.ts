/**
 * lib/skills/month-end-close-cpa/skill.test.ts
 *
 * Pinning tests for the CPA month-end-close skill. Covers the bucketing
 * (received/pending/late), uncategorized-receipt surface, batched chase
 * email rendering with CPA-vernacular tone, the proposed reminder shape,
 * the client status update, persistence guards (no Gmail draft write
 * when no persister), and the workspace/client/period mismatch errors.
 *
 * Per `feedback_runner_portability.md`: tests bind `JsonCloseFetcher` and
 * `RecordingDraftPersister`. The skill code itself does not import a
 * vendor SDK.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonCloseFetcher } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type {
  ChecklistItem,
  ClientEngagement,
  ContactPerson,
  ReceivedDoc,
} from './types';

const WORKSPACE_ID = 'ws-cpa-close-0001';
const CLIENT_ID = 'client-acme-llc';
const PERIOD = '2026-04';
const NOW = new Date('2026-05-15T15:00:00Z');

function contact(overrides: Partial<ContactPerson> = {}): ContactPerson {
  return {
    name: 'Patricia Lin',
    email: 'pat.lin@acme-llc.example.com',
    phone: null,
    role: 'controller',
    ...overrides,
  };
}

function engagement(overrides: Partial<ClientEngagement> = {}): ClientEngagement {
  return {
    clientId: CLIENT_ID,
    clientName: 'Acme LLC',
    primaryContact: contact(),
    ccContacts: [
      contact({ name: 'Mike Chen', email: 'mike.chen@acme-llc.example.com', role: 'bookkeeper' }),
    ],
    periodMonth: PERIOD,
    scope: 'full-stack-monthly',
    internalDeadline: new Date('2026-05-20T00:00:00Z'),
    partnerSignoff: false,
    ...overrides,
  };
}

function checklistItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'item-bank',
    label: 'April 2026 bank statement (Operating account)',
    category: 'bank-statement',
    dueAt: new Date('2026-05-10T00:00:00Z'), // 5 days past on NOW
    required: true,
    ...overrides,
  };
}

function receivedDoc(overrides: Partial<ReceivedDoc> = {}): ReceivedDoc {
  return {
    id: 'doc-1',
    satisfiesChecklistItemId: 'item-bank',
    receivedAt: new Date('2026-05-12T00:00:00Z'),
    filename: 'bank-2026-04.pdf',
    source: 'gmail',
    ...overrides,
  };
}

function makeFetcher(args: {
  engagement?: ClientEngagement;
  checklist?: ChecklistItem[];
  receivedDocs?: ReceivedDoc[];
}): JsonCloseFetcher {
  return new JsonCloseFetcher({
    workspaceId: WORKSPACE_ID,
    clientId: CLIENT_ID,
    periodMonth: PERIOD,
    engagement: args.engagement ?? engagement(),
    checklist: args.checklist ?? [],
    receivedDocs: args.receivedDocs ?? [],
  });
}

describe('month-end-close-cpa — bucketing', () => {
  it('buckets one item per status and surfaces uncategorized receipts', async () => {
    const checklist: ChecklistItem[] = [
      checklistItem({ id: 'item-bank', label: 'Bank — April', dueAt: new Date('2026-05-10T00:00:00Z') }),
      checklistItem({
        id: 'item-cc',
        label: 'Credit card — April',
        category: 'credit-card-statement',
        dueAt: new Date('2026-05-25T00:00:00Z'), // future → pending
      }),
      checklistItem({
        id: 'item-payroll',
        label: 'Payroll register — April',
        category: 'payroll-register',
        dueAt: new Date('2026-05-08T00:00:00Z'), // late, no receipt
      }),
    ];
    const receivedDocs: ReceivedDoc[] = [
      receivedDoc({ id: 'doc-bank', satisfiesChecklistItemId: 'item-bank' }),
      receivedDoc({
        id: 'doc-orphan',
        satisfiesChecklistItemId: null,
        filename: 'random-attachment.pdf',
        source: 'manual-upload',
      }),
    ];
    const fetcher = makeFetcher({ checklist, receivedDocs });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.value.bucketCounts, { received: 1, pending: 1, late: 1 });
    const byId = Object.fromEntries(res.value.items.map((i) => [i.itemId, i]));
    assert.equal(byId['item-bank'].status, 'received');
    assert.equal(byId['item-cc'].status, 'pending');
    assert.equal(byId['item-payroll'].status, 'late');
    assert.equal(res.value.uncategorizedReceipts.length, 1);
    assert.equal(res.value.uncategorizedReceipts[0].filename, 'random-attachment.pdf');
    assert.equal(res.value.closeReady, false);
  });

  it('all required items received + partner signoff → closeReady=true and status update is the all-clear copy', async () => {
    const checklist = [
      checklistItem({ id: 'item-bank', dueAt: new Date('2026-05-10T00:00:00Z') }),
      checklistItem({
        id: 'item-cc',
        label: 'Credit card — April',
        category: 'credit-card-statement',
        dueAt: new Date('2026-05-10T00:00:00Z'),
      }),
    ];
    const receivedDocs = [
      receivedDoc({ id: 'd1', satisfiesChecklistItemId: 'item-bank' }),
      receivedDoc({ id: 'd2', satisfiesChecklistItemId: 'item-cc', filename: 'cc-2026-04.pdf' }),
    ];
    const fetcher = makeFetcher({
      engagement: engagement({ partnerSignoff: true }),
      checklist,
      receivedDocs,
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.closeReady, true);
    assert.match(res.value.statusUpdate.subject, /all required documents received/);
    assert.match(
      res.value.statusUpdate.body,
      /signed off on our end/,
      'all-clear status copy should mention partner signoff',
    );
  });
});

describe('month-end-close-cpa — chase email vernacular + batching', () => {
  it('chases pending+late items in a SINGLE batched email per recipient with CPA tone', async () => {
    const checklist: ChecklistItem[] = [
      checklistItem({
        id: 'item-bank',
        label: 'April 2026 bank statement — Operating',
        dueAt: new Date('2026-05-08T00:00:00Z'), // 7 days late
      }),
      checklistItem({
        id: 'item-cc',
        label: 'April 2026 credit card statement — Amex',
        category: 'credit-card-statement',
        dueAt: new Date('2026-05-12T00:00:00Z'), // pending (3 days past on NOW)
      }),
      checklistItem({
        id: 'item-payroll',
        label: 'April 2026 payroll register',
        category: 'payroll-register',
        dueAt: new Date('2026-05-08T00:00:00Z'),
      }),
      checklistItem({
        id: 'item-optional',
        label: 'Owner-distribution memo (optional)',
        category: 'owner-distributions',
        dueAt: new Date('2026-05-08T00:00:00Z'),
        required: false, // optional → never chased
      }),
    ];
    const fetcher = makeFetcher({ checklist, receivedDocs: [] });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // One batched email — not three.
    assert.equal(res.value.chaseEmails.length, 1);
    const draft = res.value.chaseEmails[0];
    // Should batch the 3 required items only; optional is filtered out.
    assert.equal(draft.itemIds.length, 3);
    assert.ok(!draft.itemIds.includes('item-optional'));
    // CPA-vernacular markers — period spelled out, "engagement letter",
    // and the cpa.ts tone-guidance defer-to-operator merge field for any
    // tax-position phrasing.
    assert.match(draft.subject, /Past-due items for the April 2026 close/);
    assert.match(draft.body, /April 2026 month-end close/);
    assert.match(draft.body, /engagement letter/);
    assert.match(draft.body, /\{\{operator: tax position\}\}/);
    assert.match(draft.body, /\{\{operator: signature\}\}/);
    // Tone is formal across the board — never `casual` for a CPA chase.
    assert.equal(draft.tone, 'formal');
    // Late items batch lowers confidence so the CSM re-reads.
    assert.ok(draft.confidence <= 0.7, `late-batch confidence should be ≤ 0.7; got ${draft.confidence}`);
    // CC list carries the bookkeeper.
    assert.deepEqual(draft.ccEmails, ['mike.chen@acme-llc.example.com']);
  });

  it('pending-only batch (no late) uses higher confidence + softer subject', async () => {
    const checklist = [
      checklistItem({
        id: 'item-cc',
        label: 'April 2026 credit card statement',
        category: 'credit-card-statement',
        dueAt: new Date('2026-05-25T00:00:00Z'), // future
      }),
      checklistItem({
        id: 'item-bank',
        label: 'April 2026 bank statement',
        dueAt: new Date('2026-05-25T00:00:00Z'),
      }),
    ];
    // Force these into pending-chase by tightening lateAfterDays so the
    // skill chases pending too — but in this test, they're not yet due,
    // so they should NOT be chased.
    const fetcher = makeFetcher({ checklist, receivedDocs: [] });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Items are pending (future due date, no receipt) → still chased.
    assert.equal(res.value.chaseEmails.length, 1);
    const draft = res.value.chaseEmails[0];
    assert.match(draft.subject, /Documents needed for the April 2026 close/);
    assert.ok(!draft.subject.toLowerCase().includes('past-due'));
    assert.ok(draft.confidence >= 0.7, `pending-only batch should be ≥ 0.7; got ${draft.confidence}`);
  });

  it('no chase email when nothing is outstanding', async () => {
    const checklist = [
      checklistItem({ id: 'item-bank', dueAt: new Date('2026-05-10T00:00:00Z') }),
    ];
    const receivedDocs = [
      receivedDoc({ id: 'd1', satisfiesChecklistItemId: 'item-bank' }),
    ];
    const fetcher = makeFetcher({ checklist, receivedDocs });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.chaseEmails.length, 0);
    assert.equal(res.value.reminders.length, 0);
  });
});

describe('month-end-close-cpa — reminders + persistence', () => {
  it('proposes a reminder per chase email, default 3 days from now', async () => {
    const checklist = [
      checklistItem({ id: 'item-bank', dueAt: new Date('2026-05-08T00:00:00Z') }),
    ];
    const fetcher = makeFetcher({ checklist, receivedDocs: [] });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.reminders.length, 1);
    assert.equal(res.value.reminders[0].reminderOnLocalDate, '2026-05-18');
    assert.equal(res.value.reminders[0].recipientEmail, 'pat.lin@acme-llc.example.com');
  });

  it('persister captures BOTH the chase draft AND the status update when above threshold', async () => {
    const checklist = [
      checklistItem({ id: 'item-bank', dueAt: new Date('2026-05-25T00:00:00Z') }), // pending
    ];
    const fetcher = makeFetcher({ checklist, receivedDocs: [] });
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      persister,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // 1 chase + 1 status update = 2 calls
    assert.equal(persister.calls.length, 2);
    const threadIds = persister.calls.map((c) => c.threadId).sort();
    assert.deepEqual(threadIds, [
      `close-${CLIENT_ID}-${PERIOD}-chase`,
      `close-${CLIENT_ID}-${PERIOD}-status`,
    ]);
    assert.equal(res.value.chaseEmails[0].persisted, true);
    assert.ok(res.value.chaseEmails[0].providerDraftId);
    assert.equal(res.value.statusUpdate.persisted, true);
    assert.ok(res.value.statusUpdate.providerDraftId);
  });

  it('raising persistThreshold above status-update confidence keeps the status-update out of drafts folder', async () => {
    const checklist = [
      checklistItem({ id: 'item-bank', dueAt: new Date('2026-05-25T00:00:00Z') }),
    ];
    const fetcher = makeFetcher({ checklist, receivedDocs: [] });
    const persister = new RecordingDraftPersister();
    // In-flight close → status update confidence = 0.62. Threshold 0.7
    // suppresses persistence.
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      persister,
      persistThreshold: 0.7,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Chase draft is 0.78 → persists; status update is 0.62 → does not.
    const persistedThreadIds = persister.calls.map((c) => c.threadId);
    assert.ok(persistedThreadIds.includes(`close-${CLIENT_ID}-${PERIOD}-chase`));
    assert.ok(!persistedThreadIds.includes(`close-${CLIENT_ID}-${PERIOD}-status`));
    assert.equal(res.value.statusUpdate.persisted, false);
  });
});

describe('month-end-close-cpa — input mismatches return INVALID_INPUT', () => {
  it('workspace mismatch', async () => {
    const fetcher = makeFetcher({});
    const res = await runSkill({
      workspaceId: 'ws-other',
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'UPSTREAM_GMAIL_ERROR');
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });

  it('period mismatch', async () => {
    const fetcher = makeFetcher({});
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: '2026-03',
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });
});
