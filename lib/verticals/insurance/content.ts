import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.2 (insurance
// brokerages — composite 35, tied #1 in the ranked analysis). The fleet
// shape and operational pain points come from that analysis.
//
// JTBD table is marked draft:true — no Phase 0 product_spec.md table has
// been ratified for insurance yet. Capability-inbox entry filed flagging
// the gap so b2b-head-of-insurance can author the canonical version.

export const insurance: VerticalContent = {
  slug: "insurance",
  name: "Insurance brokerages",
  tier: "regular",

  hero: {
    eyebrow: "Tied #1 vertical fit · Regular tier",
    headline: "The fleet for the independent P&C agency.",
    valueProp:
      "agentplain REPLACES the CSR hours spent on certificates of insurance and renewal prep, INTEGRATES with your AMS, comparative rater, and 8–15 carrier portals, and AUGMENTS the producer's read on every renewal proposal and claims update.",
  },

  metaTitle: "agentplain for insurance brokerages — independent P&C agencies",
  metaDescription:
    "An agentic fleet for the 3–15 producer independent insurance agency. COI generation, renewal coordination, carrier appetite intelligence, claims-status outreach, and commission reconciliation — coordinated across EZLynx, Applied Epic, AMS360, HawkSoft, and the carrier-portal stack.",

  jtbdTables: [
    {
      role: "Agency principal",
      draft: true,
      rows: [
        {
          job: "Know what the fleet handled across your producers yesterday",
          when: "Morning open",
          today: "Walk producer desks, ask the CSR lead",
          withAgentplain:
            "Workspace overview — per-producer activity, COI throughput, renewals due in next 14 days",
        },
        {
          job: "Triage a carrier-portal change that affects appetite this week",
          when: "Within hours of the bulletin landing",
          today: "Tribal knowledge — whichever producer reads broker bulletins",
          withAgentplain:
            "Carrier-intel agent posts the weekly pulse + flags appetite shifts on accounts in-flight",
        },
        {
          job: "Reconcile direct-bill statements against the AMS",
          when: "Monthly",
          today: "CSR spends 6–10 hours on it; mistakes accrue",
          withAgentplain: "Books agent drafts the reconciliation; principal signs",
        },
        {
          job: "Approve a producer commission split exception",
          when: "Ad hoc, end-of-month",
          today: "Spreadsheet trail, email chain",
          withAgentplain:
            "Commission agent shows the draft split + the split-rule lineage; one-click approve",
        },
      ],
    },
    {
      role: "Producer",
      draft: true,
      rows: [
        {
          job: "Prep a renewal proposal 60/30/15 days out",
          when: "Continuous calendar",
          today: "Pull declarations from AMS by hand; compare against current quote",
          withAgentplain:
            "Renewal coordinator drafts the proposal, flags coverage gaps, schedules your call",
        },
        {
          job: "Issue a COI request",
          when: "Inbound, all day",
          today: "CSR spends ~30% of their day on this",
          withAgentplain:
            "COI agent reads the request, pulls the policy from the AMS, drafts the certificate, routes for one-click issue",
        },
        {
          job: "Triage a claim FNOL or status request",
          when: "Inbound, urgent",
          today: "Reactive — depends on who sees it first",
          withAgentplain:
            "Inbound agent triages, attaches policy context, routes to the right desk within minutes",
        },
      ],
    },
    {
      role: "CSR",
      draft: true,
      rows: [
        {
          job: "Generate certificates of insurance against requestor specs",
          when: "All day, every day",
          today: "Manual lookup + carrier-portal navigation + Word merge",
          withAgentplain:
            "COI agent drafts ~80% to one-click-issue; CSR moves to the exceptions",
        },
        {
          job: "Push claim status updates to insureds",
          when: "When the carrier moves on a claim",
          today: "Reactive, batched",
          withAgentplain: "Claims agent drafts the status update; CSR reviews and sends",
        },
      ],
    },
  ],

  roi: {
    multiplier: "11x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
    outputValue: "$27,000 / yr per CSR seat saved",
    math:
      "1 CSR @ $52k all-in × 30% of day on COIs (per b2b_vertical_opportunity_analysis_2026-04-27.md §3.2) = $15,600/yr in COI labor alone. Add renewal-prep reclamation (~$11,400/yr) and the per-CSR floor is ~$27k/yr returned, against a solo Regular-tier seat at $199/mo ($2,388/yr) — 11x at one CSR. A 50-seat agency on the $99 floor runs ~23x+ on the same inputs.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (per-seat ladder, locked 2026-05-09). ROI band per `project_pricing_value_anchor.md` (Regular-tier value $2,900–$10,600/mo per seat). COI labor share per `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.2 (\"one CSR can spend 30%+ of the day on it\"). Salary midpoint based on US BLS 2024 SOC 13-2053 (claims/policy processing clerks) — flagged in capability inbox as a primary-research target before first design partner ratifies the math.",
  },

  claims: {
    replace: [
      "~30% of every CSR's day on certificate-of-insurance generation",
      "Manual renewal-proposal prep — pulling declarations, comparing quotes, drafting the memo",
      "Tribal-knowledge carrier appetite tracking — replaced by a weekly carrier-intel pulse",
      "Reactive claims-status communication — replaced by a drafted update on every carrier movement",
    ],
    integrate: [
      "EZLynx (AMS + comparative rater)",
      "Applied Epic (AMS)",
      "AMS360 (AMS)",
      "HawkSoft (AMS)",
      "AgencyZoom (retention sequences)",
      "Carrier portals — Travelers, Liberty Mutual, Nationwide, Progressive, Safeco, Hartford, Chubb, and 8+ regional",
      "Outlook + Microsoft 365 Graph",
    ],
    augment: [
      "Producer review on every drafted renewal proposal — the agent drafts, the producer signs",
      "Coverage-gap analysis — flagged with citation to the declaration line, not invented",
      "Cross-sell prompts — surfaced with policy-level evidence, never blind",
      "E&O posture — every draft logged with policy context for the agency's audit trail",
    ],
  },

  integrations: {
    shipped: [],
    planned: [
      { name: "EZLynx", category: "AMS" },
      { name: "Applied Epic", category: "AMS" },
      { name: "AMS360", category: "AMS" },
      { name: "HawkSoft", category: "AMS" },
      { name: "Vertafore PL Rating", category: "Comparative rater" },
      { name: "AgencyZoom", category: "Retention" },
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
      { name: "Top-12 carrier portals", category: "Carrier" },
    ],
    plannedWindow: "Q3 2026",
  },

  valueLoopExample: {
    scenario:
      "Renewal week. 47 commercial accounts hit their 60-day renewal window on Monday.",
    before:
      "Manually pull each policy in EZLynx, rerate against current carrier appetites, flag the accounts most likely to non-renew or get hit with a premium hike, draft retention outreach for each. ~3 days of producer time.",
    after:
      "The fleet rerated all 47 against current pricing, flagged the 9 highest non-renewal risks with a one-line reason each, drafted retention notes in the agency's voice, and queued them for review. Carrier-appetite mismatches are surfaced before the renewal deadline.",
    outcome:
      "Three days of work compresses to one morning of review. The producer handles relationships; the fleet handles the rerating.",
  },
};
