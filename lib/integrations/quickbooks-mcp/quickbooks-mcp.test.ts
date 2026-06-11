/**
 * lib/integrations/quickbooks-mcp/quickbooks-mcp.test.ts
 *
 * Smoke test for the QuickBooks MCP server via the in-process MCP client +
 * fixture server. Exercises the exact dispatcher the HTTP route runs. Pure,
 * no network, no DB. Covers the approval gate on record_payment.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InProcessMcpClient, McpClientError } from '@/lib/integrations/mcp-core';
import { TestQuickbooksMcpServer } from './test-server';
import { QUICKBOOKS_NAMESPACE, type QuickbooksMcpServer } from './types';
import { QUICKBOOKS_TOOLS } from './tools';

function client() {
  const server: QuickbooksMcpServer = new TestQuickbooksMcpServer({ workspaceId: 'ws-1' });
  return new InProcessMcpClient({ server, tools: QUICKBOOKS_TOOLS, namespace: QUICKBOOKS_NAMESPACE });
}

describe('quickbooks-mcp dispatch', () => {
  it('tools/list exposes the nine QuickBooks tools', async () => {
    const tools = await client().listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'quickbooks.create_invoice',
      'quickbooks.get_estimate',
      'quickbooks.get_invoice',
      'quickbooks.get_profit_and_loss',
      'quickbooks.list_customers',
      'quickbooks.list_estimates',
      'quickbooks.list_expenses',
      'quickbooks.list_invoices',
      'quickbooks.record_payment',
    ]);
  });

  it('list_invoices returns fixtures and filters by customerId', async () => {
    const all = (await client().call('list_invoices', {})) as { invoices: unknown[] };
    assert.equal(all.invoices.length, 2);
    const filtered = (await client().call('list_invoices', { customerId: '1' })) as {
      invoices: { customerId: string }[];
    };
    assert.equal(filtered.invoices.length, 1);
    assert.equal(filtered.invoices[0].customerId, '1');
  });

  it('get_invoice returns a known invoice and 404s an unknown one', async () => {
    const res = (await client().call('get_invoice', { invoiceId: '101' })) as {
      invoice: { id: string };
    };
    assert.equal(res.invoice.id, '101');
    await assert.rejects(() => client().call('get_invoice', { invoiceId: 'nope' }), /No invoice nope/);
  });

  it('create_invoice drafts an invoice (no approval needed) and totals the lines', async () => {
    const res = (await client().call('create_invoice', {
      customerId: '1',
      lines: [{ amount: 300, description: 'Inspection' }, { amount: 200 }],
    })) as { invoice: { totalAmount: number; customerId: string } };
    assert.equal(res.invoice.totalAmount, 500);
    assert.equal(res.invoice.customerId, '1');
  });

  it('list_customers returns fixtures', async () => {
    const res = (await client().call('list_customers', {})) as { customers: unknown[] };
    assert.equal(res.customers.length, 2);
  });

  it('record_payment is GATED — refuses without an approvalToken (APPROVAL_REQUIRED)', async () => {
    await assert.rejects(
      () => client().call('record_payment', { customerId: '1', amount: 100 }),
      (err: unknown) => {
        assert.ok(err instanceof McpClientError);
        assert.equal(err.mcpErrorCode, 'APPROVAL_REQUIRED');
        return true;
      },
    );
    // empty-string token must also be rejected
    await assert.rejects(
      () => client().call('record_payment', { customerId: '1', amount: 100, approvalToken: '   ' }),
      (err: unknown) => err instanceof McpClientError && err.mcpErrorCode === 'APPROVAL_REQUIRED',
    );
  });

  it('record_payment succeeds with a non-empty approvalToken', async () => {
    const res = (await client().call('record_payment', {
      customerId: '1',
      amount: 100,
      approvalToken: 'approval-abc',
    })) as { paymentId: string; totalAmount: number };
    assert.equal(res.paymentId, 'pay-555');
    assert.equal(res.totalAmount, 100);
  });

  it('get_profit_and_loss returns flattened rows with a currency', async () => {
    const res = (await client().call('get_profit_and_loss', {})) as {
      currency: string;
      rows: { label: string; amount: number }[];
    };
    assert.equal(res.currency, 'USD');
    assert.ok(res.rows.length >= 1);
  });

  it('list_expenses returns fixtures', async () => {
    const res = (await client().call('list_expenses', {})) as { expenses: unknown[] };
    assert.equal(res.expenses.length, 1);
  });

  it('list_estimates returns all fixture estimates when no filter', async () => {
    const res = (await client().call('list_estimates', {})) as {
      estimates: { id: string; txnStatus: string }[];
    };
    assert.equal(res.estimates.length, 3);
  });

  it('list_estimates filters to Pending estimates only', async () => {
    const res = (await client().call('list_estimates', { status: 'Pending' })) as {
      estimates: { id: string; txnStatus: string; totalAmount: number }[];
    };
    assert.equal(res.estimates.length, 2, 'two Pending estimates in fixtures');
    for (const e of res.estimates) {
      assert.equal(e.txnStatus, 'Pending');
    }
    // Confirm the dollar amounts — these are the open quotes with revenue at stake.
    const amounts = res.estimates.map((e) => e.totalAmount).sort((a, b) => a - b);
    assert.deepEqual(amounts, [3800, 6200]);
  });

  it('list_estimates filters by customerId', async () => {
    const res = (await client().call('list_estimates', { customerId: '1' })) as {
      estimates: { customerId: string }[];
    };
    assert.equal(res.estimates.length, 1);
    assert.equal(res.estimates[0].customerId, '1');
  });

  it('get_estimate returns a known estimate', async () => {
    const res = (await client().call('get_estimate', { estimateId: 'EST-401' })) as {
      estimate: { id: string; totalAmount: number; txnStatus: string };
    };
    assert.equal(res.estimate.id, 'EST-401');
    assert.equal(res.estimate.totalAmount, 6200);
    assert.equal(res.estimate.txnStatus, 'Pending');
  });

  it('get_estimate 404s on unknown id', async () => {
    await assert.rejects(
      () => client().call('get_estimate', { estimateId: 'EST-NOPE' }),
      /No estimate EST-NOPE/,
    );
  });
});
