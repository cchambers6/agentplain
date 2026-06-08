/**
 * lib/integrations/ezlynx-mcp/ezlynx-mcp.test.ts
 *
 * Proves the keystone deliverable for the insurance family:
 *   (a) the fixture path returns real-shaped policies on file through the
 *       EzlynxPolicyLookup adapter,
 *   (b) the COI-request skill produces a ready-to-issue payload + draft from
 *       EZLynx-shaped data (the PolicyLookup port is wired end-to-end),
 *   (c) flag-off / no INTEGRATIONS_PROVIDER → the builder returns the fixture
 *       server (fixtures by default, no live credentials),
 *   (d) the honesty seam: an auth-class MCP error surfaces NOT_CONFIGURED,
 *       not a fabricated policy set.
 *
 * Per `feedback_runner_portability.md`: the adapter is exercised against the
 * second implementation (TestEzlynxMcpServer) — no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEzlynxMcpServer,
  isEzlynxLive,
  TestEzlynxMcpServer,
  EZLYNX_FIXTURE_INSURED,
} from './index';
import type {
  EzlynxMcpServer,
  ListPoliciesInput,
  ListPoliciesOutput,
} from './types';
import { mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import {
  EzlynxPolicyLookup,
  runSkill,
} from '@/lib/skills/insurance-coi-request';
import type { CoiRequestRecord } from '@/lib/skills/insurance-coi-request';

const WORKSPACE_ID = 'ws-insurance-ezlynx-0001';
const NOW = new Date('2026-06-07T15:00:00Z');

function request(overrides: Partial<CoiRequestRecord> = {}): CoiRequestRecord {
  return {
    requestId: 'coi-ez-0001',
    requester: {
      organizationName: 'Acme Construction GC',
      contact: { name: 'Lee Sample', email: 'lee@acme-gc.example' },
      projectReference: '2510 Peachtree St remodel',
    },
    insured: {
      displayName: 'Beacon Roofing & Restoration',
      legalName: EZLYNX_FIXTURE_INSURED,
      contact: { name: 'Sam Beacon', email: 'sam@beacon-roof.example' },
    },
    requestedLines: ['general-liability', 'workers-comp'],
    additionalInsured: true,
    waiverOfSubrogation: false,
    hasDeadline: false,
    responsibleCsr: { name: 'Jordan Hill', email: 'jordan@agency.example' },
    rawRequestBody:
      'Please send a COI for Beacon Roofing showing GL and WC for the 2510 ' +
      'Peachtree St remodel. Add Acme Construction GC as additional insured.',
    ...overrides,
  };
}

describe('ezlynx-mcp — builder flag behavior', () => {
  it('defaults to the fixture server when EZLYNX_ADAPTER_LIVE is unset', () => {
    const prev = process.env.EZLYNX_ADAPTER_LIVE;
    const prevProvider = process.env.INTEGRATIONS_PROVIDER;
    delete process.env.EZLYNX_ADAPTER_LIVE;
    delete process.env.INTEGRATIONS_PROVIDER;
    try {
      assert.equal(isEzlynxLive(), false);
      const server = buildEzlynxMcpServer({ workspaceId: WORKSPACE_ID });
      assert.equal(server.name, 'ezlynx-test');
    } finally {
      if (prev !== undefined) process.env.EZLYNX_ADAPTER_LIVE = prev;
      if (prevProvider !== undefined) process.env.INTEGRATIONS_PROVIDER = prevProvider;
    }
  });

  it('reports live when EZLYNX_ADAPTER_LIVE=on (cold-start re-read)', () => {
    const prev = process.env.EZLYNX_ADAPTER_LIVE;
    process.env.EZLYNX_ADAPTER_LIVE = 'on';
    try {
      assert.equal(isEzlynxLive(), true);
    } finally {
      if (prev === undefined) delete process.env.EZLYNX_ADAPTER_LIVE;
      else process.env.EZLYNX_ADAPTER_LIVE = prev;
    }
  });
});

describe('EzlynxPolicyLookup — adapter maps policies → PolicyOnFile', () => {
  it('returns the in-force lines for the fixture insured', async () => {
    const lookup = new EzlynxPolicyLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEzlynxMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await lookup.fetchPoliciesForInsured({
      workspaceId: WORKSPACE_ID,
      insuredLegalName: EZLYNX_FIXTURE_INSURED,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const gl = res.value.find((p) => p.line === 'general-liability');
    assert.ok(gl);
    assert.equal(gl.inForce, true);
    assert.equal(gl.carrierName, 'Travelers');
    // The expired auto policy maps through with inForce=false.
    const auto = res.value.find((p) => p.line === 'auto-liability');
    assert.ok(auto);
    assert.equal(auto.inForce, false);
  });

  it('unknown insured → empty list (never fabricated)', async () => {
    const lookup = new EzlynxPolicyLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEzlynxMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await lookup.fetchPoliciesForInsured({
      workspaceId: WORKSPACE_ID,
      insuredLegalName: 'Nobody Insured Inc',
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 0);
  });

  it('workspace mismatch is rejected with INVALID_INPUT', async () => {
    const lookup = new EzlynxPolicyLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEzlynxMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await lookup.fetchPoliciesForInsured({
      workspaceId: 'ws-other',
      insuredLegalName: EZLYNX_FIXTURE_INSURED,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
  });
});

describe('COI-request skill — issues from EZLynx data end-to-end', () => {
  it('GL + WC requested and on file → ready-to-issue with both lines matched', async () => {
    const lookup = new EzlynxPolicyLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEzlynxMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request(),
      lookup,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.status, 'ready-to-issue');
    const gl = res.value.issuance.coverageDecisions.find((d) => d.line === 'general-liability');
    const wc = res.value.issuance.coverageDecisions.find((d) => d.line === 'workers-comp');
    assert.equal(gl?.match, 'in-force');
    assert.equal(wc?.match, 'in-force');
    // The draft never quotes a premium (tone guidance).
    assert.doesNotMatch(res.value.requesterReply.body, /\$\s?\d/);
  });

  it('a requested line not on file surfaces as a coverage gap', async () => {
    const lookup = new EzlynxPolicyLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEzlynxMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      request: request({ requestedLines: ['general-liability', 'professional-liability'] }),
      lookup,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const pl = res.value.issuance.coverageDecisions.find((d) => d.line === 'professional-liability');
    assert.equal(pl?.match, 'not-on-file');
    assert.equal(res.value.status, 'coverage-gap');
  });
});

describe('COI-request skill — honesty seam (EZLynx not connected)', () => {
  it('surfaces NOT_CONFIGURED rather than a fabricated policy set', async () => {
    const stub: EzlynxMcpServer = {
      name: 'ezlynx-stub',
      workspaceId: WORKSPACE_ID,
      async listPoliciesForInsured(
        _input: ListPoliciesInput,
      ): Promise<McpResult<ListPoliciesOutput>> {
        return mcpError('CREDENTIAL_NOT_FOUND', 'no ezlynx credential');
      },
    };
    const lookup = new EzlynxPolicyLookup({ workspaceId: WORKSPACE_ID, mcp: stub });
    const res = await lookup.fetchPoliciesForInsured({
      workspaceId: WORKSPACE_ID,
      insuredLegalName: EZLYNX_FIXTURE_INSURED,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.match(res.error.message, /EZLynx is not yet connected/);
  });
});
