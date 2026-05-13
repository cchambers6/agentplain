import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 (financial
// advisors / RIAs, 1–10 advisor, composite 33).
//
// Pricing: surfaces as Regular tier per `project_stripe_both_surfaces.md`
// (simplified 2026-05-12 — single productized tier across all 10 verticals;
// fiduciary-aware depth, SEC Marketing Rule compliance corpus, and bespoke
// custodian integrations route to /custom). The `tier: "max"` field below is
// schema-only and is NOT surfaced on the customer page.
//
// JTBD draft:true — no Phase 0 product_spec.md table. Capability-inbox flagged.

export const ria: VerticalContent = {
  slug: "ria",
  name: "RIA practices",
  tier: "max",
  missionSubject: "RIAs and wealth advisors",

  hero: {
    eyebrow: "Built for independent RIAs and wealth practices",
    headline: "The fleet for the independent RIA.",
    valueProp:
      "agentplain REPLACES the meeting-prep + post-meeting documentation cycle, INTEGRATES with your CRM (Wealthbox / Redtail / Salesforce FSC), planning software (eMoney / RightCapital / MoneyGuidePro), and custodian portals, and AUGMENTS the advisor's review on every client-facing communication with a fiduciary-aware compliance pass.",
  },

  metaTitle:
    "agentplain for RIAs — independent registered investment advisors",
  metaDescription:
    "An agentic fleet for the 1–10 advisor independent registered investment advisor firm. Client-meeting prep, post-meeting note + task drafting, financial-plan refresh cadence, fiduciary-aware communication review, billing on AUM cycle, and ADV-aware compliance — coordinated across Wealthbox, Redtail, Salesforce FSC, eMoney, RightCapital, MoneyGuidePro, and your custodian portals.",

  jtbdTables: [
    {
      role: "Principal / lead advisor",
      draft: true,
      rows: [
        {
          job: "Prep for a client meeting",
          when: "Day before every meeting",
          today: "30–60 minutes per meeting pulling from CRM + planning software + custodian",
          withAgentplain:
            "Prep agent drafts the agenda + delta-since-last-meeting + open task list; advisor reviews",
        },
        {
          job: "Capture post-meeting notes + task list",
          when: "Within hours of every meeting",
          today: "Memory-dependent; often delayed",
          withAgentplain:
            "Note agent drafts the recap + task list from the meeting capture; advisor reviews and routes",
        },
        {
          job: "Approve a client-facing communication",
          when: "Per outbound, urgent",
          today: "Read every outbound — slow, inconsistent",
          withAgentplain:
            "Compliance agent runs an ADV + suitability + plain-English check; advisor signs",
        },
      ],
    },
    {
      role: "Associate advisor / planner",
      draft: true,
      rows: [
        {
          job: "Update a client's financial plan post-life-event",
          when: "Reactive (job change, inheritance, kid)",
          today: "Manual data entry into planning software, ad hoc",
          withAgentplain:
            "Planning agent drafts the refreshed plan inputs scoped to the life event; associate reviews",
        },
        {
          job: "Draft client meeting recaps",
          when: "Per-meeting",
          today: "30 minutes per recap",
          withAgentplain: "Note agent drafts; associate edits — 5 minutes",
        },
        {
          job: "Handle inbound client question",
          when: "All day",
          today: "Reactive, no triage layer",
          withAgentplain:
            "Inbound agent classifies, attaches account context, drafts the response for advisor sign-off",
        },
      ],
    },
    {
      role: "Operations / client-service associate",
      draft: true,
      rows: [
        {
          job: "Open a new account at the custodian",
          when: "Per-onboarding",
          today: "Manual paperwork + custodian portal navigation",
          withAgentplain:
            "Onboarding agent drafts the account-opening package against the custodian's current form set",
        },
        {
          job: "Run AUM billing on quarter close",
          when: "Quarterly",
          today: "Spreadsheet of AUM × fee schedule",
          withAgentplain: "Billing agent drafts the schedule; ops reviews exceptions only",
        },
        {
          job: "Keep the CRM clean",
          when: "Weekly",
          today: "Hygiene drift between quarterly clean-ups",
          withAgentplain: "Hygiene agent dedupes, normalizes, surfaces stale records weekly",
        },
      ],
    },
  ],

  roi: {
    multiplier: "24x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
    outputValue: "$175,000 / yr in advisor-hour reclamation at a 3-advisor practice",
    math:
      "3 advisors × ~6 hours/week each on prep + recap + comms triage × $300/hr opportunity cost × 50 weeks = $270k/yr opportunity. Capture 65% with the fleet → $175k/yr returned. Against 3 Regular-tier seats at $199/mo solo ($7,164/yr) that's ~24x at three advisors; a 25-advisor practice on the $119/seat band ($35,700/yr) capturing the same share of a $2.25M opportunity runs past 40x. Fiduciary-aware compliance, SEC Marketing Rule corpus, and dedicated success route to /custom when a firm needs depth beyond plug-and-play.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (single Regular tier, simplified 2026-05-12; per-seat ladder $199→$99; anything bespoke routes to /custom). ROI band per `project_pricing_value_anchor.md` (Regular-tier ROI range 15x–107x). RIA segment economics per `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 (financial advisors, composite 33). Hourly-rate input is operator-modeled — flagged in capability inbox.",
  },

  claims: {
    replace: [
      "30–60 minutes of per-meeting prep — replaced by drafted agendas",
      "30 minutes per post-meeting recap — replaced by drafted notes + task list",
      "Reactive inbound triage — replaced by classified + context-attached drafts",
      "Manual account-opening paperwork — replaced by drafted packages against current custodian forms",
    ],
    integrate: [
      "Wealthbox (CRM)",
      "Redtail (CRM)",
      "Salesforce Financial Services Cloud",
      "eMoney Advisor (planning)",
      "RightCapital (planning)",
      "MoneyGuidePro (planning)",
      "Schwab Advisor Center, Fidelity Wealthscape, Pershing NetX360 (custodian — read-only)",
      "Outlook + Microsoft 365 Graph",
    ],
    augment: [
      "Advisor review on every client-facing communication — ADV + suitability + plain-English check",
      "Plan-input drafting — every refresh cites the life-event source record",
      "Quarterly AUM billing — drafted with custodian-position evidence attached",
      "Compliance posture — every flag cites the rule (SEC Marketing Rule, ADV Part 2A, state-specific)",
    ],
  },

  integrations: {
    shipped: [],
    planned: [
      { name: "Wealthbox", category: "CRM" },
      { name: "Redtail", category: "CRM" },
      { name: "Salesforce FSC", category: "CRM" },
      { name: "eMoney Advisor", category: "Planning" },
      { name: "RightCapital", category: "Planning" },
      { name: "MoneyGuidePro", category: "Planning" },
      { name: "Schwab / Fidelity / Pershing", category: "Custodian (read-only)" },
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    plannedWindow: "Q1 2027",
  },

  valueLoopExample: {
    scenario:
      "Q1 quarterly review cycle. 87 client portfolios to discuss, 87 prep packets to assemble.",
    before:
      "Pull each client's positions in Wealthbox + custodian, run the planning model in eMoney, draft a one-page review summary with the highlights and risks, build the agenda, schedule the call. ~90 minutes per packet × 87 clients.",
    after:
      "The fleet pulled positions, ran the planning models, drafted 87 one-page review packets with portfolio drift highlighted, surfaced the 11 clients with planning-assumption changes worth raising, and queued the scheduling. SEC archiveable; every claim cites the source.",
    outcome:
      "The advisor reviews 87 drafts in two mornings instead of three weeks. Calls happen on schedule; the advisor walks in with prep, not catch-up.",
  },
};
