import type { VerticalContent } from "../types";

// Real estate is the only vertical with a canonical, ratified Phase 0
// JTBD table — see `C:\flatsbo\outputs\agentplain_product_phase0\product_spec.md` §3
// (broker-owner: BO-1..BO-8, individual agent: IA-1..IA-6).
// Operator JTBDs (OP-1..OP-8) are platform-internal and not surfaced on the
// customer-facing landing page.

export const realEstate: VerticalContent = {
  slug: "real-estate",
  name: "Real estate",
  tier: "regular",
  missionSubject: "realtors and brokerages",

  // The pre-trained realty fleet, surfaced in-product on /agents. Each entry
  // declares its runtime binding so the agents page renders a TRUTHFUL state
  // instead of a perpetual "rooting in" spinner:
  //   - `live`  → the V1 inbox loop attributes real work to this slug. The
  //               attribution resolver (lib/skills/persist-artifacts.ts) writes
  //               the slug as the handoff trace root + approval agentSlug, so
  //               `counts.get(slug)` reads the real number once email flows.
  //   - `rooting` → declared capability whose runtime skill is not wired into
  //               the live loop yet; the card states what it's waiting on.
  // Two agents are live today (the inbox chain produces buyer-inquiry replies
  // and showing-time proposals); the other five are honestly rooting — see
  // docs/realty-fleet-binding-2026-05-22.md for which can't be live yet + why.
  agentRoster: [
    {
      slug: "realty-listing-coordinator",
      name: "Listing Coordinator",
      job: "Runs listing intake and keeps every new listing's follow-up moving.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your transaction system is connected.",
    },
    {
      slug: "realty-buyer-inquiry-router",
      name: "Buyer Inquiry Router",
      job: "Classifies inbound buyer inquiries and drafts the first-touch reply.",
      runtime: "live",
      owns: ["buyer-inquiry"],
    },
    {
      slug: "realty-showing-scheduler",
      name: "Showing Scheduler",
      job: "Coordinates showing times across buyers, agents, and calendars.",
      runtime: "live",
      owns: ["scheduling"],
    },
    {
      slug: "realty-compliance-sentinel",
      name: "Compliance Sentinel",
      job: "Pre-checks every customer-facing draft before the broker signs.",
      runtime: "live",
      owns: ["compliance-check"],
    },
    {
      slug: "realty-crm-hygiene",
      name: "CRM Hygiene",
      job: "Dedupes, normalizes, and surfaces stale records in the CRM.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your CRM is connected.",
    },
    {
      slug: "realty-production-reporter",
      name: "Production Reporter",
      job: "Drafts the production read against MLS and the workspace median.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your MLS feed is connected.",
    },
    {
      slug: "realty-recruiter-assistant",
      name: "Recruiter Assistant",
      job: "Drafts recruiting outreach with one substantiated production reference.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online alongside the Production Reporter's data.",
    },
    {
      // Chief of Staff — horizontal capability bound to the
      // chief-of-staff-scheduler skill. Walks (calendar + inbox + to-do)
      // and PROPOSES meetings, reply drafts, and to-dos for broker
      // approval. Never books, never sends, never writes a third-party
      // task row — every proposal lands in /approvals as PENDING.
      slug: "realty-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the broker's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for independent real-estate brokerages",
    headline: "The operating layer behind the independent brokerage.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. The MLS / CRM / transaction-management
    // adapters live in the per-vertical integration roadmap below and surface
    // honestly there as planned, not in this present-tense hero clause.
    valueProp:
      "agentplain REPLACES the 8–12 weekly hours a broker-owner spends on coordination work, INTEGRATES with Outlook, Gmail, Google Drive, and DocuSign on day one, and AUGMENTS the broker-of-record's review on every customer-facing draft.",
    sbmSubhead:
      "The listing, buyer, and compliance skills, agents, and memory a brokerage would otherwise build itself",
  },

  metaTitle: "for independent real-estate brokerages",
  metaDescription:
    "Listing intake, buyer routing, showings, compliance, CRM hygiene, and production reporting — for the 5–25-agent independent real-estate brokerage.",

  jtbdTables: [
    {
      role: "Broker-owner",
      draft: false,
      rows: [
        {
          job: "Know what the fleet drafted overnight",
          when: "Morning, with coffee",
          today: "Open Outlook, scan the last 24 hours of activity by hand",
          withAgentplain:
            "Daily briefing — yesterday's drafts + flags + per-agent activity scannable in under 30 seconds",
        },
        {
          job: "Triage a compliance flag on an in-flight listing",
          when: "Within hours of the flag landing",
          today: "Caught after the listing's already on MLS, via a call from the broker-of-record",
          withAgentplain:
            "Sentinel pre-checks every customer-facing draft; flags surface before MLS submission with severity rating + suggested rewrite",
        },
        {
          job: "Invite a new agent to the workspace",
          when: "New hire onboarding",
          today: "Manual setup — credentials, tool access, training",
          withAgentplain: "Self-serve invite from the workspace settings page",
        },
        {
          job: "Configure which agents are enabled at your tier",
          when: "Initial setup, tier upgrade",
          today: "Doesn't exist — your current stack doesn't have configurable agents",
          withAgentplain: "Settings page, role-gated by tier",
        },
        {
          job: "See the AI activity on any listing in your brokerage",
          when: "Pre-close review, regulatory inquiry",
          today: "Hunt through inbox + CRM history by hand",
          withAgentplain:
            "Per-listing activity feed — append-only handoff log on the listing's page",
        },
        {
          job: "See agent-team health — who is using the product, who is not",
          when: "Weekly",
          today: "Doesn't exist",
          withAgentplain: "Workspace user list with last-active-at",
        },
        {
          job: "Pay your bill",
          when: "Monthly",
          today: "Manual invoice from your current tooling",
          withAgentplain: "Billing page in your workspace — invoice history + payment method",
        },
      ],
    },
    {
      role: "Individual real-estate agent",
      draft: false,
      rows: [
        {
          job: "Know what the fleet has ready for you today",
          when: "Phone-open in the morning",
          today: "No surface",
          withAgentplain:
            "Mobile-first today view — three highest-priority items at a glance",
        },
        {
          job: "Send a drafted reply to a buyer inquiry",
          when: "Mid-day, between showings",
          today: "Open Outlook, retype from memory",
          withAgentplain:
            "Surfaced drafted reply, copy-to-clipboard, deeplink into your own email client",
        },
        {
          job: "See compliance flags on your own drafts",
          when: "Pre-MLS submission",
          today: "Doesn't happen — flag fires after submission",
          withAgentplain: "Real-time flag on the draft surface",
        },
        {
          job: "Ratify a per-listing recommendation",
          when: "Within hours of recommendation landing",
          today: "Doesn't exist",
          withAgentplain: "Per-listing recommendation row in the today view",
        },
        {
          job: "Ask the fleet about a specific lead or listing",
          when: "When stuck or curious",
          today: "Doesn't exist",
          withAgentplain: "Thread surface scoped to a single record",
        },
        {
          job: "See your own production vs. workspace median",
          when: "Monthly",
          today: "Manual MLS query",
          withAgentplain: "Production-reporter output, agent-scoped variant",
        },
      ],
    },
  ],

  roi: {
    multiplier: "26x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — 7-day free trial, card at signup",
    outputValue: "$5,300 saved/mo at the broker-owner level alone",
    math:
      "8–12 owner-hours/week on coordination work × $120/hr blended (owner-as-producer opportunity cost) × 4.3 weeks = $4,128–$6,192/mo. Midpoint $5,160. Against the solo Regular-tier seat ($199/mo) the broker-owner alone recovers cost in the first working week and runs ~26x ROI. Conservative annualized: $61,920/yr returned to producing.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Regular tier per the 2026-05-15 three-tier ratification — Regular is the default entry path; brokerages wanting named-service-partner reserved time can step up to Partner ($299→$199/seat), and high-intensity multi-office or franchise-scale engagements route to Max (quote-based); first month free across Regular and Partner). Value math per `project_pricing_value_anchor.md` (Regular-tier value range $2,900–$10,600/mo per seat). Realty-specific inputs per `realty_vertical_spec_v1_2026-05-03.md` §1. Coordination-hour ranges per `agentplain_positioning.md` L33. Owner-hour opportunity cost is a 2026-05-08 internal assumption pending primary-research validation — flagged in capability inbox.",
    violationAvoidance:
      "Fair-housing exposure is the quiet killer in realty marketing: a single discriminatory phrase in a listing description or a buyer reply is a fileable Fair Housing Act violation carrying a first-offense HUD civil penalty of $26,262 (2025 inflation-adjusted, 24 CFR §180.671), and advertising-side TILA-RESPA disclosure slips compound from there. An auto-execution tool publishes the listing copy before a human reads it; agentplain's fleet drafts it, the HUD enumerated-phrase scanner flags it, and a person approves it — so the violating sentence never reaches a portal. That avoided penalty isn't in the 26x hours math above; it's pure downside the approval gate removes, which an auto-send competitor cannot promise to dodge.",
  },

  claims: {
    replace: [
      "8–12 hours/week of broker-owner coordination work — lead routing, listing-intake follow-up, showing scheduling, recruiting outreach, monthly reports",
      "The hygiene drift that an unstaffed CRM accumulates between quarterly clean-ups",
      "The \"I'll get to that next month\" production reports built by hand",
      "Reactive compliance review — every customer-facing draft is pre-checked instead",
    ],
    integrate: [
      "Outlook + Gmail (per-agent OAuth — email + calendar)",
      "Google Drive (your file substrate — past offers, playbooks, listing photos)",
      "DocuSign (per-listing signature routing)",
      "QuickBooks Online (production-reporter dependency)",
    ],
    augment: [
      "Broker-of-record review — the sentinel pre-checks; the human still signs",
      "Listing description drafting — the agent drafts in your voice; you approve before MLS",
      "Recruiting outreach — drafted opens with one substantiated production reference, plain CTA, opt-out line",
      "Buyer-inquiry first-touch — drafted in <2 minutes; sent from your own system",
    ],
  },

  integrations: {
    // Live today — the connect path is open (Follow Up Boss + Sierra via a
    // pasted API key; M365 / Google Workspace / QuickBooks via OAuth) and
    // Plaino reads, triages, and drafts on the real account. See
    // `lib/integrations/marketplace.ts` (status: 'available').
    shipped: [
      {
        name: "Follow Up Boss",
        category: "CRM",
        note: "Reads leads, triages each one, drafts a first-touch reply into /approvals, writes the decision back as a note + tag.",
      },
      {
        name: "Sierra Interactive",
        category: "CRM",
        note: "Reads contacts, triages each lead, drafts a first-touch reply, writes the triage decision back as a private note + tag.",
      },
      { name: "Microsoft 365 Graph", category: "Calendar + email" },
      { name: "Google Workspace", category: "Calendar + email" },
      { name: "QuickBooks Online", category: "Accounting" },
    ],
    planned: [
      { name: "dotloop", category: "Transaction management" },
      { name: "Skyslope", category: "Transaction management" },
      { name: "FMLS / GAMLS", category: "MLS (Georgia)" },
      { name: "Zillow / Realtor.com", category: "Lead source" },
      { name: "RESO Web API", category: "MLS standard" },
    ],
    plannedWindow: "Q3 2026",
  },

  valueLoopExample: {
    scenario:
      "Sarah's counter-offer lands Tuesday 9:14pm. She wakes Wednesday at 6:30am.",
    before:
      "Open dotloop, pull the counter, scan the buyer's agent thread, find three comparable closings in MLS, draft a response in Outlook. ~45 minutes before her first showing.",
    after:
      "The fleet has already drafted the counter-offer response, summarized the buyer's agent's response history across this transaction, and surfaced three comparable closings from the brokerage's own past-listing files in Drive. Sarah reviews, edits one number, then signs and sends from her transaction system (once dotloop is connected, the draft drops straight into it).",
    outcome:
      "Four minutes instead of forty-five. The fleet drafts; Sarah's broker-of-record review stays in place; she sends from her own transaction system.",
  },
};
