/**
 * lib/skills/lead-triage-realestate/skill.ts
 *
 * Vertical-specific workflow: triage inbound real-estate leads (Zillow,
 * Realtor.com, IDX, referrals, sphere). The skill scores each lead on
 * three signals — motivation, timeline, preapproval — buckets them
 * hot / warm / cold / nurture, picks a routing path (specific agent vs.
 * drip campaign), and drafts a first-touch reply using real-estate
 * vernacular.
 *
 * Per `project_no_outbound_architecture.md`: drafts only. The persister
 * writes to the broker's email-drafts folder via the provider-neutral
 * port. No `send` method appears anywhere in this skill.
 *
 * Per `feedback_no_silent_vendor_lock.md`: no FUB / Zillow / Gmail SDK
 * imports in this file. The skill speaks `LeadFetcher` + `DraftPersister`.
 *
 * Per `feedback_no_quick_fixes.md`: scoring is deterministic with cited
 * rules (see `scoreLead` below). The first-touch draft contains
 * real-estate-specific opener language — preapproval, MLS#, showing —
 * not a generic "thanks for reaching out" template.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type DraftPersister, type SkillResult } from '../types';
import {
  categoryFor,
  type AgentRoster,
  type DripCampaign,
  type LeadCategory,
  type LeadFirstTouchDraft,
  type LeadRecord,
  type LeadRouting,
  type LeadScores,
  type LeadTriageInput,
  type LeadTriageOutput,
  type TriagedLead,
} from './types';

const DEFAULT_PERSIST_THRESHOLD = 0.5;

export async function runSkill(
  input: LeadTriageInput,
): Promise<SkillResult<LeadTriageOutput>> {
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;

  const leadsRes = await input.fetcher.fetchInboundLeads({
    workspaceId: input.workspaceId,
  });
  if (!leadsRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `lead fetcher (${input.fetcher.name}) failed: ${leadsRes.error.message}`,
      leadsRes.error.code,
    );
  }
  const agentsRes = await input.fetcher.fetchAgentRoster({
    workspaceId: input.workspaceId,
  });
  if (!agentsRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `agent roster fetch failed: ${agentsRes.error.message}`,
      agentsRes.error.code,
    );
  }
  const campaignsRes = await input.fetcher.fetchDripCampaigns({
    workspaceId: input.workspaceId,
  });
  if (!campaignsRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `drip campaign fetch failed: ${campaignsRes.error.message}`,
      campaignsRes.error.code,
    );
  }

  const leads = leadsRes.value;
  const agents = agentsRes.value;
  const campaigns = campaignsRes.value;

  const triaged: TriagedLead[] = [];
  for (const lead of leads) {
    const scores = scoreLead(lead);
    const category = categoryFor(scores.composite, input.thresholds);
    const routing = pickRouting({ lead, category, agents, campaigns });
    let firstTouchDraft: LeadFirstTouchDraft | null = null;
    let draftSkippedReason: TriagedLead['draftSkippedReason'] = null;
    if (!lead.email) {
      draftSkippedReason = 'missing-email';
    } else {
      const draft = renderFirstTouchDraft({ lead, category, routing });
      if (input.persister && draft.confidence >= persistThreshold) {
        firstTouchDraft = await persistDraft(input.persister, {
          workspaceId: input.workspaceId,
          lead,
          draft,
        });
      } else {
        firstTouchDraft = draft;
      }
    }
    triaged.push({
      leadId: lead.id,
      leadName: lead.fullName,
      scores,
      category,
      routing,
      firstTouchDraft,
      draftSkippedReason,
    });
  }

  const categoryCounts: Record<LeadCategory, number> = {
    hot: 0,
    warm: 0,
    cold: 0,
    nurture: 0,
  };
  for (const t of triaged) categoryCounts[t.category] += 1;

  return skillOk({
    processed: leads.length,
    triaged,
    categoryCounts,
  });
}

// ── Scoring ─────────────────────────────────────────────────────────────

/**
 * Deterministic scoring with cited rules. Each signal is a keyword-based
 * scorer over the lead's inquiry text + structured fields. Order of
 * rules matches the JTBD framing in `lib/verticals/real-estate/content.ts`
 * — motivation (intent strength), timeline (urgency), preapproval
 * (financing certainty).
 *
 * The composite weighting (motivation 0.4, timeline 0.4, preapproval 0.2)
 * reflects how real-estate brokers actually triage: a strong intent + a
 * tight timeline beats preapproval alone (a cash buyer with no urgency
 * is still cold).
 */
