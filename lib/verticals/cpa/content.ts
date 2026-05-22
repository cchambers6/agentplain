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
  agentRoster: [
    {
      slug: "cpa-onboarding",
      name: "Engagement Onboarding",
      job: "Drafts the engagement letter and doc checklist scoped to entity type and state.",
    },
    {
      slug: "cpa-doc-chase",
      name: "Document Chase",
      job: "Runs the missing-document cadence per client through the season.",
    },
    {
      slug: "cpa-compliance-sentinel",
      name: "Compliance Sentinel",
      job: "Runs the federal and state checklist before a return hits the partner's desk.",
    },
    {
      slug: "cpa-books-recon",
      name: "Books Reconciler",
      job: "Drafts the books reconciliation against bank feeds; staff reviews exceptions.",
    },
    {
      slug: "cpa-collections",
      name: "Collections",
      job: "Drafts the 30/60/90 aged-AR escalation for the partner to sign.",
    },
    {
      slug: "cpa-billing",
      name: "Milestone Billing",
      job: "Drafts the invoice on each milestone trigger for the admin to send.",
    },
    {
      slug: "cpa-client-inbound",
      name: "Client Inbound",
      job: "Classifies inbound questions by engagement and drafts the response.",
    },
  ],

  hero: {
    eyebrow: "Built for small CPA and tax practices",
    headline: "The fleet for the small-firm CPA.",
    valueProp:
      "agentplain REPLACES the 8-week document-chase cycle, INTEGRATES with TaxDome / Karbon, Lacerte / UltraTax / Drake, and QuickBooks / Xero, and AUGMENTS the partner's review on every return with a federal + state checklist run before the file hits the desk.",
  },

  metaTitle:
    "agentplain for CPA firms — 2–10 person practices",
  metaDescription:
    "An agentic fleet for the solo or 2–10 partner CPA firm doing 1040s + 1120-S + bookkeeping retainers. Engagement-letter onboarding, document chase, compliance review, books reconciliation, and milestone billing — coordinated across TaxDome, Karbon, Lacerte, UltraTax, Drake, QuickBooks, and Xero.",

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
    multiplier: "12x",
    inputCost: "Partner tier · $299 per seat (solo), sliding to $199 per seat (50–99 seats) — first month free, includes 4 hrs/mo of named-service-partner time",
    outputValue: "$42,000 / yr in tax-season hour reclamation per staff seat",
    math:
      "Tax season = 80-hour weeks. Doc-chase consumes ~25% of staff hours through 8 weeks (per b2b_vertical_opportunity_analysis_2026-04-27.md §3.4 — \"document chase consumes the front office for 8 weeks a year\"). 0.25 × 80 hours × 8 weeks × $65/hr loaded = $10,400 per staff per season. Add onboarding-letter automation and books-recon reclamation: total ~$42k/yr per staff against the solo Partner-tier seat at $299/mo ($3,588/yr) = ~12x at one seat. A 3-staff firm sees ~$126k/yr in reclamation against $10,044/yr of subscription (3 seats × $279/mo at the 2–9 band) — ~12.5x at three seats. The 4 hrs/mo of named-service-partner time bundled with Partner is treated as commitment, not as ROI uplift here — primary research will reset this once first design partner signs. Customers needing bespoke compliance corpora, white-label, or 100+ seats route to Max (quote-based) or /custom (capability build).",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Partner tier per 2026-05-15 ratification; per-seat ladder $299→$199 with 4 hrs/mo of named-service-partner time included). ROI band per `project_pricing_value_anchor.md` (Partner-tier value scales with Regular's $2,900–$10,600/mo per seat plus the named-partner overlay). Doc-chase share cited from `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4. Staff-loading rate is operator-modeled — flagged in capability inbox for primary-research validation.",
  },

  claims: {
    replace: [
      "Manual engagement-letter and doc-checklist customization",
      "8 weeks of document-chase phone tag and email reminders",
      "Manual books reconciliation against bank feeds",
      "Spreadsheet-driven aged AR — replaced by drafted 30/60/90 escalations",
    ],
    integrate: [
      "TaxDome (practice management)",
      "Karbon (practice management)",
      "Canopy (practice management)",
      "Lacerte (tax prep)",
      "UltraTax (tax prep)",
      "Drake (tax prep)",
      "ProSeries (tax prep)",
      "CCH ProSystem fx Engagement (audit workpapers)",
      "CaseWare (audit workpapers)",
      "QuickBooks Online + Xero (write-up)",
      "SmartVault + Box (documents)",
      "Outlook + Microsoft 365 Graph",
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
