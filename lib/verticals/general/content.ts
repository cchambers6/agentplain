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

  hero: {
    eyebrow: "Don't see your industry?",
    headline: "Same service partnership. Lighter scaffolding.",
    valueProp:
      "agentplain REPLACES the universal admin work — inbox triage, scheduling, follow-up, basic documentation — INTEGRATES with the tools every local business already runs (Gmail, Outlook, Google Calendar, QuickBooks), and AUGMENTS the owner's review on every customer-facing draft. No vertical-specific compliance corpus; if you need one, we scope it as a Custom engagement.",
  },

  metaTitle:
    "agentplain for local businesses — service partnership for any industry",
  metaDescription:
    "An honest on-ramp for local businesses outside our ten named verticals. The same service partnership — inbox triage, scheduling, follow-up, drafted responses — scaffolded against common-denominator tools (Gmail, Outlook, Google Calendar, QuickBooks). Lighter compliance corpus than the named verticals; if you need bespoke vertical depth, we scope it as a Custom engagement.",

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
      "Inbox triage on the channels every local business runs (email, shared mailbox, contact form)",
      "The morning scramble to figure out what came in overnight",
      "The scheduling email volley — drafted with calendar context, sent from your account",
      "The 'I'll get to that tomorrow' follow-up backlog — drafted on a cadence you set",
    ],
    integrate: [
      "Gmail (read-only OAuth, drafts to your account)",
      "Microsoft 365 / Outlook (read-only OAuth, drafts to your account)",
      "Google Calendar (per-user OAuth)",
      "QuickBooks Online (read-only, for books-light reconciliation)",
      "Generic CRM webhook receiver (for tools we haven't named)",
    ],
    augment: [
      "Owner review on every customer-facing draft — the fleet drafts, you sign and send",
      "Documentation drafting — observed from how you actually work, edited by you",
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