export function scoreLead(lead: LeadRecord): LeadScores {
  const text = `${lead.inquirySubject ?? ''} ${lead.inquiryText}`.toLowerCase();

  // Motivation: explicit verbs ("buy", "tour", "see this", "make an
  // offer") + property anchors ("the property at...", MLS#, address).
  let motivation = 0;
  if (text.includes('make an offer') || text.includes('write an offer')) motivation += 0.5;
  if (text.includes('tour') || text.includes('schedule a showing') || text.includes('see this'))
    motivation += 0.35;
  if (text.includes('interested in') || text.includes('looking at')) motivation += 0.2;
  if (text.includes('serious') || text.includes('ready to buy') || text.includes('ready to sell'))
    motivation += 0.3;
  if (lead.propertyContext.type === 'specific-listing') motivation += 0.15;
  if (lead.propertyContext.mlsNumber) motivation += 0.1;
  if (lead.source === 'referral') motivation += 0.2; // referrals weight higher
  if (text.includes('just browsing') || text.includes('not in a rush')) motivation -= 0.3;
  motivation = clamp01(motivation);

  // Timeline: explicit windows + urgency words.
  let timeline = 0;
  const statedTimeline = (lead.statedTimeline ?? '').toLowerCase();
  if (statedTimeline.includes('asap') || statedTimeline.includes('this week')) timeline += 0.55;
  if (statedTimeline.includes('30 days') || statedTimeline.includes('this month')) timeline += 0.4;
  if (statedTimeline.includes('60 days') || statedTimeline.includes('next month')) timeline += 0.3;
  if (statedTimeline.includes('3 months') || statedTimeline.includes('this quarter')) timeline += 0.2;
  if (statedTimeline.includes('6 months') || statedTimeline.includes('end of year')) timeline += 0.1;
  if (statedTimeline.includes('year') || statedTimeline.includes('someday')) timeline += 0.05;
  if (text.includes('urgent') || text.includes('asap')) timeline += 0.2;
  if (text.includes('relocating') || text.includes('starting a new job')) timeline += 0.2;
  if (text.includes('just exploring') || text.includes('no rush')) timeline -= 0.3;
  if (timeline === 0) timeline = 0.2; // unknown — default modest, not zero
  timeline = clamp01(timeline);

  // Preapproval: financing posture.
  let preapproval = 0;
  const fin = (lead.statedFinancing ?? '').toLowerCase();
  if (fin.includes('cash') || fin.includes('all cash')) preapproval = 1.0;
  else if (fin.includes('preapproved') || fin.includes('pre-approved')) preapproval = 0.85;
  else if (fin.includes('underwriting') || fin.includes('approved')) preapproval = 0.7;
  else if (fin.includes('prequalified') || fin.includes('pre-qualified')) preapproval = 0.5;
  else if (fin.includes('working with a lender')) preapproval = 0.4;
  else if (fin.includes('need preapproval') || fin.includes('not preapproved')) preapproval = 0.15;
  else preapproval = 0.25; // unknown
  if (text.includes('cash offer')) preapproval = Math.max(preapproval, 0.95);
  preapproval = clamp01(preapproval);

  const composite = motivation * 0.4 + timeline * 0.4 + preapproval * 0.2;
  return {
    motivation: round2(motivation),
    timeline: round2(timeline),
    preapproval: round2(preapproval),
    composite: round2(composite),
  };
}

// ── Routing ─────────────────────────────────────────────────────────────

interface RoutingArgs {
  lead: LeadRecord;
  category: LeadCategory;
  agents: AgentRoster[];
  campaigns: DripCampaign[];
}

function pickRouting(args: RoutingArgs): LeadRouting {
  const { lead, category, agents, campaigns } = args;
  // Hot + warm leads route to a specific agent when one is available.
  // Cold + nurture route to a drip campaign — broker time is too
  // expensive for prospects > 6 months out.
  if (category === 'hot' || category === 'warm') {
    const matched = pickBestAgent(lead, agents);
    if (matched) {
      return {
        type: 'agent',
        agentId: matched.agent.id,
        agentName: matched.agent.name,
        rationale: matched.rationale,
      };
    }
    // No accepting agent — escalate to manual broker review.
    return {
      type: 'manual',
      rationale:
        'Hot/warm lead with no accepting agent on the roster — broker-owner triage required.',
    };
  }
  // Cold / nurture — pick a drip campaign.
  const audienceWanted: DripCampaign['audience'] =
    category === 'cold' ? 'cold' : 'nurture';
  const fallback = campaigns.find((c) => c.audience === audienceWanted) ??
    campaigns.find((c) => c.audience === 'general');
  if (fallback) {
    return {
      type: 'drip',
      campaignId: fallback.id,
      campaignName: fallback.name,
      rationale: `${category} lead — routed to drip campaign for "${fallback.audience}" audience.`,
    };
  }
  return {
    type: 'manual',
    rationale: `${category} lead but no matching drip campaign — operator should configure one.`,
  };
}

