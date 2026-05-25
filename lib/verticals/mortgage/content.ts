import type { VerticalContent } from "../types";

// Sources: `b2b_vertical_opportunity_analysis_2026-04-27.md` (insurance §3.2
// is the structural analog — same recurring-admin density, same compliance
// posture, same per-portal integration set with carriers replaced by
// wholesale lenders and AUS systems).
//
// JTBD ratified 2026-05-12 against published role workflows for the 2–10-LO
// independent mortgage brokerage (loanofficerhub.com role definitions, NMLS
// SAFE Act role boundaries, NAMB scope of practice). Underwriter is NOT
// surfaced as a JTBD role here — independent brokers route to wholesale-
// lender underwriters; they do not employ in-house UWs. Correspondent /
// banker shops that DO employ in-house UWs route to /custom. Flagged in
// audit.md as [VERIFY — applies if/when vertical scope expands to bankers].

export const mortgage: VerticalContent = {
  slug: "mortgage",
  name: "Mortgage brokerages",
  tier: "regular",
  missionSubject: "mortgage brokers and loan officers",

  // Fleet surfaced in-product on /agents, grounded in the mortgage JTBD tables.
  // Runtime bindings follow the realty pattern (lib/verticals/real-estate/content.ts):
  // `live` agents are wired into the V1 inbox loop so /agents shows real handoff
  // counts as soon as borrower email flows. `rooting` agents declare the capability
  // but state honestly what integration unlocks the runtime — no perpetual spinner.
  // Borrower Triage maps 1:1 to the loop's buyer-inquiry bucket (intent classify +
  // first-touch reply); every other agent in this roster needs a system-of-record
  // integration that does not yet exist (LOS / AUS / wholesale portals / pricing).
  agentRoster: [
    {
      slug: "mortgage-borrower-triage",
      name: "Borrower Triage",
      job: "Classifies inbound borrower intent and drafts the first touch.",
      runtime: "live",
      owns: ["buyer-inquiry"],
    },
    {
      slug: "mortgage-document-chase",
      name: "Document Chase",
      job: "Runs the per-file doc-collection cadence and escalates only when stuck.",
      runtime: "live",
      // Live via the mortgage-document-chase skill — works on a JSON-stub LOS
      // today; binds to Encompass / LendingPad / Calyx MCPs once they ship.
      // Drafts ONE batched borrower email per file (never one-per-doc spam);
      // stuck items surface a phone-call nudge to the LO. Rate / APR / DTI
      // language always defers to {{operator: rate/APR}}.
      boundSkill: "mortgage-document-chase",
    },
    {
      slug: "mortgage-status-updater",
      name: "Status Updater",
      job: "Drafts a borrower status note on every milestone for the LO to send.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your LOS milestones webhook is connected.",
    },
    {
      slug: "mortgage-pre-qual",
      name: "Pre-Qual Assistant",
      job: "Pulls pricing and AUS eligibility to draft a pre-qual letter in minutes.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once Optimal Blue and DU / LP are connected.",
    },
    {
      slug: "mortgage-conditions",
      name: "Conditions Coordinator",
      job: "Translates UW conditions into a borrower note and the doc list to clear them.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your LOS conditions feed is connected.",
    },
    {
      slug: "mortgage-vendor-coordination",
      name: "Vendor Coordination",
      job: "Orders appraisal and title, tracks status, and flags slipping files.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once appraisal-management and title vendor portals are connected.",
    },
    {
      slug: "mortgage-production-reporter",
      name: "Production Reporter",
      job: "Drafts the weekly LO production read against plan.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your LOS pipeline export is connected.",
    },
    {
      // Horizontal chief-of-staff capability — proposals only, no execution.
      slug: "mortgage-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the LO's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
    },
  ],

  hero: {
    eyebrow: "Built for independent mortgage brokerages",
    headline: "The fleet for the independent loan-officer office.",
    valueProp:
      "agentplain REPLACES the document-chase that drowns every loan file, INTEGRATES with your LOS, wholesale lender portals, and DU/LP, and AUGMENTS the loan officer's read on every borrower interaction and TRID-sensitive disclosure.",
  },

  metaTitle: "agentplain for mortgage brokerages — independent loan-officer offices",
  metaDescription:
    "An agentic fleet for the 2–10 loan-officer independent mortgage brokerage. Borrower triage, document collection, status updates, RESPA/TRID-aware compliance review on consumer-facing communication, and pipeline reporting — coordinated across Encompass, Calyx Point, LendingPad, and Optimal Blue.",

  jtbdTables: [
    {
      role: "Owner / branch manager",
      draft: false,
      rows: [
        {
          job: "Know which files are stalled and why",
          when: "Morning open",
          today: "Walk LO desks, ping the processor",
          withAgentplain:
            "Pipeline view — every file with current bottleneck (doc gap / VOE / UW condition / appraisal)",
        },
        {
          job: "Triage a regulatory inquiry on a recent disclosure",
          when: "Reactive, time-sensitive",
          today: "Pull the file, retrace the disclosure clock by hand",
          withAgentplain:
            "Per-file activity feed — every TRID-clock-relevant event timestamped and audit-logged",
        },
        {
          job: "See LO production vs. plan",
          when: "Weekly",
          today: "Manual LOS export → spreadsheet",
          withAgentplain: "Production-reporter agent drafts the weekly read",
        },
        {
          job: "Approve a pricing-exception or rate-lock extension",
          when: "Ad hoc, urgent",
          today: "Phone / Teams approval; no audit trail back to the lock desk",
          withAgentplain:
            "Lock-desk agent drafts the exception memo with cost-to-extend math; branch manager signs with one click",
        },
      ],
    },
    {
      role: "Loan officer",
      draft: false,
      rows: [
        {
          job: "Run inbound borrower triage",
          when: "All day, every day",
          today: "Phone tag + reactive email",
          withAgentplain:
            "Inbound agent classifies intent, attaches lead context, drafts first-touch in <2 minutes",
        },
        {
          job: "Chase a borrower for missing documents",
          when: "Continuous through the pipeline",
          today: "Manual reminders, lose 3–7 days per file",
          withAgentplain:
            "Doc-chase agent runs the cadence, drafts the borrower-facing note, escalates only when stuck",
        },
        {
          job: "Update a borrower on status mid-pipeline",
          when: "Twice a week per active file",
          today: "Borrower calls you — reactive",
          withAgentplain:
            "Status agent drafts the update on every milestone; LO signs and sends from their own system",
        },
        {
          job: "Pre-qualify a referral against current pricing + guidelines",
          when: "Inbound from realtor partners, sub-hour expected",
          today: "Open Optimal Blue, run a scenario, redraw guidelines, draft a referral-back email",
          withAgentplain:
            "Pre-qual agent pulls Optimal Blue scenario + DU eligibility, drafts the pre-qual letter and the realtor-facing summary in <5 minutes",
        },
      ],
    },
    {
      role: "Processor",
      draft: false,
      rows: [
        {
          job: "Build the document checklist for a new file",
          when: "Day 1 of every file",
          today: "Pull the LOS template, customize by hand",
          withAgentplain:
            "Onboarding agent builds the checklist scoped to loan type + occupancy + property type",
        },
        {
          job: "Reconcile UW conditions back to the file",
          when: "After every UW review",
          today: "Translate condition language, route to LO",
          withAgentplain:
            "Conditions agent drafts the borrower-facing translation + the doc list to close it",
        },
        {
          job: "Order appraisal + title and track to CD",
          when: "Continuous through every file",
          today: "Vendor portal logins + manual status nags",
          withAgentplain:
            "Vendor-coordination agent submits orders, polls for status, and flags slipping files before they affect the closing date",
        },
      ],
    },
  ],

  roi: {
    multiplier: "9x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
    outputValue: "$22,000 / yr per LO seat in cycle-time reclamation",
    math:
      "Avg LO closes 3–5 loans/month; doc-chase delay averages 5 days/file. Cycle-time compression of 2 days/file × 4 files/mo × $250 avg gross margin/day-of-float = ~$24k/yr per LO. Against the solo Regular-tier seat ($199/mo, $2,388/yr) that's ~9x at one seat; teams sliding to $99/seat at 50+ LOs run ~20x+ on the same inputs. Storm-cycle and high-volume teams see materially more.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Regular tier per the 2026-05-15 three-tier ratification — Regular is the default entry path; mortgage shops wanting named-service-partner reserved time can step up to Partner ($299→$199/seat), and high-intensity multi-state engagements route to Max (quote-based)). Value math per `project_pricing_value_anchor.md` (Regular-tier ROI range 15x–107x). Loan-cycle and doc-chase reference points pending primary-research validation — flagged in capability inbox. Sales-cycle compression mechanism modeled on the roofing-supplement analog in `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3.",
  },

  claims: {
    replace: [
      "Manual doc-chase across the pipeline — automated cadence with drafted borrower notes",
      "Template-and-customize per-file checklist building — replaced by a loan-type-aware draft",
      "Reactive status communication — replaced by milestone-triggered drafts",
      "Spreadsheet-driven production reporting — replaced by weekly drafted reads",
    ],
    integrate: [
      "Encompass (ICE Mortgage Technology) — LOS",
      "Calyx Point — LOS",
      "LendingPad — LOS",
      "Optimal Blue — pricing engine",
      "DU / LP (Fannie / Freddie AUS)",
      "Wholesale lender portals — UWM, Rocket Pro TPO, Pennymac, AmeriHome, and 10+ regional",
      "Outlook + Microsoft 365 Graph",
    ],
    augment: [
      "LO review on every borrower-facing draft — the agent drafts, the LO signs",
      "TRID-clock-relevant events logged with timestamps the broker-of-record can defend",
      "UW-condition translation — borrower-facing language drafted from the raw condition text",
      "Pipeline forecasting — drafted with file-level evidence, not rolled-up wishfulness",
    ],
  },

  integrations: {
    shipped: [],
    planned: [
      { name: "Encompass", category: "LOS" },
      { name: "Calyx Point", category: "LOS" },
      { name: "LendingPad", category: "LOS" },
      { name: "Optimal Blue", category: "Pricing engine" },
      { name: "DU / LP", category: "AUS" },
      { name: "Wholesale lender portals", category: "Lender" },
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
      { name: "Total Expert", category: "Marketing CRM" },
    ],
    plannedWindow: "Q3 2026",
  },

  valueLoopExample: {
    scenario:
      "Marcus's borrower texts at 11:47pm — 'Rates dropped again, can we relock?'",
    before:
      "Pull the loan file in Encompass, check current pricing in Optimal Blue, model the relock cost, draft a comparison email, run the numbers a second time before sending. ~30 minutes on a phone before bed.",
    after:
      "The fleet pulls the loan, runs a relock comparison against current pricing, drafts a borrower-ready email with the new monthly payment and the cost-to-relock, and queues it for Marcus's review. The borrower's full thread is summarized at the top.",
    outcome:
      "Marcus approves in two taps the next morning. Optimal Blue executes the relock; the borrower keeps the rate without a midnight phone call.",
  },
};
