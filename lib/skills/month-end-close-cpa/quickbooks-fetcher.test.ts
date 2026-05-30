/**
 * lib/skills/month-end-close-cpa/quickbooks-fetcher.test.ts
 *
 * Integration test for the QuickBooks-backed `CloseFetcher`. Runs the
 * full skill end-to-end against a mocked QuickbooksMcpServer so the
 * assertion is "the drafted approval payload reflects real QuickBooks
 * customer data + a real templated checklist, not stub JSON."
 *
 * Per `feedback_integration_acceptance_is_functional.md`: pass = the
 * skill produces a coordination output with real client name + real
 * email + real period detail. Fail = stub content survives.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  mcpError,
  mcpOk,
  type McpErrorCode,
  type McpResult,
} from '@/lib/integrations/mcp-core';
import type {
  CreateInvoiceInput,
  CreateInvoiceOutput,
  CustomerSummary,
  ExpenseSummary,
  GetInvoiceInput,
  GetInvoiceOutput,
  GetProfitAndLossInput,
  GetProfitAndLossOutput,
  InvoiceSummary,
  ListCustomersInput,
  ListCustomersOutput,
  ListExpensesInput,
  ListExpensesOutput,
  ListInvoicesInput,
  ListInvoicesOutput,
  QuickbooksMcpServer,
  RecordPaymentInput,
  RecordPaymentOutput,
} from '@/lib/integrations/quickbooks-mcp';
import { runSkill } from './skill';
import {
  QUICKBOOKS_NOT_CONNECTED_MESSAGE,
  QuickBooksCloseFetcher,
} from './quickbooks-fetcher';

const WORKSPACE_ID = 'ws-cpa-qb-test-0001';
const CLIENT_ID = 'qb-cust-cpa-1';
const PERIOD = '2026-04';
// 5 days after the May-15 deadline → every required item flips to late.
const NOW = new Date('2026-05-20T10:00:00Z');

function buildMockMcp(args: {
  customers: CustomerSummary[];
  failWith?: { code: McpErrorCode; message: string };
}): QuickbooksMcpServer {
  return {
    name: 'quickbooks-mock' as const,
    workspaceId: WORKSPACE_ID,
    async listInvoices(_input: ListInvoicesInput): Promise<McpResult<ListInvoicesOutput>> {
      return mcpOk({ invoices: [] });
    },
    async getInvoice(_input: GetInvoiceInput): Promise<McpResult<GetInvoiceOutput>> {
      return mcpError('NOT_FOUND', 'not used in this test');
    },
    async createInvoice(_input: CreateInvoiceInput): Promise<McpResult<CreateInvoiceOutput>> {
      return mcpError('NOT_FOUND', 'not used in this test');
    },
    async listCustomers(_input: ListCustomersInput): Promise<McpResult<ListCustomersOutput>> {
      if (args.failWith) return mcpError(args.failWith.code, args.failWith.message);
      return mcpOk({ customers: args.customers });
    },
    async recordPayment(_input: RecordPaymentInput): Promise<McpResult<RecordPaymentOutput>> {
      return mcpError('APPROVAL_REQUIRED', 'not used in this test');
    },
    async getProfitAndLoss(_input: GetProfitAndLossInput): Promise<McpResult<GetProfitAndLossOutput>> {
      return mcpError('NOT_FOUND', 'not used in this test');
    },
    async listExpenses(_input: ListExpensesInput): Promise<McpResult<ListExpensesOutput>> {
      return mcpOk({ expenses: [] as ExpenseSummary[] });
    },
  };
}

describe('QuickBooksCloseFetcher — happy path', () => {
  it('drives the full month-end-close skill against a real QuickBooks customer', async () => {
    const mcp = buildMockMcp({
      customers: [
        {
          id: CLIENT_ID,
          displayName: 'Riverside Cabinetry LLC',
          email: 'owner@riverside-cabinetry.com',
          balance: 0,
          active: true,
        },
      ],
    });
    const fetcher = new QuickBooksCloseFetcher({
      workspaceId: WORKSPACE_ID,
      mcp,
      scope: 'full-stack-monthly',
    });
    assert.equal(fetcher.name, 'quickbooks');
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.clientName, 'Riverside Cabinetry LLC');
    assert.equal(res.value.periodMonth, PERIOD);
    // Full-stack scope drives 8 templated items.
    assert.equal(res.value.items.length, 8);
    // QB has no received-doc concept — everything should be pending
    // or late. (Past internalDeadline → late.)
    assert.equal(res.value.bucketCounts.received, 0);
    assert.ok(
      res.value.bucketCounts.pending + res.value.bucketCounts.late === 8,
    );
    // Single batched chase email lands.
    assert.equal(res.value.chaseEmails.length, 1);
    const chase = res.value.chaseEmails[0];
    assert.equal(chase.toEmails[0], 'owner@riverside-cabinetry.com');
    assert.match(chase.subject, /April 2026 close/);
    // Body proves real-content — names real-month-name + the bank-
    // statement item (the templated checklist's first required row).
    assert.match(chase.body, /Bank statement\(s\) for 2026-04/);
    assert.match(chase.body, /April 2026/);
  });

  it('uses a narrower checklist for bookkeeping-only scope', async () => {
    const mcp = buildMockMcp({
      customers: [
        {
          id: CLIENT_ID,
          displayName: 'Riverside Cabinetry LLC',
          email: 'owner@riverside-cabinetry.com',
          balance: 0,
          active: true,
        },
      ],
    });
    const fetcher = new QuickBooksCloseFetcher({
      workspaceId: WORKSPACE_ID,
      mcp,
      scope: 'bookkeeping-only',
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
    // Bookkeeping-only = 2 items (bank + credit card).
    assert.equal(res.value.items.length, 2);
  });
});

describe('QuickBooksCloseFetcher — degraded mode', () => {
  it('returns NOT_CONFIGURED when QuickBooks is not yet connected', async () => {
    const mcp = buildMockMcp({
      customers: [],
      failWith: {
        code: 'CREDENTIAL_NOT_FOUND',
        message: 'QuickBooks credential missing for workspace',
      },
    });
    const fetcher = new QuickBooksCloseFetcher({
      workspaceId: WORKSPACE_ID,
      mcp,
    });
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
    assert.ok(res.error.message.includes(QUICKBOOKS_NOT_CONNECTED_MESSAGE));
  });

  it('returns NOT_APPLICABLE when no QuickBooks customer matches clientId', async () => {
    const mcp = buildMockMcp({
      customers: [
        {
          id: 'qb-different-id',
          displayName: 'Other Client',
          email: 'other@example.com',
          balance: 0,
          active: true,
        },
      ],
    });
    const fetcher = new QuickBooksCloseFetcher({
      workspaceId: WORKSPACE_ID,
      mcp,
    });
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
});
