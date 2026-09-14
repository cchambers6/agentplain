/**
 * lib/skills/month-end-close-cpa/close-received-docs.acceptance.test.ts
 *
 * ACCEPTANCE TEST for the defect that made the CPA flagship produce wrong
 * output for every paying customer, every month.
 *
 * `QuickBooksCloseFetcher.fetchReceivedDocs` returns `skillOk([])`
 * UNCONDITIONALLY. Its header is candid about why -- "QuickBooks does not
 * store doc-portal receipts. Returning empty is the honest answer" -- and
 * that is true of that adapter. It is catastrophic as the only wired one:
 * `run-for-workspace.ts` hardcoded `new QuickBooksCloseFetcher(...)`, so
 * EVERY checklist item bucketed pending-or-late, for every client, every
 * month, forever. A client who emailed their bank statements three weeks
 * ago got chased for them again. The chase body even apologises for it:
 * "If you have already sent any of these, please disregard."
 *
 * This test drives the PRODUCTION entry point end to end with a QuickBooks
 * customer who has emailed one of the checklist documents, and asserts the
 * chase that reaches the approval queue does not ask for it again.
 *
 * THIS TEST WAS RUN AGAINST THE UNMODIFIED CODE FIRST AND FAILED. A test
 * that never failed proves nothing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runMonthEndCloseForWorkspace } from './run-for-workspace';
import { TestQuickbooksMcpServer } from '@/lib/integrations/quickbooks-mcp';
import { TestGmailMcpServer } from '@/lib/integrations/gmail-mcp';
import type { FullMessage } from '@/lib/integrations/gmail-mcp';
import { skillOk, type DraftPersister, type SkillResult } from '../types';

const WS = 'ws-cpa-accept-1';
// The fixture QuickBooks customer '1' (Acme Roofing) with an email on file.
const CLIENT_ID = '1';
const CLIENT_EMAIL = 'ar@example.com';
const NOW = new Date('2026-06-01T05:00:00Z');
const PERIOD = '2026-05';
/** The refId the skill mints for the chase. Stable: client + period. */
const CHASE_REF = `close-${CLIENT_ID}-${PERIOD}-chase`;

/** The label the fixture attachment satisfies, and one it must NOT. */
const SATISFIED_LABEL = `Bank statement(s) for ${PERIOD}`;
const STILL_OUTSTANDING_LABEL = `Sales-tax filing confirmation for ${PERIOD}`;

/** Stands in for the WorkApprovalQueueItem write -- `threadId` IS the refId
 *  (`prisma-approval-persister.ts` maps `args.threadId` -> `refId`). */
class RecordingPersister implements DraftPersister {
  readonly name = 'recording' as const;
  readonly drafts: Array<{ threadId: string; subject: string; body: string }> = [];
  async persistDraft(args: {
    workspaceId: string;
    threadId: string;
    inReplyToMessageId: string | null;
    toEmails: string[];
    subject: string;
    body: string;
  }): Promise<SkillResult<{ providerDraftId: string }>> {
    this.drafts.push({ threadId: args.threadId, subject: args.subject, body: args.body });
    return skillOk({ providerDraftId: `rec-${this.drafts.length}` });
  }
}

function gmailWithBankStatement(): TestGmailMcpServer {
  const msg: FullMessage = {
    id: 'm-acme-bank',
    threadId: 't-acme',
    rfcMessageId: null,
    fromEmail: CLIENT_EMAIL,
    fromName: 'Acme Roofing',
    toEmails: ['firm@cpa.example.com'],
    ccEmails: [],
    subject: 'May bank statement for the close',
    bodyText: 'Attached is the statement you asked for.',
    snippet: 'Attached is the statement you asked for.',
    references: [],
    inReplyTo: null,
    attachments: [
      {
        filename: 'Acme-2026-05-bank-statement.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 18000,
        attachmentId: 'att-bank-1',
      },
    ],
    receivedAt: '2026-05-28T14:00:00Z',
    labels: ['INBOX'],
  };
  return new TestGmailMcpServer({ workspaceId: WS, seed: { messages: [msg] } });
}

