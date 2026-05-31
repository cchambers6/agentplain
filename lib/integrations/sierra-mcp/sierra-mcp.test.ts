/**
 * lib/integrations/sierra-mcp/sierra-mcp.test.ts
 *
 * Pins the wave-4 Sierra Interactive MCP:
 *   - listLeads + getLead READ path returns the seeded leads.
 *   - createNote + addTag WRITE path captures the call AND the tag
 *     write merges with existing tags (no clobber).
 *   - listPipelines + getPipelineStage round-trip cleanly.
 *   - toLeadRecord adapter maps SierraLeadSummary → LeadRecord with
 *     a `sierra-` id prefix so downstream rows trace back to Sierra.
 *   - SierraLeadFetcher's workspaceId mismatch returns INVALID_INPUT
 *     (cold-start-safe — one fetcher per workspaceId, not globally
 *     reusable).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RecordingSierraMcpServer } from './test-server';
import { SierraLeadFetcher } from './sierra-lead-fetcher';
import { toLeadRecord } from './to-lead-record';
import type { SierraLeadSummary, SierraPipelineSummary } from './types';

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_WORKSPACE_ID = '22222222-2222-2222-2222-222222222222';

function seedLead(overrides: Partial<SierraLeadSummary> = {}): SierraLeadSummary {
  return {
    id: 'lead-1',
    firstName: 'Alex',
    lastName: 'Stone',
    emails: ['alex@example.com'],
    phones: ['+15551234567'],
    source: 'Sierra Lead Capture',
    stage: 'new',
    tags: ['from-website'],
    lastActivityAt: '2026-05-29T13:00:00.000Z',
    createdAt: '2026-05-29T13:00:00.000Z',
    ...overrides,
  };
}

function seedPipeline(
  overrides: Partial<SierraPipelineSummary> = {},
): SierraPipelineSummary {
  return {
    id: 'pipe-1',
    name: 'Buyer Pipeline',
    stages: [
      { id: 'stage-new', name: 'New', sortOrder: 1 },
      { id: 'stage-active', name: 'Active', sortOrder: 2 },
    ],
    ...overrides,
  };
}

describe('sierra-mcp — recording server (read + write)', () => {
  it('listLeads returns seeded leads + records the call', async () => {
    const mcp = new RecordingSierraMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { leads: [seedLead(), seedLead({ id: 'lead-2' })] },
    });
    const res = await mcp.listLeads({ limit: 25 });
    assert.ok(res.ok);
    assert.equal(res.value.leads.length, 2);
    assert.equal(mcp.calls[0]?.tool, 'listLeads');
  });

  it('getLead returns the seeded lead by id', async () => {
    const mcp = new RecordingSierraMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { leads: [seedLead()] },
    });
    const res = await mcp.getLead({ leadId: 'lead-1' });
    assert.ok(res.ok);
    assert.equal(res.value.lead.firstName, 'Alex');
  });

  it('createNote records the call and returns a note id', async () => {
    const mcp = new RecordingSierraMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { leads: [seedLead()] },
    });
    const res = await mcp.createNote({
      leadId: 'lead-1',
      body: 'Triaged hot — routed to Jamie',
      isPrivate: true,
    });
    assert.ok(res.ok);
    assert.match(res.value.noteId, /^sierra-note-/);
    const writeCall = mcp.calls.find((c) => c.tool === 'createNote');
    assert.ok(writeCall, 'createNote must be recorded');
  });

  it('addTag merges with existing tags (no clobber)', async () => {
    const mcp = new RecordingSierraMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { leads: [seedLead({ tags: ['from-website', 'priority'] })] },
    });
    const res = await mcp.addTag({
      leadId: 'lead-1',
      tags: ['agentplain-hot'],
    });
    assert.ok(res.ok);
    // Re-read the lead — the recording server merges the tags in-place
    // so addTag is observable on subsequent reads (matches prod
    // behavior where the read-merge-write pattern leaves the union of
    // tags on the contact).
    const after = await mcp.getLead({ leadId: 'lead-1' });
    assert.ok(after.ok);
    const tags = after.value.lead.tags;
    assert.ok(tags.includes('from-website'));
    assert.ok(tags.includes('priority'));
    assert.ok(tags.includes('agentplain-hot'));
  });

  it('listPipelines + getPipelineStage round-trip', async () => {
    const mcp = new RecordingSierraMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { pipelines: [seedPipeline()] },
    });
    const list = await mcp.listPipelines({});
    assert.ok(list.ok);
    assert.equal(list.value.pipelines[0].name, 'Buyer Pipeline');
    const stage = await mcp.getPipelineStage({
      pipelineId: 'pipe-1',
      stageId: 'stage-new',
    });
    assert.ok(stage.ok);
    assert.equal(stage.value.stage.name, 'New');
  });

  it('rejects createNote when leadId does not exist', async () => {
    const mcp = new RecordingSierraMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { leads: [] },
    });
    const res = await mcp.createNote({ leadId: 'missing', body: 'x' });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'NOT_FOUND');
  });
});

describe('sierra-mcp — toLeadRecord adapter', () => {
  it('composes full name + carries sierra- prefix on the id', () => {
    const lead = seedLead({ firstName: 'Jordan', lastName: 'Reeves' });
    const record = toLeadRecord({ lead });
    assert.equal(record.fullName, 'Jordan Reeves');
    assert.equal(record.id, 'sierra-lead-1');
    assert.equal(record.email, 'alex@example.com');
  });

  it('falls back to "Unknown lead" when first + last are null', () => {
    const lead = seedLead({ firstName: null, lastName: null });
    const record = toLeadRecord({ lead });
    assert.equal(record.fullName, 'Unknown lead');
  });

  it('maps Zillow / Realtor.com / IDX sources correctly', () => {
    assert.equal(
      toLeadRecord({ lead: seedLead({ source: 'Zillow' }) }).source,
      'zillow',
    );
    assert.equal(
      toLeadRecord({ lead: seedLead({ source: 'Realtor.com sync' }) }).source,
      'realtor-com',
    );
    assert.equal(
      toLeadRecord({ lead: seedLead({ source: 'IDX widget' }) }).source,
      'idx',
    );
  });
});

describe('sierra-mcp — SierraLeadFetcher rejects mismatched workspaceId', () => {
  it('returns INVALID_INPUT when called with a different workspaceId', async () => {
    const mcp = new RecordingSierraMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { leads: [seedLead()] },
    });
    const fetcher = new SierraLeadFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const res = await fetcher.fetchInboundLeads({
      workspaceId: OTHER_WORKSPACE_ID,
    });
    assert.ok(!res.ok);
    assert.equal(res.error.code, 'INVALID_INPUT');
  });

  it('returns mapped LeadRecords on success', async () => {
    const mcp = new RecordingSierraMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { leads: [seedLead(), seedLead({ id: 'lead-2', firstName: 'Bea' })] },
    });
    const fetcher = new SierraLeadFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const res = await fetcher.fetchInboundLeads({ workspaceId: WORKSPACE_ID });
    assert.ok(res.ok);
    assert.equal(res.value.length, 2);
    assert.equal(res.value[0].id, 'sierra-lead-1');
    assert.equal(res.value[1].fullName, 'Bea Stone');
  });
});
