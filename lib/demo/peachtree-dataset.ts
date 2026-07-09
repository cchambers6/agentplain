/**
 * lib/demo/peachtree-dataset.ts
 *
 * The Peachtree Realty Demo fixture — the exact synthetic workspace state
 * Conner shows on discovery calls (docs/killer-workflows/RE-lead-triage/).
 *
 * One brokerage, four agents, three drip campaigns, twenty inbound leads
 * spread across metro-Atlanta zips, $250K–$1.2M price bands, and every
 * LeadSource the triage skill routes. Three leads "arrived overnight" and
 * land as PENDING approval cards; the other seventeen were triaged over the
 * prior week and back the saved-time ledger.
 *
 * OBVIOUSLY FAKE by construction, enforced by peachtree-dataset.test.ts:
 *   - every email ends in @example.com (RFC 2606 reserved)
 *   - every phone is in the (555) 555-01XX fictional range
 *   - every street address is 999-prefixed (flatsbo test-seed convention)
 *   - the brokerage is named "Peachtree Realty Demo"
 *
 * The shapes are the REAL skill ports (`LeadRecord` / `AgentRoster` /
 * `DripCampaign` from lib/skills/lead-triage-realestate) served through the
 * shipped `JsonLeadFetcher` — the seed runs the production triage path, not
 * a parallel demo path. When Follow Up Boss connects for real, the only
 * change is which fetcher feeds the same skill.
 *
 * Deterministic: the builder takes an `anchor` Date and derives every
 * timestamp as a fixed offset, so two seeds from the same anchor produce
 * identical workspaces (feedback_no_guesses_no_estimates — the demo numbers
 * are reproducible, not vibes).
 */

import type {
  AgentRoster,
  DripCampaign,
  LeadRecord,
} from '../skills/lead-triage-realestate/types';

/** Workspace identity — shared by the seed, the reset script, and any
 *  surface that needs to recognize the demo workspace. */
export const PEACHTREE_DEMO_SLUG = 'peachtree-realty-demo';
export const PEACHTREE_DEMO_NAME = 'Peachtree Realty Demo';

/** Marker stamped on every DB row the seed writes (KnowledgeDocument
 *  metadata, credential providerMetadata) so demo rows are queryable,
 *  badge-able, and deletable as one set. */
export const PEACHTREE_DEMO_SOURCE = 'peachtree-realty-demo-seed';

/** Dedupe table name for the saved-time ledger entries the seed writes. */
export const PEACHTREE_SAVED_TIME_TABLE = 'PeachtreeDemoSeed';

/**
 * True when an IntegrationCredential's providerMetadata marks it as a
 * seeded demo placeholder. Autonomous sweeps (follow-up-boss-sync-sweep)
 * MUST treat a demo credential as not-connected — the stored token is a
 * sentinel, never a real vendor key.
 */
