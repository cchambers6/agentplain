/**
 * lib/integrations/hubspot-mcp/hubspot-lead-fetcher.ts
 *
 * `LeadFetcher` implementation that pulls leads (HubSpot contacts) via
 * the MCP server and maps them into agentplain's `LeadRecord` shape.
 * Plugs straight into `lib/skills/lead-triage-realestate/skill.ts`
 * without the skill importing anything HubSpot-shaped.
 *
 * Universal — HubSpot is `vertical: ['all']`, so this fetcher serves any
 * workspace that wants HubSpot-to-triage routing, not just realty.
 */

import { skillError, skillOk, type SkillResult } from '@/lib/skills/types';
import type {
  AgentRoster,
  DripCampaign,
  LeadFetcher,
  LeadRecord,
} from '@/lib/skills/lead-triage-realestate/types';
import { ProdHubspotMcpServer } from './server';
import { toLeadRecord } from './to-lead-record';
import type { HubspotMcpServer } from './types';

export interface HubspotLeadFetcherOptions {
  workspaceId: string;
  mcp?: HubspotMcpServer;
  modifiedSince?: string;
  limit?: number;
}

export class HubspotLeadFetcher implements LeadFetcher {
  readonly name = 'hubspot' as const;
  private readonly mcp: HubspotMcpServer;
  private readonly modifiedSince: string | undefined;
  private readonly limit: number;
  private readonly workspaceIdOption: string;

  constructor(options: HubspotLeadFetcherOptions) {
    this.workspaceIdOption = options.workspaceId;
    this.mcp =
      options.mcp ?? new ProdHubspotMcpServer({ workspaceId: options.workspaceId });
    this.modifiedSince = options.modifiedSince;
    this.limit = options.limit ?? 25;
  }

  async fetchInboundLeads(args: {
    workspaceId: string;
  }): Promise<SkillResult<LeadRecord[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `HubspotLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
      );
    }
    const res = await this.mcp.listContacts({
      limit: this.limit,
      modifiedSince: this.modifiedSince,
    });
    if (!res.ok) {
      if (res.error.code === 'CREDENTIAL_NOT_FOUND') {
        return skillError(
          'NOT_CONFIGURED',
          `HubSpot not connected for workspace ${args.workspaceId}: ${res.error.message}`,
          res.error.code,
        );
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `HubSpot listContacts failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const records = res.value.contacts.map((contact) =>
      toLeadRecord({ contact, hasBeenContacted: false }),
    );
    return skillOk(records);
  }

  /** HubSpot exposes users via /crm/v3/owners but agent-roster routing in
   *  the realty triage skill is a downstream concern; wave-7 ships with
   *  an empty roster so the skill falls back to `manual` routing. The
   *  hook stays here so a future wave can populate it without touching
   *  the lead-triage seam. */
  async fetchAgentRoster(args: { workspaceId: string }): Promise<SkillResult<AgentRoster[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `HubspotLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
      );
    }
    return skillOk([]);
  }

  /** HubSpot's marketing campaigns are an Enterprise tier feature with a
   *  different shape than drip campaigns. Wave-7 ships an empty list;
   *  triage falls back to per-category default routing. */
  async fetchDripCampaigns(args: { workspaceId: string }): Promise<SkillResult<DripCampaign[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `HubspotLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
      );
    }
    return skillOk([]);
  }
}
