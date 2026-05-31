/**
 * lib/integrations/sierra-mcp/sierra-lead-fetcher.ts
 *
 * `LeadFetcher` implementation that pulls leads from Sierra Interactive
 * via the MCP server and maps them into agentplain's `LeadRecord` shape.
 * Plugs straight into `lib/skills/lead-triage-realestate/skill.ts`
 * without the skill importing anything Sierra-shaped.
 */

import { skillError, skillOk, type SkillResult } from '@/lib/skills/types';
import type {
  AgentRoster,
  DripCampaign,
  LeadFetcher,
  LeadRecord,
} from '@/lib/skills/lead-triage-realestate/types';
import { ProdSierraMcpServer } from './server';
import { toLeadRecord } from './to-lead-record';
import type { SierraMcpServer } from './types';

export interface SierraLeadFetcherOptions {
  workspaceId: string;
  /** Override the MCP server. Production binds `ProdSierraMcpServer`;
   *  tests inject `RecordingSierraMcpServer`. */
  mcp?: SierraMcpServer;
  modifiedSince?: string;
  limit?: number;
}

export class SierraLeadFetcher implements LeadFetcher {
  readonly name = 'sierra-interactive' as const;
  private readonly mcp: SierraMcpServer;
  private readonly modifiedSince: string | undefined;
  private readonly limit: number;
  private readonly workspaceIdOption: string;

  constructor(options: SierraLeadFetcherOptions) {
    this.workspaceIdOption = options.workspaceId;
    this.mcp =
      options.mcp ??
      new ProdSierraMcpServer({ workspaceId: options.workspaceId });
    this.modifiedSince = options.modifiedSince;
    this.limit = options.limit ?? 25;
  }

  async fetchInboundLeads(args: {
    workspaceId: string;
  }): Promise<SkillResult<LeadRecord[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `SierraLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
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
          `Sierra Interactive not connected for workspace ${args.workspaceId}: ${res.error.message}`,
          res.error.code,
        );
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `Sierra listLeads failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const records = res.value.leads.map((lead) =>
      toLeadRecord({ lead, hasBeenContacted: false }),
    );
    return skillOk(records);
  }

  async fetchAgentRoster(_args: {
    workspaceId: string;
  }): Promise<SkillResult<AgentRoster[]>> {
    // Sierra exposes a `users` endpoint, but the MCP tool surface this
    // fetcher consumes does not include it (lead-triage routes to
    // `manual` until a per-agent routing wave-5 follow-up). Returning
    // empty is the honest behavior — matches the FUB fetcher's stance.
    return skillOk([]);
  }

  async fetchDripCampaigns(_args: {
    workspaceId: string;
  }): Promise<SkillResult<DripCampaign[]>> {
    return skillOk([]);
  }
}
