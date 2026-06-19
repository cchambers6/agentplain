/**
 * lib/integrations/buildium-mcp/buildium-mcp.test.ts
 *
 * Proves the keystone deliverable for the property-management family:
 *   (a) the fixture path returns categorized, real-shaped delinquent units
 *       through the BuildiumRentRollLookup adapter,
 *   (b) the rent-collection skill produces drafts from Buildium-shaped data
 *       (the port is wired end-to-end, not just defined),
 *   (c) flag-off / no INTEGRATIONS_PROVIDER → the builder returns the
 *       fixture server (fixtures by default, no live credentials),
 *   (d) the honesty seam: an auth-class MCP error surfaces NOT_CONFIGURED,
 *       not a fabricated rent roll.
 *
 * Per `feedback_runner_portability.md`: the adapter is exercised against the
 * second implementation (TestBuildiumMcpServer) — no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildBuildiumMcpServer, isBuildiumLive, TestBuildiumMcpServer } from './index';
import type { BuildiumMcpServer, ListDelinquentLeasesInput, ListDelinquentLeasesOutput } from './types';
import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';

/**
 * The write-action methods are not exercised by these read-path / skill tests,
 * but the `BuildiumMcpServer` interface now requires them. Spread this into the
 * inline honesty-seam stubs so they satisfy the interface without each stub
 * re-declaring four unused mutations.
 */
const NOOP_WRITES = {
  async createWorkOrder() {
    return mcpError('NOT_IMPLEMENTED', 'stub') as McpResult<never>;
  },
  async chargeLateFee() {
    return mcpError('NOT_IMPLEMENTED', 'stub') as McpResult<never>;
  },
  async postNotice() {
    return mcpError('NOT_IMPLEMENTED', 'stub') as McpResult<never>;
  },
  async sendTenantMsg() {
    return mcpError('NOT_IMPLEMENTED', 'stub') as McpResult<never>;
  },
};
import {
  BuildiumRentRollLookup,
  runSkill,
} from '@/lib/skills/property-management-rent-collection-chase';

const WORKSPACE_ID = 'ws-pm-buildium-0001';
const NOW = new Date('2026-06-07T15:00:00Z');

describe('buildium-mcp — builder flag behavior', () => {
  it('defaults to the fixture server when BUILDIUM_ADAPTER_LIVE is unset', () => {
    const prev = process.env.BUILDIUM_ADAPTER_LIVE;
    const prevProvider = process.env.INTEGRATIONS_PROVIDER;
    delete process.env.BUILDIUM_ADAPTER_LIVE;
    delete process.env.INTEGRATIONS_PROVIDER;
    try {
      assert.equal(isBuildiumLive(), false);
      const server = buildBuildiumMcpServer({ workspaceId: WORKSPACE_ID });
      assert.equal(server.name, 'buildium-test');
    } finally {
      if (prev !== undefined) process.env.BUILDIUM_ADAPTER_LIVE = prev;
      if (prevProvider !== undefined) process.env.INTEGRATIONS_PROVIDER = prevProvider;
    }
  });

  it('reports live when BUILDIUM_ADAPTER_LIVE=on (cold-start re-read)', () => {
    const prev = process.env.BUILDIUM_ADAPTER_LIVE;
    process.env.BUILDIUM_ADAPTER_LIVE = 'on';
    try {
      assert.equal(isBuildiumLive(), true);
    } finally {
      if (prev === undefined) delete process.env.BUILDIUM_ADAPTER_LIVE;
      else process.env.BUILDIUM_ADAPTER_LIVE = prev;
    }
  });
});

describe('buildium-mcp — fixture server returns real-shaped delinquent leases', () => {
  it('lists leases spanning every delinquency bucket', async () => {
    const server = new TestBuildiumMcpServer({ workspaceId: WORKSPACE_ID });
    const res = await server.listDelinquentLeases();
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.leases.length, 4);
    const byId = new Map(res.value.leases.map((l) => [l.id, l]));
    assert.equal(byId.get('7001')?.daysPastDue, 5);
    assert.equal(byId.get('7002')?.daysPastDue, 9);
    assert.equal(byId.get('7003')?.daysPastDue, 21);
    assert.equal(byId.get('7004')?.paymentPlanInPlace, true);
    // Real-shaped: primary tenant carries an email + the balance is positive.
    assert.ok((byId.get('7001')?.outstandingBalance ?? 0) > 0);
    assert.equal(byId.get('7001')?.tenants[0].email, 'maria.delgado@example.com');
  });
});

