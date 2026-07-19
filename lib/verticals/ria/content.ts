import type { VerticalContent } from "../types";
import {
  TRIAL_PERIOD_DAYS,
  MONEY_BACK_GUARANTEE_DAYS,
} from "../../billing/facts";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 (financial
// advisors / RIAs, 1–10 advisor, composite 33).
//
// JTBD ratified 2026-05-12 against published role workflows for 1–10
// advisor independent RIA firms (Charles Schwab RIA Benchmarking Study
// role definitions, Investment Adviser Association scope-of-practice,
// Wealthbox/Redtail public role docs, SEC Form ADV Part 2A role boundaries).
// Five roles surfaced — Principal/lead advisor, Associate advisor/planner,
// Portfolio manager (where investment ops is separated from advice),
// Operations/CSA, Compliance officer (often outsourced or wears multiple
// hats at small RIAs).
//
// Pricing: recommended at Max tier per `project_stripe_both_surfaces.md`
// (2026-05-15 — three customer-facing tiers Regular / Partner / Max). Max is
// AD-HOC quote-based, not a fixed per-seat price; RIAs self-route to Max
// because fiduciary-aware depth, SEC Marketing Rule compliance corpus,
// custodian-portal integrations (Schwab / Fidelity / Pershing), and Form ADV
// Part 2A maintenance all require higher-intensity service than Regular's
// standard cadence. The `tier: "max"` field on disk drives the recommended-
// tier surface; `tierDisplayName("max")` returns "Max" so the customer-facing
// label is stable. Custom custodian-portal scrapers, custom planning-software
// integrations, or other capability builds we don't have yet still route to
// /custom (separate from Max — capability work, not service intensity).

export const ria: VerticalContent = {
  slug: "ria",
  name: "RIA practices",
  tier: "max",
  missionSubject: "RIAs and wealth advisors",

  directAnswer:
    "agentplain for RIAs is a managed AI service partnership for independent registered investment advisors and wealth practices. A service team installs a fleet that prepares for client meetings, writes post-meeting notes and tasks, runs plan-refresh cadences, and applies a fiduciary-aware review pass to client-facing communications — working inside Outlook, OneDrive, Excel, and DocuSign. The advisor reviews every client-facing draft before it goes out; the fleet drafts and proposes but never sends on its own.",

  verticalFaq: [
    {
      q: "How does agentplain handle fiduciary and compliance obligations?",
      a: "Within the augment model. The fleet drafts client-facing communications with a fiduciary-aware review pass and surfaces what needs attention for the advisor — it doesn't make the compliance determination or send anything. The advisor reviews every draft, and liability for licensed work stays with your firm.",
    },
    {
      q: "Is agentplain a replacement for my CRM or portfolio software?",
      a: "No. agentplain works inside the Outlook, OneDrive, Excel, and DocuSign you already run and replaces the manual work between them — meeting prep, post-meeting notes and tasks, plan-refresh cadences. It isn't a CRM or a portfolio-management system, and there's nothing to migrate.",
    },
    {
      q: "How much does agentplain cost for an RIA?",
      a: `RIAs are recommended at the Max tier — an ad-hoc service partnership quoted to your engagement and sold sales-led rather than by self-checkout, because the stakes per draft warrant a named partner and a weekly cadence. Every agentplain subscription is month-to-month, with a ${TRIAL_PERIOD_DAYS}-day free trial (card at signup) and a ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee on the first charge. Max engagements are quoted to scope.`,
    },
    {
      q: "Does the fleet send anything to clients on its own?",
      a: "No. Every draft — a meeting agenda, a follow-up note, a plan-refresh message — lands in your approval queue as a pending item. The fleet drafts and proposes; you approve and send from inside your own systems. It never auto-sends, moves money, or makes commitments on your behalf.",
    },
  ],

  // Fleet surfaced in-product on /agents, grounded in the RIA JTBD tables.
  // All seven capabilities are honestly rooting today. Each one depends on
  // a portfolio / CRM / planning surface that the RIA runs in (Wealthbox /
  // Redtail / Schwab Advisor Center / Fidelity Wealthscape / eMoney /
  // MoneyGuide / Black Diamond / Tamarac) plus Marketing-Rule corpus
  // counsel review before the runtime can attribute work. The V1 inbox
  // loop still produces draft client replies for RIA workspaces — those
  // land in Approvals under the generic inbox triage attribution. No
  // hollow shells: we are NOT pretending Meeting Prep runs without the
  // CRM + custodian feeds.
  agentRoster: [
    {
      slug: "ria-meeting-prep",
      name: "Meeting Prep",
      job: "Drafts the agenda, delta-since-last-meeting, and open task list per client.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your CRM (Wealthbox / Redtail) and your custodian feed are connected.",
    },
    {
      slug: "ria-meeting-notes",
      name: "Meeting Notes",
      job: "Drafts the recap and task list from the meeting capture for the advisor.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your meeting-capture tool (Zocks / Jump / Otter) is connected.",
    },
    {
      slug: "ria-compliance-sentinel",
      name: "Compliance Sentinel",
      job: "Runs an ADV, suitability, and Marketing Rule check before a draft is sent.",
      runtime: "rooting",
      rootingNote:
        "rooting now — the ADV, suitability, and Marketing Rule corpus is loaded; draft scoring activates after counsel review.",
    },
    {
      slug: "ria-planning-refresh",
      name: "Planning Refresh",
      job: "Drafts refreshed plan inputs scoped to a client's life event.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your planning software (eMoney / MoneyGuidePro / RightCapital) is connected.",
    },
    {
      slug: "ria-rebalance",
      name: "Rebalance",
      job: "Drafts the per-model trade list with drift cited for the PM to submit.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your portfolio system (Tamarac / Black Diamond / Orion) is connected.",
    },
    {
      slug: "ria-performance-reporter",
      name: "Performance Reporter",
      job: "Drafts the quarterly per-client performance narrative with cited attribution.",
      runtime: "live",
      // Live via the ria-client-update-draft skill — works on a JSON-stub
      // portfolio snapshot today; binds to Orion / Black Diamond / Tamarac
      // MCPs once they ship. NEVER renders dollar amounts; every figure is
      // an {{advisor: ...}} merge field the advisor confirms.
      boundSkill: "ria-client-update-draft",
    },
    {
      slug: "ria-aum-billing",
      name: "AUM Billing",
      job: "Drafts the quarter-close fee schedule; operations reviews exceptions.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your custodian feed is connected for quarter-end balances.",
    },
    {
      // Horizontal chief-of-staff capability — proposals only, no execution.
      slug: "ria-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the advisor's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for independent RIAs and wealth practices",
    headline: "The fleet for the independent RIA.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. CRM (Wealthbox / Redtail /
    // Salesforce FSC), planning (eMoney / RightCapital / MoneyGuidePro),
    // portfolio (Orion / Black Diamond / Tamarac), and custodian (Schwab /
    // Fidelity / Pershing) adapters live in the per-vertical integration
    // roadmap below and surface honestly there as planned, not in this
    // present-tense hero clause.
    valueProp:
      "agentplain REPLACES the meeting-prep + post-meeting documentation cycle, INTEGRATES with Outlook, OneDrive, Excel, and DocuSign on day one, and AUGMENTS the advisor's review on every client-facing communication with a fiduciary-aware compliance pass.",
    sbmSubhead:
      "The client-meeting skills, agents, and memory you'd otherwise have to build yourself",
  },

  metaTitle: "for independent RIAs and wealth advisors",
  metaDescription:
    "Client-meeting prep, post-meeting notes and tasks, plan-refresh cadence, and fiduciary-aware comms review — for the 1–10 advisor independent RIA firm.",

  jtbdTables: [
    {
      role: "Principal / lead advisor",
      draft: false,
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
            "Compliance agent (activating after counsel review) runs an ADV + suitability check; until then every draft is held for advisor approval",
        },
      ],
    },
    {
      role: "Associate advisor / planner",
      draft: false,
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
          today: "Type the recap from memory and scratch notes — ~30 minutes each",
          withAgentplain: "Note agent drafts; associate edits — 5 minutes",
        },
        {
          job: "Handle inbound client question",
          when: "All day",
          today: "Answer when it surfaces — from memory or by digging through the CRM, with no triage layer",
          withAgentplain:
            "Inbound agent classifies, attaches account context, drafts the response for advisor sign-off",
        },
      ],
    },
    {
      role: "Portfolio manager",
      draft: false,
      rows: [
        {
          job: "Run quarterly rebalancing across model portfolios",
          when: "Quarterly + on drift triggers",
          today: "Pull positions from custodian, run drift analysis in Orion/Tamarac/Black Diamond, draft trade tickets manually",
          withAgentplain:
            "Rebalance agent drafts the trade list per model with drift cited per position; portfolio manager reviews and submits to the custodian",
        },
        {
          job: "Generate quarterly performance reporting",
          when: "Quarterly",
          today: "Orion/Black Diamond/Tamarac report runs, manual narrative",
          withAgentplain:
            "Reporting agent drafts the per-client performance narrative with benchmark + attribution citations from the portfolio system",
        },
        {
          job: "Handle a security-specific question from an advisor",
          when: "Reactive",
          today: "Pull research / fundamentals / position-level context manually",
          withAgentplain:
            "Research agent drafts the position-level summary citing fund factsheet / 10-K / analyst note for the advisor's client conversation",
        },
      ],
    },
    {
      role: "Operations / client-service associate",
      draft: false,
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
    {
      role: "Compliance officer (CCO)",
      draft: false,
      rows: [
        {
          job: "Prep the annual SEC Form ADV update",
          when: "Annually, plus material-change filings",
          today: "Walk through every section against firm changes, draft the amendments by hand",
          withAgentplain:
            "ADV agent drafts the section-by-section change list against the year's firm events (new affiliations / new product offerings / material disciplinary history); CCO reviews and files",
        },
        {
          job: "Review marketing communications under the SEC Marketing Rule",
          when: "Per-piece, ongoing",
          today: "Read every public communication, flag testimonials / endorsements / hypotheticals manually",
          withAgentplain:
            "Marketing-rule agent (activating after counsel review) will run a first pass citing the specific Rule 206(4)-1 clause for each flag; until then the CCO reviews every draft before it's published",
        },
        {
          job: "Run the annual compliance review",
          when: "Annually",
          today: "Checklist + interviews + sample testing — weeks of work",
          withAgentplain:
            "Review agent drafts the test plan, samples transactions and trade allocations, drafts the findings report; CCO reviews and the principal signs",
        },
      ],
    },
  ],

  roi: {
    multiplier: "engagement-dependent (target 15×+)",
    inputCost: "Max tier · quote-based engagement (fiduciary-aware depth, SEC Marketing Rule compliance corpus, custodian-portal integrations, dedicated team)",
    outputValue: "$175,000 / yr in advisor-hour reclamation at a 3-advisor practice",
    math:
      "3 advisors × ~6 hours/week each on prep + recap + comms triage × $300/hr opportunity cost × 50 weeks = $270k/yr opportunity. Capture 65% with the fleet → $175k/yr returned. A 25-advisor practice capturing the same share of a $2.25M opportunity returns past $1.4M/yr. Max engagements are scoped per practice — fiduciary-aware compliance, SEC Marketing Rule corpus, custodian-portal coverage (Schwab / Fidelity / Pershing), and dedicated success management drive the price. Talk to a service partner to scope; the Partner ladder ($299→$199 per seat) is the floor the quote starts from before service-intensity overlay. Capability builds we don't have yet (e.g., a custom portfolio-rebalancer skill) live on /custom in addition to Max.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Max tier per 2026-05-15 ratification — AD-HOC quote-based engagement; routes through `/custom?type=max` intake to operator triage). ROI band per `project_pricing_value_anchor.md` (Regular tier 15x–50x as the floor; Max engagements scope from there). RIA segment economics per `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 (financial advisors, composite 33). Hourly-rate input is operator-modeled — flagged in capability inbox.",
    violationAvoidance:
      "Adviser communications live under the SEC Marketing Rule (Rule 206(4)-1) and the fiduciary duty — the SEC's 2024 enforcement sweeps settled at $60,000 to $325,000 per adviser for unsubstantiated or untrue advertising claims and missing testimonial disclosures, and a single non-compliant performance line or endorsement is enough to draw one. Auto-execution publishes before substantiation; agentplain's fleet drafts the marketing and client comms, and an advisor reviews and approves every draft before it sends — so an unsubstantiated claim never becomes a filed advertisement. The avoided settlement is downside the hours-reclaimed multiplier doesn't price, and only a draft-then-approve loop can promise it.",
  },

  claims: {
    replace: [
      "30–60 minutes of per-meeting prep — replaced by drafted agendas",
      "30 minutes per post-meeting recap — replaced by drafted notes + task list",
      "Reactive inbound triage — replaced by classified + context-attached drafts",
      "Manual account-opening paperwork — replaced by drafted packages against current custodian forms",
    ],
    integrate: [
      "Outlook (per-advisor OAuth — email + calendar)",
      "OneDrive + Excel (working files + performance workbooks)",
      "DocuSign (client agreements + ADV delivery signatures)",
    ],
    augment: [
      "Advisor review on every client-facing communication — ADV + suitability + plain-English check",
      "Plan-input drafting — every refresh cites the life-event source record",
      "Quarterly AUM billing — drafted with custodian-position evidence attached",
      "Compliance posture — every flag cites the rule (SEC Marketing Rule, ADV Part 2A, state-specific)",
    ],
  },

  integrations: {
    // Live today via OAuth — see `lib/integrations/marketplace.ts`.
    shipped: [
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    planned: [
      { name: "Wealthbox", category: "CRM" },
      { name: "Redtail", category: "CRM" },
      { name: "Salesforce FSC", category: "CRM" },
      { name: "eMoney Advisor", category: "Planning" },
      { name: "RightCapital", category: "Planning" },
      { name: "MoneyGuidePro", category: "Planning" },
      { name: "Orion", category: "Portfolio mgmt" },
      { name: "Black Diamond", category: "Portfolio mgmt" },
      { name: "Envestnet Tamarac", category: "Portfolio mgmt" },
      { name: "Schwab / Fidelity / Pershing", category: "Custodian (read-only)" },
    ],
    plannedWindow: "Q1 2027",
  },

  valueLoopExample: {
    scenario:
      "Q1 review cycle opens. James has 87 client portfolios to talk through and 87 prep packets that don't exist yet.",
    before:
      "Pull each client's positions in Wealthbox and the custodian, run the planning model in eMoney, write a one-page summary with the highlights and the risks, build the agenda, schedule the call. About 90 minutes a packet, 87 times over.",
    after:
      "The fleet pulled positions, ran the planning models, drafted 87 one-page packets with portfolio drift already highlighted, flagged the 11 clients whose planning assumptions changed enough to raise, and queued the scheduling. Every figure cites the source record it came from.",
    outcome:
      "James reviews 87 drafts across two mornings instead of three weeks. The calls happen on schedule, and he walks into each one with prep, not catch-up.",
  },
};
