/**
 * lib/integrations/quickbooks-mcp/estimate-lookup.test.ts
 *
 * Unit tests for `QuickbooksEstimateLookup` — the adapter that bridges
 * the QB MCP `EstimateSummary` DTOs to the skill's `EstimateRecord` port.
 *
 * All tests use `TestQuickbooksMcpServer` (fixture-backed, no network, no DB).
 * No mocks — the two-implementation rule means the fixture server IS the test
 * double.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TestQuickbooksMcpServer } from './test-server';
import { QuickbooksEstimateLookup } from './estimate-lookup';

const WORKSPACE_ID = 'ws-homesvc-qb-test-01';

const REP = { name: 'Sam Cooper', email: 'sam@shop.example', phone: null };

function lookup() {
  return new QuickbooksEstimateLookup({
    serverFactory: (args) => new TestQuickbooksMcpServer(args),
    rep: REP,
  });
}

describe('QuickbooksEstimateLookup', () => {
  it('returns only Pending estimates', async () => {
    const res = await lookup().fetchOpenEstimates({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Fixture has 3 estimates: 2 Pending + 1 Accepted.  Adapter must return only the 2.
    assert.equal(res.value.length, 2, 'only Pending estimates');
    for (const r of res.value) {
      // All returned records have a valid sentAt date.
      assert.ok(r.sentAt instanceof Date && !Number.isNaN(r.sentAt.getTime()));
    }
  });

  it('maps estimateId from QB id', async () => {
    const res = await lookup().fetchOpenEstimates({ workspaceId: WORKSPACE_ID });
    assert.ok(res.ok);
    if (!res.ok) return;
    const ids = res.value.map((r) => r.estimateId).sort();
    assert.deepEqual(ids, ['EST-401', 'EST-402']);
  });

  it('maps amountUsd from QB totalAmount', async () => {
    const res = await lookup().fetchOpenEstimates({ workspaceId: WORKSPACE_ID });
    assert.ok(res.ok);
    if (!res.ok) return;
    const amounts = res.value.map((r) => r.amountUsd).sort((a, b) => a - b);
    assert.deepEqual(amounts, [3800, 6200]);
  });

  it('uses the injected rep on every record', async () => {
    const res = await lookup().fetchOpenEstimates({ workspaceId: WORKSPACE_ID });
    assert.ok(res.ok);
    if (!res.ok) return;
    for (const r of res.value) {
      assert.equal(r.rep.name, REP.name);
      assert.equal(r.rep.email, REP.email);
    }
  });

  it('detects roofing trade from memo keywords', async () => {
    const res = await lookup().fetchOpenEstimates({ workspaceId: WORKSPACE_ID });
    assert.ok(res.ok);
    if (!res.ok) return;
    // EST-401 memo: "Full roof replacement — dimensional shingles"
    const est401 = res.value.find((r) => r.estimateId === 'EST-401');
    assert.ok(est401, 'EST-401 not found');
    assert.equal(est401?.trade, 'roofing');
  });

  it('detects hvac trade from memo keywords', async () => {
    const res = await lookup().fetchOpenEstimates({ workspaceId: WORKSPACE_ID });
    assert.ok(res.ok);
    if (!res.ok) return;
    // EST-402 memo: "HVAC system replacement — 3-ton Carrier"
    const est402 = res.value.find((r) => r.estimateId === 'EST-402');
    assert.ok(est402, 'EST-402 not found');
    assert.equal(est402?.trade, 'hvac');
  });

  it('homeownerAcknowledged defaults to false (QB has no read-receipt)', async () => {
    const res = await lookup().fetchOpenEstimates({ workspaceId: WORKSPACE_ID });
    assert.ok(res.ok);
    if (!res.ok) return;
    for (const r of res.value) {
      assert.equal(r.homeownerAcknowledged, false);
    }
  });

  it('name is "quickbooks"', () => {
    assert.equal(lookup().name, 'quickbooks');
  });
});
