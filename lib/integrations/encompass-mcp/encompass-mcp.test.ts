/**
 * lib/integrations/encompass-mcp/encompass-mcp.test.ts
 *
 * Proves the keystone deliverable for the mortgage family:
 *   (a) the fixture path returns a real-shaped loan file + outstanding docs
 *       through the EncompassLoanFileLookup adapter,
 *   (b) the mortgage doc-chase skill buckets + drafts from Encompass-shaped
 *       data (the LoanFileLookup port is wired end-to-end),
 *   (c) flag-off / no INTEGRATIONS_PROVIDER → the builder returns the fixture
 *       server (fixtures by default, no live credentials),
 *   (d) the honesty seam: an auth-class MCP error surfaces NOT_CONFIGURED,
 *       not a fabricated loan file.
 *
 * Per `feedback_runner_portability.md`: the adapter is exercised against the
 * second implementation (TestEncompassMcpServer) — no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEncompassMcpServer,
  isEncompassLive,
  TestEncompassMcpServer,
  ENCOMPASS_FIXTURE_LOAN_ID,
} from './index';
import type {
  EncompassMcpServer,
  GetLoanFileInput,
  GetLoanFileOutput,
  ListOutstandingDocsInput,
  ListOutstandingDocsOutput,
} from './types';
import { mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import {
  EncompassLoanFileLookup,
  runSkill,
} from '@/lib/skills/mortgage-document-chase';

const WORKSPACE_ID = 'ws-mortgage-encompass-0001';
// Anchor "now" to the fixtures' as-of so the day buckets are deterministic.
const NOW = new Date('2026-06-07T15:00:00Z');

describe('encompass-mcp — builder flag behavior', () => {
  it('defaults to the fixture server when ENCOMPASS_ADAPTER_LIVE is unset', () => {
    const prev = process.env.ENCOMPASS_ADAPTER_LIVE;
    const prevProvider = process.env.INTEGRATIONS_PROVIDER;
    delete process.env.ENCOMPASS_ADAPTER_LIVE;
    delete process.env.INTEGRATIONS_PROVIDER;
    try {
      assert.equal(isEncompassLive(), false);
      const server = buildEncompassMcpServer({ workspaceId: WORKSPACE_ID });
      assert.equal(server.name, 'encompass-test');
    } finally {
      if (prev !== undefined) process.env.ENCOMPASS_ADAPTER_LIVE = prev;
      if (prevProvider !== undefined) process.env.INTEGRATIONS_PROVIDER = prevProvider;
    }
  });

  it('reports live when ENCOMPASS_ADAPTER_LIVE=on (cold-start re-read)', () => {
    const prev = process.env.ENCOMPASS_ADAPTER_LIVE;
    process.env.ENCOMPASS_ADAPTER_LIVE = 'on';
    try {
      assert.equal(isEncompassLive(), true);
    } finally {
      if (prev === undefined) delete process.env.ENCOMPASS_ADAPTER_LIVE;
      else process.env.ENCOMPASS_ADAPTER_LIVE = prev;
    }
  });
});

describe('EncompassLoanFileLookup — adapter maps loan + conditions', () => {
  it('returns the loan file with borrower + co-borrower + LO contacts', async () => {
    const lookup = new EncompassLoanFileLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEncompassMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await lookup.fetchFile({ workspaceId: WORKSPACE_ID, loanId: ENCOMPASS_FIXTURE_LOAN_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.borrower.email, 'avery.lin@example.com');
    assert.ok(res.value.coBorrower);
    assert.equal(res.value.loanOfficer.email, 'pat.romano@summit-lending.example');
    assert.equal(res.value.purpose, 'purchase');
  });

  it('returns the outstanding conditions as OutstandingDocs', async () => {
    const lookup = new EncompassLoanFileLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEncompassMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await lookup.fetchOutstandingDocs({ workspaceId: WORKSPACE_ID, loanId: ENCOMPASS_FIXTURE_LOAN_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 4);
    const stuck = res.value.find((d) => d.id === 'COND-4');
    assert.ok(stuck);
    assert.equal(stuck.conditionAttached, true);
    assert.ok(stuck.requestedAt instanceof Date);
  });

  it('workspace mismatch is rejected with INVALID_INPUT', async () => {
    const lookup = new EncompassLoanFileLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEncompassMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await lookup.fetchFile({ workspaceId: 'ws-other', loanId: ENCOMPASS_FIXTURE_LOAN_ID });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
  });
});

describe('mortgage doc-chase skill — chases from Encompass data end-to-end', () => {
  it('buckets each doc + drafts one batched borrower chase + an LO nudge', async () => {
    const lookup = new EncompassLoanFileLookup({
      workspaceId: WORKSPACE_ID,
      mcp: new TestEncompassMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      loanId: ENCOMPASS_FIXTURE_LOAN_ID,
      lookup,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // fresh(COND-1) + pending(COND-2) + late(COND-3) + stuck(COND-4).
    assert.equal(res.value.bucketCounts.fresh, 1);
    assert.equal(res.value.bucketCounts.pending, 1);
    assert.equal(res.value.bucketCounts.late, 1);
    assert.equal(res.value.bucketCounts.stuck, 1);
    // One batched chase draft for the whole file (never one-per-doc spam).
    assert.ok(res.value.borrowerChase);
    // The stuck PTD item triggers the LO phone nudge.
    assert.equal(res.value.loNudge.needed, true);
    assert.ok(res.value.loNudge.stuckDocIds.includes('COND-4'));
    // No rate / APR / dollar amount leaks into the chase body.
    assert.doesNotMatch(res.value.borrowerChase.body, /\$\s?\d/);
  });
});

describe('mortgage doc-chase skill — honesty seam (Encompass not connected)', () => {
  it('surfaces a NOT_CONFIGURED-coded error rather than a fabricated file', async () => {
    const stub: EncompassMcpServer = {
      name: 'encompass-stub',
      workspaceId: WORKSPACE_ID,
      async getLoanFile(_input: GetLoanFileInput): Promise<McpResult<GetLoanFileOutput>> {
        return mcpError('CREDENTIAL_NOT_FOUND', 'no encompass credential');
      },
      async listOutstandingDocs(
        _input: ListOutstandingDocsInput,
      ): Promise<McpResult<ListOutstandingDocsOutput>> {
        return mcpError('CREDENTIAL_NOT_FOUND', 'no encompass credential');
      },
    };
    const lookup = new EncompassLoanFileLookup({ workspaceId: WORKSPACE_ID, mcp: stub });
    const res = await lookup.fetchFile({ workspaceId: WORKSPACE_ID, loanId: ENCOMPASS_FIXTURE_LOAN_ID });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.match(res.error.message, /Encompass is not yet connected/);
  });
});
