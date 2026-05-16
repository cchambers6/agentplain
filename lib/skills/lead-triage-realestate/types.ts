/**
 * lib/skills/lead-triage-realestate/types.ts
 *
 * Provider-neutral types for the real-estate lead triage skill. Per
 * `feedback_no_silent_vendor_lock.md` + `feedback_runner_portability.md`:
 * the skill speaks these shapes only — Follow Up Boss / Zillow / Gmail
 * SDKs stay behind the ports defined below.
 *
 * Per `project_no_outbound_architecture.md`: the skill produces a draft
 * first-touch reply. It does NOT send. The broker's system reviews and
 * sends from their own client.
 */

import type { SkillResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────

export type LeadSource =
  | 'zillow'
  | 'realtor-com'
  | 'idx'
  | 'referral'
  | 'open-house'
  | 'sphere'
  | 'cold-inbound'
  | 'other';

/**
 * One inbound real-estate lead. Production wiring populates this from
 * the Follow Up Boss MCP (TODO: not yet built — accepts the same shape
 * as a JSON payload today).
 *
 * Modeled on the FUB Lead schema and the real-estate JTBD analysis in
 * `lib/verticals/real-estate/content.ts` (broker-owner BO-1..BO-8 +
 * individual agent IA-1..IA-6).
 */
export interface LeadRecord {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  /** Free-text inquiry message — what the lead actually wrote. */
  inquiryText: string;
  /** Subject line the lead's email used, if applicable. */
  inquirySubject: string | null;
  /** Property the lead is interested in. May be a specific listing
   *  (MLS#, address) or "buyer" / "seller" intent without an anchor. */
  propertyContext: {
    type: 'specific-listing' | 'buyer-search' | 'seller-cma' | 'general';
    /** MLS# when known. */
    mlsNumber: string | null;
    /** Address text the lead referenced. */
    addressText: string | null;
  };
  /** Lead-stated timeline. Capture verbatim so the skill can rescore
   *  later without re-asking. */
  statedTimeline: string | null;
  /** Lead-stated financing posture. "preapproved", "cash", "needs preapproval", etc. */
  statedFinancing: string | null;
  /** When the lead came into the system. */
  receivedAt: Date;
  /** Whether the lead already touched a teammate (drives "first touch"
   *  vs. "follow-up" copy). */
  hasBeenContacted: boolean;
}

export interface AgentRoster {
  /** Agent id matching the workspace's user list. */
  id: string;
  /** Agent's display name. */
  name: string;
  /** Specialties the lead-routing logic respects ("luxury", "first-time
   *  buyer", "investment", "land", "commercial", "relocation"). */
  specialties: string[];
  /** Service area, in any free-form anchor the broker uses ("Atlanta
   *  intown", "North Fulton", "Cobb / Cherokee"). */
  serviceArea: string;
  /** Whether the agent is currently accepting new leads. */
  acceptingLeads: boolean;
}

export interface DripCampaign {
  id: string;
  name: string;
  /** Which lead category this campaign serves. */
  audience: 'nurture' | 'cold' | 'cma-followup' | 'general';
}

/**
 * Port the skill uses to fetch lead data. Production binds the Follow
 * Up Boss MCP; tests bind `JsonLeadFetcher`.
 *
 * Per `feedback_runner_portability.md` rule 3 (two-impl): ships with
 * `JsonLeadFetcher` so the interface is honest.
 */
export interface LeadFetcher {
  readonly name: string;
  fetchInboundLeads(args: { workspaceId: string }): Promise<SkillResult<LeadRecord[]>>;
  fetchAgentRoster(args: { workspaceId: string }): Promise<SkillResult<AgentRoster[]>>;
  fetchDripCampaigns(args: { workspaceId: string }): Promise<SkillResult<DripCampaign[]>>;
}

// ── Output shapes ────────────────────────────────────────────────────────

export type LeadCategory = 'hot' | 'warm' | 'cold' | 'nurture';

export interface LeadScores {
  /** 0–1. How strong the motivation signal in the message is. */
  motivation: number;
  /** 0–1. Timeline urgency — short timelines + active language score high. */
  timeline: number;
  /** 0–1. Financing certainty — preapproved/cash scores high. */
  preapproval: number;
  /** Composite score used to pick the category (motivation*0.4 +
   *  timeline*0.4 + preapproval*0.2). Stable across runs. */
  composite: number;
}

export type LeadRouting =
  | { type: 'agent'; agentId: string; agentName: string; rationale: string }
  | { type: 'drip'; campaignId: string; campaignName: string; rationale: string }
  | { type: 'manual'; rationale: string };

export interface LeadFirstTouchDraft {
  draftId: string;
  providerDraftId: string | null;
  subject: string;
  body: string;
  tone: 'casual' | 'formal' | 'technical';
  confidence: number;
  persisted: boolean;
}

export interface TriagedLead {
  leadId: string;
  leadName: string;
  scores: LeadScores;
  category: LeadCategory;
  routing: LeadRouting;
  firstTouchDraft: LeadFirstTouchDraft | null;
  /** When the lead is missing email — we still triage, but can't draft. */
  draftSkippedReason: 'missing-email' | null;
}

export interface LeadTriageOutput {
  processed: number;
  triaged: TriagedLead[];
  categoryCounts: Record<LeadCategory, number>;
}

export interface LeadTriageInput {
  workspaceId: string;
  fetcher: LeadFetcher;
  persister?: import('../types').DraftPersister | null;
  /** Below this confidence, drafts are returned but NOT persisted.
   *  Default 0.5 — matches `lib/skills/draft.ts`. */
  persistThreshold?: number;
  now?: Date;
  /** Override the category thresholds. Defaults: hot ≥ 0.7, warm ≥ 0.45,
   *  cold ≥ 0.20, nurture < 0.20. */
  thresholds?: {
    hot?: number;
    warm?: number;
    cold?: number;
  };
}

// ── Scoring + bucketing ─────────────────────────────────────────────────

export const DEFAULT_HOT_THRESHOLD = 0.7;
export const DEFAULT_WARM_THRESHOLD = 0.45;
export const DEFAULT_COLD_THRESHOLD = 0.2;

export function categoryFor(
  composite: number,
  thresholds: LeadTriageInput['thresholds'] = {},
): LeadCategory {
  const hot = thresholds.hot ?? DEFAULT_HOT_THRESHOLD;
  const warm = thresholds.warm ?? DEFAULT_WARM_THRESHOLD;
  const cold = thresholds.cold ?? DEFAULT_COLD_THRESHOLD;
  if (composite >= hot) return 'hot';
  if (composite >= warm) return 'warm';
  if (composite >= cold) return 'cold';
  return 'nurture';
}
