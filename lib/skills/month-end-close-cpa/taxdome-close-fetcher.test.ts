/**
 * lib/skills/month-end-close-cpa/taxdome-close-fetcher.test.ts
 *
 * Integration test for the TaxDome-backed `CloseFetcher`. Runs the full
 * skill end-to-end against the fixture TaxDome MCP server so the assertion
 * is "the assembled close reflects REAL TaxDome client + received-doc
 * portal data, not stub JSON."
 *
 * Per `feedback_integration_acceptance_is_functional.md`: pass = the
 * close buckets the client's actual uploaded docs as received and chases
 * only what is genuinely missing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mcpError, mcpOk, type McpErrorCode, type McpResult } from '@/lib/integrations/mcp-core';
import type {
  GetClientInput,
  GetClientOutput,
  ListClientsInput,
  ListClientsOutput,
  ListEngagementLettersInput,
  ListEngagementLettersOutput,
  ListReceivedDocumentsInput,
  ListReceivedDocumentsOutput,
  ListTaxDocumentsInput,
  ListTaxDocumentsOutput,
  GetTaxDocumentInput,
  GetTaxDocumentOutput,
  TaxdomeClientSummary,
  TaxdomeDocumentSummary,
  TaxdomeMcpServer,
} from '@/lib/integrations/taxdome-mcp';
import { runSkill } from './skill';
import { TAXDOME_NOT_CONNECTED_MESSAGE, TaxdomeCloseFetcher } from './taxdome-close-fetcher';

const WORKSPACE_ID = 'ws-cpa-taxdome-0001';
const CLIENT_ID = 'td-cl-1';
const PERIOD = '2026-04';
// 5 days after the May-15 internal deadline.
const NOW = new Date('2026-05-20T10:00:00Z');

function buildMockMcp(args: {
  client?: TaxdomeClientSummary;
  receivedDocs?: TaxdomeDocumentSummary[];
  failWith?: { code: McpErrorCode; message: string };
}): TaxdomeMcpServer {
  return {
    name: 'taxdome-mock' as const,
    workspaceId: WORKSPACE_ID,
    async listClients(_i: ListClientsInput): Promise<McpResult<ListClientsOutput>> {
      return mcpOk({ clients: args.client ? [args.client] : [] });
    },
    async getClient(_i: GetClientInput): Promise<McpResult<GetClientOutput>> {
      if (args.failWith) return mcpError(args.failWith.code, args.failWith.message);
      if (!args.client) return mcpError('NOT_FOUND', 'no client');
      return mcpOk({ client: args.client });
    },
    async listTaxDocuments(_i: ListTaxDocumentsInput): Promise<McpResult<ListTaxDocumentsOutput>> {
      return mcpOk({ documents: [] });
    },
    async getTaxDocument(_i: GetTaxDocumentInput): Promise<McpResult<GetTaxDocumentOutput>> {
      return mcpError('NOT_FOUND', 'not used');
    },
    async listEngagementLetters(
      _i: ListEngagementLettersInput,
    ): Promise<McpResult<ListEngagementLettersOutput>> {
      return mcpOk({ engagementLetters: [] });
    },
    async listReceivedDocuments(
      _i: ListReceivedDocumentsInput,
    ): Promise<McpResult<ListReceivedDocumentsOutput>> {
      if (args.failWith) return mcpError(args.failWith.code, args.failWith.message);
      return mcpOk({ receivedDocuments: args.receivedDocs ?? [] });
    },
  };
}

describe('TaxdomeCloseFetcher — happy path', () => {
  it('buckets the client real received docs and chases what is missing', async () => {
    const mcp = buildMockMcp({
      client: { id: CLIENT_ID, name: 'Magnolia Bakery LLC', email: 'owner@magnolia.example', active: true },
      receivedDocs: [
        {
          id: 'rdoc-1',
          filename: 'Magnolia-2026-04-bank-statement.pdf',
          clientId: CLIENT_ID,
          uploadedAt: '2026-05-03T12:00:00Z',
          status: 'pending-review',
          kind: 'received-doc',
        },
        {
          id: 'rdoc-2',
          filename: 'Magnolia-2026-04-payroll-register.pdf',
          clientId: CLIENT_ID,
          uploadedAt: '2026-05-04T12:00:00Z',
          status: 'reviewed',
          kind: 'received-doc',
        },
        {
          // archived → must NOT count as a fresh receipt.
          id: 'rdoc-3',
          filename: 'Magnolia-2025-old-bank.pdf',
          clientId: CLIENT_ID,
          uploadedAt: '2025-12-01T12:00:00Z',
          status: 'archived',
          kind: 'received-doc',
        },
      ],
    });
    const fetcher = new TaxdomeCloseFetcher({
      workspaceId: WORKSPACE_ID,
      mcp,
      scope: 'full-stack-monthly',
    });
    assert.equal(fetcher.name, 'taxdome');
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.clientName, 'Magnolia Bakery LLC');
    // Full-stack scope → 8 templated items.
    assert.equal(res.value.items.length, 8);
    // Bank statement + payroll register matched by filename keyword →
    // those two items are received; the rest are late (past deadline).
    assert.equal(res.value.bucketCounts.received, 2);
    const bank = res.value.items.find((i) => i.category === 'bank-statement');
    assert.equal(bank?.status, 'received');
    const payroll = res.value.items.find((i) => i.category === 'payroll-register');
    assert.equal(payroll?.status, 'received');
    // Chase email goes only for the still-missing required items.
    assert.equal(res.value.chaseEmails.length, 1);
    const chase = res.value.chaseEmails[0];
    assert.equal(chase.toEmails[0], 'owner@magnolia.example');
    // The bank statement is in hand → must NOT appear in the chase body.
    assert.ok(!/Bank statement\(s\) for 2026-04/.test(chase.body));
    // Sales-tax filing is still missing → must appear.
    assert.match(chase.body, /Sales-tax filing/);
  });

  it('surfaces an unmatched upload as an uncategorized receipt, not a false match', async () => {
    const mcp = buildMockMcp({
      client: { id: CLIENT_ID, name: 'Magnolia Bakery LLC', email: 'owner@magnolia.example', active: true },
      receivedDocs: [
        {
          id: 'rdoc-x',
          filename: 'random-scan-0042.pdf',
          clientId: CLIENT_ID,
          uploadedAt: '2026-05-03T12:00:00Z',
          status: 'pending-review',
          kind: 'received-doc',
        },
      ],
    });
    const fetcher = new TaxdomeCloseFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.uncategorizedReceipts.length, 1);
    assert.equal(res.value.uncategorizedReceipts[0].source, 'taxdome');
    assert.equal(res.value.bucketCounts.received, 0);
  });
});

describe('TaxdomeCloseFetcher — degraded mode', () => {
  it('returns NOT_CONFIGURED when TaxDome is not connected', async () => {
    const mcp = buildMockMcp({
      failWith: { code: 'CREDENTIAL_NOT_FOUND', message: 'no taxdome credential' },
    });
    const fetcher = new TaxdomeCloseFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.ok(res.error.message.includes(TAXDOME_NOT_CONNECTED_MESSAGE));
  });

  it('returns NOT_APPLICABLE when the client has no email on file', async () => {
    const mcp = buildMockMcp({
      client: { id: CLIENT_ID, name: 'No Email Co.', email: null, active: true },
    });
    const fetcher = new TaxdomeCloseFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_APPLICABLE');
  });

  it('runs end-to-end against the shipped fixture TaxDome server', async () => {
    // The fixture server (test-server.ts) carries cl-1 = Acme Roofing with
    // a pending-review bank statement upload. Proves the prod-shape path.
    const { TestTaxdomeMcpServer } = await import('@/lib/integrations/taxdome-mcp');
    const fetcher = new TaxdomeCloseFetcher({
      workspaceId: WORKSPACE_ID,
      mcp: new TestTaxdomeMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: 'cl-1',
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.clientName, 'Acme Roofing');
    // The fixture's AcmeRoofing-Q1-BankStatement.pdf matches bank-statement.
    const bank = res.value.items.find((i) => i.category === 'bank-statement');
    assert.equal(bank?.status, 'received');
  });
});