describe('month-end-close-cpa - a document the client already emailed is not chased again', () => {
  it('omits the satisfied item from the chase and counts it received', async () => {
    const persister = new RecordingPersister();

    const result = await runMonthEndCloseForWorkspace({
      workspaceId: WS,
      now: NOW,
      buildPersister: () => persister,
      mcp: new TestQuickbooksMcpServer({ workspaceId: WS }),
      gmail: gmailWithBankStatement(),
      // Injected so the test needs no Postgres. Same values the real reader
      // returns for a workspace that has never configured the skill.
      readConfig: async () => ({ defaultScope: 'full-stack-monthly', scopeByClientId: {} }),
    });

    assert.equal(result.periodMonth, PERIOD);
    assert.equal(result.failures.length, 0, `close failed: ${JSON.stringify(result.failures)}`);
    // NOT `=== 1`: the QuickBooks fixture carries more than one customer with
    // an email on file. This test is about ONE client's close.
    assert.ok(result.clientsPrepped >= 1, `examined ${result.clientsConsidered} clients, prepped ${result.clientsPrepped}`);

    const out = result.outputs.find((o) => o.clientId === CLIENT_ID);
    assert.ok(out, `no close output for client ${CLIENT_ID}`);

    // -- examined N of M, and fail when N is zero ---------------------------
    // Without this, every assertion below passes vacuously on an empty
    // checklist -- the exact shape that let 2,795 cases vanish while node
    // reported `fail 0`.
    const M = out.items.length;
    assert.ok(M > 0, `examined ${M} checklist items - the checklist is empty`);
    assert.equal(
      M,
      8,
      `examined ${M} of an expected 8 checklist items (full-stack-monthly). ` +
        'If the engagement scope now resolves differently, re-read this test.',
    );

    // -- the defect itself --------------------------------------------------
    assert.ok(
      out.bucketCounts.received >= 1,
      `examined ${M} items: received=${out.bucketCounts.received}, ` +
        `pending=${out.bucketCounts.pending}, late=${out.bucketCounts.late}. ` +
        'The client emailed a checklist document and nothing was detected as received.',
    );

    const satisfied = out.items.find((i) => i.label === SATISFIED_LABEL);
    assert.ok(satisfied, `examined ${M} items; none labelled "${SATISFIED_LABEL}"`);
    assert.equal(
      satisfied?.status,
      'received',
      `"${SATISFIED_LABEL}" is ${satisfied?.status} even though the client emailed it`,
    );
    assert.ok(
      (satisfied?.receivedDocs.length ?? 0) >= 1,
      'the satisfied item carries no receipt - the evidence is missing from the operator view',
    );

    // -- the approval-queue row the CSM actually reads -----------------------
    const chase = persister.drafts.find((d) => d.threadId === CHASE_REF);
    assert.ok(chase, `no WorkApprovalQueueItem at refId ${CHASE_REF}; got: ${persister.drafts.map((d) => d.threadId).join(', ')}`);
    assert.ok(
      !chase.body.includes(SATISFIED_LABEL),
      `the chase at ${CHASE_REF} still asks for a document the client already emailed:\n${chase.body}`,
    );

    // -- KNOWN-POSITIVE CONTROL ---------------------------------------------
    // "Omits the item" would also be true of a chase that asks for nothing,
    // or of no chase at all. Assert the still-missing items ARE requested, so
    // this test cannot pass by the skill going silent.
    assert.ok(
      chase.body.includes(STILL_OUTSTANDING_LABEL),
      `the chase dropped an item that IS still outstanding ("${STILL_OUTSTANDING_LABEL}") - ` +
        'the fix has over-reached, not under-reached',
    );
    assert.ok(
      out.bucketCounts.pending + out.bucketCounts.late >= 1,
      'nothing is outstanding at all - the fixture no longer exercises the chase path',
    );
  });

  it('with no Gmail server wired, the close still runs (clean degrade, not a throw)', async () => {
    const persister = new RecordingPersister();
    const result = await runMonthEndCloseForWorkspace({
      workspaceId: WS,
      now: NOW,
      buildPersister: () => persister,
      mcp: new TestQuickbooksMcpServer({ workspaceId: WS }),
      gmail: null, // explicitly the pre-fix QuickBooks-only behaviour
      readConfig: async () => ({ defaultScope: 'full-stack-monthly', scopeByClientId: {} }),
    });
    assert.equal(result.failures.length, 0);
    assert.ok(result.clientsPrepped >= 1);
    const out = result.outputs.find((o) => o.clientId === CLIENT_ID);
    assert.ok(out, 'close output missing');
    assert.ok(out.items.length > 0, `examined ${out.items.length} items`);
    // Nothing detected, everything chased -- documented, not desirable.
    assert.equal(out.bucketCounts.received, 0);
  });
});

