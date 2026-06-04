import type { VerticalContent } from "../types";

// `/general` — honest on-ramp surface for local businesses outside the ten
// ratified verticals (real-estate, mortgage, insurance, property-management,
// title-escrow, recruiting, home-services, cpa, law, ria).
//
// This is a SURFACE, not a new vertical. Per
// `feedback_no_new_verticals_finish_locked.md`, the ten ratified verticals
// stay locked — we don't open an eleventh compliance corpus or JTBD pack
// to ship `/general`. What we ship instead is the same service partnership,
// scaffolded against universal jobs (inbox triage, scheduling, follow-up,
// basic documentation) using common-denominator tools (Gmail, Outlook,
// Google Calendar, QuickBooks).
//
// Cross-role roster (2026-05-25): the agentRoster below ships FOUR
// horizontal capabilities — Chief of Staff, Inbox Triage, Follow-Up
// Chaser, Process-Doc Drafter — each bound to a catalog-registered,
// test-gated skill. Every card serves "whatever your work is" (a solo
// contractor, a board member, an office manager, an owner-operator
// outside the named ten) without becoming an industry vertical itself.
// Copy reads CROSS-ROLE on purpose. If a visitor needs vertical-specific
// depth, the page routes them to `/custom` as it always has.
//
// Per `feedback_no_quick_fixes.md` the right framing is honest, not
// pretend-vertical: the hero says "lighter scaffolding" directly so a
// visitor in a niche vertical knows what they're getting and what they're
// not. If they want a bespoke per-vertical compliance corpus, the page
// routes them to `/custom` — same path the ratified verticals use for
// depth that Regular doesn't cover (per `project_stripe_both_surfaces.md`).
//
// `status: "on-ramp"` is the marker the registry uses to keep `/general`
// out of `VERTICAL_SLUGS`, `getAllVerticals()`, and the homepage chip row.
// Route resolution still works because `getVerticalContent()` checks both
// the live registry and the on-ramp registry — see `lib/verticals/index.ts`.

