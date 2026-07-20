import type { VerticalContent } from "../types";
import {
  TRIAL_PERIOD_DAYS_EXTENDED,
  MONEY_BACK_GUARANTEE_DAYS,
} from "../../billing/facts";

// Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 (law firms
// composite 30, deprioritized for Product 2 due to Clio Work April 2026
// shipping agentic + CoCounsel/Smokeball March 2026 partnership).
//
// JTBD ratified 2026-05-12 against published role workflows for solo /
// 2–5 attorney practices (ABA Model Rules scope-of-practice, Clio Legal
// Trends Report role definitions, Smokeball/MyCase public role docs).
// Four roles surfaced — Managing partner, Litigator, Transactional
// attorney, Paralegal. The litigation vs. transactional split matters
// because the JTBDs differ materially (litigators run discovery + court
// filings + opposing-counsel coordination; transactional attorneys run
// drafting + redlining + closing coordination).
//
// Pricing: recommended at Max tier per `project_stripe_both_surfaces.md`
// (2026-05-15 — three customer-facing tiers Regular / Partner / Max). Max is
// AD-HOC quote-based, not a fixed per-seat price; law firms self-route to Max
// because privilege-aware depth, ABA Model Rule 1.6 compliance corpus, multi-
// jurisdiction state packs, and the Clio/CoCounsel competitive context all
// require higher-intensity service than Regular's standard cadence. The
// `tier: "max"` field on disk drives the recommended-tier surface;
// `tierDisplayName("max")` returns "Max" so the customer-facing label is
// stable. Bespoke jurisdictional packs and capability builds we don't have
// yet still route to /custom (separate from Max — capability work, not
// service intensity).