function pickBestAgent(
  lead: LeadRecord,
  roster: AgentRoster[],
): { agent: AgentRoster; rationale: string } | null {
  const accepting = roster.filter((a) => a.acceptingLeads);
  if (accepting.length === 0) return null;
  // Specialty match — luxury / investor / first-time buyer / land /
  // commercial / relocation. Real-estate-specific specialties only.
  const specialty = inferSpecialty(lead);
  if (specialty) {
    const match = accepting.find((a) =>
      a.specialties.map((s) => s.toLowerCase()).includes(specialty),
    );
    if (match) {
      return {
        agent: match,
        rationale: `Specialty match: ${match.name} carries "${specialty}" specialty per the roster.`,
      };
    }
  }
  // Round-robin fallback by lexicographic id — deterministic for tests
  // and gives the broker a predictable allocation surface.
  const sorted = [...accepting].sort((a, b) => a.id.localeCompare(b.id));
  return {
    agent: sorted[0],
    rationale:
      `No specialty match in roster; assigned by deterministic round-robin to ${sorted[0].name}.`,
  };
}

function inferSpecialty(lead: LeadRecord): string | null {
  const text = `${lead.inquirySubject ?? ''} ${lead.inquiryText}`.toLowerCase();
  if (text.includes('first home') || text.includes('first-time')) return 'first-time buyer';
  if (text.includes('investment') || text.includes('rental') || text.includes('investor'))
    return 'investment';
  if (text.includes('relocating') || text.includes('moving from')) return 'relocation';
  if (text.includes('land') || text.includes('acreage')) return 'land';
  if (text.includes('commercial')) return 'commercial';
  if (
    text.includes('luxury') ||
    text.includes('estate') ||
    text.includes('million') ||
    text.includes('high-end')
  )
    return 'luxury';
  return null;
}

// ── Draft rendering ─────────────────────────────────────────────────────

interface DraftArgs {
  lead: LeadRecord;
  category: LeadCategory;
  routing: LeadRouting;
}

function renderFirstTouchDraft(args: DraftArgs): LeadFirstTouchDraft {
  const { lead, category, routing } = args;
  const firstName = lead.fullName.split(/\s+/)[0] || '{{operator: first name}}';
  const propAnchor = pickPropertyAnchor(lead);
  const subject = pickSubject({ lead, category, propAnchor });
  const body = pickBody({ lead, category, routing, firstName, propAnchor });
  // Real-estate first-touch is conversational. Tone = casual across
  // categories; the broker-of-record reviews before sending.
  const tone: LeadFirstTouchDraft['tone'] = 'casual';
  // Confidence higher for hot/warm where the response logic is more
  // standardized; cold/nurture skews lower because the prospect is
  // less clearly defined.
  const confidence =
    category === 'hot' ? 0.82 :
    category === 'warm' ? 0.74 :
    category === 'cold' ? 0.6 :
    0.5;
  return {
    draftId: randomUUID(),
    providerDraftId: null,
    subject,
    body,
    tone,
    confidence,
    persisted: false,
  };
}

function pickPropertyAnchor(lead: LeadRecord): string {
  if (lead.propertyContext.mlsNumber) {
    return lead.propertyContext.addressText
      ? `${lead.propertyContext.addressText} (MLS ${lead.propertyContext.mlsNumber})`
      : `MLS ${lead.propertyContext.mlsNumber}`;
  }
  if (lead.propertyContext.addressText) return lead.propertyContext.addressText;
  if (lead.propertyContext.type === 'buyer-search') return 'your home search';
  if (lead.propertyContext.type === 'seller-cma') return 'a market analysis for your property';
  return 'your real-estate inquiry';
}

function pickSubject(args: {
  lead: LeadRecord;
  category: LeadCategory;
  propAnchor: string;
}): string {
  const { lead, category, propAnchor } = args;
  const subj = lead.inquirySubject;
  if (subj && subj.trim().length > 0) return `Re: ${subj.trim().slice(0, 80)}`;
  if (category === 'hot') return `Quick reply on ${propAnchor}`;
  if (category === 'warm') return `Following up on ${propAnchor}`;
  if (category === 'cold') return `${propAnchor} — a few next steps`;
  return `Thanks for reaching out about ${propAnchor}`;
}

