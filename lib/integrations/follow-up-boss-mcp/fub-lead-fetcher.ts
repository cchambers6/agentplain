/**
 * lib/integrations/follow-up-boss-mcp/fub-lead-fetcher.ts
 *
 * `LeadFetcher` implementation that pulls leads from Follow Up Boss
 * via the MCP server and maps them into agentplain's `LeadRecord` shape.
 * Plugs straight into `lib/skills/lead-triage-realestate/skill.ts`
 * without the skill importing anything FUB-shaped.
 */

import { skillError, skillOk, type SkillResult } from '@/lib/skills/types';
import type {
  AgentRoster,
  DripCampaign,
  LeadFetcher,
  LeadRecord,
} from '@/lib/skills/lead-triage-realestate/types';
import { ProdFollowUpBossMcpServer } from './server';
import { toLeadRecord } from './to-lead-record';
import type { FollowUpBossMcpServer } from './types';

export interface FubLeadFetcherOptions {
  workspaceId: string;
  /** Override the MCP server. Production binds `ProdFollowUpBossMcpServer`;
   *  tests inject `RecordingFollowUpBossMcpServer`. */
  mcp?: FollowUpBossMcpServer;
  /** Only consider FUB leads created/updated after this ISO timestamp.
   *  When omitted the fetcher pulls the most recent N leads via
   *  `listLeads` without a time filter — appropriate for the first
   *  cron fire on a workspace. */
  modifiedSince?: string;
  /** Cap on leads pulled per fire. Default 25. */
  limit?: number;
}

export class FubLeadFetcher implements LeadFetcher {
  readonly name = 'follow-up-boss' as const;
  private readonly mcp: FollowUpBossMcpServer;
  private readonly modifiedSince: string | undefined;
  private readonly limit: number;
  private readonly workspaceIdOption: string;

  constructor(options: FubLeadFetcherOptions) {
    this.workspaceIdOption = options.workspaceId;
    this.mcp =
      options.mcp ??
      new ProdFollowUpBossMcpServer({ workspaceId: options.workspaceId });
    this.modifiedSince = options.modifiedSince;
    this.limit = options.limit ?? 25;
  }

  async fetchInboundLeads(args: {
    workspaceId: string;
  }): Promise<SkillResult<LeadRecord[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `FubLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
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
          `Follow Up Boss not connected for workspace ${args.workspaceId}: ${res.error.message}`,
          res.error.code,
        );
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR', // closest existing taxonomy bucket — fetcher errors
        `Follow Up Boss listLeads failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const records = res.value.leads.map((lead) =>
      toLeadRecord({ lead, hasBeenContacted: false }),
    );
    return skillOk(records);
  }

  /**
   * FUB does NOT yet supply an agent roster through this adapter. The
   * skill receives an empty list so its routing falls back to
   * `'manual'` (the same honest behavior the ParsedMessage adapter
   * uses today, per the wave-1 router rationale in
   * lib/skills/vertical-router.ts). Wiring this up would require a
   * separate FUB tool we have not yet built — the audit calls this
   * out as a wave-4 follow-up.
   */
  async fetchAgentRoster(_args: {
    workspaceId: string;
  }): Promise<SkillResult<AgentRoster[]>> {
    return skillOk([]);
  }

  /**
   * Drip campaigns are an FUB concept (Lead Flow). We do not yet read
   * them — the skill's routing falls back to `manual` when this is
   * empty. Wave-4 follow-up.
   */
  async fetchDripCampaigns(_args: {
    workspaceId: string;
  }): Promise<SkillResult<DripCampaign[]>> {
    return skillOk([]);
  }
}
