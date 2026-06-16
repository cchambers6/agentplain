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
      { dimension: "Cost shape", alternative: "Variable model-API usage", agentplain: "Flat per-seat monthly, first month free" },
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
        a: "Building it yourself costs engineering time plus variable model-API usage. agentplain is a flat per-seat subscription — $99 to $299 depending on tier — with the first month free, month-to-month. You trade variable build-and-maintain cost for a predictable, run-for-you fee.",
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
        a: "An assistant is a salary plus benefits and overhead. agentplain is a flat per-seat subscription — $99 to $299 depending on tier — month-to-month with the first month free.",
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
      { dimension: "Cost shape", alternative: "Retainer / project fees", agentplain: "Flat per-seat monthly, first month free" },
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

export const COMPARISON_SLUGS = Object.keys(REGISTRY);

export function getComparison(slug: string): Comparison | null {
  return REGISTRY[slug] ?? null;
}

export function getAllComparisons(): Comparison[] {
  return COMPARISON_SLUGS.map((s) => REGISTRY[s]);
}
