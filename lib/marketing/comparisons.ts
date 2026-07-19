import {
  TRIAL_PERIOD_DAYS,
  MONEY_BACK_GUARANTEE_DAYS,
} from "../billing/facts";

// Comparison registry — "agentplain vs {alternative}" pages.
//
// AEO (answer-engine optimization) intent: when someone asks an AI answer
// engine "agentplain vs ChatGPT" / "should I build my own agents or use
// agentplain" / "agentplain vs hiring an assistant", these pages give the
// engine an honest, quotable answer that lifts up agentplain's specific
// value — a managed, run-for-you service partnership — without trashing the
// alternative.
//
// Editorial rules (match the homepage + FAQ + memory locks):
//   - HONEST. Each comparison states where the alternative genuinely wins
//     before where agentplain wins. A comparison that only flatters us reads
//     as marketing and an answer engine won't trust it.
//   - "service partnership", "run for you, not configured by you", "the fleet
//     drafts; you decide", draft-then-approve / no-outbound — the locked
//     positioning vocabulary.
//   - VENDOR DISCIPLINE: never name the AI model that powers agentplain
//     (Claude/Anthropic) — the 2026-06-11 vendor-invisible rule. ChatGPT /
//     OpenAI may be named ONLY as the compared alternative on the chatgpt
//     page (a competitor we contrast with, not our own substrate), matching
//     the homepage which already contrasts with ChatGPT.
//   - Pricing claims cite the locked per-seat ladder only ($99–$299; first
//     month free; month-to-month) per `project_stripe_both_surfaces.md`.
//   - No invented metrics, customer counts, or ratings
//     (`feedback_no_guesses_no_estimates.md`).

export interface ComparisonRow {
  /** The axis being compared, e.g. "Who maintains it". */
  dimension: string;
  /** The alternative's answer on this axis. */
  alternative: string;
  /** agentplain's answer on this axis. */
  agentplain: string;
}

/** One specific, defensible thing the compared product cannot do. */
export interface ComparisonGap {
  /** Short imperative title ("Write the follow-up."). */
  title: string;
  /** The defensible specifics — every claim here has a source line in
   *  docs/marketing/compare-pages-2026-07-08/RESEARCH-NOTES.md. */
  detail: string;
}

export interface Comparison {
  /** URL slug under /compare/. */
  slug: string;
  /** The alternative as a noun phrase used in headings ("doing it yourself"). */
  alternative: string;
  /** Short label for the hub card + breadcrumb ("Build it yourself"). */
  navLabel: string;
  /** One-line summary for the /compare hub grid. */
  cardSummary: string;
  metaTitle: string;
  metaDescription: string;
  heroHeadline: string;
  /**
   * AEO direct answer to "Should I choose agentplain or {alternative}?" —
   * self-contained and quotable; rendered high on the page AND emitted as the
   * first FAQPage item.
   */
  directAnswer: string;
  /** Honest — where the alternative genuinely wins. Listed FIRST on the page. */
  whereAlternativeWins: string[];
  /** Where agentplain wins. */
  whereAgentplainWins: string[];
  rows: ComparisonRow[];
  /** The honest bottom line: pick the alternative if… */
  chooseAlternativeIf: string;
  /** …pick agentplain if… */
  chooseAgentplainIf: string;
  faq: Array<{ q: string; a: string }>;

  // ── Optional vendor-page fields (named-competitor comparisons) ──────────
  // The vendor pages follow the ratified "DIY vs run-for-you" frame
  // (docs/marketing/deep-dive-2026-07-02/01-competitive-positioning.md):
  // shared pain first, the vendor's genuine strengths, the specific gaps,
  // what run-for-you means, then the honest bottom line. Generic pages
  // (diy/chatgpt/assistant/agency) omit these and render unchanged.

  /** The concrete week both products exist to fix — rendered after the hero. */
  sharedPain?: string;
  /** What the compared product can't do — specific and defensible. */
  cantDo?: ComparisonGap[];
  /** What "run-for-you" means, as plain paragraphs. */
  runForYou?: string[];
  /** Render the intro-call booking CTA instead of the trial CTA. */
  bookingCta?: boolean;
}

const NO_OUTBOUND_ANSWER =
  "No. Every draft — a reply, a proposal, a status update — lands in your approval queue as a pending item. The fleet drafts and proposes; you approve and send from inside your own email, calendar, and CRM. It never auto-sends, moves money, or makes commitments on your behalf.";

