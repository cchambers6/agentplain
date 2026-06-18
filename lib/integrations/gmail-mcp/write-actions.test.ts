/**
 * lib/integrations/gmail-mcp/write-actions.test.ts
 *
 * Smoke test for the Gmail write-action depth + approval gate. Builds the
 * server through the real factory (`buildGmailMcpServer`) with an injected
 * in-memory gate + audit sink — exactly how production wires it, minus the DB —
 * so it proves the factory seam gates every mutation, that an approved grant
 * lets the (canned, recording) call run, and that every fire is audit-logged.
 * No external Gmail API is touched.
 *
 * Mirrors `lib/integrations/hubspot-mcp/write-actions.test.ts`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Build the in-memory recording server (canned success) rather than the prod
// REST server — the gate seam is identical, and no external API is hit.
process.env.INTEGRATIONS_PROVIDER = 'test';

import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from '@/lib/integrations/approval';
import { buildGmailMcpServer } from './index';
import {
  COMPOSE_FROM_TEMPLATE,
  SCHEDULE_SEND,
  gmailAction,
  type ComposeFromTemplateInput,
  type ScheduleSendInput,
} from './actions';

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildGmailMcpServer({ workspaceId: 'ws-1', deps: { gate, audit } });
  return { gate, audit, server };
}

test('compose_from_template is blocked without an approval — Gmail never called', async () => {
  const { server, audit } = setup();
  const res = await server.composeFromTemplate({
    to: ['dana@example.com'],
    templateId: 'welcome',
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('compose_from_template runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: ComposeFromTemplateInput = {
    to: ['dana@example.com'],
    templateId: 'welcome',
    variables: { subject: 'Hi', body: 'Welcome {{name}}' },
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: gmailAction(COMPOSE_FROM_TEMPLATE, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.composeFromTemplate(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.messageId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'gmail');
  assert.equal(audit.entries[0].action, 'compose_from_template');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('a grant approved for one payload cannot send a different one', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: gmailAction(COMPOSE_FROM_TEMPLATE, {
      to: ['dana@example.com'],
      templateId: 'welcome',
    }),
  });
  // Same token, different recipient → fingerprint mismatch → blocked.
  const res = await server.composeFromTemplate({
    to: ['someone-else@example.com'],
    templateId: 'welcome',
    pendingApprovalId: 'ap-1',
  });
  assert.equal(res.ok, false);
});

test('schedule_send is gated (outbound), runs once approved', async () => {
  const { server, gate, audit } = setup();
  const input: ScheduleSendInput = {
    to: ['dana@example.com'],
    subject: 'Quarterly check-in',
    body: 'Hi Dana, scheduling our review.',
    sendAt: '2026-07-01T15:00:00.000Z',
    pendingApprovalId: 'ap-2',
  };
  const blocked = await server.scheduleSend({ ...input, pendingApprovalId: undefined });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok === false && blocked.error.code, 'APPROVAL_REQUIRED');

  gate.seedApproved({
    pendingApprovalId: 'ap-2',
    workspaceId: 'ws-1',
    action: gmailAction(SCHEDULE_SEND, input),
  });
  const ok = await server.scheduleSend(input);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok === true && typeof ok.value.scheduledId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].action, 'schedule_send');
});

test('internal writes (draftMessage, archive) are UNGATED — reach no third party', async () => {
  // Per the wave-2 model, a draft (nothing sent) and archive (removes the
  // INBOX label) are internal mailbox state, not outreach — so they run
  // without an approval and write no approval audit row.
  const { server, audit } = setup();
  const draft = await server.draftMessage({
    to: ['dana@example.com'],
    subject: 'Re: tour',
    body: 'Sounds good.',
  });
  assert.equal(draft.ok, true);
  assert.equal(audit.entries.length, 0);
});

test('reads pass through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listMessages({ query: 'in:inbox' });
  assert.equal(res.ok, true);
  const labels = await server.listLabels();
  assert.equal(labels.ok, true);
});
