/**
 * lib/integrations/notion-mcp/write-actions.test.ts
 *
 * Smoke test for the Notion write-action depth + approval gate. Builds the
 * server through the real factory (`buildNotionMcpServer`) with an injected
 * in-memory gate + audit sink — exactly how production wires it, minus the DB —
 * so it proves the factory seam gates every mutation (the new add_comment AND
 * the pre-existing createPage / updatePage writes), that an approved grant lets
 * the (mocked, recording) SDK call run, and that every fire is audit-logged.
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
import { buildNotionMcpServer } from './index';
import { ADD_COMMENT, notionAction, type AddCommentInput } from './actions';

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildNotionMcpServer({ workspaceId: 'ws-1', deps: { gate, audit } });
  return { gate, audit, server };
}

test('add_comment is blocked without an approval — Notion never called', async () => {
  const { server, audit } = setup();
  const res = await server.addComment({ pageId: 'pg-1', body: 'Looks good to me.' });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('add_comment runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: AddCommentInput = { pageId: 'pg-1', body: 'Looks good to me.', pendingApprovalId: 'ap-1' };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: notionAction(ADD_COMMENT, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.addComment(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.commentId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'notion');
  assert.equal(audit.entries[0].action, 'add_comment');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('a grant approved for one comment payload cannot post a different one', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: notionAction(ADD_COMMENT, { pageId: 'pg-1', body: 'Approved text' }),
  });
  // Same token, different body → fingerprint mismatch → blocked.
  const res = await server.addComment({ pageId: 'pg-1', body: 'Totally different', pendingApprovalId: 'ap-1' });
  assert.equal(res.ok, false);
});

test('pre-existing writes (createPage, updatePage) are now gated too', async () => {
  const { server, audit } = setup();
  const create = await server.createPage({
    parentType: 'page_id',
    parentId: 'pg-1',
    title: 'New runbook',
  });
  const update = await server.updatePage({ pageId: 'pg-1', appendBody: 'Addendum' });
  assert.equal(create.ok, false);
  assert.equal(create.ok === false && create.error.code, 'APPROVAL_REQUIRED');
  assert.equal(update.ok, false);
  assert.equal(update.ok === false && update.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('createPage runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  // The recording server requires the parent to exist; the gate runs first,
  // so the create reaching the recording server is what we assert. Use a
  // database parent path that the recording server validates against its seed —
  // here the recording server (no seed via factory) will NOT have the parent,
  // so we instead assert the gate let the call THROUGH (audit recorded) even
  // when the underlying SDK returns a domain error.
  const input = {
    parentType: 'page_id' as const,
    parentId: 'pg-1',
    title: 'New runbook',
    pendingApprovalId: 'ap-create',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-create',
    workspaceId: 'ws-1',
    action: {
      connector: 'notion',
      action: 'create_page',
      pendingApprovalId: 'ap-create',
      discipline: 'operations',
      detail: {
        parentType: input.parentType,
        parentId: input.parentId,
        title: input.title,
        body: null,
      },
    },
  });
  const res = await server.createPage(input);
  // Gate passed → execute ran → audit recorded (outcome reflects the SDK result).
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'notion');
  assert.equal(audit.entries[0].action, 'create_page');
  // The recording server (built by the factory with no seed) has no 'pg-1'
  // parent → NOT_FOUND. The point is the gate let it through and audited it.
  assert.equal(res.ok, false);
  assert.equal(audit.entries[0].outcome, 'error');
});

test('reads pass through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listPages({ limit: 5 });
  assert.equal(res.ok, true);
});