/**
 * The second half of the defect: `QuickBooksCloseFetcherOptions.scope`
 * existed, was tested with 'bookkeeping-only', and had NO production caller.
 * `run-for-workspace.ts` constructed the fetcher with no scope argument, so
 * every engagement got `full-stack-monthly` -- the 8-item list -- and a
 * tax-only client was chased for a payroll register and a sales-tax filing
 * confirmation every month.
 */
describe('month-end-close-cpa - engagement scope reaches the fetcher', () => {
  const PAYROLL_LABEL = `Payroll register for ${PERIOD}`;
  const SALES_TAX_LABEL = `Sales-tax filing confirmation for ${PERIOD}`;

  it('a bookkeeping-only client is not chased for payroll or sales tax', async () => {
    const persister = new RecordingPersister();
    const result = await runMonthEndCloseForWorkspace({
      workspaceId: WS,
      now: NOW,
      buildPersister: () => persister,
      mcp: new TestQuickbooksMcpServer({ workspaceId: WS }),
      gmail: null,
      readConfig: async () => ({
        defaultScope: 'full-stack-monthly',
        scopeByClientId: { [CLIENT_ID]: 'bookkeeping-only' },
      }),
    });

    const out = result.outputs.find((o) => o.clientId === CLIENT_ID);
    assert.ok(out, 'close output missing');
    assert.equal(
      out.items.length,
      2,
      `examined ${out.items.length} of an expected 2 checklist items for bookkeeping-only`,
    );

    const chase = persister.drafts.find((d) => d.threadId === CHASE_REF);
    assert.ok(chase, `no chase at ${CHASE_REF}`);
    assert.ok(!chase.body.includes(PAYROLL_LABEL), 'bookkeeping-only client chased for a payroll register');
    assert.ok(!chase.body.includes(SALES_TAX_LABEL), 'bookkeeping-only client chased for a sales-tax filing');

    // KNOWN-POSITIVE CONTROL: a narrower scope must still chase its own
    // items, or "not chased for payroll" would be true of a silent skill.
    assert.ok(
      chase.body.includes(`Bank statement(s) for ${PERIOD}`),
      'bookkeeping-only client was not chased for a bank statement either - the scope narrowed too far',
    );
  });

  it('CONTROL: the same client at the default scope IS chased for payroll', async () => {
    // Proves the assertion above is about the scope, not about the labels
    // being absent for some unrelated reason.
    const persister = new RecordingPersister();
    await runMonthEndCloseForWorkspace({
      workspaceId: WS,
      now: NOW,
      buildPersister: () => persister,
      mcp: new TestQuickbooksMcpServer({ workspaceId: WS }),
      gmail: null,
      readConfig: async () => ({ defaultScope: 'full-stack-monthly', scopeByClientId: {} }),
    });
    const chase = persister.drafts.find((d) => d.threadId === CHASE_REF);
    assert.ok(chase, `no chase at ${CHASE_REF}`);
    assert.ok(chase.body.includes(PAYROLL_LABEL), 'default scope no longer chases payroll - the control is broken');
  });

  it('an unknown scope string in config is dropped, not coerced', async () => {
    const persister = new RecordingPersister();
    const result = await runMonthEndCloseForWorkspace({
      workspaceId: WS,
      now: NOW,
      buildPersister: () => persister,
      mcp: new TestQuickbooksMcpServer({ workspaceId: WS }),
      gmail: null,
      // Shape a malformed SkillConfig row would produce after the reader
      // has already dropped the bad value: the client simply has no entry.
      readConfig: async () => ({ defaultScope: 'full-stack-monthly', scopeByClientId: {} }),
    });
    const out = result.outputs.find((o) => o.clientId === CLIENT_ID);
    assert.ok(out, 'close output missing');
    assert.equal(out.items.length, 8, `examined ${out.items.length} of an expected 8 items (documented default)`);
  });
});
