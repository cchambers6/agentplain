/**
 * lib/skills/title-escrow-closing-doc-chase/skill.test.ts
 *
 * Pins the title-escrow closing-doc chase: per-party batched chases,
 * never asserting a title status / wire-instructions destination,
 * deterministic bucketing across required + optional + late items.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonClosingFileFetcher } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type {
  ChecklistItem,
  ClosingFile,
  ReceivedDoc,
} from './types';

const WORKSPACE_ID = 'ws-title-0001';
const FILE_ID = 'closing-2026-0142';
const NOW = new Date('2026-05-22T15:00:00Z');

function file(): ClosingFile {
  return {
    fileId: FILE_ID,
    propertyAddress: '1247 Magnolia Dr, Atlanta GA',
    scheduledClosingDate: '2026-06-05',
    closingCoordinator: {
      name: 'Pat Hill',
      email: 'pat.hill@escrow.example',
      role: 'underwriter',
    },
    contacts: [
      { name: 'Bank Officer', email: 'lender@bank.example', role: 'lender' },
      { name: 'Sarah Buyer', email: 'sarah@buyer.example', role: 'buyer' },
      { name: 'Mark Seller', email: 'mark@seller.example', role: 'seller' },
    ],
  };
}

function checklistItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'item-cd',
    label: 'Final Closing Disclosure',
    responsibleParty: 'lender',
    dueAt: new Date('2026-05-15T00:00:00Z'),
    required: true,
    ...overrides,
  };
}

function fetcher(opts: {
  checklist: ChecklistItem[];
  received?: ReceivedDoc[];
}): JsonClosingFileFetcher {
  return new JsonClosingFileFetcher({
    workspaceId: WORKSPACE_ID,
    fileId: FILE_ID,
    file: file(),
    checklist: opts.checklist,
    receivedDocs: opts.received ?? [],
  });
}

describe('title-escrow-closing-doc-chase — bucketing', () => {
  it('buckets received / pending / late and computes closingReady', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fileId: FILE_ID,
      fetcher: fetcher({
        checklist: [
          checklistItem({ id: 'item-cd', dueAt: new Date('2026-05-10T00:00:00Z') }),
          checklistItem({
            id: 'item-survey',
            label: 'Property survey',
            responsibleParty: 'seller',
            dueAt: new Date('2026-05-25T00:00:00Z'),
          }),
        ],
        received: [
          {
            id: 'doc-cd',
            satisfiesChecklistItemId: 'item-cd',
            receivedAt: new Date('2026-05-12T00:00:00Z'),
            filename: 'final-cd.pdf',
          },
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.value.bucketCounts, { received: 1, pending: 1, late: 0 });
    assert.equal(res.value.closingReady, false);
  });

  it('all required items received → closingReady=true', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fileId: FILE_ID,
      fetcher: fetcher({
        checklist: [checklistItem({ id: 'item-cd' })],
        received: [
          {
            id: 'doc-cd',
            satisfiesChecklistItemId: 'item-cd',
            receivedAt: new Date('2026-05-12T00:00:00Z'),
            filename: 'final-cd.pdf',
          },
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.closingReady, true);
    assert.equal(res.value.drafts.length, 0, 'no drafts when nothing outstanding');
  });
});

describe('title-escrow-closing-doc-chase — per-party batching', () => {
  it('produces one batched draft per responsible party (not one per item)', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fileId: FILE_ID,
      fetcher: fetcher({
        checklist: [
          checklistItem({ id: 'item-cd', responsibleParty: 'lender' }),
          checklistItem({
            id: 'item-payoff',
            label: 'Payoff statement',
            responsibleParty: 'lender',
          }),
          checklistItem({
            id: 'item-survey',
            label: 'Property survey',
            responsibleParty: 'seller',
            dueAt: new Date('2026-05-10T00:00:00Z'),
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // 2 parties owe docs (lender + seller) → 2 drafts.
    assert.equal(res.value.drafts.length, 2);
    const lender = res.value.drafts.find((d) => d.party === 'lender');
    assert.ok(lender);
    assert.equal(lender!.itemIds.length, 2, 'lender batch should include both items');
  });

  it('NEVER asserts title status or wire destination — always merge fields', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fileId: FILE_ID,
      fetcher: fetcher({
        checklist: [checklistItem({ id: 'item-cd', responsibleParty: 'lender' })],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const draft = res.value.drafts[0];
    assert.match(draft.body, /\{\{operator: title status\}\}/);
    assert.match(draft.body, /\{\{operator: wire confirmation\}\}/);
    assert.equal(draft.tone, 'formal');
  });

  it('optional items never trigger a chase even when past target', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fileId: FILE_ID,
      fetcher: fetcher({
        checklist: [
          checklistItem({
            id: 'item-optional',
            label: 'Buyer info update',
            responsibleParty: 'buyer',
            required: false,
            dueAt: new Date('2026-05-01T00:00:00Z'), // 21 days late
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.drafts.length, 0);
  });

  it('late items raise urgency and lower confidence', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fileId: FILE_ID,
      fetcher: fetcher({
        checklist: [
          checklistItem({
            id: 'item-cd',
            responsibleParty: 'lender',
            dueAt: new Date('2026-05-10T00:00:00Z'),
          }),
        ],
      }),
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const lender = res.value.drafts[0];
    assert.match(lender.subject, /Past-due items/);
    assert.ok(lender.confidence <= 0.65);
  });
});

describe('title-escrow-closing-doc-chase — persistence', () => {
  it('persists each party draft to the recording persister above threshold', async () => {
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fileId: FILE_ID,
      fetcher: fetcher({
        checklist: [
          checklistItem({ id: 'item-cd', responsibleParty: 'lender', dueAt: new Date('2026-06-01T00:00:00Z') }),
        ],
      }),
      now: NOW,
      persister,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(persister.calls.length, 1);
    assert.equal(res.value.drafts[0].persisted, true);
  });
});
