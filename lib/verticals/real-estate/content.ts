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

  hero: {
    eyebrow: "Pin 1 · in pilot · Regular tier",
    headline: "The operating layer behind the independent brokerage.",
    valueProp:
      "agentplain REPLACES the 8–12 weekly hours a broker-owner spends on coordination work, INTEGRATES with Follow Up Boss, dotloop, FMLS, GAMLS, and Outlook, and AUGMENTS the broker-of-record's review on every customer-facing draft.",
  },

  metaTitle: "agentplain for real estate brokerages — agentic operating layer",
  metaDescription:
    "An agentic operating layer for the 5–25-agent independent real-estate brokerage. Listing intake, buyer routing, showings, compliance, CRM hygiene, production reporting, and recruiting — coordinated by a pre-trained fleet that sits on top of the tools you already use.",

  jtbdTables: [
    {
      role: "Broker-owner",
      draft: false,
      rows: [
        {
          job: "Know what the fleet did yesterday",
          when: "Morning, with coffee",
          today: "Email digest from the operator",
          withAgentplain:
            "Workspace overview page — daily briefing + per-agent activity, scannable in under 30 seconds",
        },
        {
          job: "Ratify a capability proposal targeting your fleet",
          when: "When the capability-builder fires",
          today: "Operator DMs you",
          withAgentplain:
            "/app/workspace/[id]/proposals with the target-agent voice block enforced",
        },
        {
          job: "Triage a compliance flag on an in-flight listing",
          when: "Within hours of the flag landing",
          today: "Operator texts you",
          withAgentplain:
            "/app/workspace/[id]/compliance with an SLA timer per severity tier",
        },
        {
          job: "Invite a new agent to the workspace",
          when: "New hire onboarding",
          today: "Email the operator",
          withAgentplain: "Self-serve invite UI",
        },
        {
          job: "Configure which agents are enabled at your tier",
          when: "Initial setup, tier upgrade",
          today: "Operator does it",
          withAgentplain: "Settings page, role-gated by tier",
        },
        {
          job: "See the AI activity on any listing in your brokerage",
          when: "Pre-close review, regulatory inquiry",
          today: "Ask the operator",
          withAgentplain:
            "/app/workspace/[id]/listings/[id] activity feed — append-only handoff log",
        },
        {
          job: "See agent-team health — who is using the product, who is not",
          when: "Weekly",
          today: "Does not exist",
          withAgentplain: "Workspace user list with last-active-at",
        },
        {
          job: "Pay your bill",
          when: "Monthly",
          today: "Manual invoice",
          withAgentplain: "Billing page (read-only invoice list in V1, self-serve in Phase 4)",
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
    multiplier: "23x",
    inputCost: "$2,750 / 30-day pilot (Growth pricing tier — 11–20 agents)",
    outputValue: "$5,300 saved/mo at the broker-owner level alone",
    math:
      "8–12 owner-hours/week on coordination work × $120/hr blended (owner-as-producer opportunity cost) × 4.3 weeks = $4,128–$6,192/mo. Midpoint $5,160. Conservative annualized: $61,920/yr returned to producing. Pilot recovers its cost in ~9 working days at midpoint.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` L13 + `realty_vertical_spec_v1_2026-05-03.md` §1. Coordination-hour ranges per `agentplain_positioning.md` L33. Owner-hour opportunity cost is a 2026-05-08 internal assumption pending primary-research validation — flagged in capability inbox.",
  },

  claims: {
    replace: [
      "8–12 hours/week of broker-owner coordination work — lead routing, listing-intake follow-up, showing scheduling, recruiting outreach, monthly reports",
      "The hygiene drift that an unstaffed CRM accumulates between quarterly clean-ups",
      "The \"I'll get to that next month\" production reports built by hand",
      "Reactive compliance review — every customer-facing draft is pre-checked instead",
    ],
    integrate: [
      "Follow Up Boss (read + write — P1, ~3 days)",
      "dotloop (read + write — P1, ~3–5 days)",
      "FMLS + GAMLS (read-only feed for any Georgia pilot)",
      "Microsoft 365 Graph — calendar + email (per-agent OAuth)",
      "Google Calendar + Workspace email",
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
    shipped: [],
    planned: [
      { name: "Follow Up Boss", category: "CRM" },
      { name: "Sierra Interactive", category: "CRM" },
      { name: "dotloop", category: "Transaction management" },
      { name: "Skyslope", category: "Transaction management" },
      { name: "FMLS / GAMLS", category: "MLS (Georgia)" },
      { name: "Microsoft 365 Graph", category: "Calendar + email" },
      { name: "Google Workspace", category: "Calendar + email" },
      { name: "Zillow / Realtor.com", category: "Lead source" },
      { name: "RESO Web API", category: "MLS standard" },
      { name: "QuickBooks Online", category: "Accounting" },
    ],
    plannedWindow: "Q3 2026",
  },
};
