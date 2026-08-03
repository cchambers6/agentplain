/**
 * lib/integrations/hubspot-mcp/skill/skill.validation.test.ts
 *
 * The VALIDATION proof for the HubSpot skill — the (c) and (d) halves of the
 * Chiron-style discipline. A typecheck proves the code compiles; this proves
 * behavior: known input produces known output, invalid input never reaches
 * HubSpot, the approval gate still blocks outbound through the new surface, a
 * malformed vendor response is refused rather than returned, and the grant
 * replay semantic is whatever `approval-gate-memory.ts` actually implements.
 *
 * Wiring mirrors `../write-actions.test.ts`: in-memory gate + audit sink, the
 * recording server behind the real approval decorator. No external API is
 * touched.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.INTEGRATIONS_PROVIDER = 'test';

import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from '@/lib/integrations/approval';
import { mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { RecordingHubspotMcpServer } from '../test-server';
import { withHubspotApproval } from '../with-approval';
import { CREATE_DEAL, hubspotAction, type CreateDealInput } from '../actions';
import type { HubspotContactSummary, HubspotDealSummary, HubspotMcpServer } from '../types';
import { runHubspotSkill } from './skill';

// ── Fixtures ────────────────────────────────────────────────────────────────

const CONTACT_A: HubspotContactSummary = {
  id: 'c-1',
  firstName: 'Dana',
  lastName: 'Reeves',
  email: 'dana@example.com',
  phone: '+14045551212',
  company: 'Reeves Realty',
  lifecycleStage: 'lead',
  leadSource: 'Zillow',
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-20T09:30:00.000Z',
};

const CONTACT_B: HubspotContactSummary = {
  id: 'c-2',
  firstName: 'Marcus',
  lastName: null,
  email: 'marcus@example.com',
  phone: null,
  company: null,
  lifecycleStage: 'subscriber',
  leadSource: null,
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: null,
};

const DEAL_A: HubspotDealSummary = {
  id: 'd-1',
  name: 'Peachtree listing',
  amount: 40000,
  pipeline: 'default',
  dealStage: 'qualifiedtobuy',
  closeDate: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: null,
};

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  // The factory takes no seed, so the recording server is constructed directly
  // and wrapped with the SAME decorator the factory installs — the gate seam
  // under test is identical.
  const recording = new RecordingHubspotMcpServer({
    workspaceId: 'ws-1',
    seed: { contacts: [CONTACT_A, CONTACT_B], deals: [DEAL_A] },
  });
  const server = withHubspotApproval(recording, { gate, audit });
  return { gate, audit, recording, server };
}

// ── 1. Known input → known output (read) ────────────────────────────────────

test('list_contacts returns exactly the seeded contacts', async () => {
  const { server, recording } = setup();
  const res = await runHubspotSkill({ action: 'list_contacts', params: { limit: 10 } }, { server });

  assert.deepEqual(res, {
    ok: true,
    value: {
      action: 'list_contacts',
      result: { contacts: [CONTACT_A, CONTACT_B] },
    },
  });
  assert.deepEqual(recording.calls, [{ tool: 'listContacts', input: { limit: 10 } }]);
});

// ── 2. Known input → known output (get) ─────────────────────────────────────

test('get_deal returns exactly the seeded deal', async () => {
  const { server } = setup();
  const res = await runHubspotSkill({ action: 'get_deal', params: { dealId: 'd-1' } }, { server });

  assert.deepEqual(res, {
    ok: true,
    value: { action: 'get_deal', result: { deal: DEAL_A } },
  });
});

// ── 3. Read idempotency ─────────────────────────────────────────────────────

test('repeating a read is idempotent — same output, no mutation recorded', async () => {
  const { server, recording, audit } = setup();
  const input = { action: 'list_contacts', params: { limit: 10 } };

  const first = await runHubspotSkill(input, { server });
  const second = await runHubspotSkill(input, { server });

  assert.deepEqual(first, second);
  assert.equal(recording.calls.length, 2);
  assert.deepEqual(
    recording.calls.map((c) => c.tool),
    ['listContacts', 'listContacts'],
  );
  // Nothing was written, so nothing was audited.
  assert.equal(audit.entries.length, 0);
});

// ── 4. Invalid input never reaches the server ───────────────────────────────

test('an empty contactId is refused before HubSpot is called', async () => {
  const { server, recording } = setup();
  const res = await runHubspotSkill({ action: 'get_contact', params: { contactId: '' } }, { server });

  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'INVALID_INPUT');
  assert.deepEqual(recording.calls, []);
});

test('an out-of-range limit is refused before HubSpot is called', async () => {
  const { server, recording } = setup();
  const res = await runHubspotSkill({ action: 'list_contacts', params: { limit: 500 } }, { server });

  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'INVALID_INPUT');
  assert.deepEqual(recording.calls, []);
});

test('an unknown action is refused structurally', async () => {
  const { server, recording } = setup();
  const res = await runHubspotSkill({ action: 'delete_everything', params: {} }, { server });

  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'INVALID_INPUT');
  assert.deepEqual(recording.calls, []);
});

test('unknown keys are stripped, and rejection messages carry no values', async () => {
  const { server, recording } = setup();
  const res = await runHubspotSkill(
    { action: 'get_contact', params: { contactId: 'c-1', apiKey: 'sk-live-super-secret' } },
    { server },
  );
  // The call is valid, and the un-declared key never reaches HubSpot.
  assert.equal(res.ok, true);
  assert.deepEqual(recording.calls, [{ tool: 'getContact', input: { contactId: 'c-1' } }]);

  const bad = await runHubspotSkill(
    { action: 'log_activity', params: { objectType: 'contacts', objectId: 'c-1', activityType: 'SHOUT', body: 'hunter2' } },
    { server },
  );
  assert.equal(bad.ok, false);
  assert.equal(bad.ok === false && bad.error.code, 'INVALID_INPUT');
  assert.equal(bad.ok === false && bad.error.message.includes('hunter2'), false);
});

// ── 5. The gate is load-bearing through the skill ───────────────────────────

test('send_email_template without a grant is APPROVAL_REQUIRED — nothing sent', async () => {
  const { server, recording, audit } = setup();
  const res = await runHubspotSkill(
    {
      action: 'send_email_template',
      params: { contactId: 'c-1', recipientEmail: 'dana@example.com', emailId: '1234' },
    },
    { server },
  );

  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.deepEqual(recording.calls, []);
  assert.equal(audit.entries.length, 0);
});

// ── 6. Approved write, known output ─────────────────────────────────────────

test('an approved create_deal runs, parses, and records the exact payload', async () => {
  const { server, gate, audit, recording } = setup();
  const params: CreateDealInput = {
    dealName: 'Acme expansion',
    amount: '40000',
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: hubspotAction(CREATE_DEAL, params),
    approvedByUserId: 'user-9',
  });

  const res = await runHubspotSkill({ action: 'create_deal', params }, { server });

  assert.equal(res.ok, true);
  assert.equal(res.ok === true && res.value.action, 'create_deal');
  assert.equal(res.ok === true && typeof res.value.result.dealId, 'string');
  assert.deepEqual(recording.calls, [{ tool: 'createDeal', input: params }]);
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].action, 'create_deal');
  assert.equal(audit.entries[0].outcome, 'ok');
});

// ── 7. Replay semantics, as actually implemented ────────────────────────────

test('replaying an approved create_deal fires AGAIN — grants are reusable, not single-use', async () => {
  const { server, gate, audit, recording } = setup();
  const params: CreateDealInput = {
    dealName: 'Acme expansion',
    amount: '40000',
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: hubspotAction(CREATE_DEAL, params),
    approvedByUserId: 'user-9',
  });

  const first = await runHubspotSkill({ action: 'create_deal', params }, { server });
  const second = await runHubspotSkill({ action: 'create_deal', params }, { server });

  // THE SEMANTIC, read from `approval-gate-memory.ts` (and matched by
  // `approval-gate-prisma.ts`): `check()` validates workspace + action +
  // payload fingerprint + status + expiry, and does NOT consume or mark the
  // grant. So an identical replay carrying the same token passes the gate
  // again and the write fires again — the gate provides at-least-once
  // authorization bound to an exact payload, NOT at-most-once delivery. The
  // in-memory gate never expires a grant unless `expiresAt` was seeded; the
  // Prisma gate additionally expires it CONNECTOR_APPROVAL_TTL_MS (24h) after
  // the operator's decision. De-duplication, if a caller needs it, has to live
  // above this seam.
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(recording.calls.length, 2);
  assert.equal(audit.entries.length, 2);

  // Two distinct deals were created — proof the second call really ran.
  const firstId = first.ok === true && first.value.action === 'create_deal' ? first.value.result.dealId : null;
  const secondId =
    second.ok === true && second.value.action === 'create_deal' ? second.value.result.dealId : null;
  assert.notEqual(firstId, secondId);
});

test('a grant does not authorize a different payload through the skill', async () => {
  const { server, gate, recording } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: hubspotAction(CREATE_DEAL, { dealName: 'Acme expansion', amount: '40000' }),
  });

  const res = await runHubspotSkill(
    {
      action: 'create_deal',
      params: { dealName: 'Acme expansion', amount: '999999', pendingApprovalId: 'ap-1' },
    },
    { server },
  );

  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.deepEqual(recording.calls, []);
});

// ── 8. Output contract violations are caught ────────────────────────────────

/** A server that answers `getContact` with a shape HubSpot would never send. */
function malformedServer(): HubspotMcpServer {
  const unimplemented = (name: string) => async (): Promise<McpResult<never>> => {
    throw new Error(`${name} not used in this test`);
  };
  return {
    name: 'malformed',
    workspaceId: 'ws-1',
    getContact: async () => mcpOk({ contact: { id: 42 } } as never),
    listContacts: unimplemented('listContacts'),
    updateContact: unimplemented('updateContact'),
    listDeals: unimplemented('listDeals'),
    getDeal: unimplemented('getDeal'),
    updateDeal: unimplemented('updateDeal'),
    listCompanies: unimplemented('listCompanies'),
    getCompany: unimplemented('getCompany'),
    createNote: unimplemented('createNote'),
    createDeal: unimplemented('createDeal'),
    updateDealStage: unimplemented('updateDealStage'),
    logActivity: unimplemented('logActivity'),
    createTask: unimplemented('createTask'),
    sendEmailTemplate: unimplemented('sendEmailTemplate'),
    sendSequenceEnrollment: unimplemented('sendSequenceEnrollment'),
  } as HubspotMcpServer;
}

test('a malformed HubSpot response is CONTRACT_VIOLATION, never returned', async () => {
  const res = await runHubspotSkill(
    { action: 'get_contact', params: { contactId: 'c-1' } },
    { server: malformedServer() },
  );

  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'CONTRACT_VIOLATION');
  // The unparsed value is not smuggled out on the error.
  assert.equal(JSON.stringify(res).includes('42'), false);
});
