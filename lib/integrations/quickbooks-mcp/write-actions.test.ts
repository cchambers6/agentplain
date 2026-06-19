/**
 * lib/integrations/quickbooks-mcp/write-actions.test.ts
 *
 * Smoke test for the QuickBooks write-action depth + approval gate. Builds the
 * server through the real factory (`buildQuickbooksMcpServer`) with an injected
 * in-memory gate + audit sink — exactly how production wires it, minus the DB —
 * so it proves the factory seam gates every mutation, that an approved grant
 * lets the (fixture) SDK call run, and that every fire is audit-logged. No
 * external API is touched.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Build the in-memory fixture server (canned SDK success) rather than the prod
// REST server — the gate seam is identical, and no external API is hit.
process.env.INTEGRATIONS_PROVIDER = 'test';

import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from '@/lib/integrations/approval';
import { buildQuickbooksMcpServer } from './index';
import {
  CREATE_CUSTOMER,
  SEND_INVOICE,
  quickbooksAction,
  type CreateCustomerInput,
  type SendInvoiceInput,
} from './actions';

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildQuickbooksMcpServer({ workspaceId: 'ws-1', deps: { gate, audit } });
  return { gate, audit, server };
}

test('send_invoice is blocked without an approval — QuickBooks never called', async () => {
  const { server, audit } = setup();
  const res = await server.sendInvoice({ invoiceId: '101' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('send_invoice (OUTBOUND) runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: SendInvoiceInput = {
    invoiceId: '101',
    recipientEmail: 'ar@example.com',
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: quickbooksAction(SEND_INVOICE, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.sendInvoice(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && res.value.status, 'sent');
  assert.equal(res.ok === true && res.value.invoiceId, '101');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'quickbooks');
  assert.equal(audit.entries[0].action, 'send_invoice');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('create_customer is gated and runs once approved', async () => {
  const { server, gate, audit } = setup();
  const input: CreateCustomerInput = {
    displayName: 'New Homeowner LLC',
    email: 'new@homeowner.example',
    pendingApprovalId: 'ap-2',
  };
  const blocked = await server.createCustomer({ displayName: 'New Homeowner LLC' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok === false && blocked.error.code, 'APPROVAL_REQUIRED');

  gate.seedApproved({
    pendingApprovalId: 'ap-2',
    workspaceId: 'ws-1',
    action: quickbooksAction(CREATE_CUSTOMER, input),
  });
  const res = await server.createCustomer(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.customerId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].action, 'create_customer');
});

test('a grant approved for one payload cannot send a different one', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: quickbooksAction(SEND_INVOICE, { invoiceId: '101' }),
  });
  // Same token, different invoice → fingerprint mismatch → blocked.
  const res = await server.sendInvoice({ invoiceId: '999', pendingApprovalId: 'ap-1' });
  assert.equal(res.ok, false);
});

test('pre-existing mutation create_invoice is now gated at the shared seam', async () => {
  const { server, audit } = setup();
  const res = await server.createInvoice({
    customerId: '1',
    lines: [{ amount: 300, description: 'Inspection' }],
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('create_invoice runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const lines = [{ amount: 300, description: 'Inspection' }];
  const detail = { customerId: '1', lines, itemId: null };
  gate.seedApproved({
    pendingApprovalId: 'ap-inv',
    workspaceId: 'ws-1',
    action: {
      connector: 'quickbooks',
      action: 'create_invoice',
      pendingApprovalId: 'ap-inv',
      discipline: 'finance',
      detail,
    },
  });
  const res = await server.createInvoice({ customerId: '1', lines, pendingApprovalId: 'ap-inv' });
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && res.value.invoice.totalAmount, 300);
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].action, 'create_invoice');
});

test('pre-existing mutation record_payment is gated at the shared seam', async () => {
  const { server, audit } = setup();
  // Even with a valid inner approvalToken, the shared gate blocks without a grant.
  const res = await server.recordPayment({
    customerId: '1',
    amount: 100,
    approvalToken: 'inner-ok',
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('record_payment runs once approved at both gates', async () => {
  const { server, gate, audit } = setup();
  const detail = { customerId: '1', amount: 100 };
  gate.seedApproved({
    pendingApprovalId: 'ap-pay',
    workspaceId: 'ws-1',
    action: {
      connector: 'quickbooks',
      action: 'record_payment',
      pendingApprovalId: 'ap-pay',
      discipline: 'finance',
      detail,
    },
    approvedByUserId: 'user-3',
  });
  const res = await server.recordPayment({
    customerId: '1',
    amount: 100,
    approvalToken: 'inner-ok',
    pendingApprovalId: 'ap-pay',
  });
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && res.value.paymentId, 'pay-555');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].action, 'record_payment');
  assert.equal(audit.entries[0].approvedByUserId, 'user-3');
});

test('reads pass through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listInvoices({});
  assert.equal(res.ok, true);
});
