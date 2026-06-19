/**
 * lib/integrations/approval/with-approval.test.ts
 *
 * Smoke test for the connector-agnostic approval gate core — the seam EVERY
 * connector's write actions flow through. Uses only the in-memory gate + sink
 * (no DB, no SDK), exercising the contract each per-connector decorator relies
 * on:
 *   - no token / wrong workspace / wrong action / fingerprint drift / pending /
 *     rejected / expired all block, and `execute` is NEVER called;
 *   - an approved, unexpired, fingerprint-matched grant lets the write run;
 *   - every executed write — ok OR error — is audit-logged exactly once.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mcpOk, mcpError } from '@/lib/integrations/mcp-core';
import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from './approval-gate-memory';
import { gateAndRun, type GatedAction } from './with-approval';

const WS = 'ws-1';
const action = (over: Partial<GatedAction> = {}): GatedAction => ({
  connector: 'hubspot',
  action: 'create_deal',
  detail: { dealName: 'Acme', amount: '40000' },
  ...over,
});

function harness() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  let runs = 0;
  const run = async () => {
    runs += 1;
    return mcpOk({ id: 'deal-1' });
  };
  return { gate, audit, runs: () => runs, run };
}

test('blocks when no approval token is present — SDK never called', async () => {
  const h = harness();
  const res = await gateAndRun({
    gate: h.gate,
    audit: h.audit,
    workspaceId: WS,
    action: action(),
    execute: h.run,
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(h.runs(), 0);
  assert.equal(h.audit.entries.length, 0);
});

test('blocks an unknown / wrong-workspace token', async () => {
  const h = harness();
  h.gate.seedApproved({ pendingApprovalId: 'a1', workspaceId: 'other-ws', action: action() });
  const res = await gateAndRun({
    gate: h.gate,
    audit: h.audit,
    workspaceId: WS,
    action: action({ pendingApprovalId: 'a1' }),
    execute: h.run,
  });
  assert.equal(res.ok, false);
  assert.equal(h.runs(), 0);
});

test('blocks on fingerprint drift — approval cannot be replayed onto a new payload', async () => {
  const h = harness();
  h.gate.seedApproved({ pendingApprovalId: 'a1', workspaceId: WS, action: action() });
  const res = await gateAndRun({
    gate: h.gate,
    audit: h.audit,
    workspaceId: WS,
    // same token, but the amount changed since approval
    action: action({ pendingApprovalId: 'a1', detail: { dealName: 'Acme', amount: '99999' } }),
    execute: h.run,
  });
  assert.equal(res.ok, false);
  assert.equal(h.runs(), 0);
});

test('blocks pending and rejected grants', async () => {
  for (const seed of ['seedPending', 'seedRejected'] as const) {
    const h = harness();
    h.gate[seed]({ pendingApprovalId: 'a1', workspaceId: WS, action: action() });
    const res = await gateAndRun({
      gate: h.gate,
      audit: h.audit,
      workspaceId: WS,
      action: action({ pendingApprovalId: 'a1' }),
      execute: h.run,
    });
    assert.equal(res.ok, false);
    assert.equal(h.runs(), 0);
  }
});

test('blocks an expired grant', async () => {
  const gate = new InMemoryConnectorApprovalGate({ now: () => 10_000 });
  const audit = new InMemoryConnectorActionAuditSink();
  gate.seedApproved({
    pendingApprovalId: 'a1',
    workspaceId: WS,
    action: action(),
    expiresAt: new Date(5_000).toISOString(),
  });
  let runs = 0;
  const res = await gateAndRun({
    gate,
    audit,
    workspaceId: WS,
    action: action({ pendingApprovalId: 'a1' }),
    execute: async () => {
      runs += 1;
      return mcpOk({ id: 'x' });
    },
  });
  assert.equal(res.ok, false);
  assert.equal(runs, 0);
});

test('runs the SDK call on a valid grant and audit-logs success', async () => {
  const h = harness();
  h.gate.seedApproved({
    pendingApprovalId: 'a1',
    workspaceId: WS,
    action: action(),
    approvedByUserId: 'user-7',
  });
  const res = await gateAndRun({
    gate: h.gate,
    audit: h.audit,
    workspaceId: WS,
    action: action({ pendingApprovalId: 'a1' }),
    execute: h.run,
  });
  assert.equal(res.ok, true);
  assert.equal(h.runs(), 1);
  assert.equal(h.audit.entries.length, 1);
  const entry = h.audit.entries[0];
  assert.equal(entry.outcome, 'ok');
  assert.equal(entry.connector, 'hubspot');
  assert.equal(entry.action, 'create_deal');
  assert.equal(entry.approvedByUserId, 'user-7');
  assert.equal(entry.pendingApprovalId, 'a1');
});

test('audit-logs a post-approval SDK failure (outcome=error)', async () => {
  const h = harness();
  h.gate.seedApproved({ pendingApprovalId: 'a1', workspaceId: WS, action: action() });
  const res = await gateAndRun({
    gate: h.gate,
    audit: h.audit,
    workspaceId: WS,
    action: action({ pendingApprovalId: 'a1' }),
    execute: async () => mcpError('UPSTREAM_ERROR', 'HubSpot 500'),
  });
  assert.equal(res.ok, false);
  assert.equal(h.audit.entries.length, 1);
  assert.equal(h.audit.entries[0].outcome, 'error');
  assert.equal(h.audit.entries[0].errorCode, 'UPSTREAM_ERROR');
});
