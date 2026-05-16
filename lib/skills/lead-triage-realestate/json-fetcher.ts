/**
 * lib/skills/lead-triage-realestate/json-fetcher.ts
 *
 * Second implementation of `LeadFetcher`. Accepts pre-loaded JSON
 * (the same shape the Follow Up Boss MCP will return when built) and
 * serves it. Used by tests today and by manual JSON imports while the
 * MCP is in flight.
 *
 * Per `feedback_runner_portability.md` rule 3.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  AgentRoster,
  DripCampaign,
  LeadFetcher,
  LeadRecord,
} from './types';

export interface JsonLeadFetcherSeed {
  workspaceId: string;
  leads: LeadRecord[];
  agents: AgentRoster[];
  campaigns: DripCampaign[];
}

export class JsonLeadFetcher implements LeadFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonLeadFetcherSeed) {}

  async fetchInboundLeads(args: { workspaceId: string }): Promise<SkillResult<LeadRecord[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonLeadFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    return skillOk(this.seed.leads);
  }

  async fetchAgentRoster(args: { workspaceId: string }): Promise<SkillResult<AgentRoster[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonLeadFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    return skillOk(this.seed.agents);
  }

  async fetchDripCampaigns(args: { workspaceId: string }): Promise<SkillResult<DripCampaign[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonLeadFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    return skillOk(this.seed.campaigns);
  }
}
