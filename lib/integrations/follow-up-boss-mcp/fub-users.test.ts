/**
 * lib/integrations/follow-up-boss-mcp/fub-users.test.ts
 *
 * Wave-4 — pins the new `list_users` + `list_lead_lists` FUB MCP tools
 * AND the per-agent routing behavior the lead-triage skill now gets for
 * free when FUB users come back populated.
 *
 * Verifies:
 *   - listUsers returns active users by default; activeOnly=false
 *     returns the full set.
 *   - listLeadLists returns the seeded smartlists.
 *   - FubLeadFetcher.fetchAgentRoster maps FUB users → AgentRoster,
 *     passing `groups` through as `specialties`.
 *   - End-to-end: lead-triage routes a "luxury Buckhead inquiry" to the
 *     FUB user whose `groups` carry `luxury`. Pre-wave-4 this would
 *     have fallen back to `manual` because the roster was empty.
 *   - On CREDENTIAL_NOT_FOUND the fetcher returns an empty roster
 *     (graceful degrade — workspace can triage even before FUB is
 *     connected).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mcpError } from '@/lib/integrations/mcp-core';
import { RecordingFollowUpBossMcpServer } from './test-server';
import { FubLeadFetcher } from './fub-lead-fetcher';
import { runSkill } from '@/lib/skills/lead-triage-realestate/skill';
import type {
  FollowUpBossMcpServer,
  FubLeadListSummary,
  FubLeadSummary,
  FubUserSummary,
  ListLeadListsInput,
  ListLeadListsOutput,
  ListLeadsInput,
  ListLeadsOutput,
  ListUsersInput,
  ListUsersOutput,
} from './types';
import type { McpResult } from '@/lib/integrations/mcp-core';

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';

function user(overrides: Partial<FubUserSummary> = {}): FubUserSummary {
  return {
    id: 'u1',
    firstName: 'Jamie',
    lastName: 'Lin',
    email: 'jamie@example.com',
    role: 'Agent',
    active: true,
    groups: ['luxury', 'buckhead'],
    ...overrides,
  };
}

function list(overrides: Partial<FubLeadListSummary> = {}): FubLeadListSummary {
  return { id: 'l1', name: 'Cold leads — 90 day nurture', isPublic: true, ...overrides };
}

function lead(overrides: Partial<FubLeadSummary> = {}): FubLeadSummary {
  return {
    id: '101',
    firstName: 'Pat',
    lastName: 'Quinn',
    emails: ['pat@example.com'],
    phones: [],
    source: 'Zillow',
    stage: 'new',
    tags: [],
    lastActivityAt: '2026-05-29T13:00:00.000Z',
    createdAt: '2026-05-29T13:00:00.000Z',
    ...overrides,
  };
}

describe('follow-up-boss-mcp — listUsers / listLeadLists', () => {
  it('listUsers defaults to active-only', async () => {
    const mcp = new RecordingFollowUpBossMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        users: [user(), user({ id: 'u2', active: false, firstName: 'Old' })],
      },
    });
    const res = await mcp.listUsers({});
    assert.ok(res.ok);
    assert.equal(res.value.users.length, 1);
    assert.equal(res.value.users[0].firstName, 'Jamie');
  });

  it('listUsers with activeOnly=false returns inactive users too', async () => {
    const mcp = new RecordingFollowUpBossMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        users: [user(), user({ id: 'u2', active: false, firstName: 'Old' })],
      },
    });
    const res = await mcp.listUsers({ activeOnly: false });
    assert.ok(res.ok);
    assert.equal(res.value.users.length, 2);
  });

  it('listLeadLists returns seeded smartlists', async () => {
    const mcp = new RecordingFollowUpBossMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: { leadLists: [list(), list({ id: 'l2', name: 'Nurture' })] },
    });
    const res = await mcp.listLeadLists({});
    assert.ok(res.ok);
    assert.equal(res.value.lists.length, 2);
  });
});

describe('follow-up-boss-mcp — FubLeadFetcher.fetchAgentRoster maps users → roster', () => {
  it('agents come through with specialties = groups', async () => {
    const mcp = new RecordingFollowUpBossMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        users: [
          user(),
          user({
            id: 'u2',
            firstName: 'Rob',
            lastName: 'Ng',
            groups: ['first-time buyer', 'north fulton'],
          }),
        ],
      },
    });
    const fetcher = new FubLeadFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const res = await fetcher.fetchAgentRoster({ workspaceId: WORKSPACE_ID });
    assert.ok(res.ok);
    assert.equal(res.value.length, 2);
    const jamie = res.value.find((a) => a.name === 'Jamie Lin');
    assert.ok(jamie);
    assert.ok(jamie.specialties.includes('luxury'));
    assert.ok(jamie.specialties.includes('buckhead'));
    assert.equal(jamie.acceptingLeads, true);
  });

  it('CREDENTIAL_NOT_FOUND degrades to empty roster (workspace can still triage)', async () => {
    // Custom MCP that returns CREDENTIAL_NOT_FOUND on listUsers — proves
    // the fetcher does NOT propagate the error as a hard failure.
    const mcp: FollowUpBossMcpServer = {
      name: 'stub',
      workspaceId: WORKSPACE_ID,
      async listLeads(_i: ListLeadsInput): Promise<McpResult<ListLeadsOutput>> {
        return { ok: true, value: { leads: [] } };
      },
      async getLead() {
        return mcpError('NOT_FOUND', 'no');
      },
      async createNote() {
        return mcpError('NOT_FOUND', 'no');
      },
      async addTag() {
        return mcpError('NOT_FOUND', 'no');
      },
      async listPipelines() {
        return { ok: true, value: { pipelines: [] } };
      },
      async getPipelineStage() {
        return mcpError('NOT_FOUND', 'no');
      },
      async listUsers(_i: ListUsersInput): Promise<McpResult<ListUsersOutput>> {
        return mcpError('CREDENTIAL_NOT_FOUND', 'no fub key');
      },
      async listLeadLists(
        _i: ListLeadListsInput,
      ): Promise<McpResult<ListLeadListsOutput>> {
        return mcpError('CREDENTIAL_NOT_FOUND', 'no fub key');
      },
      async createLead() {
        return mcpError('NOT_IMPLEMENTED', 'no');
      },
      async sendTextTemplate() {
        return mcpError('NOT_IMPLEMENTED', 'no');
      },
      async scheduleActionPlan() {
        return mcpError('NOT_IMPLEMENTED', 'no');
      },
    };
    const fetcher = new FubLeadFetcher({ workspaceId: WORKSPACE_ID, mcp });
    const roster = await fetcher.fetchAgentRoster({ workspaceId: WORKSPACE_ID });
    assert.ok(roster.ok);
    assert.equal(roster.value.length, 0);
    const drips = await fetcher.fetchDripCampaigns({ workspaceId: WORKSPACE_ID });
    assert.ok(drips.ok);
    assert.equal(drips.value.length, 0);
  });
});

describe('lead-triage end-to-end — per-agent routing through FUB users', () => {
  it('luxury lead routes to the FUB user whose groups carry luxury', async () => {
    const mcp = new RecordingFollowUpBossMcpServer({
      workspaceId: WORKSPACE_ID,
      seed: {
        leads: [
          lead({
            firstName: 'Pat',
            lastName: 'Quinn',
          }),
        ],
        users: [
          user(), // Jamie / luxury / buckhead
          user({
            id: 'u2',
            firstName: 'Rob',
            lastName: 'Ng',
            groups: ['first-time buyer', 'north fulton'],
          }),
        ],
        leadLists: [list({ name: 'Cold leads' })],
      },
    });
    const fetcher = new FubLeadFetcher({ workspaceId: WORKSPACE_ID, mcp });
    // Override the inquiryText via a custom fetcher subclass: the
    // FubLeadFetcher derives inquiryText from the FUB person record,
    // which doesn't carry message body. For this routing assertion we
    // wrap fetchInboundLeads to seed luxury cues directly.
    const wrapped = {
      ...fetcher,
      name: 'fub-luxury-test' as const,
      fetchInboundLeads: async (args: { workspaceId: string }) => {
        const base = await fetcher.fetchInboundLeads(args);
        if (!base.ok) return base;
        return {
          ok: true as const,
          value: base.value.map((l) => ({
            ...l,
            inquiryText:
              'I am ready to buy a luxury estate in Buckhead — preapproved, looking to make an offer this month.',
            statedTimeline: 'this month',
            statedFinancing: 'preapproved',
          })),
        };
      },
      fetchAgentRoster: fetcher.fetchAgentRoster.bind(fetcher),
      fetchDripCampaigns: fetcher.fetchDripCampaigns.bind(fetcher),
    };
    const out = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher: wrapped,
    });
    assert.ok(out.ok);
    assert.equal(out.value.triaged.length, 1);
    const triaged = out.value.triaged[0];
    // Before wave-4, an empty roster would have routed to `manual`.
    // Wave-4 populates the roster from FUB users; the luxury cue + a
    // group named "luxury" on the user should route to Jamie.
    assert.equal(
      triaged.routing.type,
      'agent',
      `expected agent routing, got ${triaged.routing.type}: ${JSON.stringify(triaged.routing)}`,
    );
    if (triaged.routing.type === 'agent') {
      assert.equal(triaged.routing.agentName, 'Jamie Lin');
    }
    // The lead-triage produces a hot/warm draft for this case.
    assert.ok(['hot', 'warm'].includes(triaged.category));
  });
});
