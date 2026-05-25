import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.2 (insurance
// brokerages — composite 35, tied #1 in the ranked analysis). The fleet
// shape and operational pain points come from that analysis.
//
// JTBD ratified 2026-05-12 against published role workflows for the 3–15
// producer independent P&C agency (Big "I" Best Practices role definitions,
// NAPSLO scope-of-practice for E&S, NAIC producer-vs-CSR split). Four
// roles: Agency principal, Producer, Account Manager (mid-market handler),
// CSR (high-volume admin). Larger agencies separate Producer and AM; smaller
// shops collapse the two — both are surfaced so the JTBD reads regardless
// of org shape.

export const insurance: VerticalContent = {
  slug: "insurance",
  name: "Insurance brokerages",
  tier: "regular",
  missionSubject: "insurance brokers and agencies",

  // Fleet surfaced in-product on /agents, grounded in the insurance JTBD
  // tables. Inbound Triage owns the V1 inbox loop's buyer-inquiry bucket
  // (intent classify + first-touch draft for COI / FNOL / billing /
  // service inbound). Every other agent rooting on an AMS + carrier-
  // portal connection.
  agentRoster: [
    {
      slug: "insurance-inbound-triage",
      name: "Inbound Triage",
      job: "Classifies COI requests, claim FNOLs, and service questions and drafts the first-touch reply.",
      runtime: "live",
      owns: ["buyer-inquiry"],
    },
    {
      slug: "insurance-coi-generator",
      name: "COI Generator",
      job: "Reads the COI request, pulls the policy, and drafts the certificate for one-click issue.",
      runtime: "live",
      // Live via the deterministic insurance-coi-request skill — works on a
      // JSON-stub AMS today; binds to EZLynx / Applied Epic / AMS360 / HawkSoft
      // MCPs once they ship. Never quotes a premium or binding date — every
      // quantitative claim defers to an {{operator: ...}} merge field.
      boundSkill: "insurance-coi-request",
    },
    {
      slug: "insurance-renewal-coordinator",
      name: "Renewal Coordinator",
      job: "Drafts 60/30/15-day renewal proposals with coverage-gap flags and carrier-appetite context.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your AMS and comparative rater are connected for declarations + rerate data.",
    },
    {
      slug: "insurance-claims-status",
      name: "Claims Status",
      job: "Drafts the insured-facing status note on every carrier-side claim movement.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once carrier claim portals or the AMS claims feed are connected.",
    },
    {
      slug: "insurance-endorsement",
      name: "Endorsement Coordinator",
      job: "Drafts the AMS update and the carrier-portal endorsement submission from the insured request.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your AMS and the carrier portals you write the most premium with are connected.",
    },
    {
      slug: "insurance-billing-recon",
      name: "Billing Reconciler",
      job: "Reconciles direct-bill carrier statements against the AMS and drafts the insured-facing explanation.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your AMS billing module and carrier direct-bill statements are connected.",
    },
    {
      slug: "insurance-carrier-intel",
      name: "Carrier Intel",
      job: "Posts the weekly carrier-appetite pulse and flags appetite shifts on in-flight accounts.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your AMS account book and carrier bulletin feeds are connected.",
    },
    {
      // Horizontal chief-of-staff capability — proposals only, no execution.
      slug: "insurance-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the producer's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
    },
  ],

  hero: {
    eyebrow: "Built for independent P&C agencies",
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
      draft: false,
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
      draft: false,
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
      role: "Account manager",
      draft: false,
      rows: [
        {
          job: "Service mid-market commercial accounts between renewals",
          when: "Continuous, account-book of 50–150 accounts",
          today: "Reactive — phone calls and email pile up; renewal-prep crowds out service work",
          withAgentplain:
            "Service agent drafts policy-change confirmations, endorsement requests to carriers, and insured-facing summaries — AM signs and sends",
        },
        {
          job: "Process endorsements and mid-term changes",
          when: "Inbound, daily",
          today: "Re-key request into the AMS + each affected carrier portal",
          withAgentplain:
            "Endorsement agent reads the insured's request, drafts the AMS update and the carrier-portal submission in parallel; AM reviews exceptions",
        },
        {
          job: "Maintain account-level loss-run records",
          when: "Pre-renewal (90 days out) and on claim activity",
          today: "Request loss runs from each carrier, paste into spreadsheet, re-share with insured",
          withAgentplain:
            "Loss-run agent requests, normalizes, and drafts the insured-facing loss-history summary across all carriers on the account",
        },
        {
          job: "Cross-sell on a renewal touch",
          when: "Renewal-window driven",
          today: "Producer-led, ad hoc, often skipped under load",
          withAgentplain:
            "Renewal agent surfaces coverage-gap candidates with policy-line evidence; AM and producer decide which to raise",
        },
      ],
    },
    {
      role: "CSR",
      draft: false,
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
        {
          job: "Process billing inquiries and direct-bill discrepancies",
          when: "1st–10th of every month",
          today: "Pull the bill, compare carrier vs. AMS, draft the insured response",
          withAgentplain:
            "Billing agent reconciles the carrier-bill vs. AMS-bill, drafts the insured-facing explanation citing the discrepancy line",
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
      "Pricing per `project_stripe_both_surfaces.md` (Regular tier per the 2026-05-15 three-tier ratification — Regular is the default entry path; agencies wanting named-service-partner reserved time can step up to Partner ($299→$199/seat), and high-intensity engagements route to Max (quote-based)). ROI band per `project_pricing_value_anchor.md` (Regular-tier value $2,900–$10,600/mo per seat). COI labor share per `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.2 (\"one CSR can spend 30%+ of the day on it\"). Salary midpoint based on US BLS 2024 SOC 13-2053 (claims/policy processing clerks) — flagged in capability inbox as a primary-research target before first design partner ratifies the math.",
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