const REGISTRY: Record<string, Comparison> = {
  diy: {
    slug: "diy",
    alternative: "building it yourself",
    navLabel: "Build it yourself",
    cardSummary:
      "Building your own agents on foundation-model APIs vs. a pre-built, run-for-you fleet.",
    metaTitle: "agentplain vs. building it yourself",
    metaDescription:
      "Should you build your own AI agents or use agentplain? An honest comparison: raw cost and control vs. a pre-built, vertical-aware fleet a service team runs and maintains for you.",
    heroHeadline: "agentplain vs. building it yourself",
    directAnswer:
      "If you have an engineer who can build and maintain agents on foundation-model APIs and the time to write the vertical workflows, integrations, and compliance checks yourself, building it yourself is cheaper on paper — you pay only for model API usage. agentplain is for the local business that wants the result without the build: we bring the pre-built skills and agents, the vertical-specific memory, the connected tools, and a service team that runs and customizes the whole thing for a flat monthly fee. You pay for the assembled, maintained, run-for-you system instead of the parts.",
    whereAlternativeWins: [
      "Lowest raw cost — you pay only for model API usage, no subscription.",
      "Total control over every prompt, model choice, and workflow.",
      "No third party in your data path.",
    ],
    whereAgentplainWins: [
      "Nothing to build — pre-built vertical skills, agents, and memory ship on day one.",
      "A service team runs and customizes it; you don't maintain anything.",
      "Vertical compliance posture and the integrations to your tools are already done.",
      "Draft-then-approve guardrails and an approval queue are built in.",
    ],
    rows: [
      { dimension: "Time to first value", alternative: "Weeks to months of building", agentplain: "Days, set up by a service team" },
      { dimension: "Who maintains it", alternative: "You or your engineer, indefinitely", agentplain: "Your service partner" },
      { dimension: "Vertical workflows", alternative: "You design and test each one", agentplain: "Pre-built per vertical, counsel-reviewed corpus" },
      { dimension: "Integrations", alternative: "You wire each tool yourself", agentplain: "Connected on the /integrations page" },
      { dimension: "Cost shape", alternative: "Variable model-API usage", agentplain: `Flat per-seat monthly, ${TRIAL_PERIOD_DAYS}-day free trial` },
      { dimension: "Compliance + guardrails", alternative: "You build the checks", agentplain: "Per-vertical corpus + draft-then-approve loop" },
    ],
    chooseAlternativeIf:
      "You have in-house engineering, want maximum control, and have time to build and maintain the workflows, integrations, and compliance checks yourself.",
    chooseAgentplainIf:
      "You want the assembled result — vertical skills, connected tools, and a service team running it — without building or maintaining anything.",
    faq: [
      {
        q: "Is agentplain just a wrapper I could build myself?",
        a: "You could build something like it — the foundation-model APIs are open. What you'd be signing up to build and maintain is the vertical workflow library, the per-tool integrations, the memory layer that keeps it useful, the compliance corpus, and the draft-then-approve guardrails — then keep all of it current as models and your operations change. agentplain is that assembled system plus a service team that runs it, for a flat fee.",
      },
      {
        q: "What does agentplain cost compared with building it?",
        a: `Building it yourself costs engineering time plus variable model-API usage. agentplain is a flat per-seat subscription — $99 to $299 depending on tier — month-to-month, with a ${TRIAL_PERIOD_DAYS}-day free trial and a ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee. You trade variable build-and-maintain cost for a predictable, run-for-you fee.`,
      },
      { q: "Does the fleet send anything on its own?", a: NO_OUTBOUND_ANSWER },
    ],
  },

  chatgpt: {
    slug: "chatgpt",
    alternative: "a generic AI chatbot",
    navLabel: "A generic AI chatbot",
    cardSummary:
      "A horizontal tool you prompt yourself vs. a vertical fleet a service team runs on your tools.",
    metaTitle: "agentplain vs. a generic AI chatbot (like ChatGPT)",
    metaDescription:
      "Should you use a generic AI chatbot like ChatGPT or agentplain? An honest comparison: a cheap horizontal tool you drive yourself vs. a vertical-aware fleet a service team runs in the background on your email, CRM, and documents.",
    heroHeadline: "agentplain vs. a generic AI chatbot",
    directAnswer:
      "A generic AI chatbot like ChatGPT is a horizontal tool you drive yourself — you open it, write a prompt, and copy the result back into your work. agentplain is a managed service partnership: a vertical-aware fleet runs in the background on your email, calendar, CRM, and documents, drafts what you'd otherwise type, and queues it for your approval — installed, run, and customized for you by a service team. The chatbot is a tool you operate; agentplain is an operation we run for you.",
    whereAlternativeWins: [
      "Cheap or free, and instant to start.",
      "General-purpose — it will answer almost anything, not just your vertical.",
      "No setup; open a tab and type.",
    ],
    whereAgentplainWins: [
      "Runs in the background on your real inbox, calendar, and CRM — you don't prompt it to do its job.",
      "Vertical-aware: your workflows, your deadlines, your compliance language.",
      "Integrated with the tools you already use; drafts land in an approval queue.",
      "A service team installs it, runs reviews, and customizes it — you don't operate it.",
      "Draft-then-approve: nothing sends on its own.",
    ],
    rows: [
      { dimension: "How you use it", alternative: "You prompt it every time", agentplain: "It runs in the background on your tools" },
      { dimension: "Knows your business", alternative: "Only what you paste in", agentplain: "Vertical corpus + your files + your past edits" },
      { dimension: "Integrations", alternative: "Copy-paste, by hand", agentplain: "Connected: email, CRM, documents, e-signature" },
      { dimension: "Who runs it", alternative: "You", agentplain: "A service team" },
      { dimension: "Taking action", alternative: "You do everything manually", agentplain: "Drafts queue for your approval; you send" },
      { dimension: "Cost shape", alternative: "Cheap/free, self-serve", agentplain: "Flat per-seat, service included" },
    ],
    chooseAlternativeIf:
      "You want a cheap, general-purpose tool for ad-hoc questions and you're happy to drive it yourself.",
    chooseAgentplainIf:
      "You want the recurring work of your specific business handled in the background by a service team — not a tool you have to operate.",
    faq: [
      {
        q: "Is agentplain just ChatGPT with extra steps?",
        a: "No. ChatGPT is a horizontal tool you prompt yourself. agentplain is a vertical-aware fleet that runs in the background on your email, calendar, CRM, and documents and drafts what you'd otherwise type — plus a service team that installs, runs, and customizes it. You don't prompt it to do its job, and you don't operate it; we do.",
      },
      {
        q: "Can't I just use a chatbot for my business?",
        a: "You can, for ad-hoc questions. The gap is the recurring, integrated work: reading your real inbox, knowing your vertical's workflows and compliance language, drafting inside the tools you already use, and routing every draft through an approval queue. That's the layer agentplain runs for you.",
      },
      { q: "Does agentplain send anything on its own?", a: NO_OUTBOUND_ANSWER },
    ],
  },

  "hiring-an-assistant": {
    slug: "hiring-an-assistant",
    alternative: "hiring an assistant",
    navLabel: "Hiring an assistant",
    cardSummary:
      "A human for judgment, calls, and relationships vs. a fleet for the systematic work at a fraction of a salary.",
    metaTitle: "agentplain vs. hiring an assistant",
    metaDescription:
      "Should you hire an assistant or use agentplain? An honest comparison: a human for judgment, calls, and relationships vs. an always-on fleet that handles the systematic drafting and follow-up at a fraction of a salary. Many shops run both.",
    heroHeadline: "agentplain vs. hiring an assistant",
    directAnswer:
      "A human assistant brings judgment, can make phone calls, and handles the physical and relational tasks software can't. agentplain handles the systematic, repeatable work — reading the inbox, drafting replies and documents, chasing deadlines, keeping the CRM clean — for a fraction of a salary, around the clock, with no turnover. Many shops run both: the assistant does the human work, and agentplain does the systematic work and drafts for the assistant to review.",
    whereAlternativeWins: [
      "Human judgment and relationships.",
      "Can make calls, run errands, and handle the physical and ad-hoc.",
      "Flexible — you can reassign a person to anything.",
    ],
    whereAgentplainWins: [
      "A fraction of a salary — flat per-seat, no benefits or overhead.",
      "Always on; no PTO, sick days, or turnover.",
      "Scales instantly across the whole recurring workload.",
      "Per-vertical compliance corpus and draft-then-approve are built in.",
      "Never quits and takes the institutional knowledge with it.",
    ],
    rows: [
      { dimension: "Cost", alternative: "Salary + benefits + overhead", agentplain: "Flat per-seat monthly" },
      { dimension: "Availability", alternative: "Business hours, PTO, turnover", agentplain: "Around the clock, no turnover" },
      { dimension: "Best at", alternative: "Judgment, calls, relationships, ad-hoc", agentplain: "Systematic drafting, triage, follow-up at scale" },
      { dimension: "Ramp-up", alternative: "Hiring + training", agentplain: "Days, run by a service team" },
      { dimension: "Compliance", alternative: "Depends on the person", agentplain: "Per-vertical corpus + approval queue" },
    ],
    chooseAlternativeIf:
      "You need a human for calls, in-person work, relationship management, and judgment calls that change every day.",
    chooseAgentplainIf:
      "You need the repeatable, high-volume systematic work handled reliably and affordably — or you want to free your assistant from it.",
    faq: [
      {
        q: "Should I hire an assistant or use agentplain?",
        a: "They solve different problems. An assistant brings human judgment, calls, and relationships; agentplain handles the systematic, repeatable work — triage, drafting, follow-up, CRM hygiene — for a fraction of a salary and around the clock. Many shops run both, with agentplain drafting and the assistant reviewing.",
      },
      {
        q: "Can agentplain replace my assistant?",
        a: "Not the human parts — calls, judgment, relationships, anything physical. What it takes over is the queue of repeatable drafting and coordination work that eats an assistant's day, so the person you hire spends their time where judgment actually matters.",
      },
      {
        q: "How much does agentplain cost compared with an assistant?",
        a: `An assistant is a salary plus benefits and overhead. agentplain is a flat per-seat subscription — $99 to $299 depending on tier — month-to-month, with a ${TRIAL_PERIOD_DAYS}-day free trial and a ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee.`,
      },
    ],
  },

  agency: {
    slug: "agency",
    alternative: "hiring an agency",
    navLabel: "Hiring an agency",
    cardSummary:
      "A human team for bespoke projects vs. an always-on fleet for the recurring operational load.",
    metaTitle: "agentplain vs. hiring an agency",
    metaDescription:
      "Should you hire an agency or use agentplain? An honest comparison: a human team for bespoke project work vs. an always-on managed AI fleet that handles the recurring operational load inside your own tools, for a flat fee — with the work product owned by you.",
    heroHeadline: "agentplain vs. hiring an agency",
    directAnswer:
      "An agency gives you a human team that takes whole functions off your plate on a project or retainer basis — useful when the work needs bespoke human strategy or creative. agentplain is an always-on managed AI service partnership: a vertical-aware fleet handles the recurring operational work inside your own tools, run and customized by a service team, for a flat monthly fee — and the work product is yours, not the agency's. It's built for the day-to-day operating load, not one-off campaigns.",
    whereAlternativeWins: [
      "Full-service human teams for bespoke, strategic, or creative project work.",
      "Deep one-off expertise on demand.",
      "Accountable human account managers.",
    ],
    whereAgentplainWins: [
      "Always-on for recurring operational work, not per-project.",
      "A fraction of an agency retainer — flat per-seat.",
      "Works inside your own tools; the work product is yours.",
      "Per-vertical compliance corpus and draft-then-approve are built in.",
      "No scoping cycles — it runs every day in the background.",
    ],
    rows: [
      { dimension: "Engagement", alternative: "Project or retainer", agentplain: "Flat per-seat subscription" },
      { dimension: "Best at", alternative: "Bespoke strategy, creative, one-offs", agentplain: "Recurring operational work at scale" },
      { dimension: "Where the work lives", alternative: "Often the agency's systems", agentplain: "Inside your own tools; you own it" },
      { dimension: "Cost shape", alternative: "Retainer / project fees", agentplain: `Flat per-seat monthly, ${TRIAL_PERIOD_DAYS}-day free trial` },
      { dimension: "Availability", alternative: "Scoped engagements", agentplain: "Runs in the background every day" },
    ],
    chooseAlternativeIf:
      "You need bespoke human strategy, creative, or a one-off project that benefits from a dedicated outside team.",
    chooseAgentplainIf:
      "You need the recurring day-to-day operational load handled affordably and continuously, with the work product owned by you.",
    faq: [
      {
        q: "Is agentplain an agency?",
        a: "No. An agency is a human team you engage per project or on retainer, often working in their own systems. agentplain is a managed AI service partnership: a vertical-aware fleet runs the recurring operational work inside your own tools, customized by a service team, for a flat monthly fee — and you own the work product. For bespoke, one-off engagement work, agentplain also offers Custom engagements on /custom.",
      },
      {
        q: "Why is agentplain cheaper than an agency?",
        a: "An agency prices human hours on a retainer or per project. agentplain runs a managed AI fleet for a flat per-seat fee — $99 to $299 depending on tier — so the recurring operational work costs a fraction of agency hours while running continuously in the background.",
      },
      {
        q: "Does agentplain do bespoke project work like an agency?",
        a: "For work outside the productized tiers — a bespoke compliance corpus, a custom integration, a one-off build — agentplain scopes a Custom engagement on /custom: a written spec, a fixed-price build, then handoff. The subscription covers the always-on recurring work; /custom covers the bespoke project work.",
      },
    ],
  },
};

