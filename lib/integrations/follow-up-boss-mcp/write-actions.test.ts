/**
 * lib/integrations/follow-up-boss-mcp/write-actions.test.ts
 *
 * Smoke test for the Follow Up Boss write-action depth + approval gate. Builds
 * the server through the real factory (`buildFollowUpBossMcpServer`) with an
 * injected in-memory gate + audit sink — exactly how production wires it, minus
 * the DB — so it proves the factory seam gates every mutation, that an approved
 * grant lets the (recording) SDK call run, and that every fire is audit-logged.
 * No external API is touched.
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
import { buildFollowUpBossMcpServer } from './index';
import {
  CREATE_LEAD,
  SEND_TEXT_TEMPLATE,
  fubAction,
  type CreateLeadInput,
} from './actions';
import type { FubLeadSummary } from './types';

const SEED_LEAD: FubLeadSummary = {
  id: 'p-1',
  firstName: 'Sam',
  lastName: 'Lee',
  emails: ['sam@example.com'],
  phones: ['555-0100'],
  source: 'Zillow',
  stage: 'New',
  tags: ['hot'],
  lastActivityAt: null,
  createdAt: null,
};

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  // The factory forwards its whole args object to the recording constructor,
  // which reads `seed` — so we pass it through (extra prop, hence the cast).
  const args = {
    workspaceId: 'ws-1',
    deps: { gate, audit },
    seed: { leads: [SEED_LEAD] },
  };
  const server = buildFollowUpBossMcpServer(
    args as Parameters<typeof buildFollowUpBossMcpServer>[0],
  );
  return { gate, audit, server };
}

test('create_lead is blocked without an approval — FUB never called', async () => {
  const { server, audit } = setup();
  const res = await server.createLead({ name: 'Dana Buyer', email: 'dana@example.com' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('create_lead runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: CreateLeadInput = {
    name: 'Dana Buyer',
    email: 'dana@example.com',
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: fubAction(CREATE_LEAD, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.createLead(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.leadId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'follow_up_boss');
  assert.equal(audit.entries[0].action, 'create_lead');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('a grant approved for one payload cannot create a different lead', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: fubAction(CREATE_LEAD, { name: 'Dana Buyer' }),
  });
  // Same token, different name → fingerprint mismatch → blocked.
  const res = await server.createLead({ name: 'Someone Else', pendingApprovalId: 'ap-1' });
  assert.equal(res.ok, false);
});

test('outbound send_text_template + schedule_action_plan are gated', async () => {
  const { server, audit } = setup();
  const text = await server.sendTextTemplate({
    personId: 'p-1',
    templateId: 't-1',
    message: 'Hi Sam',
  });
  const plan = await server.scheduleActionPlan({
    personId: 'p-1',
    actionPlanId: 'plan-1',
  });
  assert.equal(text.ok, false);
  assert.equal(text.ok === false && text.error.code, 'APPROVAL_REQUIRED');
  assert.equal(plan.ok, false);
  assert.equal(plan.ok === false && plan.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('send_text_template runs once approved', async () => {
  const { server, gate, audit } = setup();
  const input = {
    personId: 'p-1',
    templateId: 't-1',
    message: 'Hi Sam',
    pendingApprovalId: 'ap-text',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-text',
    workspaceId: 'ws-1',
    action: fubAction(SEND_TEXT_TEMPLATE, input),
  });
  const res = await server.sendTextTemplate(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.messageId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].action, 'send_text_template');
});

test('reads pass through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listLeads({ limit: 5 });
  assert.equal(res.ok, true);
});

test('pre-existing writes (createNote, addTag) are now gated too', async () => {
  const { server, audit } = setup();
  const note = await server.createNote({ leadId: 'p-1', body: 'triaged: hot' });
  const tag = await server.addTag({ leadId: 'p-1', tags: ['nurture'] });
  assert.equal(note.ok, false);
  assert.equal(note.ok === false && note.error.code, 'APPROVAL_REQUIRED');
  assert.equal(tag.ok, false);
  assert.equal(tag.ok === false && tag.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});
