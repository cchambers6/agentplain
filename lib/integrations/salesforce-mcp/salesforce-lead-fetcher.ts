/**
 * lib/integrations/salesforce-mcp/salesforce-lead-fetcher.ts
 *
 * `LeadFetcher` implementation that pulls leads from Salesforce via the
 * MCP server and maps them into agentplain's `LeadRecord` shape.
 * Plugs into `lib/skills/lead-triage-realestate/skill.ts` without the
 * skill importing anything Salesforce-shaped.
 */

import { skillError, skillOk, type SkillResult } from '@/lib/skills/types';
import type {
  AgentRoster,
  DripCampaign,
  LeadFetcher,
  LeadRecord,
} from '@/lib/skills/lead-triage-realestate/types';
import { ProdSalesforceMcpServer } from './server';
import { toLeadRecord } from './to-lead-record';
import type { SalesforceMcpServer } from './types';

export interface SalesforceLeadFetcherOptions {
  workspaceId: string;
  mcp?: SalesforceMcpServer;
  modifiedSince?: string;
  limit?: number;
}

export class SalesforceLeadFetcher implements LeadFetcher {
  readonly name = 'salesforce' as const;
  private readonly mcp: SalesforceMcpServer;
  private readonly modifiedSince: string | undefined;
  private readonly limit: number;
  private readonly workspaceIdOption: string;

  constructor(options: SalesforceLeadFetcherOptions) {
    this.workspaceIdOption = options.workspaceId;
    this.mcp =
      options.mcp ?? new ProdSalesforceMcpServer({ workspaceId: options.workspaceId });
    this.modifiedSince = options.modifiedSince;
    this.limit = options.limit ?? 25;
  }

  async fetchInboundLeads(args: { workspaceId: string }): Promise<SkillResult<LeadRecord[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `SalesforceLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
      );
    }
    const res = await this.mcp.listLeads({
      limit: this.limit,
      modifiedSince: this.modifiedSince,
    });
    if (!res.ok) {
      if (res.error.code === 'CREDENTIAL_NOT_FOUND') {
        return skillError(
          'NOT_CONFIGURED',
          `Salesforce not connected for workspace ${args.workspaceId}: ${res.error.message}`,
          res.error.code,
        );
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `Salesforce listLeads failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const records = res.value.leads.map((lead) =>
      toLeadRecord({ lead, hasBeenContacted: false }),
    );
    return skillOk(records);
  }

  /** Salesforce users live in the User sObject — agent-roster routing in
   *  the realty triage skill is a downstream concern; wave-7 ships with
   *  an empty roster so the skill falls back to `manual` routing. */
  async fetchAgentRoster(args: { workspaceId: string }): Promise<SkillResult<AgentRoster[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `SalesforceLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
      );
    }
    return skillOk([]);
  }

  /** Salesforce Campaign sObject is an Enterprise feature; wave-7 ships
   *  an empty list and the triage skill falls back to default routing. */
  async fetchDripCampaigns(args: { workspaceId: string }): Promise<SkillResult<DripCampaign[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `SalesforceLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
      );
    }
    return skillOk([]);
  }
}