// ── Named-vendor pages: Georgia real estate (the beachhead) ──────────────────
//
// The "DIY vs run-for-you" pages the founder outreach emails link to.
// Frame ratified 2026-07-03; claims sourced in
// docs/marketing/compare-pages-2026-07-08/RESEARCH-NOTES.md (retrieved
// 2026-07-03, re-verified 2026-07-08 — re-verify quarterly per the
// competitive-positioning doc).
//
// Extra rules on top of the registry rules above:
//   - Follow Up Boss, Sierra Interactive, and BoldTrail are ROADMAP, not
//     wired. Never claim integration; "works alongside" is the truthful verb.
//     The live integration story is email + calendar + QuickBooks, plus
//     DocuSign/Drive on the realty stack.
//   - The one dollar figure outside the seat ladder is the HUD first-offense
//     fair-housing civil penalty ($26,262, 24 CFR 180.671, 2025 inflation
//     adjustment) — a cited regulatory figure, not a price.
//   - Each page names where the vendor wins first. Kept deliberately fair:
//     many of our best customers already run one of these, and should.

const VENDOR_REGISTRY: Record<string, Comparison> = {
  "follow-up-boss": {
    slug: "follow-up-boss",
    alternative: "Follow Up Boss",
    navLabel: "Follow Up Boss",
    cardSummary:
      "The team CRM of record vs. a service that does the drafting work around it. Most brokerages that fit us keep both.",
    metaTitle: "Follow Up Boss vs run for you",
    metaDescription:
      "Follow Up Boss organizes your leads and reminds your agents to follow up. Someone still writes the follow-up. An honest comparison for Georgia brokers: the team CRM of record vs. a run-for-you service that drafts the work for your approval.",
    heroHeadline: "Follow Up Boss vs run for you",
    directAnswer:
      "Follow Up Boss is the CRM of record for real-estate teams: it organizes leads, routes them, and reminds your agents to follow up. It does not write the follow-up. agentplain is a run-for-you service — the fleet reads what's already in your inbox and calendar, drafts the replies, the chases, and the summaries, and a person on your team approves each one before anything goes out. If your leads are a mess, buy the CRM first. If the writing is what eats your evenings, that's the work we run.",
    sharedPain:
      "You run a Georgia brokerage. Portal leads arrive at nine and ten at night, and the first useful reply usually wins the client. Your CRM logs every lead and fires a task at the right agent. The reply itself still has to be written by a person, and so does the commission-invoice chase, the transaction status update, and the month-end report. That writing is the part of the desk no CRM does.",
    whereAlternativeWins: [
      "The pipeline of record. Lead routing, deal stages, and agent accountability in one place — Follow Up Boss does this as well as anything in the category.",
      "Lead-source coverage: portals and lead providers forward into it with an email swap, and its own docs put basic setup at minutes, not weeks.",
      "Automation at volume once built — Automations 2.0 fires templates, tasks, and record updates on triggers your team defines.",
      "Phone-first team workflows, with a dialer add-on and calling reports.",
    ],
    whereAgentplainWins: [
      "The work between the records: reading the thread, drafting the reply in your voice, chasing the missing document.",
      "A service team installs it and runs a monthly review. Nobody at your brokerage becomes the software administrator.",
      "Real-estate drafts are checked against the fair-housing corpus, and a person approves everything before it goes out.",
      "Works across the whole desk — email, calendar, QuickBooks, and the transaction documents — not inside one tool's walls.",
    ],
    cantDo: [
      {
        title: "Write the follow-up.",
        detail:
          "Follow Up Boss fires the task and the template. The 9pm buyer who asked about schools, financing, and a Saturday showing gets a merge-field email until a person writes back. The fleet drafts the specific reply from the actual thread; your agent reads it, edits if needed, and sends.",
      },
      {
        title: "Run itself.",
        detail:
          "Action plans, automations, and routing rules are built and maintained by someone at your brokerage — its own plans reserve richer onboarding for the higher tiers because setup is real work. With run-for-you, setup and the monthly tune-up are our job, not a role you staff.",
      },
      {
        title: "Hold every send for a human.",
        detail:
          "Its automation sends what you pre-wrote. One fair-housing slip in an auto-sent drip is a first-offense civil penalty of up to $26,262 (HUD, 24 CFR 180.671). Our architecture is the reverse: real-estate drafts pass a fair-housing review, and nothing leaves without a person approving it.",
      },
      {
        title: "See past its own walls.",
        detail:
          "The commission invoice lives in QuickBooks. The closing docs live in DocuSign and Drive. The month-end story lives across all of it. A CRM works its own database; the fleet reads across the desk and drafts what sits between the tools.",
      },
    ],
    runForYou: [
      "Run-for-you means the service does the work and you do the deciding. We install the fleet against the tools you already use — email, calendar, QuickBooks, and the document stack — and configure the workflows for how your brokerage actually runs.",
      "Every day the fleet reads what came in, drafts the replies, chases, and summaries a person would otherwise type, and queues each one for approval. Nothing sends on its own. You, or the agent you assign, approve and send from your own systems.",
      "A person on our side runs a monthly review with you: what the fleet drafted, what you edited, what to change. You never file a ticket to get your own software configured.",
    ],
    rows: [
      {
        dimension: "Setup time",
        alternative: "Self-serve in minutes; automations and action plans are yours to build",
        agentplain: "Installed and configured by a service team in days",
      },
      {
        dimension: "Ongoing labor",
        alternative: "An admin or team lead owns automations, templates, and routing",
        agentplain: "You approve drafts; we run the fleet and the monthly review",
      },
      {
        dimension: "Personalization",
        alternative: "Templates and merge fields your team writes ahead of time",
        agentplain: "Per-thread drafts written in your voice from the live context",
      },
      {
        dimension: "Cost predictability",
        alternative: "Per-user pricing, with add-ons like the dialer billed per user on top",
        agentplain: "Flat per-seat monthly, $99–$299 by tier, published in full",
      },
      {
        dimension: "When you need help",
        alternative: "Help center and support, with richer onboarding on higher plans",
        agentplain: "A named service partner and a standing monthly review",
      },
    ],
    chooseAlternativeIf:
      "Your problem is lead organization — routing, accountability, pipeline visibility — and someone on your team will own building and maintaining the automations. Follow Up Boss is a strong CRM of record, and nothing about agentplain asks you to leave it.",
    chooseAgentplainIf:
      "Your leads are already organized and the bottleneck is the writing: first-touch replies, document chases, status updates, the month-end report. We run that work alongside the CRM you keep.",
    faq: [
      {
        q: "Do I have to replace Follow Up Boss to use agentplain?",
        a: "No. Keep it. Follow Up Boss stays your CRM of record; agentplain works alongside it on the email, calendar, QuickBooks, and document work a CRM doesn't do. There is no direct Follow Up Boss integration today — the fleet works from your inbox and calendar, where the real conversations already live.",
      },
      {
        q: "Follow Up Boss has automations. How is run-for-you different?",
        a: "Its automations fire templates and tasks on triggers someone at your brokerage builds and maintains. The fleet writes the message itself — a specific draft for the specific thread — and a person approves it before it goes anywhere. Automation sends what you pre-wrote; run-for-you drafts what you would have written.",
      },
      { q: "Does the fleet send anything on its own?", a: NO_OUTBOUND_ANSWER },
    ],
    bookingCta: true,
  },

  sierra: {
    slug: "sierra",
    alternative: "Sierra Interactive",
    navLabel: "Sierra Interactive",
    cardSummary:
      "The IDX website + CRM front door vs. a service for the desk work every captured lead creates.",
    metaTitle: "Sierra Interactive vs run for you",
    metaDescription:
      "Sierra Interactive captures and nurtures leads with an IDX website and CRM. The desk work each lead creates is still yours. An honest comparison for Georgia brokers: the lead-capture front door vs. a run-for-you drafting service.",
    heroHeadline: "Sierra Interactive vs run for you",
    directAnswer:
      "Sierra Interactive couples an IDX website with a CRM: it captures buyer leads on your site, alerts them to listings, and runs drip campaigns tied to what they browsed. It's a strong front door. agentplain is a run-for-you service for the work behind the door — the fleet reads your inbox and calendar, drafts the replies and follow-ups a person would otherwise type, and queues everything for a person to approve. One captures the lead. The other does the desk work the lead creates.",
    sharedPain:
      "The Georgia broker who buys Sierra usually has the same week: the site captures inquiries all day, the alerts and drips keep leads warm, and every serious buyer still turns into a thread in somebody's inbox — schools, financing, a showing this weekend. The website did its job. The evenings still go to writing.",
    whereAlternativeWins: [
      "The lead-capture front end. Fast IDX sites with saved searches, listing alerts, and behavioral tracking — the websites are the product's spine.",
      "Drip campaigns and e-alerts at volume, tied to what the buyer actually browsed.",
      "Built for teams that want to rank on Google organically, not just run a brochure site.",
      "One vendor for site plus CRM, with lead routing built in.",
    ],
    whereAgentplainWins: [
      "The specific reply. The fleet drafts from the actual thread, in your voice, and your agent approves it.",
      "The off-site desk: commission invoices in QuickBooks, closing docs, the month-end report.",
      "A service partner configures and runs it — no campaign upkeep lands on your team.",
      "Nothing auto-sends. Real-estate drafts pass a fair-housing review, then a person approves.",
    ],
    cantDo: [
      {
        title: "Answer the buyer.",
        detail:
          "Drips and alerts keep a lead warm. They can't answer the question the buyer actually asked — the school district, the seller's timeline, whether Saturday at ten works. The fleet drafts that reply from the thread itself, and your agent approves it before it goes out.",
      },
      {
        title: "Work off the website.",
        detail:
          "Sierra lives on your site and its CRM. The commission invoice lives in QuickBooks, the closing docs in DocuSign and Drive, the month-end story in email. That off-site desk work is exactly what the fleet reads and drafts.",
      },
      {
        title: "Come with a person.",
        detail:
          "Sierra's plans sell onboarding windows measured in days — 30 to 90 by tier, per its published pricing — and campaign upkeep is your team's job after that. Run-for-you includes a service partner who configures the fleet, runs it, and reviews the month with you, every month.",
      },
      {
        title: "Hold every send for a human.",
        detail:
          "Automated campaigns send on triggers. One fair-housing slip in an auto-sent message is a first-offense civil penalty of up to $26,262 (HUD, 24 CFR 180.671). The fleet drafts, the fair-housing corpus reviews, a person approves. That order is the product.",
      },
    ],
    runForYou: [
      "Run-for-you means the service does the work and you do the deciding. We install the fleet against the tools you already use — email, calendar, QuickBooks, and the document stack — and configure the workflows for how your brokerage actually runs.",
      "Every day the fleet reads what came in, drafts the replies, chases, and summaries a person would otherwise type, and queues each one for approval. Nothing sends on its own. You, or the agent you assign, approve and send from your own systems.",
      "A person on our side runs a monthly review with you: what the fleet drafted, what you edited, what to change. You never file a ticket to get your own software configured.",
    ],
    rows: [
      {
        dimension: "Setup time",
        alternative: "Site build plus an onboarding window; campaigns are yours to configure",
        agentplain: "Installed and configured by a service team in days",
      },
      {
        dimension: "Ongoing labor",
        alternative: "Someone maintains the campaigns, alerts, and routing",
        agentplain: "You approve drafts; we run the fleet and the monthly review",
      },
      {
        dimension: "Personalization",
        alternative: "Behavior-triggered templates written ahead of time",
        agentplain: "Per-thread drafts written in your voice from the live context",
      },
      {
        dimension: "Cost predictability",
        alternative: "Platform tiers with setup fees on monthly billing and per-feed add-ons",
        agentplain: "Flat per-seat monthly, $99–$299 by tier, published in full",
      },
      {
        dimension: "When you need help",
        alternative: "An onboarding window and support tiers that vary by plan",
        agentplain: "A named service partner and a standing monthly review",
      },
    ],
    chooseAlternativeIf:
      "You need the front door: an IDX site that captures and nurtures leads, and you have — or are — the person who will run its campaigns. If ranking organically is your growth plan, Sierra's sites are built for it.",
    chooseAgentplainIf:
      "Lead capture isn't your bottleneck; the desk work is. We draft the replies, chases, and reports your captured leads generate, alongside whatever site and CRM you keep.",
    faq: [
      {
        q: "Does agentplain integrate with Sierra Interactive?",
        a: "Not directly today. The fleet works from your email, calendar, QuickBooks, and document tools — which is where Sierra's leads land the moment a real conversation starts. Sierra stays your site and CRM of record; we work beside it, not inside it.",
      },
      {
        q: "Sierra already sends automated follow-ups. Why add agentplain?",
        a: "Sierra's follow-ups are templates fired on behavioral triggers — good for keeping a cold lead warm. The fleet writes the specific reply to the specific thread, in your voice, and a person approves it before it goes out. When a lead gets serious, templates stop being enough. That's the handoff we cover.",
      },
      { q: "Does the fleet send anything on its own?", a: NO_OUTBOUND_ANSWER },
    ],
    bookingCta: true,
  },

  boldtrail: {
    slug: "boldtrail",
    alternative: "BoldTrail",
    navLabel: "BoldTrail",
    cardSummary:
      "The brokerage all-in-one platform vs. a service that takes the platform-running work off your plate.",
    metaTitle: "BoldTrail vs run for you",
    metaDescription:
      "BoldTrail puts website, CRM, and lead nurture under one login — and hands your brokerage a platform to run. An honest comparison for Georgia brokers: the all-in-one vs. a run-for-you service that drafts the work for your approval.",
    heroHeadline: "BoldTrail vs run for you",
    directAnswer:
      "BoldTrail, the platform that grew out of kvCORE, is the big brokerage all-in-one: website, CRM, lead nurture, marketing, and back-office modules under one login. It's built to be the system a brokerage standardizes on. agentplain doesn't compete for that job. We're a run-for-you service: the fleet does the reading and drafting work a platform still leaves to people — first-touch replies, document chases, month-end summaries — and a person approves every draft. Brokerages standardize on a platform. Owners hand the typing to us.",
    sharedPain:
      "The all-in-one pitch is real: one platform, every module, one contract. What arrives with it is a platform to run. Public reviews consistently describe a learning curve measured in weeks, and someone at your Georgia brokerage becomes the person who builds the campaigns, maintains the routing, and trains every new agent. Meanwhile the 9pm lead still gets a template until a person writes back.",
    whereAlternativeWins: [
      "Breadth. Website, CRM, nurture, marketing, and back-office modules in one contract instead of five.",
      "Brokerage-scale standardization — one platform every agent logs into, with brokerage-level reporting and recruiting tools.",
      "Automated lead nurture at volume: behavioral alerts and campaigns across a database of thousands.",
      "If you're consolidating a scattered stack into one system, this is the category to shop.",
    ],
    whereAgentplainWins: [
      "Nothing new to administer. The fleet works your existing email, calendar, QuickBooks, and documents.",
      "Days to running, installed by a service team — no quote cycle, no admin role to staff.",
      "Per-thread drafts in your voice, not campaign templates.",
      "Published flat pricing, $99–$299 per seat.",
    ],
    cantDo: [
      {
        title: "Shrink the job of running it.",
        detail:
          "An all-in-one is also all on you: a quote-based sale, onboarding, a learning curve public reviewers put at weeks, then standing campaign and routing upkeep. Every module you add is more surface someone at the brokerage administers. Run-for-you moves that administration to our side of the table.",
      },
      {
        title: "Write the specific reply.",
        detail:
          "Its nurture campaigns work a database at volume. The serious buyer's question — the one that decides whether you win the client — still waits for a person to write back. The fleet drafts that reply from the thread; your agent approves and sends.",
      },
      {
        title: "Watch the books and the paperwork.",
        detail:
          "Commission invoices age in QuickBooks. Closing documents sit in DocuSign and Drive. The month-end report has to be assembled from all of it. Platform modules track their own records; the fleet reads across the desk and drafts what's between them.",
      },
      {
        title: "Hold every send for a human.",
        detail:
          "Automated nurture sends on triggers. One fair-housing slip across a database that size is a first-offense civil penalty of up to $26,262 (HUD, 24 CFR 180.671) — and the risk scales with the volume. The fleet drafts, the fair-housing corpus reviews, a person approves. Nothing goes out on its own.",
      },
    ],
    runForYou: [
      "Run-for-you means the service does the work and you do the deciding. We install the fleet against the tools you already use — email, calendar, QuickBooks, and the document stack — and configure the workflows for how your brokerage actually runs.",
      "Every day the fleet reads what came in, drafts the replies, chases, and summaries a person would otherwise type, and queues each one for approval. Nothing sends on its own. You, or the agent you assign, approve and send from your own systems.",
      "A person on our side runs a monthly review with you: what the fleet drafted, what you edited, what to change. You never file a ticket to get your own software configured.",
    ],
    rows: [
      {
        dimension: "Setup time",
        alternative: "A quote-based sale, onboarding, and a learning curve reviewers measure in weeks",
        agentplain: "Installed and configured by a service team in days",
      },
      {
        dimension: "Ongoing labor",
        alternative: "An admin owns campaigns, routing, and training every new agent",
        agentplain: "You approve drafts; we run the fleet and the monthly review",
      },
      {
        dimension: "Personalization",
        alternative: "Behavioral campaigns built from templates",
        agentplain: "Per-thread drafts written in your voice from the live context",
      },
      {
        dimension: "Cost predictability",
        alternative: "Quote-based; rates aren't published",
        agentplain: "Flat per-seat monthly, $99–$299 by tier, published in full",
      },
      {
        dimension: "When you need help",
        alternative: "Vendor support channels and training resources",
        agentplain: "A named service partner and a standing monthly review",
      },
    ],
    chooseAlternativeIf:
      "You're consolidating your brokerage's stack and want one platform every agent runs on — and you have the admin capacity to own it. BoldTrail's breadth is the point, and a service like ours doesn't replace it.",
    chooseAgentplainIf:
      "You don't want to run more software. You want the reading, drafting, chasing, and reporting handled, alongside whatever platform your agents already use.",
    faq: [
      {
        q: "Does agentplain integrate with BoldTrail?",
        a: "Not directly today. The fleet works from your email, calendar, QuickBooks, and document tools. BoldTrail stays your platform of record for whatever you run in it; we do the drafting work beside it, and a person on your team approves everything before it moves.",
      },
      {
        q: "BoldTrail already has automation and a big feature list. What's left for agentplain?",
        a: "The part no module does: writing the specific message. Platforms automate templates at volume and track records in their modules. The fleet reads the live thread, drafts the reply or the chase or the summary a person would have typed, and queues it for approval. Feature breadth and run-for-you solve different problems; plenty of brokerages will want both.",
      },
      { q: "Does the fleet send anything on its own?", a: NO_OUTBOUND_ANSWER },
    ],
    bookingCta: true,
  },
};

Object.assign(REGISTRY, VENDOR_REGISTRY);

export const COMPARISON_SLUGS = Object.keys(REGISTRY);

export function getComparison(slug: string): Comparison | null {
  return REGISTRY[slug] ?? null;
}

export function getAllComparisons(): Comparison[] {
  return COMPARISON_SLUGS.map((s) => REGISTRY[s]);
}