export function isDemoCredentialMetadata(providerMetadata: unknown): boolean {
  return (
    typeof providerMetadata === 'object' &&
    providerMetadata !== null &&
    (providerMetadata as Record<string, unknown>).isDemo === true
  );
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Offset helper: `daysAgo` days before the anchor, at `hour:minute` of
 *  that day (anchor-local wall clock is close enough for demo realism). */
function at(anchor: Date, daysAgo: number, hour: number, minute: number): Date {
  const d = new Date(anchor.getTime() - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ── Roster ───────────────────────────────────────────────────────────────

export const PEACHTREE_AGENTS: AgentRoster[] = [
  {
    id: 'agent-alicia-grant',
    name: 'Alicia Grant',
    specialties: ['relocation', 'first-time buyer'],
    serviceArea: 'Atlanta intown',
    acceptingLeads: true,
  },
  {
    id: 'agent-rob-delgado',
    name: 'Rob Delgado',
    specialties: ['luxury', 'investment'],
    serviceArea: 'Buckhead / Sandy Springs',
    acceptingLeads: true,
  },
  {
    id: 'agent-maya-chen',
    name: 'Maya Chen',
    specialties: ['first-time buyer'],
    serviceArea: 'Decatur / East Atlanta',
    acceptingLeads: true,
  },
  {
    // On leave — proves routing respects availability, not just specialty.
    id: 'agent-sam-whitaker',
    name: 'Sam Whitaker',
    specialties: ['land', 'commercial'],
    serviceArea: 'Cobb / Cherokee',
    acceptingLeads: false,
  },
];

export const PEACHTREE_CAMPAIGNS: DripCampaign[] = [
  {
    id: 'drip-nurture-metro',
    name: 'Long-timeline nurture — metro Atlanta',
    audience: 'nurture',
  },
  {
    id: 'drip-cold-primer',
    name: 'Early browsers — market primer',
    audience: 'cold',
  },
  {
    id: 'drip-general-followup',
    name: 'General follow-up',
    audience: 'general',
  },
];

// ── Leads ────────────────────────────────────────────────────────────────

export interface PeachtreeLeads {
  /** Landed after close of business yesterday → PENDING approval cards. */
  overnight: LeadRecord[];
  /** Triaged over the prior week → APPROVED cards + saved-time ledger. */
  historical: LeadRecord[];
  all: LeadRecord[];
}

/** Build the full 20-lead set anchored to `anchor` (typically seed time). */
export function peachtreeLeads(anchor: Date): PeachtreeLeads {
  const overnight: LeadRecord[] = [
    {
      // THE demo card — scores hot, routes to the relocation specialist,
      // drafts a first-touch with the two-showing-windows operator slot.
      id: 'lead-jordan-ellis',
      fullName: 'Jordan Ellis',
      email: 'jordan.ellis@example.com',
      phone: '(555) 555-0101',
      source: 'zillow',
      inquirySubject: 'Is 999 Peachtree Way NE still available?',
      inquiryText:
        'Saw this on Zillow tonight — very interested in the listing at 999 ' +
        'Peachtree Way NE. We are relocating to Atlanta for work and ready ' +
        'to buy. Could we tour it this weekend?',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: 'FMLS-9990101',
        addressText: '999 Peachtree Way NE, Atlanta, GA 30309 · $585,000',
      },
      statedTimeline: 'this month — relocating for work',
      statedFinancing: 'preapproved to $600k',
      receivedAt: at(anchor, 1, 21, 14), // 9:14pm last night
      hasBeenContacted: false,
    },
    {
      id: 'lead-renee-okafor',
      fullName: 'Renee Okafor',
      email: 'renee.okafor@example.com',
      phone: '(555) 555-0102',
      source: 'idx',
      inquirySubject: 'Looking at 3-bedrooms in Decatur',
      inquiryText:
        'I have been looking at a few of your 3-bedroom listings around ' +
        'Decatur under $400k. Interested in seeing what is out there in the ' +
        'next couple of months.',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'Decatur, GA 30030 · 3-bed under $400,000',
      },
      statedTimeline: 'next 3 months',
      statedFinancing: 'working with a lender',
      receivedAt: at(anchor, 1, 22, 47), // 10:47pm last night
      hasBeenContacted: false,
    },
    {
      id: 'lead-shah-family',
      fullName: 'Priya Shah',
      email: 'priya.shah@example.com',
      phone: '(555) 555-0103',
      source: 'open-house',
      inquirySubject: null,
      inquiryText:
        'We stopped by the open house on 999 Sycamore Trail. Just browsing ' +
        'for now, not in a rush — we may sell our Dunwoody place sometime ' +
        'next year and downsize.',
      propertyContext: {
        type: 'general',
        mlsNumber: null,
        addressText: '999 Sycamore Trail, Dunwoody, GA 30338',
      },
      statedTimeline: 'sometime next year',
      statedFinancing: null,
      receivedAt: at(anchor, 1, 19, 3), // 7:03pm last night
      hasBeenContacted: false,
    },
  ];

  const historical: LeadRecord[] = [
    {
      id: 'lead-marcus-webb',
      fullName: 'Marcus Webb',
      email: 'marcus.webb@example.com',
      phone: '(555) 555-0104',
      source: 'referral',
      inquirySubject: 'Referred by the Hendersons',
      inquiryText:
        'The Hendersons said you handled their sale — we are serious about ' +
        'making an offer on something in Virginia-Highland this quarter.',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'Virginia-Highland, Atlanta, GA 30306 · up to $750,000',
      },
      statedTimeline: 'this quarter',
      statedFinancing: 'preapproved',
      receivedAt: at(anchor, 2, 8, 30),
      hasBeenContacted: true,
    },
    {
      id: 'lead-carmen-diaz',
      fullName: 'Carmen Diaz',
      email: 'carmen.diaz@example.com',
      phone: '(555) 555-0105',
      source: 'zillow',
      inquirySubject: 'Tour request — 999 Highland View Ct',
      inquiryText:
        'Interested in the property at 999 Highland View Ct. Would like to ' +
        'schedule a showing this week if possible.',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: 'FMLS-9990105',
        addressText: '999 Highland View Ct, Atlanta, GA 30312 · $415,000',
      },
      statedTimeline: 'this week',
      statedFinancing: 'prequalified',
      receivedAt: at(anchor, 2, 14, 12),
      hasBeenContacted: true,
    },
    {
      id: 'lead-tom-abernathy',
      fullName: 'Tom Abernathy',
      email: 'tom.abernathy@example.com',
      phone: '(555) 555-0106',
      source: 'sphere',
      inquirySubject: 'Thinking about selling',
      inquiryText:
        'We are thinking about listing the Marietta house next spring. What ' +
        'would you estimate it goes for these days?',
      propertyContext: {
        type: 'seller-cma',
        mlsNumber: null,
        addressText: '999 Whitlock Ave, Marietta, GA 30060',
      },
      statedTimeline: 'next spring — about a year out',
      statedFinancing: null,
      receivedAt: at(anchor, 2, 19, 45),
      hasBeenContacted: true,
    },
    {
      id: 'lead-nia-thompson',
      fullName: 'Nia Thompson',
      email: 'nia.thompson@example.com',
      phone: '(555) 555-0107',
      source: 'realtor-com',
      inquirySubject: 'First home — West Midtown?',
      inquiryText:
        'First-time buyer looking at condos in West Midtown around $350k. ' +
        'Not preapproved yet — where do I start?',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'West Midtown, Atlanta, GA 30318 · around $350,000',
      },
      statedTimeline: '6 months',
      statedFinancing: 'need preapproval',
      receivedAt: at(anchor, 3, 9, 5),
      hasBeenContacted: true,
    },
    {
      id: 'lead-victor-hale',
      fullName: 'Victor Hale',
      email: 'victor.hale@example.com',
      phone: '(555) 555-0108',
      source: 'idx',
      inquirySubject: 'Cash offer — 999 Tuxedo Park Ln',
      inquiryText:
        'Looking at 999 Tuxedo Park Ln in Buckhead. Prepared to make an ' +
        'offer — cash, no contingency on financing. Timeline is ASAP.',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: 'FMLS-9990108',
        addressText: '999 Tuxedo Park Ln, Atlanta, GA 30324 · $1,150,000',
      },
      statedTimeline: 'ASAP',
      statedFinancing: 'all cash',
      receivedAt: at(anchor, 3, 11, 20),
      hasBeenContacted: true,
    },
    {
      id: 'lead-grace-lindqvist',
      fullName: 'Grace Lindqvist',
      email: 'grace.lindqvist@example.com',
      phone: '(555) 555-0109',
      source: 'open-house',
      inquirySubject: null,
      inquiryText:
        'Loved the open house at 999 Oakhurst Dr. Interested in touring ' +
        'similar homes in Decatur — we are ready to buy in the next 30 days.',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'Oakhurst, Decatur, GA 30030 · $450,000–$525,000',
      },
      statedTimeline: '30 days',
      statedFinancing: 'preapproved',
      receivedAt: at(anchor, 3, 16, 40),
      hasBeenContacted: true,
    },
    {
      id: 'lead-dev-patel',
      fullName: 'Dev Patel',
      email: 'dev.patel@example.com',
      phone: '(555) 555-0110',
      source: 'cold-inbound',
      inquirySubject: 'Investment duplexes',
      inquiryText:
        'Do you work with investors? Looking at duplexes in East Atlanta, ' +
        'interested in anything cash-flowing under $500k.',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'East Atlanta, GA 30316 · under $500,000',
      },
      statedTimeline: 'this quarter',
      statedFinancing: 'underwriting with a portfolio lender',
      receivedAt: at(anchor, 4, 10, 15),
      hasBeenContacted: true,
    },
    {
      id: 'lead-holly-mercer',
      fullName: 'Holly Mercer',
      email: 'holly.mercer@example.com',
      phone: '(555) 555-0111',
      source: 'zillow',
      inquirySubject: 'Question about 999 Roswell Mill Rd',
      inquiryText:
        'Just browsing for now — curious what the HOA covers at 999 Roswell ' +
        'Mill Rd. No rush on our end.',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: 'FMLS-9990111',
        addressText: '999 Roswell Mill Rd, Roswell, GA 30075 · $389,000',
      },
      statedTimeline: null,
      statedFinancing: null,
      receivedAt: at(anchor, 4, 13, 55),
      hasBeenContacted: true,
    },
    {
      id: 'lead-andre-boykin',
      fullName: 'Andre Boykin',
      email: 'andre.boykin@example.com',
      phone: '(555) 555-0112',
      source: 'referral',
      inquirySubject: 'Relocating from Chicago',
      inquiryText:
        'My colleague recommended you. Starting a new job in Midtown in ' +
        'January — interested in touring homes near the Beltline next month.',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'Beltline corridor, Atlanta, GA 30308 · up to $650,000',
      },
      statedTimeline: 'next month',
      statedFinancing: 'preapproved',
      receivedAt: at(anchor, 4, 20, 8),
      hasBeenContacted: true,
    },
    {
      id: 'lead-sofia-marino',
      fullName: 'Sofia Marino',
      email: 'sofia.marino@example.com',
      phone: '(555) 555-0113',
      source: 'idx',
      inquirySubject: 'Kennesaw starter homes',
      inquiryText:
        'Looking at starter homes around Kennesaw in the $250k–$300k range. ' +
        'Just exploring the market for now.',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'Kennesaw, GA 30144 · $250,000–$300,000',
      },
      statedTimeline: 'end of year',
      statedFinancing: null,
      receivedAt: at(anchor, 5, 9, 42),
      hasBeenContacted: true,
    },
    {
      // Missing email on purpose — the triage card honestly reports
      // "draft skipped: missing-email" instead of inventing a channel.
      id: 'lead-walkin-woodstock',
      fullName: 'Ray Delaney',
      email: null,
      phone: '(555) 555-0114',
      source: 'open-house',
      inquirySubject: null,
      inquiryText:
        'Walk-in at the 999 Arnold Mill Rd open house. Interested in ' +
        'touring more of Woodstock — left a phone number only.',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'Woodstock, GA 30188 · around $425,000',
      },
      statedTimeline: '3 months',
      statedFinancing: null,
      receivedAt: at(anchor, 5, 15, 30),
      hasBeenContacted: true,
    },
    {
      id: 'lead-jae-kim',
      fullName: 'Jae Kim',
      email: 'jae.kim@example.com',
      phone: '(555) 555-0115',
      source: 'realtor-com',
      inquirySubject: 'Tour — 999 Lavista Walk',
      inquiryText:
        'Interested in the townhome at 999 Lavista Walk. Could I see this ' +
        'one and anything similar nearby? Hoping to move in 60 days.',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: 'FMLS-9990115',
        addressText: '999 Lavista Walk NE, Atlanta, GA 30324 · $498,000',
      },
      statedTimeline: '60 days',
      statedFinancing: 'working with a lender',
      receivedAt: at(anchor, 5, 18, 22),
      hasBeenContacted: true,
    },
    {
      id: 'lead-beth-crawford',
      fullName: 'Beth Crawford',
      email: 'beth.crawford@example.com',
      phone: '(555) 555-0116',
      source: 'sphere',
      inquirySubject: 'CMA on the Avondale house',
      inquiryText:
        'Ready to sell the Avondale Estates house — new baby, we need more ' +
        'space. What is it worth and how fast could we list?',
      propertyContext: {
        type: 'seller-cma',
        mlsNumber: null,
        addressText: '999 Clarendon Ave, Avondale Estates, GA 30002',
      },
      statedTimeline: 'this quarter',
      statedFinancing: null,
      receivedAt: at(anchor, 6, 8, 10),
      hasBeenContacted: true,
    },
    {
      id: 'lead-omar-haddad',
      fullName: 'Omar Haddad',
      email: 'omar.haddad@example.com',
      phone: '(555) 555-0117',
      source: 'zillow',
      inquirySubject: 'Is 999 Grant Park Pl available?',
      inquiryText:
        'Interested in 999 Grant Park Pl — would love to tour it. We sold ' +
        'our last place already, so timeline is this month.',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: 'FMLS-9990117',
        addressText: '999 Grant Park Pl SE, Atlanta, GA 30312 · $549,000',
      },
      statedTimeline: 'this month',
      statedFinancing: 'cash from prior sale',
      receivedAt: at(anchor, 6, 12, 33),
      hasBeenContacted: true,
    },
    {
      id: 'lead-tanya-fields',
      fullName: 'Tanya Fields',
      email: 'tanya.fields@example.com',
      phone: '(555) 555-0118',
      source: 'cold-inbound',
      inquirySubject: 'Dunwoody schools question',
      inquiryText:
        'We might move for schools someday — what neighborhoods around ' +
        'Dunwoody would you suggest keeping an eye on?',
      propertyContext: {
        type: 'general',
        mlsNumber: null,
        addressText: 'Dunwoody, GA 30338',
      },
      statedTimeline: 'someday',
      statedFinancing: null,
      receivedAt: at(anchor, 6, 17, 48),
      hasBeenContacted: true,
    },
    {
      id: 'lead-luis-romero',
      fullName: 'Luis Romero',
      email: 'luis.romero@example.com',
      phone: '(555) 555-0119',
      source: 'idx',
      inquirySubject: 'Inman Park bungalow',
      inquiryText:
        'Looking at the bungalow at 999 Euclid Ave. Serious buyer — we lost ' +
        'two offers this spring and are ready to move fast on the right one.',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: 'FMLS-9990119',
        addressText: '999 Euclid Ave NE, Atlanta, GA 30307 · $725,000',
      },
      statedTimeline: 'ASAP',
      statedFinancing: 'preapproved',
      receivedAt: at(anchor, 6, 20, 5),
      hasBeenContacted: true,
    },
    {
      id: 'lead-erin-mcallister',
      fullName: 'Erin McAllister',
      email: 'erin.mcallister@example.com',
      phone: '(555) 555-0120',
      source: 'open-house',
      inquirySubject: null,
      inquiryText:
        'Visited the open house at 999 Ponce Ct. Browsing while our lease ' +
        'runs out — probably a year away from buying around $300k.',
      propertyContext: {
        type: 'buyer-search',
        mlsNumber: null,
        addressText: 'Poncey-Highland, Atlanta, GA 30306 · around $300,000',
      },
      statedTimeline: 'about a year',
      statedFinancing: null,
      receivedAt: at(anchor, 6, 14, 27),
      hasBeenContacted: true,
    },
  ];

  return { overnight, historical, all: [...overnight, ...historical] };
}
