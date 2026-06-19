/**
 * lib/integrations/sierra-mcp/write-actions.test.ts
 *
 * Smoke test for the Sierra write-action depth + approval gate. Builds the
 * server through the real factory (`buildSierraMcpServer`) with an injected
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
import { buildSierraMcpServer } from './index';
import { CREATE_CONTACT, sierraAction, type CreateContactInput } from './actions';

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildSierraMcpServer({ workspaceId: 'ws-1', deps: { gate, audit } });
  return { gate, audit, server };
}

test('create_contact is blocked without an approval — Sierra never called', async () => {
  const { server, audit } = setup();
  const res = await server.createContact({ firstName: 'Dana', lastName: 'Lee' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('create_contact runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: CreateContactInput = {
    firstName: 'Dana',
    lastName: 'Lee',
    email: 'dana@example.com',
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: sierraAction(CREATE_CONTACT, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.createContact(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.contactId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'sierra');
  assert.equal(audit.entries[0].action, 'create_contact');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('a grant approved for one payload cannot create a different one', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: sierraAction(CREATE_CONTACT, { firstName: 'Dana', lastName: 'Lee' }),
  });
  // Same token, different name → fingerprint mismatch → blocked.
  const res = await server.createContact({
    firstName: 'Evan',
    lastName: 'Cho',
    pendingApprovalId: 'ap-1',
  });
  assert.equal(res.ok, false);
});

test('outbound action (send_drip) is gated', async () => {
  const { server, audit } = setup();
  const res = await server.sendDrip({ contactId: 'c-1', campaignId: 'camp-1' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('update_status is gated', async () => {
  const { server } = setup();
  const res = await server.updateStatus({ leadId: 'l-1', status: 'Hot' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
});

test('reads pass through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listLeads({ limit: 5 });
  assert.equal(res.ok, true);
});

test('pre-existing writes (createNote, addTag) are now gated too', async () => {
  const { server } = setup();
  const note = await server.createNote({ leadId: 'l-1', body: 'triaged: warm' });
  assert.equal(note.ok, false);
  assert.equal(note.ok === false && note.error.code, 'APPROVAL_REQUIRED');

  const tag = await server.addTag({ leadId: 'l-1', tags: ['warm'] });
  assert.equal(tag.ok, false);
  assert.equal(tag.ok === false && tag.error.code, 'APPROVAL_REQUIRED');
});