export const law: VerticalContent = {
  slug: "law",
  name: "Law firms",
  tier: "max",
  missionSubject: "law firms and solo practitioners",

  directAnswer:
    "agentplain for law firms is a managed AI service partnership for solo and small (2–5 attorney) firms. A service team installs a fleet that handles client intake, drafts engagement letters, runs conflict checks, chases documents, and applies a privilege-aware review pass to client communications and drafted pleadings — working inside Outlook, OneDrive, and DocuSign. The attorney reviews every client communication and filing; the fleet drafts and proposes but never sends or files on its own.",

  verticalFaq: [
    {
      q: "How does agentplain protect privilege and handle conflicts?",
      a: "Within the augment model. The fleet drafts client communications and pleadings with a privilege-aware review pass, runs conflict checks at intake, and surfaces what needs attention for the attorney — it doesn't make the legal determination or send anything. The attorney reviews everything, and liability for licensed work stays with your firm.",
    },
    {
      q: "Is agentplain a replacement for my practice-management software?",
      a: "No. agentplain works inside the Outlook, OneDrive, and DocuSign you already run and replaces the manual work between them — intake, engagement letters, conflict checks, document chase, milestone billing. It isn't a practice-management system, and there's nothing to migrate.",
    },
    {
      q: "How much does agentplain cost for a law firm?",
      a: `Law firms are recommended at the Max tier — an ad-hoc service partnership quoted to your engagement and sold sales-led rather than by self-checkout, because the stakes per draft warrant a named partner and a weekly cadence. Every agentplain subscription is month-to-month; law firms get the extended ${TRIAL_PERIOD_DAYS_EXTENDED}-day free trial (card at signup) and a ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee on the first charge. Max engagements are quoted to scope.`,
    },
    {
      q: "Where does client and matter data live?",
      a: "In your systems. Matter files, client communications, and discovery material stay in the Outlook, OneDrive, and DocuSign your firm already controls — the fleet reads them in-flight through your own connected accounts and does not copy them onto agentplain's servers. What agentplain keeps is Plaino's working memory of your practice: your templates, your voice, per-matter context. That memory is encrypted per workspace, exportable anytime, and hard-deleted when the account closes.",
    },
    {
      q: "Whose accounts does the fleet run on?",
      a: "Your firm's. Outlook and Microsoft 365 connect by OAuth on your own tenant, under your own credentials — revoke access in your admin console and it ends immediately. Practice-management and document-management integrations on the roadmap connect the same way: your accounts, your keys, never a shared login we hold for you.",
    },
    {
      q: "Does the fleet send communications or file pleadings on its own?",
      a: "No. Every draft — an intake reply, an engagement letter, a pleading — lands in your approval queue as a pending item. The fleet drafts and proposes; you approve, send, and file from inside your own systems. It never auto-sends, files, moves money, or makes commitments on your behalf.",
    },
  ],

  // Fleet surfaced in-product on /agents, grounded in the law JTBD tables.
  // All seven capabilities are honestly rooting today: each one needs the
  // matter-management / privilege-review surface a law firm runs in (Clio,
  // MyCase, Smokeball, NetDocuments) plus counsel-approved privilege rules
  // before runtime can attribute work. The V1 inbox loop still produces
  // draft replies for law workspaces — those land in Approvals under the
  // generic inbox triage attribution. We are NOT pretending Intake &
  // Onboarding runs the conflict check today; the conflict check needs the
  // matter system. Discipline matches the realty content file and the
  // AgentRosterEntry runtime contract.
  agentRoster: [
    {
      slug: "law-intake-onboarding",
      name: "Intake & Onboarding",
      job: "Runs the conflict check and drafts the engagement letter scoped to the matter.",
      runtime: "live",
      // Live via the deterministic intake-conflict-screen skill — works on
      // a JSON-stub ledger today; binds to Clio / MyCase / PracticePanther
      // MCPs once they ship. Never asserts a legal conclusion; the partner
      // signs the {{operator: legal conclusion}} merge field before send.
      boundSkill: "law-intake-conflict-screen",
    },
    {
      slug: "law-drafting",
      name: "Drafting",
      job: "Drafts the first pass of a pleading or contract with the matter facts inserted.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your document-mgmt system (NetDocuments / iManage / SharePoint) is connected for matter facts.",
    },
    {
      slug: "law-doc-chase",
      name: "Document Chase",
      job: "Runs the doc-collection cadence with clients and opposing counsel per channel.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your client portal (Clio Connect / MyCase) is connected.",
    },
    {
      slug: "law-compliance-sentinel",
      name: "Compliance Sentinel",
      job: "Flags privilege and ABA Model Rule 1.6 concerns before a draft is sent.",
      runtime: "rooting",
      rootingNote:
        "rooting now — privilege and ABA 1.6 corpus is loaded; draft scoring activates after counsel review.",
    },
    {
      slug: "law-discovery-review",
      name: "Discovery Review",
      job: "Runs first-pass responsiveness and privilege tagging, citing the rule basis.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once a Relativity / Everlaw connection is established for the discovery corpus.",
    },
    {
      slug: "law-status-updater",
      name: "Status Updater",
      job: "Drafts the client matter-status update on every state change for the attorney.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once matter-state webhooks from your practice-management system are connected.",
    },
    {
      slug: "law-billing",
      name: "Milestone Billing",
      job: "Drafts the milestone invoice and the aged-AR escalation for the partner.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your billing module (Clio Manage / TimeSolv) is connected.",
    },
    {
      // Horizontal chief-of-staff capability — proposals only, no execution.
      slug: "law-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the attorney's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for small law firms and solo practitioners",
    headline: "The fleet for the small law firm.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. Practice-management (Clio / MyCase
    // / Smokeball / PracticePanther), DMS (NetDocuments / iManage), legal-research,
    // and court-e-filing adapters live in the per-vertical integration roadmap
    // below and surface honestly there as planned, not in this present-tense
    // hero clause.
    valueProp:
      "agentplain REPLACES the intake-to-engagement bottleneck, INTEGRATES with Outlook, OneDrive, and DocuSign on day one, and AUGMENTS the partner's read on every client communication and every drafted pleading with attorney approval on every draft.",
    sbmSubhead:
      "The intake-to-drafting skills, agents, and memory you'd otherwise have to build yourself",
  },

  metaTitle: "for solo and small law firms (2–5 attorneys)",
  metaDescription:
    "Client intake, engagement letters, conflict checks, privilege-guarded comms, document chase, and milestone billing — for the solo or 2–5 attorney firm.",

  jtbdTables: [
    {
      role: "Managing partner / owner-attorney",
      draft: false,
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
            "Compliance agent (activating after counsel review) flags privilege / work-product / ABA Model Rule 1.6 concerns; until then every draft is held for attorney approval before send",
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
      role: "Litigator / litigation associate",
      draft: false,
      rows: [
        {
          job: "Draft a pleading, motion, or discovery response",
          when: "Continuous through every active matter",
          today: "Template + manual customization against jurisdiction local rules",
          withAgentplain:
            "Drafting agent generates the first draft with the matter facts inserted + local-rule citations attached; attorney reviews and revises",
        },
        {
          job: "Coordinate with opposing counsel on scheduling + discovery",
          when: "Continuous",
          today: "Email chains + phone tag",
          withAgentplain:
            "OC-coordination agent drafts the meet-and-confer correspondence, drafts the scheduling-order positions, logs the agreed-upon dates to the matter calendar",
        },
        {
          job: "Run discovery review on opposing production",
          when: "Discovery phase",
          today: "Doc-by-doc review + privilege-tag spreadsheet",
          withAgentplain:
            "Review agent runs first-pass responsiveness + privilege tagging, drafts the privilege log entries citing the rule basis; litigator reviews the borderline calls",
        },
        {
          job: "Update the client on matter status",
          when: "Per scheduled cadence + court-event-driven",
          today: "Reactive — client calls you",
          withAgentplain:
            "Status agent drafts the update on every matter-state change; attorney signs and sends",
        },
      ],
    },
    {
      role: "Transactional attorney",
      draft: false,
      rows: [
        {
          job: "Draft a contract from a term sheet or playbook",
          when: "Per-deal, ongoing",
          today: "Open the firm precedent, customize against the deal terms, redline by hand",
          withAgentplain:
            "Drafting agent generates the first-pass draft from the firm precedent applying the deal terms, surfaces the playbook-exception clauses for attorney decision",
        },
        {
          job: "Redline a counterparty draft against playbook positions",
          when: "Per-deal turn",
          today: "Read line-by-line, mark up Word, escalate edge cases to partner",
          withAgentplain:
            "Redline agent runs a first-pass review citing the firm-playbook position for each deviation; attorney reviews the substantive points",
        },
        {
          job: "Run an intake conflict check + engagement letter",
          when: "Day 1 of every new matter",
          today: "Manual conflict search + template merge",
          withAgentplain:
            "Onboarding agent runs the conflict check, drafts the engagement letter scoped to deal type + fee structure",
        },
        {
          job: "Coordinate the closing checklist",
          when: "Pre-closing, per-deal",
          today: "Spreadsheet of conditions precedent + email reminders",
          withAgentplain:
            "Closing agent drafts the checklist scoped to the deal type, runs the document-chase cadence, surfaces stuck items to the attorney",
        },
      ],
    },
    {
      role: "Paralegal / case manager",
      draft: false,
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
    multiplier: "engagement-dependent (target 15×+)",
    inputCost: "Max tier · quote-based engagement (privilege-aware depth, ABA Model Rule 1.6 compliance corpus, multi-jurisdiction packs, dedicated team)",
    outputValue: "$150,000 / yr in attorney-hour reclamation at a 3-attorney firm",
    math:
      "3 attorneys × ~10 hours/week each on drafting + status + chase work × $250/hr billable opportunity cost × 50 weeks = $375k/yr opportunity. Capture even 40% with the fleet → $150k/yr returned. A 25-attorney firm capturing 75% of $3.125M opportunity returns past $2.3M/yr. Max engagements are scoped per firm — privilege-aware compliance, ABA Model Rule 1.6 review, multi-state filing packs, and dedicated success management drive the price. Talk to a service partner to scope; the Partner ladder ($299→$199 per seat) is the floor the quote starts from before service-intensity overlay. Capability builds we don't have yet (e.g., a custom court e-filing skill) live on /custom in addition to Max.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Max tier per 2026-05-15 ratification — AD-HOC quote-based engagement; routes through `/custom?type=max` intake to operator triage). ROI band per `project_pricing_value_anchor.md` (Regular tier 15x–50x as the floor; Max engagements scope from there). Competitive context per `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 + §5 (Clio Work April 2026; CoCounsel/Smokeball March 2026). Hourly-rate input is operator-modeled — flagged in capability inbox.",
    violationAvoidance:
      "Client communications are bound by the ABA Model Rules — Rule 1.6 on confidentiality and Rule 7.1 on false or misleading statements about a lawyer's services. There's no fixed civil fine, but the exposure is heavier than one: disciplinary action up to disbarment, plus legal-malpractice liability that follows a single privileged detail sent to the wrong recipient. A tool that auto-sends can breach privilege or misstate in one message; agentplain drafts and an attorney reviews and approves every client-facing draft before it sends, so a privilege breach or misleading line never leaves the firm. That avoided exposure is the part of ROI no hours-saved multiplier can show — and no auto-execution tool can promise.",
  },

  claims: {
    replace: [
      "Manual conflict-check + engagement-letter drafting on new matters",
      "Reactive client status updates — replaced by matter-state-triggered drafts",
      "Hand-checked filing prep against local rules — replaced by drafted packages",
      "Spreadsheet aged-WIP review — replaced by drafted milestone invoices and AR escalations",
    ],
    integrate: [
      "Outlook (per-attorney OAuth — email + calendar)",
      "OneDrive (document substrate for matter files)",
      "DocuSign (engagement-letter + retainer signatures)",
    ],
    augment: [
      "Partner review on every privilege-sensitive draft — ABA Model Rule 1.6 + 1.7 + 1.18 awareness",
      "Conflict-check audit trail — drafts cite the firm's prior-matter index",
      "Local-rule compliance — every filing draft cites the rule number",
      "Billing narrative — drafted in the firm's voice with matter context attached",
    ],
  },

  integrations: {
    // Live today via OAuth — see `lib/integrations/marketplace.ts`.
    shipped: [
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    planned: [
      { name: "Clio Manage", category: "Practice mgmt" },
      { name: "MyCase", category: "Practice mgmt" },
      { name: "Smokeball", category: "Practice mgmt" },
      { name: "PracticePanther", category: "Practice mgmt" },
      { name: "NetDocuments", category: "Document management" },
      { name: "iManage Work", category: "Document management" },
      { name: "Westlaw + Lexis", category: "Legal research" },
      { name: "Court e-filing portals", category: "Court" },
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
