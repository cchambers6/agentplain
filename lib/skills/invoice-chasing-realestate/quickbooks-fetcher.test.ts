/**
 * lib/skills/invoice-chasing-realestate/quickbooks-fetcher.test.ts
 *
 * Integration test for the QuickBooks-backed `InvoiceFetcher`. Drives the
 * full skill end-to-end against a mocked QuickbooksMcpServer so the
 * assertion is "the drafted approval-queue payload contains real
 * QuickBooks-derived content, not stub JSON."
 *
 * Per `feedback_integration_acceptance_is_functional.md`: the bar is the
 * full value loop — fetch invoices, hydrate customers, bucket by days,
 * draft a tier-appropriate reminder. Pass = a real draft from a real MCP
 * call. Fail = stub content survives or the skill returns an UPSTREAM
 * error.
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
  QuickBooksInvoiceFetcher,
} from './quickbooks-fetcher';

const WORKSPACE_ID = 'ws-finance-qb-test-0001';
const NOW = new Date('2026-05-20T12:00:00Z');

/** Minimal QuickbooksMcpServer that returns canned rows the test can
 *  control — keeps the skill assertion focused on "did the QB data make
 *  it through every layer?" */
function buildMockMcp(args: {
  invoices: InvoiceSummary[];
  customers: CustomerSummary[];
  failWith?: { code: McpErrorCode; message: string };
}): QuickbooksMcpServer {
  return {
    name: 'quickbooks-mock' as const,
    workspaceId: WORKSPACE_ID,
    async listInvoices(_input: ListInvoicesInput): Promise<McpResult<ListInvoicesOutput>> {
      if (args.failWith) return mcpError(args.failWith.code, args.failWith.message);
      return mcpOk({ invoices: args.invoices });
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
      return mcpError('APPROVAL_REQUIRED', 'never called from a read-only fetcher');
    },
    async getProfitAndLoss(_input: GetProfitAndLossInput): Promise<McpResult<GetProfitAndLossOutput>> {
      return mcpError('NOT_FOUND', 'not used in this test');
    },
    async listExpenses(_input: ListExpensesInput): Promise<McpResult<ListExpensesOutput>> {
      return mcpError('NOT_FOUND', 'not used in this test');
    },
    async listEstimates(): Promise<McpResult<import('./../../integrations/quickbooks-mcp/types').ListEstimatesOutput>> {
      return mcpError('NOT_FOUND', 'not used in this test');
    },
    async getEstimate(): Promise<McpResult<import('./../../integrations/quickbooks-mcp/types').GetEstimateOutput>> {
      return mcpError('NOT_FOUND', 'not used in this test');
    },
    async sendInvoice(): Promise<McpResult<import('./../../integrations/quickbooks-mcp/actions').SendInvoiceOutput>> {
      return mcpError('APPROVAL_REQUIRED', 'never called from a read-only fetcher');
    },
    async createCustomer(): Promise<McpResult<import('./../../integrations/quickbooks-mcp/actions').CreateCustomerOutput>> {
      return mcpError('APPROVAL_REQUIRED', 'never called from a read-only fetcher');
    },
  };
}

describe('QuickBooksInvoiceFetcher — happy path', () => {
  it('produces real drafts from real QuickBooks invoices (no stubbed JSON survives)', async () => {
    const mcp = buildMockMcp({
      invoices: [
        {
          id: 'qb-inv-101',
          docNumber: '1101',
          customerId: 'qb-cust-1',
          customerName: 'Acme Title Co',
          totalAmount: 4500.0,
          balance: 4500.0,
          txnDate: '2026-04-15',
          dueDate: '2026-04-30',
        },
        {
          id: 'qb-inv-102',
          docNumber: '1102',
          customerId: 'qb-cust-2',
          customerName: 'Brookside Closings',
          totalAmount: 1200.0,
          balance: 0,
          txnDate: '2026-05-01',
          dueDate: '2026-05-31',
        },
      ],
      customers: [
        {
          id: 'qb-cust-1',
          displayName: 'Acme Title Co',
          email: 'ar@acme-title.com',
          balance: 4500.0,
          active: true,
        },
        {
          id: 'qb-cust-2',
          displayName: 'Brookside Closings',
          email: 'billing@brookside-closings.com',
          balance: 0,
          active: true,
        },
      ],
    });
    const fetcher = new QuickBooksInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      mcp,
    });
    assert.equal(fetcher.name, 'quickbooks');
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.processed, 2);
    // qb-inv-101 (open, 20 days past due) → firm
    // qb-inv-102 (balance=0) → paid (skipped)
    assert.equal(res.value.followUps.length, 1);
    assert.equal(res.value.bucketCounts.firm, 1);
    const followUp = res.value.followUps[0];
    assert.equal(followUp.invoiceId, 'qb-inv-101');
    assert.equal(followUp.invoiceNumber, '1101');
    assert.equal(followUp.recipient.email, 'ar@acme-title.com');
    assert.equal(followUp.recipient.name, 'Acme Title Co');
    // Honesty seam — closingReference defaults to '' in QB (no native
    // field). The body should fall back to the operator merge field.
    assert.match(
      followUp.draft.body,
      /\{\{operator: closing reference\}\}/,
      'closing reference falls back to operator merge field when QuickBooks has no native value',
    );
    // Subject names the real invoice doc number — proves the QB row
    // flowed through verbatim, not a stub.
    assert.match(followUp.draft.subject, /1101/);
    const skipKinds = new Set(res.value.skipped.map((s) => s.kind));
    assert.ok(skipKinds.has('paid'));
  });
});

describe('QuickBooksInvoiceFetcher — degraded mode', () => {
  it('returns a calm NOT_CONFIGURED notice when QuickBooks is not yet connected', async () => {
    const mcp = buildMockMcp({
      invoices: [],
      customers: [],
      failWith: {
        code: 'CREDENTIAL_NOT_FOUND',
        message: 'QuickBooks credential missing for workspace',
      },
    });
    const fetcher = new QuickBooksInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      mcp,
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.equal(res.error.message.includes(QUICKBOOKS_NOT_CONNECTED_MESSAGE), true);
  });

  it('returns NOT_CONFIGURED when QuickBooks token has expired (TOKEN_EXPIRED)', async () => {
    const mcp = buildMockMcp({
      invoices: [],
      customers: [],
      failWith: { code: 'TOKEN_EXPIRED', message: 'oauth token expired' },
    });
    const fetcher = new QuickBooksInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      mcp,
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
  });
});

describe('QuickBooksInvoiceFetcher — workspace isolation', () => {
  it('refuses to fetch when asked for a different workspace', async () => {
    const fetcher = new QuickBooksInvoiceFetcher({
      workspaceId: WORKSPACE_ID,
      mcp: buildMockMcp({ invoices: [], customers: [] }),
    });
    const res = await fetcher.fetchOpenInvoices({ workspaceId: 'ws-other' });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
  });
});
