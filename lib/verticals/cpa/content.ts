import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4 (accounting
// firms, 2–10 person, composite 34). Fleet shape and operational pain
// points cited.
//
// JTBD ratified 2026-05-12 against published role workflows for solo /
// 2–10 partner CPA firms (AICPA scope-of-practice, PCPS firm survey role
// definitions, Karbon/TaxDome public role docs). Five roles surfaced —
// Partner/owner-CPA, Staff accountant (tax preparer), Audit/assurance
// senior, Client services manager, Admin. Audit/assurance applies to the
// subset of firms that do assurance work; pure tax-and-bookkeeping shops
// can ignore that row.
//
// Pricing: recommended at Partner tier per `project_stripe_both_surfaces.md`
// (2026-05-15 — three customer-facing tiers Regular / Partner / Max). Partner
// is the recommended starting tier for CPA practices because tax-season
// cadence benefits from the 4 hrs/mo of named-service-partner reserved time
// (review-gate adjustment, state-pack iteration, monthly business review).
// The schema enum on disk stays `plus`; `lib/pricing/tiers.ts` →
// `tierDisplayName("plus")` returns "Partner" so the customer never sees
// the on-disk identifier. State-specific compliance corpus and bespoke
// practice-mgmt integrations still route to /custom.

export const cpa: VerticalContent = {
  slug: "cpa",
  name: "CPA firms",
  tier: "plus",
  missionSubject: "CPAs and tax practices",

  // Fleet surfaced in-product on /agents, grounded in the CPA JTBD tables.
  // Client Inbound is the live capability — it owns the inbox loop's
  // buyer-inquiry bucket (classify + first-touch draft). Every other agent
  // declares honestly via rootingNote what integration unlocks the runtime,
  // matching the realty 2-live/5-rooting discipline.
  agentRoster: [
    {
      slug: "cpa-onboarding",
      name: "Engagement Onboarding",
      job: "Drafts the engagement letter and doc checklist scoped to entity type and state.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your practice-management system (TaxDome / Karbon / Canopy) is connected.",
    },
    {
      slug: "cpa-doc-chase",
      name: "Document Chase",
      job: "Runs the missing-document cadence per client through the season.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your tax-software client portal is connected.",
    },
    {
      slug: "cpa-compliance-sentinel",
      name: "Compliance Sentinel",
      job: "Runs the federal and state checklist before a return hits the partner's desk.",
      runtime: "rooting",
      rootingNote:
        "rooting now — federal and per-state checklist corpus is loaded; draft scoring activates after counsel review.",
    },
    {
      slug: "cpa-books-recon",
      name: "Books Reconciler",
      job: "Drafts the books reconciliation against bank feeds; staff reviews exceptions.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once QuickBooks Online or Xero plus the bank feed is connected.",
    },
    {
      slug: "cpa-collections",
      name: "Collections",
      job: "Drafts the 30/60/90 aged-AR escalation for the partner to sign.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your AR feed (QuickBooks Online / practice-mgmt billing) is connected.",
    },
    {
      slug: "cpa-billing",
      name: "Milestone Billing",
      job: "Drafts the invoice on each milestone trigger for the admin to send.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your practice-management billing module is connected.",
    },
    {
      slug: "cpa-client-inbound",
      name: "Client Inbound",
      job: "Classifies inbound questions by engagement and drafts the response.",
      runtime: "live",
      owns: ["buyer-inquiry"],
    },
    {
      // Horizontal chief-of-staff capability — proposals only, no execution.
      slug: "cpa-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the partner's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for small CPA and tax practices",
    headline: "The fleet for the small-firm CPA.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. Practice-management and tax-prep
    // vendors (TaxDome / Karbon / Lacerte / UltraTax / Drake / ProSeries / Xero)
    // live in the per-vertical integration roadmap below and surface honestly
    // there as planned, not in this present-tense hero clause.
    valueProp:
      "agentplain REPLACES the 8-week document-chase cycle, INTEGRATES with Outlook, OneDrive, QuickBooks Online, and DocuSign on day one, and AUGMENTS the partner's review on every return with a federal + state checklist run before the file hits the desk.",
    sbmSubhead:
      "The tax-season skills, agents, and memory you'd otherwise have to build yourself — built on Claude, configured by us.",
  },

  metaTitle: "for CPA firms — 2–10 person practices",
  metaDescription:
    "An agentic fleet for the solo or 2–10 partner CPA firm doing 1040s + 1120-S + bookkeeping retainers. Engagement-letter onboarding, document chase, compliance review, books reconciliation, and milestone billing — drafted for the partner's review and sent from your own systems.",

  jtbdTables: [
    {
      role: "Partner / owner-CPA",
      draft: false,
      rows: [
        {
          job: "Know which returns are at risk of missing deadline",
          when: "Daily during tax season",
          today: "Walk staff desks, ask the admin",
          withAgentplain:
            "Pipeline view — every file with current bottleneck (doc gap / staff prep / partner review / e-file)",
        },
        {
          job: "Review a return before e-file",
          when: "Pre-submit, every return",
          today: "Eyeball the staff prep + your own checklist",
          withAgentplain:
            "Compliance agent has already run federal + state checklist; you review the flagged items only",
        },
        {
          job: "Approve a billing-collections escalation",
          when: "Monthly",
          today: "Spreadsheet of aged AR",
          withAgentplain:
            "Collections agent drafts the 30/60/90 escalation; partner signs the >60-day touch",
        },
      ],
    },
    {
      role: "Staff accountant / tax preparer",
      draft: false,
      rows: [
        {
          job: "Build the doc checklist for a new engagement",
          when: "Day 1 of every new engagement",
          today: "TaxDome / Karbon template, customize by hand",
          withAgentplain:
            "Onboarding agent drafts the checklist scoped to entity type + state + prior-year docs",
        },
        {
          job: "Chase clients for missing documents",
          when: "8 weeks every tax season",
          today: "Email reminders + phone tag",
          withAgentplain:
            "Doc-chase agent runs the cadence per client; staff handles the escalations",
        },
        {
          job: "Reconcile client books against bank feeds",
          when: "Monthly for bookkeeping clients",
          today: "Manual classification + JE drafting",
          withAgentplain:
            "Books agent drafts the reconciliation; staff reviews exceptions only",
        },
      ],
    },
    {
      role: "Audit / assurance senior",
      draft: false,
      rows: [
        {
          job: "Build the engagement plan from prior-year workpapers",
          when: "Engagement kickoff",
          today: "Roll forward prior workpapers in CaseWare / CCH ProSystem fx Engagement; update for current-year scope",
          withAgentplain:
            "Roll-forward agent drafts updated workpapers, flags the items that changed, drafts the client request list — senior reviews the planning judgment",
        },
        {
          job: "Run analytical procedures and document the variance commentary",
          when: "Continuous through fieldwork",
          today: "Manual variance spreadsheet + hand-written narrative",
          withAgentplain:
            "Analytical agent drafts the variance against PY + budget, drafts the narrative with the explanation cited to the GL detail",
        },
        {
          job: "Draft management-letter comments + recommendations",
          when: "Engagement wrap-up",
          today: "Hand-drafted from fieldwork notes",
          withAgentplain:
            "ML agent drafts each comment + recommendation citing the specific finding; senior reviews and the partner signs",
        },
      ],
    },
    {
      role: "Client services manager",
      draft: false,
      rows: [
        {
          job: "Coordinate the multi-engagement client relationship",
          when: "Continuous for advisory + tax + assurance clients",
          today: "Spreadsheet of engagements, manual deadline tracking, email chain per touch",
          withAgentplain:
            "CSM agent surfaces the client's open engagements, drafts the unified status update, flags the cross-engagement risks (e.g., tax position that needs assurance flag)",
        },
        {
          job: "Run the quarterly client check-in",
          when: "Quarterly",
          today: "30–45 min prep per client pulling from Karbon/TaxDome + prior-year file",
          withAgentplain:
            "Prep agent drafts the recap, the open items, the advisory talking points; CSM reviews and runs the call",
        },
        {
          job: "Handle inbound client questions across engagement types",
          when: "All day",
          today: "Triage by ear, route to whoever knows the file",
          withAgentplain:
            "Inbound agent classifies by engagement, attaches the relevant workpaper or return context, drafts the response for the CSM",
        },
      ],
    },
    {
      role: "Admin",
      draft: false,
      rows: [
        {
          job: "Send engagement letters",
          when: "Pre-engagement, all year",
          today: "Manual template merge",
          withAgentplain: "Onboarding agent drafts the letter scoped to the engagement type",
        },
        {
          job: "Run billing on milestone",
          when: "Per-deliverable",
          today: "Manual invoice from TaxDome / Karbon",
          withAgentplain:
            "Billing agent drafts the invoice on milestone trigger; admin reviews and sends",
        },
        {
          job: "Manage e-signature routing for engagement letters + 8879s",
          when: "Per-engagement + per-return",
          today: "Manual DocuSign / TaxDome eSign send + reminder cadence",
          withAgentplain:
            "Signature agent assembles the packet, routes to signers, runs the reminder cadence with admin in the loop",
        },
      ],
    },
  ],

  roi: {
    multiplier: "12x–18x",
    inputCost: "Partner tier · $299 per seat (solo), sliding to $199 per seat (50–99 seats) — first month free, includes 4 hrs/mo of named-service-partner time",
    outputValue: "$42,000 / yr in tax-season hour reclamation per staff seat",
    math:
      "Tax season = 80-hour weeks. Doc-chase consumes ~25% of staff hours through 8 weeks (per b2b_vertical_opportunity_analysis_2026-04-27.md §3.4 — \"document chase consumes the front office for 8 weeks a year\"). 0.25 × 80 hours × 8 weeks × $65/hr loaded = $10,400 per staff per season. Add onboarding-letter automation and books-recon reclamation: total ~$42k/yr (~$3,500/mo) per staff seat. Solo case: against the Partner-tier solo seat ($299/mo) = ~12x ROI. At-scale case: same per-staff value against the 50-seat-band price ($199/mo) = ~18x. The 4 hrs/mo of named-service-partner time bundled with Partner is treated as commitment, not as ROI uplift here — primary research will reset this once first design partner signs. Customers needing bespoke compliance corpora, white-label, or 100+ seats route to Max (quote-based) or /custom (capability build).",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Partner tier per 2026-05-15 ratification; per-seat ladder $299→$199 with 4 hrs/mo of named-service-partner time included). ROI band per `project_pricing_value_anchor.md` (Partner-tier value scales with Regular's $2,900–$10,600/mo per seat plus the named-partner overlay). Doc-chase share cited from `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4. Staff-loading rate is operator-modeled — flagged in capability inbox for primary-research validation.",
    violationAvoidance:
      "Tax and advisory correspondence is governed by the AICPA Code of Professional Conduct and Treasury Circular 230 — a preparer position that understates a client's liability carries an IRC §6694 penalty of $1,000 (unreasonable position) or $5,000 (willful or reckless conduct) per return, on top of Circular 230 censure, suspension, or disbarment from practice before the IRS. The fleet drafts client letters, engagement notes, and filing-ready work; a credentialed person approves before anything is sent or filed, so a Circular 230 slip is corrected at the draft stage rather than assessed as a preparer penalty. That avoided exposure is real ROI the 12x–18x hours math leaves out, and it only holds because nothing auto-executes.",
  },

  claims: {
    replace: [
      "Manual engagement-letter and doc-checklist customization",
      "8 weeks of document-chase phone tag and email reminders",
      "Manual books reconciliation against bank feeds",
      "Spreadsheet-driven aged AR — replaced by drafted 30/60/90 escalations",
    ],
    integrate: [
      "Outlook (per-staff OAuth — email + calendar)",
      "OneDrive + Excel (working files + workbook reads)",
      "QuickBooks Online (write-up + bookkeeping reads)",
      "DocuSign (engagement letters + 8879 routing)",
    ],
    augment: [
      "Partner review on every return — staff prep is pre-flagged against federal + state checklist",
      "State-specific rule compliance — every flag cites the rule text, not invented",
      "Engagement letter language — drafted with engagement-type-specific scope language",
      "Books JE drafting — drafted with bank-feed evidence; partner approves",
    ],
  },

  integrations: {
    shipped: [],
    planned: [
      { name: "TaxDome", category: "Practice mgmt" },
      { name: "Karbon", category: "Practice mgmt" },
      { name: "Canopy", category: "Practice mgmt" },
      { name: "Lacerte", category: "Tax prep" },
      { name: "UltraTax", category: "Tax prep" },
      { name: "Drake", category: "Tax prep" },
      { name: "ProSeries", category: "Tax prep" },
      { name: "CCH ProSystem fx Engagement", category: "Audit workpapers" },
      { name: "CaseWare", category: "Audit workpapers" },
      { name: "QuickBooks Online", category: "Accounting" },
      { name: "Xero", category: "Accounting" },
      { name: "SmartVault / Box", category: "Document storage" },
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    plannedWindow: "Q4 2026",
  },

  valueLoopExample: {
    scenario:
      "March 17, 5:42pm. Eight days to the corporate-return deadline. 23 clients still missing documents.",
    before:
      "Open every TaxDome client file, run the missing-doc checklist, draft individual chase emails ('still need your K-1, your auto-mileage log, your fixed-asset additions...'), keep a running list of who's responded. ~6 hours per evening through deadline week.",
    after:
      "The fleet ran the missing-doc checklist across all 23 files, drafted 23 individualized chase emails citing the specific missing items, identified the 4 clients on filing extensions and skipped them, and queued the messages in the partner's review tray.",
    outcome:
      "The partner reviews 19 drafts in 35 minutes. By March 18 noon, 17 clients have responded. The partner spends the eight days advising on close cases, not chasing receipts.",
  },
};
