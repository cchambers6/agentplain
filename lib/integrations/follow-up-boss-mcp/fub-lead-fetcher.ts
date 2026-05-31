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
   * Wave-4 — populates the agent roster from FUB's `users` endpoint.
   * Each active user becomes one `AgentRoster` row; the user's `groups`
   * surface as `specialties`. Lead-triage uses specialty matching to
   * route to the right agent based on the lead's inquiry.
   *
   * Returns an empty list on CREDENTIAL_NOT_FOUND so the workspace can
   * triage leads even before FUB is connected — routing falls back to
   * `manual`, matching the pre-wave-4 behavior.
   */
  async fetchAgentRoster(args: {
    workspaceId: string;
  }): Promise<SkillResult<AgentRoster[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `FubLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
      );
    }
    const res = await this.mcp.listUsers({ activeOnly: true, limit: 100 });
    if (!res.ok) {
      if (res.error.code === 'CREDENTIAL_NOT_FOUND') {
        return skillOk([]);
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `Follow Up Boss listUsers failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const roster: AgentRoster[] = res.value.users
      .filter(
        (u) =>
          u.role === null ||
          u.role.toLowerCase().includes('agent') ||
          u.role.toLowerCase().includes('owner') ||
          u.role.toLowerCase().includes('broker'),
      )
      .map((u) => {
        const name = composeFullName(u.firstName, u.lastName, u.email);
        // Treat each FUB group as both a specialty AND the service
        // area when no dedicated tag carries the area. Brokerages
        // typically use groups for territory ("Buckhead", "North
        // Fulton") + specialty ("luxury", "first-time buyer"); we
        // pass the whole set through and let the skill match by
        // substring inclusion.
        return {
          id: `fub-user-${u.id}`,
          name,
          specialties: u.groups.map((g) => g.toLowerCase()),
          serviceArea: u.groups.join(', ') || 'unspecified',
          acceptingLeads: true,
        };
      });
    return skillOk(roster);
  }

  /**
   * Wave-4 — populates drip campaigns from FUB's `smartLists` (lead-list)
   * endpoint. Each public list becomes one `DripCampaign` row. List
   * names are matched heuristically to the LeadCategory audience the
   * skill expects (nurture / cold / cma-followup / general).
   */
  async fetchDripCampaigns(args: {
    workspaceId: string;
  }): Promise<SkillResult<DripCampaign[]>> {
    if (args.workspaceId !== this.workspaceIdOption) {
      return skillError(
        'INVALID_INPUT',
        `FubLeadFetcher: workspaceId mismatch (constructed for ${this.workspaceIdOption}, called with ${args.workspaceId})`,
      );
    }
    const res = await this.mcp.listLeadLists({ limit: 100 });
    if (!res.ok) {
      if (res.error.code === 'CREDENTIAL_NOT_FOUND') {
        return skillOk([]);
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `Follow Up Boss listLeadLists failed: ${res.error.message}`,
        res.error.code,
      );
    }
    const campaigns: DripCampaign[] = res.value.lists
      .filter((l) => l.isPublic)
      .map((l) => ({
        id: `fub-list-${l.id}`,
        name: l.name,
        audience: inferAudience(l.name),
      }));
    return skillOk(campaigns);
  }
}

function composeFullName(
  first: string | null,
  last: string | null,
  emailFallback: string | null,
): string {
  const trimmed = [first, last]
    .map((s) => s?.trim() ?? '')
    .filter(Boolean);
  if (trimmed.length > 0) return trimmed.join(' ');
  if (emailFallback) return emailFallback;
  return 'FUB agent';
}

function inferAudience(name: string): DripCampaign['audience'] {
  const lower = name.toLowerCase();
  if (lower.includes('nurture') || lower.includes('long-term')) return 'nurture';
  if (lower.includes('cold')) return 'cold';
  if (lower.includes('cma') || lower.includes('seller')) return 'cma-followup';
  return 'general';
}
