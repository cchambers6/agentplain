/**
 * lib/integrations/salesforce-mcp/write-actions.test.ts
 *
 * Smoke test for the Salesforce write-action depth + approval gate. Builds the
 * server through the real factory (`buildSalesforceMcpServer`) with an injected
 * in-memory gate + audit sink — exactly how production wires it, minus the DB —
 * so it proves the factory seam gates every mutation, that an approved grant
 * lets the (mocked, recording) SDK call run, and that every fire is audit-
 * logged. No external API is touched.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Build the in-memory recording server (canned SDK success) rather than the
// prod REST server — the gate seam is identical, and no external API is hit.
process.env.INTEGRATIONS_PROVIDER = 'test';

import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from '@/lib/integrations/approval';
import { buildSalesforceMcpServer } from './index';
import { CREATE_OPPORTUNITY, salesforceAction, type CreateOpportunityInput } from './actions';

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildSalesforceMcpServer({ workspaceId: 'ws-1', deps: { gate, audit } });
  return { gate, audit, server };
}

test('create_opportunity is blocked without an approval — Salesforce never called', async () => {
  const { server, audit } = setup();
  const res = await server.createOpportunity({
    name: 'Acme expansion',
    stageName: 'Prospecting',
    closeDate: '2026-12-31',
    amount: 40000,
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('create_opportunity runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: CreateOpportunityInput = {
    name: 'Acme expansion',
    stageName: 'Prospecting',
    closeDate: '2026-12-31',
    amount: 40000,
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: salesforceAction(CREATE_OPPORTUNITY, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.createOpportunity(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.opportunityId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'salesforce');
  assert.equal(audit.entries[0].action, 'create_opportunity');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('a grant approved for one payload cannot run a different one', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: salesforceAction(CREATE_OPPORTUNITY, {
      name: 'Acme',
      stageName: 'Prospecting',
      closeDate: '2026-12-31',
      amount: 40000,
    }),
  });
  // Same token, different amount → fingerprint mismatch → blocked.
  const res = await server.createOpportunity({
    name: 'Acme',
    stageName: 'Prospecting',
    closeDate: '2026-12-31',
    amount: 999999,
    pendingApprovalId: 'ap-1',
  });
  assert.equal(res.ok, false);
});

test('outbound action (send_email_template) is gated', async () => {
  const { server, audit } = setup();
  const email = await server.sendEmailTemplate({
    recipientEmail: 'dana@example.com',
    templateId: '00X000000000001',
  });
  assert.equal(email.ok, false);
  assert.equal(email.ok === false && email.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('update_record and log_call are gated', async () => {
  const { server, audit } = setup();
  const upd = await server.updateRecord({
    sobjectType: 'Lead',
    recordId: '00Q000000000001',
    fields: { Status: 'Working - Contacted' },
  });
  const call = await server.logCall({ subject: 'Discovery call' });
  assert.equal(upd.ok, false);
  assert.equal(call.ok, false);
  assert.equal(audit.entries.length, 0);
});

test('reads pass through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listLeads({ limit: 5 });
  assert.equal(res.ok, true);
});

test('pre-existing write (createTask) is now gated too', async () => {
  const { server } = setup();
  const res = await server.createTask({ subject: 'Follow up' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
});
