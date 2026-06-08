/**
 * lib/integrations/qualia-mcp/qualia-mcp.test.ts
 *
 * Proves the keystone deliverable for the title-escrow family:
 *   (a) the fixture path returns a real-shaped closing file + checklist +
 *       receipts through the QualiaClosingFileFetcher adapter,
 *   (b) the closing-doc-chase skill buckets per party + drafts from
 *       Qualia-shaped data (the ClosingFileFetcher port is wired end-to-end),
 *   (c) flag-off / no INTEGRATIONS_PROVIDER → the builder returns the fixture
 *       server (fixtures by default, no live credentials),
 *   (d) the honesty seam: an auth-class MCP error surfaces NOT_CONFIGURED,
 *       not a fabricated closing file.
 *
 * Per `feedback_runner_portability.md`: the adapter is exercised against the
 * second implementation (TestQualiaMcpServer) — no network, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQualiaMcpServer,
  isQualiaLive,
  TestQualiaMcpServer,
  QUALIA_FIXTURE_ORDER_ID,
} from './index';
import type {
  GetClosingOrderInput,
  GetClosingOrderOutput,
  QualiaMcpServer,
} from './types';
import { mcpError, type McpResult } from '@/lib/integrations/mcp-core';
import {
  QualiaClosingFileFetcher,
  runSkill,
} from '@/lib/skills/title-escrow-closing-doc-chase';

const WORKSPACE_ID = 'ws-title-qualia-0001';
// Anchor "now" past CK-3 (06-12) and CK-4 (06-11) so they read as late, while
// CK-2 (06-18) and CK-5 (06-17) stay pending.
const NOW = new Date('2026-06-15T15:00:00Z');

describe('qualia-mcp — builder flag behavior', () => {
  it('defaults to the fixture server when QUALIA_ADAPTER_LIVE is unset', () => {
    const prev = process.env.QUALIA_ADAPTER_LIVE;
    const prevProvider = process.env.INTEGRATIONS_PROVIDER;
    delete process.env.QUALIA_ADAPTER_LIVE;
    delete process.env.INTEGRATIONS_PROVIDER;
    try {
      assert.equal(isQualiaLive(), false);
      const server = buildQualiaMcpServer({ workspaceId: WORKSPACE_ID });
      assert.equal(server.name, 'qualia-test');
    } finally {
      if (prev !== undefined) process.env.QUALIA_ADAPTER_LIVE = prev;
      if (prevProvider !== undefined) process.env.INTEGRATIONS_PROVIDER = prevProvider;
    }
  });

  it('reports live when QUALIA_ADAPTER_LIVE=on (cold-start re-read)', () => {
    const prev = process.env.QUALIA_ADAPTER_LIVE;
    process.env.QUALIA_ADAPTER_LIVE = 'on';
    try {
      assert.equal(isQualiaLive(), true);
    } finally {
      if (prev === undefined) delete process.env.QUALIA_ADAPTER_LIVE;
      else process.env.QUALIA_ADAPTER_LIVE = prev;
    }
  });
});

describe('QualiaClosingFileFetcher — adapter maps order + checklist + receipts', () => {
  it('returns the closing file with coordinator + parties', async () => {
    const fetcher = new QualiaClosingFileFetcher({
      workspaceId: WORKSPACE_ID,
      mcp: new TestQualiaMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await fetcher.fetchFile({ workspaceId: WORKSPACE_ID, fileId: QUALIA_FIXTURE_ORDER_ID });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.propertyAddress, '742 Evergreen Ter, Atlanta, GA 30307');
    assert.equal(res.value.closingCoordinator.email, 'robin.vasquez@summit-title.example');
    assert.equal(res.value.contacts.length, 4);
  });

  it('maps the checklist with Date due dates and the received receipt', async () => {
    const fetcher = new QualiaClosingFileFetcher({
      workspaceId: WORKSPACE_ID,
      mcp: new TestQualiaMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const checklist = await fetcher.fetchChecklist({ workspaceId: WORKSPACE_ID, fileId: QUALIA_FIXTURE_ORDER_ID });
    assert.equal(checklist.ok, true);
    if (!checklist.ok) return;
    assert.equal(checklist.value.length, 5);
    assert.ok(checklist.value[0].dueAt instanceof Date);

    const received = await fetcher.fetchReceivedDocs({ workspaceId: WORKSPACE_ID, fileId: QUALIA_FIXTURE_ORDER_ID });
    assert.equal(received.ok, true);
    if (!received.ok) return;
    assert.equal(received.value.length, 1);
    assert.equal(received.value[0].satisfiesChecklistItemId, 'CK-1');
  });

  it('workspace mismatch is rejected with INVALID_INPUT', async () => {
    const fetcher = new QualiaClosingFileFetcher({
      workspaceId: WORKSPACE_ID,
      mcp: new TestQualiaMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await fetcher.fetchFile({ workspaceId: 'ws-other', fileId: QUALIA_FIXTURE_ORDER_ID });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
  });
});

describe('closing-doc-chase skill — drafts per party from Qualia data', () => {
  it('buckets items, marks the received one, and drafts per outstanding party', async () => {
    const fetcher = new QualiaClosingFileFetcher({
      workspaceId: WORKSPACE_ID,
      mcp: new TestQualiaMcpServer({ workspaceId: WORKSPACE_ID }),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fileId: QUALIA_FIXTURE_ORDER_ID,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // CK-1 received; CK-3 (lender) + CK-4 (seller) late; CK-2 (buyer) +
    // CK-5 (buyer-attorney, optional) pending.
    assert.equal(res.value.bucketCounts.received, 1);
    assert.equal(res.value.bucketCounts.late, 2);
    assert.equal(res.value.bucketCounts.pending, 2);
    assert.equal(res.value.closingReady, false);
    // Required, non-received items drive the per-party drafts: buyer (CK-2),
    // lender (CK-3), seller (CK-4). The optional CK-5 is not chased.
    const parties = new Set(res.value.drafts.map((d) => d.party));
    assert.ok(parties.has('buyer'));
    assert.ok(parties.has('lender'));
    assert.ok(parties.has('seller'));
    assert.ok(!parties.has('buyer-attorney'));
  });
});

describe('closing-doc-chase skill — honesty seam (Qualia not connected)', () => {
  it('surfaces a NOT_CONFIGURED-coded error rather than a fabricated file', async () => {
    const stub: QualiaMcpServer = {
      name: 'qualia-stub',
      workspaceId: WORKSPACE_ID,
      async getClosingOrder(
        _input: GetClosingOrderInput,
      ): Promise<McpResult<GetClosingOrderOutput>> {
        return mcpError('CREDENTIAL_NOT_FOUND', 'no qualia credential');
      },
    };
    const fetcher = new QualiaClosingFileFetcher({ workspaceId: WORKSPACE_ID, mcp: stub });
    const res = await fetcher.fetchFile({ workspaceId: WORKSPACE_ID, fileId: QUALIA_FIXTURE_ORDER_ID });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
    assert.match(res.error.message, /Qualia is not yet connected/);
  });
});
