/**
 * lib/skills/lead-triage-realestate/parsed-message-fetcher.ts
 *
 * Third implementation of `LeadFetcher` — bridges an inbound email
 * `ParsedMessage` into the lead-triage skill's input shape. Used by the
 * wave-1 vertical webhook router so every inbound message on a real-
 * estate workspace flows through the lead-triage skill alongside the
 * generic chain.
 *
 * Per `feedback_runner_portability.md` two-implementation rule the
 * port is already real (JsonLeadFetcher); this is the third impl that
 * speaks to a different upstream shape.
 *
 * Per `feedback_no_silent_vendor_lock.md`: nothing in here calls Gmail
 * / Outlook / FUB / Sierra SDKs. The adapter takes ParsedMessage
 * objects the email MCP already decoded and reshapes them into
 * LeadRecord[] for the triage skill.
 *
 * HONESTY BAR — what email gives us vs. what FUB / kvCORE give us:
 *
 *   AGENT ROSTER — empty. We don't have a workspace-level agent
 *     roster source yet; that lands when FUB / kvCORE MCPs ship.
 *     Triaged leads route to `manual` until then.
 *
 *   DRIP CAMPAIGNS — empty. Same reason.
 *
 *   LEAD SOURCE — heuristic. If the sender domain matches `zillow.com`
 *     or `realtor.com` we tag the source; otherwise `cold-inbound`.
 *
 *   PROPERTY CONTEXT — heuristic. We scan the subject + body for an
 *     "MLS" reference; if found we tag `specific-listing`. Otherwise
 *     `general`.
 *
 *   STATED TIMELINE / FINANCING — null. The skill scores around their
 *     absence; an operator who reviews can fill them in.
 *
 * The honesty seam: every triaged lead lands `routing.type='manual'`
 * until an agent-roster source connects. That's better than fake-
 * routing to a hardcoded agent.
 */

import { skillOk, type SkillResult } from '../types';
import type {
  AgentRoster,
  DripCampaign,
  LeadFetcher,
  LeadRecord,
  LeadSource,
} from './types';
import type { ParsedMessage } from '../types';

export interface ParsedMessageLeadFetcherSeed {
  workspaceId: string;
  messages: ParsedMessage[];
}

export class ParsedMessageLeadFetcher implements LeadFetcher {
  readonly name = 'parsed-message' as const;
  constructor(private readonly seed: ParsedMessageLeadFetcherSeed) {}

  async fetchInboundLeads(args: {
    workspaceId: string;
  }): Promise<SkillResult<LeadRecord[]>> {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillOk([]);
    }
    const leads = this.seed.messages
      .map((m) => toLeadRecord(m))
      .filter((l): l is LeadRecord => l !== null);
    return skillOk(leads);
  }

  async fetchAgentRoster(_args: {
    workspaceId: string;
  }): Promise<SkillResult<AgentRoster[]>> {
    // No workspace-level agent roster yet — wires when FUB / kvCORE MCP
    // lands. Triaged leads route to `manual` per the honesty bar.
    return skillOk([]);
  }

  async fetchDripCampaigns(_args: {
    workspaceId: string;
  }): Promise<SkillResult<DripCampaign[]>> {
    return skillOk([]);
  }
}

/** Map one ParsedMessage to a LeadRecord. Returns null when the message
 *  is clearly not a lead (no body, no sender email, very large body
 *  suggests it's a thread digest, etc.). */
export function toLeadRecord(m: ParsedMessage): LeadRecord | null {
  if (!m.fromEmail || m.fromEmail.trim().length === 0) return null;
  if (!m.bodyText || m.bodyText.trim().length === 0) return null;
  // Cheap "is this a thread digest / no-reply notice" filter — sender
  // patterns we know are NOT leads. Office-admin already triages most
  // of these; this is defense-in-depth.
  const lowerFrom = m.fromEmail.toLowerCase();
  if (
    lowerFrom.startsWith('no-reply@') ||
    lowerFrom.startsWith('noreply@') ||
    lowerFrom.startsWith('do-not-reply@') ||
    lowerFrom.startsWith('donotreply@')
  ) {
    return null;
  }
  return {
    id: m.id,
    fullName: m.fromName ?? m.fromEmail,
    email: m.fromEmail,
    phone: null,
    source: inferSource(m),
    inquiryText: m.bodyText,
    inquirySubject: m.subject || null,
    propertyContext: inferPropertyContext(m),
    statedTimeline: null,
    statedFinancing: null,
    receivedAt: m.receivedAt,
    hasBeenContacted: false,
  };
}

function inferSource(m: ParsedMessage): LeadSource {
  const domain = m.fromEmail.split('@')[1]?.toLowerCase() ?? '';
  if (domain.endsWith('zillow.com')) return 'zillow';
  if (domain.endsWith('realtor.com')) return 'realtor-com';
  if (domain.endsWith('homes.com')) return 'other';
  return 'cold-inbound';
}

function inferPropertyContext(m: ParsedMessage): LeadRecord['propertyContext'] {
  const haystack = `${m.subject} ${m.bodyText}`;
  // Look for an MLS-style id (FMLS / GAMLS / etc.) — `MLS# 1234567` or
  // `MLS 1234567` are the common formats. Generic — no vertical-specific
  // MLS provider assumed.
  const mlsMatch = haystack.match(/MLS\s*#?\s*(\d{5,9})/i);
  if (mlsMatch) {
    return {
      type: 'specific-listing',
      mlsNumber: mlsMatch[1],
      addressText: null,
    };
  }
  return { type: 'general', mlsNumber: null, addressText: null };
}
