import type { VerticalContent } from "../types";

// Source: realty-recruiter-assistant precedent in `realty_vertical_spec_v1_2026-05-03.md`
// §2.2 (deferred-V1 recruiter shape) generalized to standalone recruiting
// firms and in-house talent teams.
//
// JTBD ratified 2026-05-12 against published role workflows for 2–10
// recruiter boutique staffing firms (Bullhorn 360 implementation
// playbook, ASA scope-of-practice for contingent search, SHRM staffing
// firm role definitions). Five roles surfaced — Principal, Account
// manager, Recruiter, Sourcer, Coordinator. In smaller shops recruiter
// + sourcer collapse; in larger shops the AM (client-facing) and the
// recruiter (candidate-facing) split — both are surfaced so the JTBD
// reads regardless of org shape.

export const recruiting: VerticalContent = {
  slug: "recruiting",
  name: "Recruiting firms",
  tier: "regular",
  missionSubject: "recruiters and staffing firms",

  directAnswer:
    "agentplain for recruiting is a managed AI service partnership for boutique recruiting and staffing firms. A service team installs a fleet that sources candidates from public data, drafts first-touch outreach backed by a substantiated reference, honors opt-out handling, and tracks the pipeline — working inside Outlook, Gmail, Slack, and DocuSign. The recruiter reviews every outreach before it sends; the fleet drafts and proposes but never sends on its own.",

  verticalFaq: [
    {
      q: "How does agentplain handle outreach opt-outs and compliance?",
      a: "Within the augment model. The fleet drafts outreach that respects opt-out handling and grounds each message in a substantiated reference rather than a generic pitch, then surfaces it for the recruiter's review. The recruiter approves and sends every message — the fleet doesn't send on its own.",
    },
    {
      q: "Is agentplain a replacement for my ATS?",
      a: "No. agentplain works inside the Outlook, Gmail, Slack, and DocuSign you already run and replaces the manual work between them — sourcing, first-touch drafting, pipeline tracking. It isn't an applicant-tracking system, and there's nothing to migrate.",
    },
    {
      q: "How much does agentplain cost for a recruiting firm?",
      a: "Recruiting is recommended at the Regular tier — $199 per seat per month for a solo recruiter, sliding to $99 per seat at 50+ seats. Every tier is per seat, month-to-month, with the first month free, and you can cancel anytime.",
    },
    {
      q: "Does the fleet send outreach to candidates on its own?",
      a: "No. Every drafted opener and follow-up lands in your approval queue as a pending item. The fleet drafts and proposes; you approve and send from inside your own email and systems. It never auto-sends, moves money, or makes commitments on your behalf.",
    },
  ],

  // Fleet surfaced in-product on /agents, grounded in the recruiting JTBD
  // tables. Outreach owns the inbox loop's buyer-inquiry bucket — classify
  // an inbound candidate reply and draft the next touch. Scheduler owns
  // scheduling — the multi-party interview slot proposals the loop produces
  // on scheduling-needed inbound. Every other agent is honestly rooting on
  // an ATS / sequence-tool / call-capture connection.
  agentRoster: [
    {
      slug: "recruiting-sourcing",
      name: "Sourcing",
      job: "Drafts a ranked candidate list with a substantiated reference per name.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your ATS (Greenhouse / Lever / Workable / Bullhorn) is connected.",
    },
    {
      slug: "recruiting-outreach",
      name: "Outreach",
      job: "Drafts the first-touch with one production reference, plain CTA, and opt-out line.",
      runtime: "live",
      owns: ["buyer-inquiry"],
    },
    {
      slug: "recruiting-cadence",
      name: "Cadence",
      job: "Runs the second and third touch timing for the recruiter to send.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once a sequence tool (Gem / Outreach / SalesLoft) or your ATS cadence is connected.",
    },
    {
      slug: "recruiting-candidate-status-update",
      name: "Candidate Status",
      job: "Reads the role's active pipeline and drafts the per-candidate update on every transition for the recruiter to send.",
      runtime: "live",
      // Live via the recruiting-candidate-status-update skill — works on a
      // JSON-stub ATS today; binds to Greenhouse / Lever / Workable / Bullhorn
      // MCPs once they ship. Comp + offer detail always defer to {{operator:
      // comp/offer details}}; hiring-manager feedback never leaks into the
      // draft verbatim; offer-extended and rejection drafts always queue for
      // recruiter review before any persistence.
      boundSkill: "recruiting-candidate-status-update",
    },
    {
      slug: "recruiting-intake-brief",
      name: "Intake Brief",
      job: "Drafts the role brief from the hiring-manager call and surfaces open questions.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your call-capture tool (Gong / Fireflies / Otter) is connected for the intake transcript.",
    },
    {
      slug: "recruiting-pipeline-recap",
      name: "Pipeline Recap",
      job: "Drafts the weekly client recap with candidates moved and bottlenecks flagged.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your ATS is connected for stage-transition history.",
    },
    {
      slug: "recruiting-scheduler",
      name: "Scheduler",
      job: "Runs the multi-party interview search; coordinator reviews conflicts only.",
      runtime: "live",
      owns: ["scheduling"],
    },
    {
      slug: "recruiting-ats-hygiene",
      name: "ATS Hygiene",
      job: "Dedupes, normalizes, and surfaces stale records in the ATS each week.",
      runtime: "rooting",
      rootingNote:
        "rooting now — comes online once your ATS is connected with read + write scope.",
    },
    {
      // Horizontal chief-of-staff capability — proposals only, no execution.
      // Complements recruiting-scheduler (which owns multi-party interview
      // search) by also surfacing reply drafts + to-dos against the
      // recruiter's general calendar + inbox.
      slug: "recruiting-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the recruiter's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for boutique recruiting firms and in-house talent teams",
    headline: "The fleet for the boutique recruiting practice.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. ATS (Bullhorn / Greenhouse / Lever
    // / JobAdder / Recruiterflow / Workable), LinkedIn Recruiter, Apollo, and
    // sequence-tool adapters live in the per-vertical integration roadmap
    // below and surface honestly there as planned, not in this present-tense
    // hero clause.
    valueProp:
      "agentplain REPLACES the manual sourcing + first-touch drafting cycle, INTEGRATES with Outlook, Gmail, Slack, and DocuSign on day one, and AUGMENTS the recruiter's read on every outreach with substantiated production evidence.",
    sbmSubhead:
      "The sourcing and outreach skills, agents, and memory you'd otherwise have to build yourself",
  },

  metaTitle: "for boutique recruiting firms and in-house talent teams",
  metaDescription:
    "Sourcing on public data, drafted outreach with a substantiated reference, opt-out compliance, and pipeline tracking — for the 2–10 recruiter boutique firm.",

  jtbdTables: [
    {
      role: "Practice owner / managing partner",
      draft: false,
      rows: [
        {
          job: "Know which roles are at risk this week",
          when: "Monday morning",
          today: "Standup notes + tribal recall",
          withAgentplain:
            "Pipeline view — every role with current bottleneck (sourcing / outreach reply-rate / client-side delay)",
        },
        {
          job: "Approve a high-touch candidate outreach",
          when: "Ad hoc",
          today: "Read the draft, edit, reply-all",
          withAgentplain:
            "Outreach queue — drafts with substantiation cited; one-click approve or one-click edit",
        },
      ],
    },
    {
      role: "Account manager / client lead",
      draft: false,
      rows: [
        {
          job: "Run an intake call on a new role with the hiring manager",
          when: "Per-search, week 1",
          today: "30–60 minute call + scattered Slack/email follow-ups to capture the spec",
          withAgentplain:
            "Intake agent drafts the role brief from the call transcript, surfaces the unanswered questions, and routes the brief to the recruiter — AM reviews and confirms",
        },
        {
          job: "Update the hiring manager on pipeline progress",
          when: "Weekly + ad hoc",
          today: "Manual pull from Bullhorn + draft email recap",
          withAgentplain:
            "Pipeline agent drafts the weekly client recap with candidates surfaced, candidates moved, and bottlenecks flagged",
        },
        {
          job: "Coordinate feedback loops after every client interview",
          when: "Continuous through every search",
          today: "Chase the hiring manager by email; lose 2–3 days per cycle",
          withAgentplain:
            "Feedback agent drafts the post-interview prompt to the client + the candidate-facing relay; AM signs and routes",
        },
      ],
    },
    {
      role: "Recruiter",
      draft: false,
      rows: [
        {
          job: "Source candidates against an open role",
          when: "Day 1–7 of every search",
          today: "LinkedIn search, production-board scraping, spreadsheet",
          withAgentplain:
            "Sourcing agent drafts a ranked list with substantiated production references; recruiter triages",
        },
        {
          job: "Draft the first-touch outreach",
          when: "Per candidate, sub-3 minute window for response rate",
          today: "Template + manual customization",
          withAgentplain:
            "Outreach agent drafts <180-word first touch with one specific production reference, plain CTA, opt-out line",
        },
        {
          job: "Run the second + third touch cadence",
          when: "Days 3 and 8 of every search",
          today: "Calendar reminder + manual draft",
          withAgentplain:
            "Cadence agent runs the timing; recruiter reviews and sends from their own system",
        },
        {
          job: "Assemble the offer package",
          when: "Pre-offer, urgent",
          today: "Stitched-together docs, late-night work",
          withAgentplain:
            "Offer-package agent drafts the comp letter, the role overview, the talking points; recruiter reviews",
        },
      ],
    },
    {
      role: "Sourcer",
      draft: false,
      rows: [
        {
          job: "Build a sourcing list against an open role",
          when: "Day 1–3 of every search",
          today: "LinkedIn Recruiter search + scraping + spreadsheet of candidates",
          withAgentplain:
            "Sourcing agent runs the keyword + boolean search across LinkedIn Recruiter, GitHub (where applicable), and vertical-specific boards; drafts a ranked list with substantiation per candidate",
        },
        {
          job: "Enrich + verify contact data",
          when: "Per-candidate, sub-30-minute window",
          today: "Apollo / Sales Nav lookups + manual cross-check",
          withAgentplain:
            "Enrichment agent pulls Apollo + public-record data, drafts the candidate record with employment-history + open-source-contribution evidence where ToS allows",
        },
        {
          job: "Pass qualified candidates to recruiters",
          when: "Continuous",
          today: "Slack/email handoff + ATS note",
          withAgentplain:
            "Handoff agent drafts the candidate brief into the ATS with the sourcing rationale, recruiter takes the warm record",
        },
      ],
    },
    {
      role: "Coordinator",
      draft: false,
      rows: [
        {
          job: "Schedule interviews across candidate + 2–4 interviewers",
          when: "Continuous",
          today: "Email tetris + scheduling tool",
          withAgentplain:
            "Scheduler agent runs the multi-party search; coordinator reviews only the conflicts",
        },
        {
          job: "Keep the ATS clean and current",
          when: "End of week",
          today: "Spreadsheet diff + manual updates",
          withAgentplain: "Hygiene agent dedupes, normalizes, surfaces stale records weekly",
        },
        {
          job: "Manage candidate experience touchpoints",
          when: "Continuous per-candidate",
          today: "Templated nurture, often skipped under load",
          withAgentplain:
            "Experience agent drafts the cadence (post-application acknowledgment, post-interview thank-you, decline-with-reason), coordinator approves",
        },
      ],
    },
  ],

  roi: {
    multiplier: "23x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — 7-day free trial, card at signup",
    outputValue: "$54,000 / yr per recruiter in cycle-time and placement-rate reclamation",
    math:
      "1 recruiter @ 30% of week on sourcing + outreach drafting (~12 hours) × $75/hr loaded = $46,800/yr in labor reclamation. Add response-rate lift from substantiated outreach (modeled at +20% to placements) → $7k/yr at 2 placements baseline. Total ~$54k/yr per recruiter against the solo Regular-tier seat at $199/mo ($2,388/yr) = ~23x at one recruiter; team-of-10 on the $149 band runs ~30x+ on the same inputs.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (Regular tier per the 2026-05-15 three-tier ratification — Regular is the default entry path; recruiting shops wanting named-service-partner reserved time can step up to Partner ($299→$199/seat), and high-intensity exec-search engagements route to Max (quote-based)). ROI band per `project_pricing_value_anchor.md` (Regular-tier value $2,900–$10,600/mo per seat). Time-allocation estimates pending primary-research validation — flagged in capability inbox. Response-rate-lift claim is operator-modeled, not customer-attested.",
    violationAvoidance:
      "Candidate outreach and screening fall under EEOC enforcement of Title VII and a growing patchwork of state and local Ban-the-Box laws — Title VII compensatory-and-punitive damages are capped at $50,000 to $300,000 per claimant by employer size (Civil Rights Act of 1991), and a single discriminatory phrasing or a premature criminal-history question is enough to trigger a claim. Auto-execution sends the screening question before anyone checks it; agentplain's fleet drafts the outreach and screening copy and a recruiter reviews and approves every draft before it sends, so a problematic message never goes out by machine. That avoided claim is downside the 23x hours math never captures, and only a human-approval loop can stand behind it.",
  },

  claims: {
    replace: [
      "Manual production-board scraping — replaced by drafted ranked sourcing lists",
      "Template-and-customize first-touch drafting — replaced by substantiated drafts in your voice",
      "Calendar-reminder cadence — replaced by timing-aware second + third touches",
      "Hand-built offer packages — replaced by drafted comp letters with role context",
    ],
    integrate: [
      "Outlook + Gmail (per-recruiter OAuth — email + calendar)",
      "Slack (coordinator messaging)",
      "DocuSign (offer-letter signatures)",
    ],
    augment: [
      "Recruiter review on every outreach draft — opt-out line always present",
      "Substantiation citation — every production claim references the source record",
      "Drafts only — you send from your own system with your own consent records",
      "Pipeline forecasting — drafted with candidate-stage evidence, not vibes",
    ],
  },

  integrations: {
    // Live today via OAuth — see `lib/integrations/marketplace.ts`.
    shipped: [
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    planned: [
      { name: "Bullhorn", category: "ATS" },
      { name: "Greenhouse", category: "ATS" },
      { name: "Lever", category: "ATS" },
      { name: "JobAdder", category: "ATS" },
      { name: "Recruiterflow", category: "ATS" },
      { name: "Workable", category: "ATS" },
      { name: "LinkedIn Recruiter", category: "Sourcing (read-only)" },
      { name: "Apollo", category: "Enrichment" },
    ],
    plannedWindow: "Q3 2026",
  },

  valueLoopExample: {
    scenario:
      "Tuesday morning: a senior backend role just opened at a client. Goal — five qualified candidates in pipeline by Friday.",
    before:
      "Source on LinkedIn Recruiter, qualify against the JD, draft individualized opening messages, log everything in Bullhorn, follow up the ones who reply. ~12 hours across the week.",
    after:
      "The fleet drafted 12 substantiated openers (each citing a specific reason from the candidate's record) and queued them for the recruiter's review. Once your sourcing tools and ATS are connected, it will also source candidates against the JD, enrich them, and rank the top matches by stated-skill match + employer history.",
    outcome:
      "The recruiter reviews 12 drafts in 40 minutes, sends 9, and books 5 calls by Friday. The 12 hours becomes 90 minutes.",
  },
};
