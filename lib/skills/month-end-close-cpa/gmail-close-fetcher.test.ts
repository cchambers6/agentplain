/**
 * lib/skills/month-end-close-cpa/gmail-close-fetcher.test.ts
 *
 * Wave-5 (theme #12 / ratif #7). Proves the GmailCloseFetcher detects
 * received month-end docs from email attachments via the Gmail MCP port
 * (fixture-backed) and categorizes them against the engagement checklist —
 * so the CPA close stops returning empty when the client already emailed
 * the documents.
 *
 * Per `feedback_runner_portability.md`: binds TestGmailMcpServer (fixture
 * attachments) + JsonCloseFetcher (base). No live creds, no vendor SDK.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TestGmailMcpServer } from '../../integrations/gmail-mcp';
import type { FullMessage } from '../../integrations/gmail-mcp';
import { GmailCloseFetcher, categorizeAttachment } from './gmail-close-fetcher';
import { JsonCloseFetcher } from './json-fetcher';
import { runSkill } from './skill';
import type {
  ChecklistItem,
  ClientEngagement,
  ContactPerson,
} from './types';

const WORKSPACE_ID = 'ws-cpa-gmail-0001';
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

function engagement(): ClientEngagement {
  return {
    clientId: CLIENT_ID,
    clientName: 'Acme LLC',
    primaryContact: contact(),
    ccContacts: [],
    periodMonth: PERIOD,
    scope: 'full-stack-monthly',
    internalDeadline: new Date('2026-05-20T00:00:00Z'),
    partnerSignoff: false,
  };
}

function checklist(): ChecklistItem[] {
  return [
    {
      id: 'item-bank',
      label: 'April bank statement',
      category: 'bank-statement',
      dueAt: new Date('2026-05-10T00:00:00Z'),
      required: true,
    },
    {
      id: 'item-payroll',
      label: 'Payroll register',
      category: 'payroll-register',
      dueAt: new Date('2026-05-10T00:00:00Z'),
      required: true,
    },
    {
      id: 'item-salestax',
      label: 'Sales tax filing',
      category: 'sales-tax-filing',
      dueAt: new Date('2026-05-12T00:00:00Z'),
      required: true,
    },
  ];
}

function msg(overrides: Partial<FullMessage>): FullMessage {
  return {
    id: 'm-1',
    threadId: 't-1',
    rfcMessageId: null,
    fromEmail: 'pat.lin@acme-llc.example.com',
    fromName: 'Patricia Lin',
    toEmails: ['firm@cpa.example.com'],
    ccEmails: [],
    subject: 'Documents for April close',
    bodyText: 'Attached.',
    snippet: 'Attached.',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: '2026-05-08T10:00:00Z',
    labels: ['INBOX'],
    ...overrides,
  };
}

describe('GmailCloseFetcher — attachment detection', () => {
  it('detects emailed attachments and categorizes them against the checklist', async () => {
    const gmail = new TestGmailMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        messages: [
          msg({
            id: 'm-bank',
            subject: 'April bank statement attached',
            attachments: [
              {
                filename: 'Acme-April-bank-statement.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 12000,
                attachmentId: 'att-bank',
              },
            ],
          }),
          msg({
            id: 'm-payroll',
            subject: 'Payroll register for April',
            attachments: [
              {
                filename: 'payroll-register-2026-04.csv',
                mimeType: 'text/csv',
                sizeBytes: 4000,
                attachmentId: 'att-payroll',
              },
            ],
          }),
          msg({
            id: 'm-noise',
            subject: 'Re: lunch next week',
            attachments: [
              {
                filename: 'signature-logo.png',
                mimeType: 'image/png',
                sizeBytes: 500,
                attachmentId: 'att-logo',
              },
            ],
          }),
        ],
      },
    });

    const base = new JsonCloseFetcher({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      engagement: engagement(),
      checklist: checklist(),
      receivedDocs: [], // nothing in the portal — the gap the audit named
    });

    const fetcher = new GmailCloseFetcher({ base, gmail });
    const res = await fetcher.fetchReceivedDocs({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
    });

    assert.ok(res.ok);
    if (!res.ok) return;
    const bySource = res.value.filter((d) => d.source === 'gmail');
    // The bank statement + payroll register are detected; the logo PNG is
    // NOT (it lands as uncategorized at worst, but here the keyword match
    // routes the two real docs and the logo matches nothing).
    const bank = bySource.find((d) => d.filename.includes('bank-statement'));
    const payroll = bySource.find((d) => d.filename.includes('payroll-register'));
    assert.ok(bank, 'bank statement attachment detected');
    assert.ok(payroll, 'payroll register attachment detected');
    assert.equal(bank!.satisfiesChecklistItemId, 'item-bank');
    assert.equal(payroll!.satisfiesChecklistItemId, 'item-payroll');
    assert.equal(bank!.source, 'gmail');
  });

  it('flips the close from empty to populated — required items now show received', async () => {
    const gmail = new TestGmailMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        messages: [
          msg({
            id: 'm-bank',
            subject: 'bank statement',
            attachments: [
              {
                filename: 'bank-statement.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 9000,
                attachmentId: 'a1',
              },
            ],
          }),
        ],
      },
    });
    const base = new JsonCloseFetcher({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      engagement: engagement(),
      checklist: checklist(),
      receivedDocs: [],
    });
    const fetcher = new GmailCloseFetcher({ base, gmail });

    const out = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.ok(out.ok);
    if (!out.ok) return;
    const bankItem = out.value.items.find((i) => i.itemId === 'item-bank');
    assert.equal(bankItem?.status, 'received', 'emailed bank statement marks the item received');
    assert.equal(out.value.bucketCounts.received, 1);
  });

  it('merges Gmail docs with base portal docs (no duplication)', async () => {
    const gmail = new TestGmailMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        messages: [
          msg({
            id: 'm-tax',
            subject: 'sales tax filing',
            attachments: [
              {
                filename: 'sales-tax-april.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 3000,
                attachmentId: 'a-tax',
              },
            ],
          }),
        ],
      },
    });
    const base = new JsonCloseFetcher({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      engagement: engagement(),
      checklist: checklist(),
      receivedDocs: [
        {
          id: 'portal-payroll',
          satisfiesChecklistItemId: 'item-payroll',
          receivedAt: new Date('2026-05-07T00:00:00Z'),
          filename: 'payroll.csv',
          source: 'taxdome',
        },
      ],
    });
    const fetcher = new GmailCloseFetcher({ base, gmail });
    const res = await fetcher.fetchReceivedDocs({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.length, 2);
    assert.ok(res.value.some((d) => d.source === 'taxdome'));
    assert.ok(res.value.some((d) => d.source === 'gmail'));
  });

  it('falls back to base docs when the Gmail read fails', async () => {
    // A server scoped to a different workspace + an empty seed still lists
    // ok; to force a failure we use a stub that errors on listMessages.
    const failingGmail = {
      name: 'gmail-stub',
      workspaceId: WORKSPACE_ID,
      listMessages: async () => ({
        ok: false as const,
        error: { code: 'UPSTREAM_ERROR' as const, message: 'boom' },
      }),
      getMessage: async () => ({ ok: false as const, error: { code: 'NOT_FOUND' as const, message: 'x' } }),
      searchThreads: async () => ({ ok: true as const, value: { threads: [], nextPageToken: null } }),
      draftMessage: async () => ({ ok: false as const, error: { code: 'NOT_IMPLEMENTED' as const, message: 'x' } }),
      labelMessage: async () => ({ ok: false as const, error: { code: 'NOT_IMPLEMENTED' as const, message: 'x' } }),
      listLabels: async () => ({ ok: true as const, value: { labels: [] } }),
      composeFromTemplate: async () => ({ ok: false as const, error: { code: 'NOT_IMPLEMENTED' as const, message: 'x' } }),
      scheduleSend: async () => ({ ok: false as const, error: { code: 'NOT_IMPLEMENTED' as const, message: 'x' } }),
      archive: async () => ({ ok: false as const, error: { code: 'NOT_IMPLEMENTED' as const, message: 'x' } }),
      listResources: async () => ({ ok: true as const, value: [] }),
      readResource: async () => ({ ok: false as const, error: { code: 'NOT_FOUND' as const, message: 'x' } }),
    };
    const base = new JsonCloseFetcher({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      engagement: engagement(),
      checklist: checklist(),
      receivedDocs: [
        {
          id: 'portal-bank',
          satisfiesChecklistItemId: 'item-bank',
          receivedAt: new Date('2026-05-07T00:00:00Z'),
          filename: 'bank.pdf',
          source: 'taxdome',
        },
      ],
    });
    const fetcher = new GmailCloseFetcher({ base, gmail: failingGmail });
    const res = await fetcher.fetchReceivedDocs({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0].source, 'taxdome');
  });
});

describe('categorizeAttachment', () => {
  it('routes by filename + subject keyword overlap; returns null for noise', () => {
    const list = checklist();
    assert.equal(
      categorizeAttachment({
        filename: 'Acme-bank-statement-april.pdf',
        subject: 'statements',
        checklist: list,
      }),
      'item-bank',
    );
    assert.equal(
      categorizeAttachment({
        filename: 'random-logo.png',
        subject: 'lunch',
        checklist: list,
      }),
      null,
    );
  });
});
