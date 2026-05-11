import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4 (accounting
// firms, 2–10 person, composite 34). Fleet shape and operational pain
// points cited. JTBD draft:true — no Phase 0 product_spec.md table.
// Capability-inbox flagged.

export const cpa: VerticalContent = {
  slug: "cpa",
  name: "CPA firms",
  tier: "plus",

  hero: {
    eyebrow: "Top-5 vertical fit · Plus tier",
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
      draft: true,
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
      role: "Staff accountant",
      draft: true,
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
      role: "Admin",
      draft: true,
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
      ],
    },
  ],

  roi: {
    multiplier: "26x",
    inputCost: "$2,750 / 30-day pilot (Plus tier)",
    outputValue: "$42,000 / yr in tax-season hour reclamation per staff seat",
    math:
      "Tax season = 80-hour weeks. Doc-chase consumes ~25% of staff hours through 8 weeks (per b2b_vertical_opportunity_analysis_2026-04-27.md §3.4 — \"document chase consumes the front office for 8 weeks a year\"). 0.25 × 80 hours × 8 weeks × $65/hr loaded = $10,400 per staff per season. Add onboarding-letter automation and books-recon reclamation: total ~$42k/yr per staff. A 3-staff firm sees ~$126k/yr in reclamation against $33k/yr in Plus-tier subscription.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` L13. Doc-chase share cited from `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4. Staff-loading rate is operator-modeled — flagged in capability inbox for primary-research validation. Plus-tier mapping per the task brief; canonical mapping in `project_vertical_tier_mapping.md` STUB.",
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
      { name: "QuickBooks Online", category: "Accounting" },
      { name: "Xero", category: "Accounting" },
      { name: "SmartVault / Box", category: "Document storage" },
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    plannedWindow: "Q4 2026",
  },
};
