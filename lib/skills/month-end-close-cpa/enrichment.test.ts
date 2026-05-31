/**
 * lib/skills/month-end-close-cpa/enrichment.test.ts
 *
 * Integration pinning test: when both TaxDome AND Karbon MCPs are
 * wired, the month-end-close skill produces a chase email body + a
 * status update body that REFERENCE the enrichment counts. When
 * neither is wired, the body stays QuickBooks-only and a
 * `missingConnectorsNote` names the gap honestly.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this is the
 * functional acceptance bar for Phase 1 — the loop is real because the
 * skill's draft body reflects what the firm sees in TaxDome + Karbon,
 * not stub text.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { TestTaxdomeMcpServer } from '@/lib/integrations/taxdome-mcp';
import { TestKarbonMcpServer } from '@/lib/integrations/karbon-mcp';
import type { TaxdomeMcpServer } from '@/lib/integrations/taxdome-mcp';
import type { KarbonMcpServer } from '@/lib/integrations/karbon-mcp';
import { runSkill } from './skill';
import { mcpEnrichmentSource } from './enrichment';
import { JsonCloseFetcher } from './json-fetcher';
import type {
  ChecklistItem,
  ClientEngagement,
  ReceivedDoc,
} from './types';

const WORKSPACE_ID = 'ws-cpa-enrichment-0001';
const CLIENT_ID = 'client-acme-llc';
// Map the close engagement to a TaxDome + Karbon client id that the
// fixture servers know about so the enrichment read returns non-zero
// counts.
const TAXDOME_CLIENT_ID = 'cl-1';
const KARBON_CLIENT_ID = 'k-cl-1';
const PERIOD = '2026-04';
const NOW = new Date('2026-05-15T15:00:00Z');

function engagement(): ClientEngagement {
  return {
    clientId: CLIENT_ID,
    clientName: 'Acme LLC',
    primaryContact: {
      name: 'Patricia Lin',
      email: 'pat.lin@acme.example.com',
      phone: null,
      role: 'controller',
    },
    ccContacts: [],
    periodMonth: PERIOD,
    scope: 'full-stack-monthly',
    internalDeadline: new Date('2026-05-20T00:00:00Z'),
    partnerSignoff: false,
  };
}

function checklist(): ChecklistItem[] {
  return [
    {
      id: 'item-bank',
      label: 'April 2026 bank statement',
      category: 'bank-statement',
      dueAt: new Date('2026-05-08T00:00:00Z'),
      required: true,
    },
  ];
}

function buildFetcher(receivedDocs: ReceivedDoc[] = []): JsonCloseFetcher {
  return new JsonCloseFetcher({
    workspaceId: WORKSPACE_ID,
    clientId: CLIENT_ID,
    periodMonth: PERIOD,
    engagement: engagement(),
    checklist: checklist(),
    receivedDocs,
  });
}

describe('month-end-close-cpa — enrichment integration', () => {
  it('drafts mention TaxDome + Karbon counts when both connectors are wired', async () => {
    const taxdomeMcp: TaxdomeMcpServer = new TestTaxdomeMcpServer({ workspaceId: WORKSPACE_ID });
    const karbonMcp: KarbonMcpServer = new TestKarbonMcpServer({ workspaceId: WORKSPACE_ID });
    const source = mcpEnrichmentSource({ taxdomeMcp, karbonMcp });

    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher: buildFetcher(),
      now: NOW,
      enrichmentSource: source,
      taxdomeClientId: TAXDOME_CLIENT_ID,
      karbonClientId: KARBON_CLIENT_ID,
    });
    assert.ok(res.ok, 'runSkill should succeed');

    const out = res.value;
    // TaxDome fixture has 1 pending-review received-doc for cl-1.
    assert.equal(out.enrichment.taxdomePendingReceived, 1);
    // Karbon fixture has 1 active workflow (wf-1) for k-cl-1 with 1
    // blocked job (job-1).
    assert.equal(out.enrichment.karbonActiveWorkflows, 1);
    assert.equal(out.enrichment.karbonBlockedJobs, 1);
    assert.equal(out.missingConnectorsNote, null, 'no missing connectors when both are wired');

    // The chase email body should reference the enrichment counts.
    assert.equal(out.chaseEmails.length, 1, 'one chase email drafted');
    const chase = out.chaseEmails[0];
    assert.ok(
      chase.body.includes('1 client doc pending review in TaxDome'),
      `expected TaxDome enrichment in chase body; got: ${chase.body.slice(0, 400)}`,
    );
    assert.ok(
      chase.body.includes('1 job currently blocked in Karbon'),
      `expected Karbon enrichment in chase body; got: ${chase.body.slice(0, 400)}`,
    );

    // The status update body should also reference the enrichment counts.
    assert.ok(
      out.statusUpdate.body.includes('1 client doc pending review in TaxDome'),
      'expected enrichment in status update body',
    );
  });

  it('honest empty-state when neither connector is wired', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher: buildFetcher(),
      now: NOW,
      // No enrichmentSource — the skill should still produce a draft
      // and the output should carry null enrichment counts.
    });
    assert.ok(res.ok);
    const out = res.value;
    assert.equal(out.enrichment.taxdomePendingReceived, null);
    assert.equal(out.enrichment.karbonBlockedJobs, null);
    // Without an enrichment source the skill doesn't fabricate a
    // missing-connector note (the note comes from the reader, not the
    // skill). This is the honest empty state — the skill is silent
    // about TaxDome/Karbon when no enrichment was attempted.
    assert.equal(out.missingConnectorsNote, null);

    assert.equal(out.chaseEmails.length, 1);
    const chase = out.chaseEmails[0];
    assert.ok(!chase.body.includes('TaxDome'), 'no TaxDome line when not wired');
    assert.ok(!chase.body.includes('Karbon'), 'no Karbon line when not wired');
  });

  it('one connector wired: drafts mention that one, missingConnectorsNote names the gap', async () => {
    // Only TaxDome — stub Karbon as not-connected by returning a
    // credential error from listWorkflows.
    const taxdomeMcp = new TestTaxdomeMcpServer({ workspaceId: WORKSPACE_ID });
    const karbonStub: KarbonMcpServer = {
      name: 'karbon-stub' as const,
      workspaceId: WORKSPACE_ID,
      async listClients() {
        return mcpOk({ clients: [] });
      },
      async getClient() {
        return mcpOk({ client: { id: 'x', name: 'x', email: null, kind: 'organization' } });
      },
      async listWorkflows(): Promise<McpResult<{ workflows: never[] }>> {
        return { ok: false, error: { code: 'CREDENTIAL_NOT_FOUND', message: 'not connected' } };
      },
      async getWorkflow() {
        return { ok: false, error: { code: 'CREDENTIAL_NOT_FOUND', message: 'not connected' } };
      },
      async listJobs() {
        return { ok: false, error: { code: 'CREDENTIAL_NOT_FOUND', message: 'not connected' } };
      },
      async listRecurringTasks() {
        return { ok: false, error: { code: 'CREDENTIAL_NOT_FOUND', message: 'not connected' } };
      },
    };

    const source = mcpEnrichmentSource({ taxdomeMcp, karbonMcp: karbonStub });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
      periodMonth: PERIOD,
      fetcher: buildFetcher(),
      now: NOW,
      enrichmentSource: source,
      taxdomeClientId: TAXDOME_CLIENT_ID,
      karbonClientId: KARBON_CLIENT_ID,
    });
    assert.ok(res.ok);
    const out = res.value;
    assert.equal(out.enrichment.taxdomePendingReceived, 1);
    assert.equal(out.enrichment.karbonBlockedJobs, null);
    assert.equal(out.enrichment.karbonActiveWorkflows, null);
    assert.ok(
      out.missingConnectorsNote && out.missingConnectorsNote.includes('Karbon'),
      `missingConnectorsNote should name Karbon; got: ${out.missingConnectorsNote}`,
    );

    const chase = out.chaseEmails[0];
    assert.ok(chase.body.includes('TaxDome'), 'TaxDome line present');
    assert.ok(!chase.body.includes('Karbon'), 'no Karbon line when not connected');
  });
});
