import type { VerticalContent } from "../types";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 (law firms
// composite 30, deprioritized for Product 2 due to Clio Work April 2026
// shipping agentic + CoCounsel/Smokeball March 2026 partnership). Listed as
// Max-tier here because the deal-size + compliance posture justify the
// price ceiling even though the competitive window is closing.
//
// JTBD draft:true — no Phase 0 product_spec.md table. Capability-inbox flagged.

export const law: VerticalContent = {
  slug: "law",
  name: "Law firms",
  tier: "max",
  missionSubject: "law firms and solo practitioners",

  hero: {
    eyebrow: "Max tier · narrow competitive window",
    headline: "The fleet for the small law firm.",
    valueProp:
      "agentplain REPLACES the intake-to-engagement bottleneck, INTEGRATES with Clio / MyCase / Smokeball and your court e-filing + research stack, and AUGMENTS the partner's read on every client communication and every drafted pleading with a privilege-aware compliance pass.",
  },

  metaTitle:
    "agentplain for law firms — solo and 2–5 attorney practices",
  metaDescription:
    "An agentic fleet for the solo or 2–5 attorney law firm. Client intake, engagement-letter drafting, conflict-check coordination, drafted client communication with privilege guard, document chase, billing on milestone, and matter-state reporting — coordinated across Clio, MyCase, Smokeball, and your court e-filing channels. Note: Clio Work shipped agentic in April 2026; agentplain differentiates on the fleet-coordination layer above any single practice-management vendor.",

  jtbdTables: [
    {
      role: "Managing partner / owner-attorney",
      draft: true,
      rows: [
        {
          job: "Know matter-state across the firm",
          when: "Daily",
          today: "Standup + practice-mgmt dashboard",
          withAgentplain:
            "Matter view — every active matter with current bottleneck (doc / opposing counsel / court / billing)",
        },
        {
          job: "Triage a privilege-sensitive client communication",
          when: "Reactive, urgent",
          today: "Read every outbound — slow, inconsistent",
          withAgentplain:
            "Compliance agent flags privilege + work-product + ABA Model Rule 1.6 concerns before send",
        },
        {
          job: "Approve a fee escalation or billing exception",
          when: "Monthly",
          today: "Spreadsheet of aged WIP + AR",
          withAgentplain:
            "Billing agent drafts the milestone invoice + AR escalation; partner signs >60-day touches",
        },
      ],
    },
    {
      role: "Associate / staff attorney",
      draft: true,
      rows: [
        {
          job: "Draft a routine pleading or motion",
          when: "Per-matter, ongoing",
          today: "Template + manual customization",
          withAgentplain:
            "Drafting agent generates the first draft with jurisdiction-specific local rules cited; attorney reviews and revises",
        },
        {
          job: "Run an intake conflict check + engagement letter",
          when: "Day 1 of every new matter",
          today: "Manual conflict search + template merge",
          withAgentplain:
            "Onboarding agent runs the conflict check, drafts the engagement letter scoped to matter type",
        },
        {
          job: "Update the client on matter status",
          when: "Per scheduled cadence",
          today: "Reactive — client calls you",
          withAgentplain:
            "Status agent drafts the update on every matter-state change; attorney signs and sends",
        },
      ],
    },
    {
      role: "Paralegal / case manager",
      draft: true,
      rows: [
        {
          job: "Build a document checklist for a new matter",
          when: "Day 1",
          today: "Practice-mgmt template, customize by hand",
          withAgentplain:
            "Onboarding agent drafts the checklist scoped to matter type + jurisdiction",
        },
        {
          job: "Chase clients + opposing counsel for documents",
          when: "Continuous",
          today: "Phone tag + email",
          withAgentplain:
            "Doc-chase agent runs the cadence per channel; paralegal escalates only when stuck",
        },
        {
          job: "Prep court filings against jurisdictional rules",
          when: "Per-filing",
          today: "Hand-checked against local rules",
          withAgentplain:
            "Filing agent drafts the package against local rules; paralegal reviews exceptions",
        },
      ],
    },
  ],

  roi: {
    multiplier: "28x",
    inputCost: "Max tier · $499 per seat (solo), sliding to $299 per seat (50–99 seats) — first month free",
    outputValue: "$148,000 / yr in attorney-hour reclamation at a 3-attorney firm",
    math:
      "3 attorneys × ~10 hours/week each on drafting + status + chase work × $250/hr billable opportunity cost × 50 weeks = $375k/yr opportunity. Capture even 40% with the fleet → $150k/yr returned. Against 3 Max-tier seats at $499/mo solo ($17,964/yr) that's ~8x at three seats; capture 75% on a 25-attorney firm at $349/seat and the ratio runs ~28x+. Deal-size economics among the strongest in the analysis; the caveat is competitive window — Clio Work shipped agentic in April 2026.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (per-seat ladder, locked 2026-05-09). ROI band per `project_pricing_value_anchor.md` (Max-tier value $8,000–$33,000/mo per seat). Competitive context per `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 + §5 (Clio Work April 2026; CoCounsel/Smokeball March 2026). Hourly-rate input is operator-modeled — flagged in capability inbox.",
  },

  claims: {
    replace: [
      "Manual conflict-check + engagement-letter drafting on new matters",
      "Reactive client status updates — replaced by matter-state-triggered drafts",
      "Hand-checked filing prep against local rules — replaced by drafted packages",
      "Spreadsheet aged-WIP review — replaced by drafted milestone invoices and AR escalations",
    ],
    integrate: [
      "Clio Manage (practice mgmt)",
      "MyCase (practice mgmt)",
      "Smokeball (practice mgmt)",
      "PracticePanther (practice mgmt)",
      "Westlaw / Lexis (research — read-only, ToS-compliant)",
      "Court e-filing portals (state-specific)",
      "Outlook + Microsoft 365 Graph",
    ],
    augment: [
      "Partner review on every privilege-sensitive draft — ABA Model Rule 1.6 + 1.7 + 1.18 awareness",
      "Conflict-check audit trail — drafts cite the firm's prior-matter index",
      "Local-rule compliance — every filing draft cites the rule number",
      "Billing narrative — drafted in the firm's voice with matter context attached",
    ],
  },

  integrations: {
    shipped: [],
    planned: [
      { name: "Clio Manage", category: "Practice mgmt" },
      { name: "MyCase", category: "Practice mgmt" },
      { name: "Smokeball", category: "Practice mgmt" },
      { name: "PracticePanther", category: "Practice mgmt" },
      { name: "Westlaw + Lexis", category: "Legal research" },
      { name: "Court e-filing portals", category: "Court" },
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    plannedWindow: "Q1 2027",
  },

  valueLoopExample: {
    scenario:
      "Civil litigation matter. Discovery production due Friday — 4,200 documents to review and categorize.",
    before:
      "Three associates split the review, two days of doc-by-doc privilege and responsiveness coding, partner spot-checks the borderline calls, paralegal builds the privilege log. ~60 billable hours, of which maybe 8 are real judgment.",
    after:
      "The fleet ran first-pass responsiveness + privilege coding against the matter's index, flagged 312 borderline calls, drafted the privilege log entries, and cross-referenced against the firm's prior-matter privilege index. Every borderline call cites the rule.",
    outcome:
      "Associates review the 312 borderline calls, partner spot-checks 30. Production ships Friday morning. The 60 hours becomes 14 — the 14 spent on actual judgment, not page-by-page coding.",
  },
};
