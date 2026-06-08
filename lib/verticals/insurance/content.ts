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
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for independent P&C agencies",
    headline: "The fleet for the independent P&C agency.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. The AMS / comparative-rater /
    // carrier-portal adapters live in the per-vertical integration roadmap
    // below and surface honestly there as planned, not in this present-tense
    // hero clause.
    valueProp:
      "agentplain REPLACES the CSR hours spent on certificates of insurance and renewal prep, INTEGRATES with Outlook, OneDrive, and DocuSign on day one, and AUGMENTS the producer's read on every renewal proposal and claims update.",
    sbmSubhead:
      "The agency skills, agents, and memory you'd otherwise have to build yourself — built on Claude, configured by us.",
  },

  metaTitle: "for independent P&C insurance brokerages",
  metaDescription:
    "COI generation, renewal coordination, carrier-appetite intel, claims-status outreach, and commission reconciliation — for the 3–15 producer P&C agency.",

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
          today: "Line-match each carrier statement against the AMS by hand — 6–10 hours a month, and mistakes still accrue",
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
          today: "Look up the policy, navigate the carrier portal, merge the ACORD 25 by hand — ~30% of the CSR's day",
          withAgentplain:
            "COI agent reads the request, drafts the certificate against the producer's policy reference, routes for one-click issue",
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
    multiplier: "11x–23x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
    outputValue: "$27,000 / yr per CSR seat saved",
    math:
      "1 CSR @ $52k all-in × 30% of day on COIs (per b2b_vertical_opportunity_analysis_2026-04-27.md §3.2) = $15,600/yr in COI labor alone. Add renewal-prep reclamation (~$11,400/yr) and the per-CSR value is ~$27k/yr (~$2,250/mo) returned. Solo case: against the Regular-tier solo seat ($199/mo) = ~11x ROI. At-scale case: same per-CSR value against the 50-seat-band price ($99/mo) = ~23x. Multi-CSR agencies typically see the at-scale economics.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Regular tier per the 2026-05-15 three-tier ratification — Regular is the default entry path; agencies wanting named-service-partner reserved time can step up to Partner ($299→$199/seat), and high-intensity engagements route to Max (quote-based)). ROI band per `project_pricing_value_anchor.md` (Regular-tier value $2,900–$10,600/mo per seat). COI labor share per `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.2 (\"one CSR can spend 30%+ of the day on it\"). Salary midpoint based on US BLS 2024 SOC 13-2053 (claims/policy processing clerks) — flagged in capability inbox as a primary-research target before first design partner ratifies the math.",
    violationAvoidance:
      "Claims and policy correspondence falls under each state's adoption of the NAIC Unfair Claims Settlement Practices Act (Model Law 900) — penalties run from $1,000 to as much as $25,000 per violation, up to suspension or revocation of the insurer's license, and replacement-cost mis-statements draw their own state market-conduct fines. A tool that auto-sends a CSR's claim update can commit an unfair-claims violation in a single message; agentplain's fleet drafts the update and a licensed human approves it before it leaves, keeping the per-violation exposure off the books. That downside the approval gate removes is value the 11x–23x hours math never captures — and an auto-send competitor cannot promise to dodge it.",
  },

  claims: {
    replace: [
      "~30% of every CSR's day on certificate-of-insurance generation",
      "Manual renewal-proposal prep — pulling declarations, comparing quotes, drafting the memo",
      "Tribal-knowledge carrier appetite tracking — replaced by a weekly carrier-intel pulse",
      "Reactive claims-status communication — replaced by a drafted update on every carrier movement",
    ],
    integrate: [
      "Outlook (per-producer OAuth — email + calendar)",
      "OneDrive (working files + policy declarations)",
      "DocuSign (COI delivery + endorsement signatures)",
    ],
    augment: [
      "Producer review on every drafted renewal proposal — the agent drafts, the producer signs",
      "Coverage-gap analysis — flagged with citation to the declaration line, not invented",
      "Cross-sell prompts — surfaced with policy-level evidence, never blind",
      "E&O posture — every draft logged with policy context for the agency's audit trail",
    ],
  },

  integrations: {
    // Live today via OAuth — see `lib/integrations/marketplace.ts`.
    shipped: [
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    // Adapter built + tested behind the `PolicyLookup` port (wave-1b,
    // `lib/integrations/ezlynx-mcp/`). Going live needs EZLynx partner OAuth
    // credentials + `EZLYNX_ADAPTER_LIVE=on`.
    supported: [
      {
        name: "EZLynx",
        category: "AMS",
        note: "Reads the policy behind the certificate-of-insurance request loop. Connecting your EZLynx credential turns it on.",
      },
    ],
    planned: [
      { name: "Applied Epic", category: "AMS" },
      { name: "AMS360", category: "AMS" },
      { name: "HawkSoft", category: "AMS" },
      { name: "Vertafore PL Rating", category: "Comparative rater" },
      { name: "AgencyZoom", category: "Retention" },
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
