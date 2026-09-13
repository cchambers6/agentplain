import type { VerticalContent } from "../types";
import {
  TRIAL_PERIOD_DAYS,
  MONEY_BACK_GUARANTEE_DAYS,
  MONTHLY_PRICE_USD_CENTS,
} from "../../billing/facts";

// One flat price for every vertical and every customer. READ, never
// restated: hardcoding "$99" here is exactly how the retired per-seat
// ladder outlived the engine that stopped producing it.
const FLAT = "$" + MONTHLY_PRICE_USD_CENTS / 100;

// Real estate is the only vertical with a canonical, ratified Phase 0
// JTBD table — see `C:\flatsbo\outputs\agentplain_product_phase0\product_spec.md` §3
// (broker-owner: BO-1..BO-8, individual agent: IA-1..IA-6).
// Operator JTBDs (OP-1..OP-8) are platform-internal and not surfaced on the
// customer-facing landing page.

export const realEstate: VerticalContent = {
  slug: "real-estate",
  name: "Real estate",
  tier: "regular",
  missionSubject: "realtors and brokerages",

  // CLAIM DISCIPLINE (2026-09-12 claims pass): every capability named in
  // this file must resolve to a SKILL_CATALOG entry that is
  // `runtime: 'live'` AND has a named production caller that dispatches
  // it — the 16-skill set formed by SWEEP_DISPATCH_MANIFEST (9) plus
  // NON_SWEEP_LIVE_SKILLS (7) in lib/skills/sweep-dispatch-manifest.ts.
  // That rule is stated because FOUR different answers to "which skills
  // have a production caller" exist in this repo (4 / 16 / 17 / 18) and
  // quoting one without its rule is the defect.
  //
  // Listing intake, CRM hygiene, production reporting, recruiting
  // outreach and listing-description drafting resolve to NOTHING in that
  // set. They were deleted here rather than softened. The agentRoster
  // below already marked them `rooting`; the prose did not, and the prose
  // is what a customer reads.
  directAnswer:
    "agentplain for real estate is a managed AI service partnership for independent brokerages and agents. A service team installs a vertical-aware fleet that triages inbound buyer inquiries and drafts the first-touch reply, proposes showing times across buyers, agents, and calendars, and runs a daily compliance sweep over the previous day's drafts — working inside the Outlook, Gmail, Google Drive, and DocuSign you already use. The fleet drafts and proposes; the broker approves and sends. Nothing leaves the brokerage without a person's name on it.",

  verticalFaq: [
    {
      // REWRITTEN 2026-09-12. The previous answer said the sentinel checks
      // every draft "before the broker-of-record reviews it". That is
      // backwards, not merely optimistic: `compliance-watch-general` runs
      // on a DAILY cron (`0 13 * * *`,
      // lib/inngest/functions/compliance-watch-sweep.ts) and scans the
      // TRAILING 24 HOURS of drafts that already exist. A draft written at
      // 13:05 UTC is looked at roughly a day later — routinely after the
      // broker has approved and sent it. Describing a retrospective
      // advisory digest as a pre-send gate is the single most exposed
      // claim on this page, because the reader's next question is whether
      // it prevents a fair-housing filing. It does not.
      q: "Does agentplain handle fair-housing compliance?",
      a: "Partly, and it is important to be exact about when. A daily compliance sweep reads the previous 24 hours of drafts and flags fair-housing trigger phrases and personal-data matches, then leaves you a digest to review. It runs once a day, it runs after the drafts are written, and it advises — it does not block a draft, does not gate sending, and does not make the legal call. It is a second pair of eyes on yesterday's work, not a pre-send check, so it can flag wording you have already sent. Review before your broker-of-record signs remains the control that matters, and liability for licensed activity stays with your brokerage.",
    },
    {
      q: "Is agentplain a replacement for my CRM or MLS?",
      a: "No. agentplain connects to the Outlook, Gmail, Google Drive, and DocuSign you already pay for and takes on two pieces of the manual coordination between them — triaging inbound buyer inquiries into a drafted first-touch reply, and proposing showing times across buyers, agents, and calendars. It isn't a CRM, an MLS, or a transaction-management system, it does not clean up your CRM records or build your production reports, and there's nothing to migrate.",
    },
    {
      q: "How much does agentplain cost for a brokerage?",
      a: `${FLAT} per month. One flat price — the same whether you are a solo agent or a multi-office brokerage, and the same across every vertical. Month-to-month, with a ${TRIAL_PERIOD_DAYS}-day free trial (card at signup) and a ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee on your first charge. You can cancel anytime.`,
    },
    {
      q: "What if it doesn't work for my brokerage?",
      a: `You find out before you pay. The trial opens with the after-hours lead demo running on sample data, then the fleet drafts against your real inbox once you connect it — so by day ${TRIAL_PERIOD_DAYS} you have your own drafts, not our claims, to judge. If the first month still doesn't earn its seat, the ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee applies to your first charge, and every plan is month-to-month with no annual lock-in.`,
    },
    {
      q: "Do I need new software or an IT project to start?",
      a: "No. You connect the accounts you already own: Outlook, Gmail, and Google Workspace by OAuth on your own credentials, and Follow Up Boss or Sierra Interactive by pasting your own API key. The integrations stay yours — revoke a key or disconnect an account and access ends with it. There is no migration and nothing new for your agents to learn.",
    },
    {
      q: "Does the fleet send anything to clients on its own?",
      a: "No. Every draft — a buyer reply, a showing proposal, a status note — lands in your approval queue as a pending item. The fleet drafts and proposes; you approve and send from inside your own email, calendar, and CRM, where your name and domain are already on the message. It never auto-sends, moves money, or makes commitments on your behalf.",
    },
  ],

  // The pre-trained realty fleet, surfaced in-product on /agents. Each entry
  // declares its runtime binding so the agents page renders a TRUTHFUL state
  // instead of a perpetual "rooting in" spinner:
  //   - `live`  → the V1 inbox loop attributes real work to this slug. The
  //               attribution resolver (lib/skills/persist-artifacts.ts) writes
  //               the slug as the handoff trace root + approval agentSlug, so
  //               `counts.get(slug)` reads the real number once email flows.
  //   - `rooting` → declared capability whose runtime skill is not wired into
  //               the live loop yet; the card states what it's waiting on.
  // Two agents are live today (the inbox chain produces buyer-inquiry replies
  // and showing-time proposals); the other five are honestly rooting — see
  // docs/realty-fleet-binding-2026-05-22.md for which can't be live yet + why.
  agentRoster: [
    {
      slug: "realty-listing-coordinator",
      name: "Listing Coordinator",
      job: "Runs listing intake and keeps every new listing's follow-up moving.",
      runtime: "rooting",
      rootingNote:
        "Setting up — comes online once your transaction system is connected.",
    },
    {
      slug: "realty-buyer-inquiry-router",
      name: "Buyer Inquiry Router",
      job: "Classifies inbound buyer inquiries and drafts the first-touch reply.",
      runtime: "live",
      owns: ["buyer-inquiry"],
    },
    {
      slug: "realty-showing-scheduler",
      name: "Showing Scheduler",
      job: "Coordinates showing times across buyers, agents, and calendars.",
      runtime: "live",
      owns: ["scheduling"],
    },
    {
      slug: "realty-compliance-sentinel",
      name: "Compliance Sentinel",
      job: "Pre-checks every customer-facing draft before the broker signs.",
      runtime: "live",
      owns: ["compliance-check"],
    },
    {
      slug: "realty-crm-hygiene",
      name: "CRM Hygiene",
      job: "Dedupes, normalizes, and surfaces stale records in the CRM.",
      runtime: "rooting",
      rootingNote:
        "Setting up — comes online once your CRM is connected.",
    },
    {
      slug: "realty-production-reporter",
      name: "Production Reporter",
      job: "Drafts the production read against MLS and the workspace median.",
      runtime: "rooting",
      rootingNote:
        "Setting up — comes online once your MLS feed is connected.",
    },
    {
      slug: "realty-recruiter-assistant",
      name: "Recruiter Assistant",
      job: "Drafts recruiting outreach with one substantiated production reference.",
      runtime: "rooting",
      rootingNote:
        "Setting up — comes online alongside the Production Reporter's data.",
    },
    {
      // Chief of Staff — horizontal capability bound to the
      // chief-of-staff-scheduler skill. Walks (calendar + inbox + to-do)
      // and PROPOSES meetings, reply drafts, and to-dos for broker
      // approval. Never books, never sends, never writes a third-party
      // task row — every proposal lands in /approvals as PENDING.
      slug: "realty-chief-of-staff",
      name: "Chief of Staff",
      job: "Proposes meetings, reply drafts, and to-dos against the broker's calendar + inbox + board.",
      runtime: "live",
      boundSkill: "chief-of-staff-scheduler",
      // Card is LIVE only when a calendar connector is wired. With
      // neither GOOGLE nor M365 active the agents page degrades the
      // badge to "connect to activate" so the roster never overclaims.
      liveRequires: { connectors: ["GOOGLE", "M365"] },
    },
  ],

  hero: {
    eyebrow: "Built for independent real-estate brokerages",
    headline: "The operating layer behind the independent brokerage.",
    // INTEGRATES list names only the connect tiles in `lib/integrations/marketplace.ts`
    // that ship `status: 'available'` today. The MLS / CRM / transaction-management
    // adapters live in the per-vertical integration roadmap below and surface
    // honestly there as planned, not in this present-tense hero clause.
    // The 8–12 weekly hours covered FIVE activities (lead routing,
    // listing-intake follow-up, showing scheduling, recruiting outreach,
    // monthly reports). Two of the five ship. See `roi.math` for the
    // arithmetic that takes 8–12 down to 1.6–2.4.
    valueProp:
      "agentplain REPLACES part of the weekly coordination a broker-owner does by hand — inbound buyer triage and showing scheduling — INTEGRATES with Outlook, Gmail, Google Drive, and DocuSign on day one, and AUGMENTS the broker-of-record's review with a daily compliance sweep over the previous day's drafts.",
    sbmSubhead:
      "The buyer-inquiry, scheduling, and compliance skills, agents, and memory a brokerage would otherwise build itself",
  },

  metaTitle: "for independent real-estate brokerages",
  metaDescription:
    "Inbound buyer triage, drafted first-touch replies, showing scheduling, and a daily compliance sweep — for the 5–25-agent independent real-estate brokerage.",

  jtbdTables: [
    {
      role: "Broker-owner",
      draft: false,
      rows: [
        {
          job: "Know what the fleet drafted overnight",
          when: "Morning, with coffee",
          today: "Open Outlook, scan the last 24 hours of activity by hand",
          withAgentplain:
            "Daily briefing — yesterday's drafts + flags + per-agent activity scannable in under 30 seconds",
        },
        {
          // Was: "Sentinel pre-checks every customer-facing draft; flags
          // surface before MLS submission with severity rating +
          // suggested rewrite." The sweep is daily and retrospective, and
          // it writes a digest — there is no severity rating and no
          // suggested rewrite in the output.
          job: "Re-read what the fleet drafted yesterday for compliance risk",
          when: "Next day, when the digest lands",
          today: "Caught after the listing's already on MLS, via a call from the broker-of-record",
          withAgentplain:
            "Daily sweep over the previous 24 hours of drafts; one digest naming what was flagged and what to check before you approve",
        },
        {
          job: "Invite a new agent to the workspace",
          when: "New hire onboarding",
          today: "Manual setup — credentials, tool access, training",
          withAgentplain: "Self-serve invite from the workspace settings page",
        },
        {
          job: "Configure which agents are enabled at your tier",
          when: "Initial setup, tier upgrade",
          today: "Doesn't exist — your current stack doesn't have configurable agents",
          withAgentplain: "Settings page, role-gated by tier",
        },
        {
          job: "See the AI activity on any listing in your brokerage",
          when: "Pre-close review, regulatory inquiry",
          today: "Hunt through inbox + CRM history by hand",
          withAgentplain:
            "Per-listing activity feed — append-only handoff log on the listing's page",
        },
        {
          job: "See agent-team health — who is using the product, who is not",
          when: "Weekly",
          today: "Doesn't exist",
          withAgentplain: "Workspace user list with last-active-at",
        },
        {
          job: "Pay your bill",
          when: "Monthly",
          today: "Manual invoice from your current tooling",
          withAgentplain: "Billing page in your workspace — invoice history + payment method",
        },
      ],
    },
    {
      role: "Individual real-estate agent",
      draft: false,
      rows: [
        {
          job: "Know what the fleet has ready for you today",
          when: "Phone-open in the morning",
          today: "No surface",
          withAgentplain:
            "Mobile-first today view — three highest-priority items at a glance",
        },
        {
          job: "Send a drafted reply to a buyer inquiry",
          when: "Mid-day, between showings",
          today: "Open Outlook, retype from memory",
          withAgentplain:
            "Surfaced drafted reply, copy-to-clipboard, deeplink into your own email client",
        },
        {
          // Was "Real-time flag on the draft surface" — no such surface
          // exists. The only compliance output is the daily digest.
          job: "See compliance flags on your own drafts",
          when: "Next day",
          today: "Doesn't happen — flag fires after submission",
          withAgentplain: "Named in the daily compliance digest, for you to check before approving",
        },
        // DELETED: "Ratify a per-listing recommendation" →
        // "Per-listing recommendation row in the today view".
        // `LISTING_RECOMMENDATION` has a renderer, settings UI and report
        // math, and NOTHING writes one. A row promising a surface fed by
        // a producer that does not exist is the clearest kind of unbacked
        // claim, so it is cut rather than reworded.
        {
          job: "Ask the fleet about a specific lead or listing",
          when: "When stuck or curious",
          today: "Doesn't exist",
          withAgentplain: "Thread surface scoped to a single record",
        },
        // DELETED: "See your own production vs. workspace median" →
        // "Production-reporter output, agent-scoped variant". There is no
        // production-reporter skill in SKILL_CATALOG; the roster already
        // shows that agent as `rooting`. The JTBD row promised the output
        // in the present tense anyway.
      ],
    },
  ],

  roi: {
    // RE-DERIVED 2026-09-12, in the shape PR #566 used for CPA: separate
    // what is SOURCED from what is MODELED and publish the number you can
    // stand behind.
    //
    // The headline was "50x" / "$5,300 saved/mo". Three things were wrong
    // with it, and the first is the one to notice:
    //
    //  1. $5,300 did not match its own arithmetic. The math block derived
    //     a midpoint of $5,160 and the headline said $5,300. No test
    //     pinned either figure, so the two could drift apart silently and
    //     did.
    //  2. The 8–12 hr/week input covered FIVE activities — lead routing,
    //     listing-intake follow-up, showing scheduling, recruiting
    //     outreach, monthly reports. THREE of the five do not exist.
    //  3. It counted the hours as fully REPLACED. They are not: the fleet
    //     drafts, the broker reviews and sends. The product's own copy
    //     says so two lines above.
    //
    // UNLIKE CPA, REAL ESTATE HAS NO SOURCED INPUT AT ALL. CPA's 9x rests
    // on a cited doc-chase share in
    // `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4. Real
    // estate's hour range comes from an internal positioning document and
    // its hourly rate is an internal assumption. So there is no sourced
    // figure to fall back to, and the honest headline is a MODELED one,
    // labelled as such. That is the finding, not a presentation choice.
    multiplier: "~10x modeled — no sourced figure exists for this vertical",
    inputCost: `${FLAT}/month flat — ${TRIAL_PERIOD_DAYS}-day free trial, card at signup`,
    outputValue: "~$1,030/mo modeled at the broker-owner level",
    math:
      `Start from the 8–12 owner-hours/week coordination range (internal positioning input, not primary research). That range covers five activities: lead routing, listing-intake follow-up, showing scheduling, recruiting outreach, monthly reports. TWO of the five have a live skill with a production caller — buyer-inquiry triage and showing scheduling. No source breaks the range down per activity, so we weight the five equally and take two-fifths: 3.2–4.8 hrs/week. Of that, the fleet DRAFTS and the broker still reviews and sends, so only the drafting leg is recovered; we model that at half, which is an operator assumption and not a measurement: 1.6–2.4 hrs/week. × $120/hr (owner-as-producer opportunity cost, an internal 2026-05-08 assumption pending primary research) × 4.3 weeks = $826–$1,238/mo. Midpoint ~$1,032. Against the flat ${FLAT}/month that is ~10x, or ~$12,400/yr against $1,188/yr paid. Every input in that chain is operator-modeled; none of it is sourced. Every agent added to the brokerage raises the return; the bill does not move.`,
    citation:
      "Pricing per `lib/billing/facts.ts` (`MONTHLY_PRICE_USD_CENTS`) — ONE flat monthly price, the same for every customer and every vertical, whatever the headcount. Trial + money-back mechanics per the same module. Coordination-hour range per `agentplain_positioning.md` L33 — an internal positioning document, NOT primary research. Owner-hour opportunity cost ($120/hr) is a 2026-05-08 internal assumption pending primary-research validation — flagged in capability inbox. The two-fifths activity weighting and the one-half drafting-leg share are operator assumptions introduced by the 2026-09-12 claims re-derivation and are likewise unvalidated. Backed-capability set per `SWEEP_DISPATCH_MANIFEST` + `NON_SWEEP_LIVE_SKILLS` in `lib/skills/sweep-dispatch-manifest.ts`. NO COMPONENT OF THIS FIGURE IS SOURCED FROM PRIMARY RESEARCH; compare CPA, whose 9x rests on a cited doc-chase share.",
    violationAvoidance:
      "Fair-housing exposure is a real risk in realty marketing: a single discriminatory phrase in a listing description or a buyer reply is a fileable Fair Housing Act violation carrying a first-offense HUD civil penalty of $26,262 (2025 inflation-adjusted, 24 CFR §180.671). What agentplain does about it is narrower than that framing invites, so state it exactly: nothing is auto-sent, so a person reads every draft before it goes — that is the control. Separately, a daily sweep re-reads the previous 24 hours of drafts and flags fair-housing trigger phrases for you. The sweep runs AFTER drafts are written and advises rather than blocks, so it is a backstop that can catch wording you have already sent — it is not a pre-publication gate and it cannot be relied on to keep a violating sentence off a portal. The approval step is what does that work.",
  },

  // Every line below names a skill in the 16-skill backed set. Four
  // claims were DELETED rather than softened, because nothing in the
  // catalog produces them:
  //   - CRM hygiene drift        → no CRM-hygiene skill exists.
  //   - hand-built production reports → no production-reporter skill
  //     exists; `LISTING_RECOMMENDATION` likewise has a renderer and no
  //     producer (5 references, all in bounded-execute + tests).
  //   - listing-description drafting → same, no producer.
  //   - recruiting outreach      → no recruiting skill is catalog-live.
  claims: {
    replace: [
      // 8–12 covered five activities; two ship. See `roi.math`.
      "1.6–2.4 hours/week of broker-owner coordination — triaging inbound buyer inquiries into a drafted first-touch reply, and proposing showing times across buyers, agents, and calendars",
      // Honest cadence AND honest direction: a daily sweep over the
      // PREVIOUS day's drafts, advisory only.
      "The end-of-week scramble to re-read what went out — a daily sweep flags fair-housing and personal-data matches in the previous 24 hours of drafts",
    ],
    integrate: [
      "Outlook + Gmail (per-agent OAuth — email + calendar)",
      "Google Drive (your file substrate — past offers, playbooks, listing photos)",
      "DocuSign (per-listing signature routing)",
      // Was "(production-reporter dependency)" — that skill does not
      // exist, so the stated REASON for the integration was a claim for
      // unbuilt software. The connector itself is real.
      "QuickBooks Online (accounting connector)",
    ],
    augment: [
      "Broker-of-record review — you still sign; the daily sweep is a second look at yesterday's drafts, not a gate on today's",
      // "<2 minutes" was not defensible as a blanket claim. TWO callers
      // dispatch `lead-triage-realestate` and they have very different
      // latencies: the vertical-router fires on the inbound webhook
      // (lib/skills/vertical-router.ts REGISTRATIONS), while the Follow
      // Up Boss / HubSpot / Salesforce sync sweeps run HOURLY
      // (`0 * * * *`). A lead arriving through the CRM can therefore wait
      // up to an hour. State the slower path.
      "Buyer-inquiry first-touch — drafted within minutes of an inbound email, or on an hourly sync for leads that arrive through your CRM; you approve and send from your own system",
    ],
  },

  integrations: {
    // Live today — the connect path is open (Follow Up Boss + Sierra via a
    // pasted API key; M365 / Google Workspace / QuickBooks via OAuth) and
    // Plaino reads, triages, and drafts on the real account. See
    // `lib/integrations/marketplace.ts` (status: 'available').
    shipped: [
      {
        name: "Follow Up Boss",
        category: "CRM",
        note: "Reads leads, triages each one, drafts a first-touch reply into /approvals, writes the decision back as a note + tag.",
      },
      {
        name: "Sierra Interactive",
        category: "CRM",
        note: "Reads contacts, triages each lead, drafts a first-touch reply, writes the triage decision back as a private note + tag.",
      },
      { name: "Microsoft 365 Graph", category: "Calendar + email" },
      { name: "Google Workspace", category: "Calendar + email" },
      { name: "QuickBooks Online", category: "Accounting" },
    ],
    planned: [
      { name: "dotloop", category: "Transaction management" },
      { name: "Skyslope", category: "Transaction management" },
      { name: "FMLS / GAMLS", category: "MLS (Georgia)" },
      { name: "Zillow / Realtor.com", category: "Lead source" },
      { name: "RESO Web API", category: "MLS standard" },
    ],
    plannedWindow: "Q3 2026",
  },

  // REWRITTEN 2026-09-12. The previous example was a counter-offer
  // response drafted overnight, with the buyer's-agent thread summarized
  // and three comparable closings pulled from MLS and Drive. None of
  // that is a live skill: there is no counter-offer skill, no comparables
  // retrieval, and no transaction-management connector (dotloop is in
  // `integrations.planned`). It was the most vivid paragraph on the page
  // and described software that does not exist.
  //
  // Replaced with the one loop that IS backed end to end — the after-
  // hours buyer inquiry, dispatched by the vertical-router on the inbound
  // webhook (`lead-triage-realestate`), which is also the loop the trial
  // demo runs.
  valueLoopExample: {
    scenario:
      "A buyer inquiry lands on Sarah's listing Tuesday 9:14pm. She wakes Wednesday at 6:30am.",
    before:
      "Open Outlook, work out which listing it's about and how warm the lead is, retype a first reply from memory. The lead has been waiting nine hours, and whoever replied first probably has it.",
    after:
      "The inquiry was triaged when it arrived and a first-touch reply is already drafted and waiting in her approval queue, tagged with how the fleet read the lead. Sarah reads it, edits a line, and sends it from her own email — where her name and domain are already on the message.",
    outcome:
      "A reply out before her first showing instead of after it. The fleet drafts; Sarah approves and sends; nothing left the brokerage unread.",
  },
};
