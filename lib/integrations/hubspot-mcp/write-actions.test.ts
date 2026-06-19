/**
 * lib/integrations/hubspot-mcp/write-actions.test.ts
 *
 * Smoke test for the HubSpot write-action depth + approval gate. Builds the
 * server through the real factory (`buildHubspotMcpServer`) with an injected
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
import { buildHubspotMcpServer } from './index';
import { CREATE_DEAL, hubspotAction, type CreateDealInput } from './actions';

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildHubspotMcpServer({ workspaceId: 'ws-1', deps: { gate, audit } });
  return { gate, audit, server };
}

test('create_deal is blocked without an approval — HubSpot never called', async () => {
  const { server, audit } = setup();
  const res = await server.createDeal({ dealName: 'Acme expansion', amount: '40000' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('create_deal runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: CreateDealInput = { dealName: 'Acme expansion', amount: '40000', pendingApprovalId: 'ap-1' };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: hubspotAction(CREATE_DEAL, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.createDeal(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.dealId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'hubspot');
  assert.equal(audit.entries[0].action, 'create_deal');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('a grant approved for one payload cannot send a different one', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: hubspotAction(CREATE_DEAL, { dealName: 'Acme', amount: '40000' }),
  });
  // Same token, different amount → fingerprint mismatch → blocked.
  const res = await server.createDeal({ dealName: 'Acme', amount: '999999', pendingApprovalId: 'ap-1' });
  assert.equal(res.ok, false);
});

test('outbound actions (send_email_template, send_sequence_enrollment) are gated', async () => {
  const { server, audit } = setup();
  const email = await server.sendEmailTemplate({
    contactId: 'c-1',
    recipientEmail: 'dana@example.com',
    emailId: '1234',
  });
  const seq = await server.sendSequenceEnrollment({
    contactId: 'c-1',
    sequenceId: 'seq-1',
    senderEmail: 'agent@firm.com',
  });
  assert.equal(email.ok, false);
  assert.equal(seq.ok, false);
  assert.equal(audit.entries.length, 0);
});

test('reads pass through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listContacts({ limit: 5 });
  assert.equal(res.ok, true);
});

test('pre-existing writes (createNote) are now gated too', async () => {
  const { server } = setup();
  const res = await server.createNote({ objectType: 'contacts', objectId: 'c-1', body: 'hi' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
});