describe('BuildiumRentRollLookup — adapter maps leases → UnitDelinquency', () => {
  it('returns categorized real-shaped units through the RentRollLookup port', async () => {
    const lookup = new BuildiumRentRollLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestBuildiumMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await lookup.fetchDelinquentUnits({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 4);
    const unit = res.value.find((u) => u.leaseId === '7001');
    assert.ok(unit);
    assert.equal(unit.primaryTenant.email, 'maria.delgado@example.com');
    assert.equal(unit.coTenants.length, 1); // Tomas (co-tenant) has an email → addressable
    // Honest mapping: PM-of-record is an operator merge field; formal notice
    // fails safe to owner approval; chase history starts from agentplain's
    // own ledger, not Buildium.
    assert.match(unit.propertyManager.name, /\{\{operator: property manager name\}\}/);
    assert.equal(unit.formalNoticeRequiresOwnerApproval, true);
    assert.equal(unit.tenantAcknowledged, false);
    assert.equal(unit.lastChaseAt, null);
  });

  it('workspace mismatch is rejected with INVALID_INPUT', async () => {
    const lookup = new BuildiumRentRollLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestBuildiumMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await lookup.fetchDelinquentUnits({ workspaceId: 'ws-other' });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
  });
});

describe('rent-collection skill — drafts from Buildium data end-to-end', () => {
  it('buckets each unit + drafts a chase + queues the escalation for owner review', async () => {
    const lookup = new BuildiumRentRollLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestBuildiumMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, lookup, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // 5d + 6d → soft-chase (2), 9d → formal-notice (1), 21d → escalation (1).
    assert.equal(res.value.bucketCounts['soft-chase'], 2);
    assert.equal(res.value.bucketCounts['formal-notice'], 1);
    assert.equal(res.value.bucketCounts.escalation, 1);
    assert.equal(res.value.bucketCounts.grace, 0);
    // One draft per non-grace unit.
    assert.equal(res.value.drafts.length, 4);
    // The escalation lands on the owner-review queue with the fail-safe flag.
    assert.equal(res.value.ownerReview.length, 1);
    assert.equal(res.value.ownerReview[0].leaseId, '7003');
    assert.equal(res.value.ownerReview[0].formalNoticeRequiresOwnerApproval, true);
    // The plan-aware soft-chase draft acknowledges the payment plan.
    const planDraft = res.value.drafts.find((d) => d.leaseId === '7004');
    assert.ok(planDraft);
    assert.match(planDraft.body, /payment plan/i);
    // No dollar amount leaks into any draft body (tone guidance).
    for (const d of res.value.drafts) {
      assert.doesNotMatch(d.body, /\$\s?\d/, `draft for ${d.leaseId} must not quote a dollar amount`);
    }
  });
});

describe('rent-collection skill — honesty seam (Buildium not connected)', () => {
  it('surfaces NOT_CONFIGURED rather than a fabricated rent roll', async () => {
    const stub: BuildiumMcpServer = {
      name: 'buildium-stub',
      workspaceId: WORKSPACE_ID,
      async listDelinquentLeases(
        _input?: ListDelinquentLeasesInput,
      ): Promise<McpResult<ListDelinquentLeasesOutput>> {
        return mcpError('CREDENTIAL_NOT_FOUND', 'no buildium credential');
      },
      async healthCheck() {
        return { ok: false as const, latencyMs: 0, lastChecked: NOW.toISOString(), errorCode: 'CREDENTIAL_NOT_FOUND' };
      },
      ...NOOP_WRITES,
    };
    const lookup = new BuildiumRentRollLookup({ workspaceId: WORKSPACE_ID, mcp: stub });
    const res = await lookup.fetchDelinquentUnits({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.match(res.error.message, /Buildium is not yet connected/);
  });

  it('a lease with no addressable tenant is dropped, never faked', async () => {
    const stub: BuildiumMcpServer = {
      name: 'buildium-stub',
      workspaceId: WORKSPACE_ID,
      async listDelinquentLeases(): Promise<McpResult<ListDelinquentLeasesOutput>> {
        return mcpOk({
          leases: [
            {
              id: '9999',
              unitLabel: 'No-Email Unit #1',
              outstandingBalance: 500,
              rentDueDate: '2026-06-01',
              daysPastDue: 6,
              tenants: [{ name: 'Anon Tenant', email: null, phone: null }],
              paymentPlanInPlace: false,
            },
          ],
        });
      },
      async healthCheck() {
        return { ok: true as const, latencyMs: 0, lastChecked: NOW.toISOString() };
      },
      ...NOOP_WRITES,
    };
    const lookup = new BuildiumRentRollLookup({ workspaceId: WORKSPACE_ID, mcp: stub });
    const res = await lookup.fetchDelinquentUnits({ workspaceId: WORKSPACE_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 0);
  });
});