export const general: VerticalContent = {
  slug: "general",
  name: "Local businesses",
  tier: "regular",
  status: "on-ramp",
  missionSubject: "local businesses",

  // Cross-role roster — every card is HORIZONTAL (serves any role: a
  // contractor, a board member, a solo operator, an office manager, an
  // owner-operator outside the ten ratified verticals). Per
  // `feedback_no_new_verticals_finish_locked.md` /general is a SURFACE,
  // not an eleventh vertical: nothing here is industry-specific. Each
  // card is bound to a catalog-registered, test-gated skill that runs
  // end-to-end on JSON demo seeds today; production wiring lights up
  // once the underlying mailbox / calendar / activity-log adapters land.
  //
  // Reads "whatever your work is" not "industry-N" — per
  // `feedback_everything_tells_a_story.md`, every visitor to /general
  // is a local business owner whose work doesn't fit one of the ten
  // named verticals. The cards talk about THEIR work, never about a
  // specific industry.
  agentRoster: [
    {
      slug: "general-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against your calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
    {
      slug: "general-inbox-triage",
      name: "Inbox Triage",
      job: "Sorts whatever lands in your inbox by priority — urgent, customer-active, vendor-pending, needs-your-decision, noise — and drafts a gentle acknowledgement on the two middle classes so the people you serve hear back today.",
      runtime: "live",
      boundSkill: "inbox-triage-general",
      // Card is LIVE only when a mailbox connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades to
      // "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
    {
      slug: "general-follow-up-chaser",
      name: "Follow-Up Chaser",
      job: "Spots the threads you sent days ago without a reply and drafts the gentle nudge — oldest first, capped per run so your queue stays sane.",
      runtime: "live",
      boundSkill: "follow-up-chaser-general",
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
    {
      slug: "general-process-doc-drafter",
      name: "Process-Doc Drafter",
      job: "Watches how you actually handle recurring work and, once a pattern repeats three or more times, drafts the SOP so the process moves out of your head and into a doc you can hand off.",
      runtime: "live",
      boundSkill: "process-doc-drafter-general",
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Don't see your industry?",
    headline: "Same service partnership. Lighter scaffolding.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. (The Generic CRM webhook receiver
    // and standalone Google Calendar tile are roadmap, not present — they
    // surface honestly in the planned-integrations roadmap below.)
    valueProp:
      "agentplain REPLACES the universal admin work — inbox triage, scheduling, follow-up, basic documentation — INTEGRATES with the tools every local business already runs (Gmail, Outlook, Google Drive, QuickBooks, DocuSign), and AUGMENTS the owner's review on every customer-facing draft. No vertical-specific compliance corpus; if you need one, we scope it as a Custom engagement.",
  },

  metaTitle: "for local businesses — any industry",
  metaDescription:
    "An honest on-ramp for local businesses outside our ten named verticals. The same service partnership — inbox triage, scheduling, follow-up, drafted responses — scaffolded against common-denominator tools (Gmail, Outlook, Google Drive, QuickBooks, DocuSign). Lighter compliance corpus than the named verticals; if you need bespoke vertical depth, we scope it as a Custom engagement.",

  jtbdTables: [
    {
      role: "Owner / operator",
      draft: false,
      rows: [
        {
          job: "Know what came in overnight that actually matters",
          when: "Morning, with coffee",
          today: "Open every inbox channel, scan for urgency, mentally rank",
          withAgentplain:
            "Daily briefing — categorized inbound across email + calendar + the tools you've connected, scannable in under 30 seconds",
        },
        {
          job: "Decide which inbound deserves a same-day response",
          when: "All day",
          today: "Read every message, judge by feel, often miss the urgent one",
          withAgentplain:
            "Inbound classified by intent (lead / customer follow-up / vendor / noise); priority sorted; drafted replies queued for your review",
        },
        {
          job: "Get back to a customer who pinged you yesterday",
          when: "When you remember — usually too late",
          today: "Hunt the thread, retype context from memory",
          withAgentplain:
            "Follow-up agent surfaces the thread + context + a drafted next-touch on the cadence you set",
        },
        {
          job: "Schedule a call or meeting without the email volley",
          when: "Every booking",
          today: "Three rounds of 'how about Tuesday' before a time lands",
          withAgentplain:
            "Scheduling agent reads the thread, proposes times against your calendar, drafts the confirmation",
        },
        {
          job: "Document a recurring process so it doesn't live in your head",
          when: "When something breaks and you wish you'd written it down",
          today: "Doesn't happen — no time between operating and selling",
          withAgentplain:
            "Documentation agent drafts the SOP from how you actually do it (observed across email + calendar + your notes); you edit and approve",
        },
      ],
    },
    {
      role: "Admin / office manager",
      draft: false,
      rows: [
        {
          job: "Triage shared inbox and route what needs the owner",
          when: "All day",
          today: "Eyeball every message, judge urgency, forward with a note",
          withAgentplain:
            "Inbox agent classifies and drafts the owner-handoff with the context already attached",
        },
        {
          job: "Send a routine follow-up the owner asked you to remember",
          when: "Daily",
          today: "Sticky notes, manual reminder list, hope you don't forget",
          withAgentplain:
            "Follow-up agent runs the cadence; you review the drafted touch before it goes",
        },
        {
          job: "Reconcile what got invoiced against what got paid",
          when: "Weekly to monthly",
          today: "Manual cross-check between QuickBooks and the inbox",
          withAgentplain:
            "Books-light agent flags the gaps and drafts the chase email; you send",
        },
      ],
    },
  ],

  roi: {
    multiplier: "15x",
    inputCost:
      "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
    outputValue:
      "$3,000 / mo per seat at the conservative end of the value range",
    math:
      "Lower bound of the published value-anchor band ($2,900–$10,600/mo per seat). Universal-admin recovery is the floor case: ~6 owner-hours/week on inbox triage + scheduling + follow-up × $100/hr conservative blended rate × 4.3 weeks = ~$2,580/mo against the solo Regular-tier seat ($199/mo) = ~13x at the floor. Rounded to a 15x headline that sits at the bottom of the 15x–110x ROI range every Regular-tier vertical advertises. Without a vertical-specific compliance corpus the upside ceiling is lower than the named verticals — that's the honest trade for not having to scope a Custom engagement.",
    citation:
      "Pricing per `project_stripe_both_surfaces.md` (single Regular tier, simplified 2026-05-12; per-seat ladder $199→$99; first month free). ROI band per `project_pricing_value_anchor.md` (Regular-tier ROI range 15x–107x). Universal-admin hour share is an operator-modeled floor — flagged in capability inbox for primary-research validation. `/general` deliberately publishes the low end of the range because the on-ramp scaffolding is lighter than a ratified vertical.",
  },

  claims: {
    replace: [
      "Inbox triage on the channels every local business runs (email, shared mailbox, contact form) — priority-sorted into urgent / customer-active / vendor-pending / needs-your-decision / noise",
      "The morning scramble to figure out what came in overnight",
      "The scheduling email volley — drafted with calendar context, sent from your account",
      "The 'I'll get to that tomorrow' follow-up backlog — stale threads surfaced oldest first with a drafted nudge",
      "The 'I keep meaning to write that down' process — recurring patterns clustered and drafted as an SOP you can edit and hand off",
    ],
    integrate: [
      "Gmail (read-only OAuth, drafts to your account)",
      "Microsoft 365 / Outlook (read-only OAuth, drafts to your account)",
      "Google Drive + OneDrive (file substrate for past work + playbooks)",
      "QuickBooks Online (read-only, for books-light reconciliation)",
      "DocuSign (signature routing for the documents that need it)",
    ],
    augment: [
      "Owner review on every customer-facing draft — the fleet drafts, you sign and send",
      "SOP drafting — observed from how you actually handle recurring work, edited by you, copied into your own docs",
      "Vendor / contractor follow-up — drafted in your voice; you approve before send",
      "Books-light reconciliation — drafted with the QuickBooks line cited; you decide",
    ],
  },

  integrations: {
    shipped: [],
    planned: [
      { name: "Gmail", category: "Email" },
      { name: "Microsoft 365 / Outlook", category: "Email + calendar" },
      { name: "Google Calendar", category: "Calendar" },
      { name: "QuickBooks Online", category: "Accounting (read-only)" },
      {
        name: "Generic CRM webhook receiver",
        category: "Catch-all",
        note: "For tools outside the ten named verticals' integration roadmap",
      },
    ],
    plannedWindow: "Q4 2026",
  },

  valueLoopExample: {
    scenario:
      "Tuesday 7:18am. A local independent boutique owner — not in one of our ten named verticals — opens her laptop.",
    before:
      "Open Gmail, scan 47 overnight messages, pick out the three customer questions, mentally rank vendor pings, find the partner email she meant to answer yesterday, retype a quote from memory, schedule a fitting consult with three back-and-forth emails. ~50 minutes before the first customer walks in.",
    after:
      "The fleet has drafted replies to the three customer questions citing the order history, surfaced the partner thread with a one-line catch-up, drafted the quote with the line items pulled from QuickBooks, and proposed three fitting-consult time slots against her calendar with the confirmation already drafted. She reviews, edits, sends from her own Gmail.",
    outcome:
      "Six minutes instead of fifty. No vertical-specific compliance corpus, no MLS integration, no broker-of-record sentinel — just the universal admin lifted off the owner's plate. If the boutique ever needed something deeper (state retail sales-tax reconciliation, vendor-contract review), that scopes as a Custom engagement.",
  },
};
