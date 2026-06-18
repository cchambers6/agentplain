/**
 * lib/integrations/buildium-mcp/write-actions.test.ts
 *
 * Smoke test for the Buildium write-action depth + approval gate. Builds the
 * server through the real factory (`buildBuildiumMcpServer`) with an injected
 * in-memory gate + audit sink — exactly how production wires it, minus the DB —
 * so it proves the factory seam gates every mutation, that an approved grant
 * lets the (fixture, recording) call run, and that every fire is audit-logged.
 * No external API is touched.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Build the in-memory fixture server (canned success) rather than the prod REST
// server — the gate seam is identical, and no external API is hit.
process.env.INTEGRATIONS_PROVIDER = 'test';

import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from '@/lib/integrations/approval';
import { buildBuildiumMcpServer } from './index';
import { CREATE_WORK_ORDER, buildiumAction, type CreateWorkOrderInput } from './actions';

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildBuildiumMcpServer({ workspaceId: 'ws-1', deps: { gate, audit } });
  return { gate, audit, server };
}

test('create_work_order is blocked without an approval — Buildium never called', async () => {
  const { server, audit } = setup();
  const res = await server.createWorkOrder({
    propertyId: 'p-1',
    title: 'Leaking faucet',
    description: 'Unit 4B kitchen faucet drips',
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('create_work_order runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: CreateWorkOrderInput = {
    propertyId: 'p-1',
    title: 'Leaking faucet',
    description: 'Unit 4B kitchen faucet drips',
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: buildiumAction(CREATE_WORK_ORDER, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.createWorkOrder(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.workOrderId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'buildium');
  assert.equal(audit.entries[0].action, 'create_work_order');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('a grant approved for one payload cannot fire a different one', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: buildiumAction(CREATE_WORK_ORDER, {
      propertyId: 'p-1',
      title: 'Leaking faucet',
      description: 'drips',
    }),
  });
  // Same token, different description → fingerprint mismatch → blocked.
  const res = await server.createWorkOrder({
    propertyId: 'p-1',
    title: 'Leaking faucet',
    description: 'TOTALLY DIFFERENT WORK',
    pendingApprovalId: 'ap-1',
  });
  assert.equal(res.ok, false);
});

test('outbound actions (charge_late_fee, send_tenant_msg) are gated', async () => {
  const { server, audit } = setup();
  const charge = await server.chargeLateFee({ leaseId: 'l-1', amount: 75, memo: 'June late fee' });
  const msg = await server.sendTenantMsg({
    tenantId: 't-1',
    subject: 'Rent reminder',
    body: 'Your balance is past due.',
  });
  assert.equal(charge.ok, false);
  assert.equal(charge.ok === false && charge.error.code, 'APPROVAL_REQUIRED');
  assert.equal(msg.ok, false);
  assert.equal(msg.ok === false && msg.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('post_notice is gated', async () => {
  const { server, audit } = setup();
  const res = await server.postNotice({ leaseId: 'l-1', subject: 'Notice', body: 'Pay rent.' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('reads pass through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listDelinquentLeases({ limit: 2 });
  assert.equal(res.ok, true);
});