function pickBody(args: {
  lead: LeadRecord;
  category: LeadCategory;
  routing: LeadRouting;
  firstName: string;
  propAnchor: string;
}): string {
  const { lead, category, routing, firstName, propAnchor } = args;
  const routingLine = routingMention(routing);
  const askForPreapproval =
    !lead.statedFinancing ||
    /need|not preapproved/i.test(lead.statedFinancing) ||
    lead.statedFinancing.trim().length === 0;
  switch (category) {
    case 'hot':
      return [
        `Hi ${firstName},`,
        '',
        `Thanks for reaching out about ${propAnchor}. Happy to help and want ` +
          'to make sure we get you accurate info quickly.',
        '',
        askForPreapproval
          ? 'Could you share where you are on financing — preapproved with a ' +
            'lender, working on it, or coming in cash? That helps us tailor what ' +
            'we send next.'
          : 'Thanks for noting where you are on financing — that helps us tailor ' +
            'what we send next.',
        '',
        lead.propertyContext.type === 'specific-listing'
          ? 'On showings, we have flexibility this week. {{operator: propose two ' +
            'concrete time windows that respect your calendar}}.'
          : 'For next steps, we can pull a short list of homes that match what ' +
            'you described and walk through a couple together this week.',
        '',
        routingLine,
        '',
        'Talk soon,',
        '{{operator: signature}}',
      ].join('\n');
    case 'warm':
      return [
        `Hi ${firstName},`,
        '',
        `Thanks for reaching out about ${propAnchor}. Wanted to follow up so ` +
          'this does not slip through the cracks.',
        '',
        askForPreapproval
          ? 'A quick question that helps us point you in the right direction — ' +
            'where are you on preapproval? Even a quick "working with a lender" ' +
            'gives us enough to move forward.'
          : 'Thanks for sharing where you are on financing.',
        '',
        'On timing — is there a window in the next couple of weeks that would ' +
          'work for a 15-minute call to map out what you are looking for? ' +
          '{{operator: propose two slots that respect your calendar}}.',
        '',
        routingLine,
        '',
        'Thanks,',
        '{{operator: signature}}',
      ].join('\n');
    case 'cold':
      return [
        `Hi ${firstName},`,
        '',
        `Thanks for reaching out about ${propAnchor}. It sounds like you are ` +
          'earlier in the process, which is a great place to be — easier to ' +
          'plan without pressure.',
        '',
        'We will send a few helpful resources over the next couple of weeks ' +
          'so you can get familiar with the market. When you are ready to look ' +
          'at homes or talk through the sell side, just reply to any of those ' +
          'notes and we will pick up live.',
        '',
        routingLine,
        '',
        'Talk soon,',
        '{{operator: signature}}',
      ].join('\n');
    case 'nurture':
      return [
        `Hi ${firstName},`,
        '',
        `Thanks for the note on ${propAnchor}. It sounds like the timing is a ` +
          'ways out — that is totally fine. We will keep you on a low-volume ' +
          'list with neighborhood market notes you can scan in 60 seconds.',
        '',
        'Whenever you are closer to making a move — even just exploring — ' +
          'reply to any one of those and we will pick up the thread.',
        '',
        routingLine,
        '',
        'Thanks,',
        '{{operator: signature}}',
      ].join('\n');
  }
}

function routingMention(routing: LeadRouting): string {
  // Surface routing context as an operator-only merge comment — the
  // routing decision should not leak into copy the lead sees. The
  // broker's queue UI displays this separately; in the email body we
  // keep it as an HTML comment-style marker so a human review catches
  // any accidental leak.
  if (routing.type === 'agent') {
    return `{{operator-only — internal: routed to ${routing.agentName} (${routing.rationale})}}`;
  }
  if (routing.type === 'drip') {
    return `{{operator-only — internal: enroll in "${routing.campaignName}" drip campaign}}`;
  }
  return `{{operator-only — internal: ${routing.rationale}}}`;
}

// ── Persistence ─────────────────────────────────────────────────────────

async function persistDraft(
  persister: DraftPersister,
  args: {
    workspaceId: string;
    lead: LeadRecord;
    draft: LeadFirstTouchDraft;
  },
): Promise<LeadFirstTouchDraft> {
  if (!args.lead.email) {
    return { ...args.draft, persisted: false, providerDraftId: null };
  }
  const res = await persister.persistDraft({
    workspaceId: args.workspaceId,
    threadId: `lead-${args.lead.id}`,
    inReplyToMessageId: null,
    toEmails: [args.lead.email],
    subject: args.draft.subject,
    body: args.draft.body,
  });
  if (!res.ok) {
    return { ...args.draft, persisted: false, providerDraftId: null };
  }
  return {
    ...args.draft,
    persisted: true,
    providerDraftId: res.value.providerDraftId,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
