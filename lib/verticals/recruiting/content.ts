import type { VerticalContent } from "../types";

// Source: realty-recruiter-assistant precedent in `realty_vertical_spec_v1_2026-05-03.md`
// §2.2 (deferred-V1 recruiter shape) generalized to standalone recruiting
// firms and in-house talent teams. No Phase 0 product_spec.md JTBD table —
// draft:true and capability-inbox flagged.

export const recruiting: VerticalContent = {
  slug: "recruiting",
  name: "Recruiting firms",
  tier: "regular",

  hero: {
    eyebrow: "Adjacent vertical · Regular tier",
    headline: "The fleet for the boutique recruiting practice.",
    valueProp:
      "agentplain REPLACES the manual sourcing + first-touch drafting cycle, INTEGRATES with your ATS and the public license / production boards your candidates show up on, and AUGMENTS the recruiter's read on every outreach with substantiated production evidence.",
  },

  metaTitle: "agentplain for recruiting firms — boutique and in-house talent teams",
  metaDescription:
    "An agentic fleet for the 2–10 recruiter boutique firm or in-house talent team. Sourcing against public production data, drafted outreach with one substantiated reference per touch, opt-out compliance, pipeline tracking, and offer-package assembly — coordinated across Bullhorn, Greenhouse, LinkedIn Recruiter, and the verticalized license boards where your candidates live.",

  jtbdTables: [
    {
      role: "Practice owner / managing partner",
      draft: true,
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
      role: "Recruiter",
      draft: true,
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
      role: "Coordinator",
      draft: true,
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
      ],
    },
  ],

  roi: {
    multiplier: "23x",
    inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
    outputValue: "$54,000 / yr per recruiter in cycle-time and placement-rate reclamation",
    math:
      "1 recruiter @ 30% of week on sourcing + outreach drafting (~12 hours) × $75/hr loaded = $46,800/yr in labor reclamation. Add response-rate lift from substantiated outreach (modeled at +20% to placements) → $7k/yr at 2 placements baseline. Total ~$54k/yr per recruiter against the solo Regular-tier seat at $199/mo ($2,388/yr) = ~23x at one recruiter; team-of-10 on the $149 band runs ~30x+ on the same inputs.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (per-seat ladder, locked 2026-05-09). ROI band per `project_pricing_value_anchor.md` (Regular-tier value $2,900–$10,600/mo per seat). Time-allocation estimates pending primary-research validation — flagged in capability inbox. Response-rate-lift claim is operator-modeled, not customer-attested.",
  },

  claims: {
    replace: [
      "Manual production-board scraping — replaced by drafted ranked sourcing lists",
      "Template-and-customize first-touch drafting — replaced by substantiated drafts in your voice",
      "Calendar-reminder cadence — replaced by timing-aware second + third touches",
      "Hand-built offer packages — replaced by drafted comp letters with role context",
    ],
    integrate: [
      "Bullhorn (ATS)",
      "Greenhouse (ATS)",
      "Lever (ATS)",
      "LinkedIn Recruiter (sourcing — read-only)",
      "Apollo / Sales Navigator (enrichment, where ToS-compliant)",
      "Outlook + Microsoft 365 Graph",
      "Public license / production boards (per vertical — FMLS for real-estate recruiters, state bar for legal recruiters, etc.)",
    ],
    augment: [
      "Recruiter review on every outreach draft — opt-out line always present",
      "Substantiation citation — every production claim references the source record",
      "TCPA / CAN-SPAM posture — no SMS without documented prior consent",
      "Pipeline forecasting — drafted with candidate-stage evidence, not vibes",
    ],
  },

  integrations: {
    shipped: [],
    planned: [
      { name: "Bullhorn", category: "ATS" },
      { name: "Greenhouse", category: "ATS" },
      { name: "Lever", category: "ATS" },
      { name: "Workable", category: "ATS" },
      { name: "LinkedIn Recruiter", category: "Sourcing (read-only)" },
      { name: "Apollo", category: "Enrichment" },
      { name: "Outlook + M365 Graph", category: "Email + calendar" },
    ],
    plannedWindow: "Q3 2026",
  },

  valueLoopExample: {
    scenario:
      "Tuesday morning: a senior backend role just opened at a client. Goal — five qualified candidates in pipeline by Friday.",
    before:
      "Source on LinkedIn Recruiter, qualify against the JD, draft individualized opening messages, log everything in Bullhorn, follow up the ones who reply. ~12 hours across the week.",
    after:
      "The fleet sourced 40 candidates against the JD, enriched them through Apollo, ranked the top 12 by stated-skill match + employer history, drafted 12 substantiated openers (each citing a specific reason from the candidate's record), and queued them for the recruiter's review.",
    outcome:
      "The recruiter reviews 12 drafts in 40 minutes, sends 9, and books 5 calls by Friday. The 12 hours becomes 90 minutes.",
  },
};
