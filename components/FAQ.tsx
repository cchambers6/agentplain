export type FAQItem = {
  q: string;
  a: string;
};

// FAQ content. Every entry cross-references mission rule
// (`project_agentplain_mission_and_positioning.md`) plus the
// service-partnership lock (ratified 2026-05-15 — three productized tiers
// under a managed-service model; supersedes the 2026-05-12 self-serve
// single-tier framing on customer surfaces):
//   - No "agent counts" — "the fleet" is the unit
//   - No real-estate-only framing
//   - No "self-serve" / "DIY" framing — agentplain is a service partnership
//   - No "configure your agents" with customer-as-operator
//   - Pricing answered as the three-tier service partnership
//   - Drafts / proposes / advises — never "sends" / "executes"
//   - Customer is the SERVED party, never the AI operator —
//     no "configure your agents," "set up your fleet," "self-serve,"
//     "DIY agents." The service partner installs, runs, and customizes.
//
// Items are exported so `lib/seo/structured-data.ts` can derive the
// FAQPage JSON-LD payload from the same source of truth — no copy-paste,
// no drift between the rendered page and the structured data.

export const FAQ_ITEMS: FAQItem[] = [
  {
    q: "What is agentplain?",
    a: "A service partnership for local businesses. Your service team installs a fleet of capable AI partners inside your shop, configures it for your vertical, runs weekly reviews, and customizes the agents as your ops shift. The fleet reads from your existing tools — email, calendar, CRM, transaction systems, accounting — categorizes what matters, drafts what you'd otherwise type, schedules what needs scheduling, and coordinates across threads. The fleet drafts; you decide. We run the operation; you run the business. Built for ten verticals: real estate, mortgage, insurance, property management, title & escrow, recruiting, home services contractors, CPA / tax firms, law firms, and RIA / wealth practices.",
  },
  {
    q: "What does the service partner actually do?",
    a: "Five things. (1) Install — the partner sets up the fleet, connects your tools, loads your vertical's JTBD table and compliance corpus, and runs the first week alongside you. (2) Review — a recurring call (monthly for Regular, weekly for Partner) covering what the fleet drafted, what got approved, what needs tuning. (3) Customize — when your ops shift (new compliance rule, new transaction system, new comp model), the partner updates the agents so you don't have to. (4) Escalate — if a draft hits a hard call, the partner brings it to you with the context. (5) Translate — when something looks off, the partner is your single human contact, not a ticket queue.",
  },
  {
    q: "Is this just ChatGPT with extra steps?",
    a: "No, and not even close. ChatGPT is a horizontal tool you have to drive yourself. agentplain is a service partnership: vertical-aware fleet (MLS workflows, tax-prep deadlines, IRS filing windows, fair-housing language — whatever your vertical needs) plus a service team that installs and runs it. The fleet works in the background and surfaces drafts for your review; you don't prompt it to do its job. And you don't operate it — we do.",
  },
  {
    q: "How is this different from Claude for Small Business or other AI-for-SMB tools?",
    a: "We're not a competitor to Claude — we're the service layer that makes it usable. Claude for Small Business is a genuinely capable tool, but it hands an owner a horizontal model and expects them to figure out which skills to write, which agents to build, what to put in memory, and how to wire their tools. agentplain brings all of that pre-built: the per-vertical skills and agents you'd otherwise build yourself, the memory we curate and maintain so it stays useful, the integrations connected for you, and a service team that installs, runs reviews, and customizes for your shop — all for a low flat fee. Built on Claude, configured by us. You're not buying a tool; you're getting it run for you.",
  },
  {
    q: "What if I just want the tool, not the service?",
    a: "agentplain isn't sold without the service. The product is the partnership — install, run, customize — not a self-serve platform you wire together yourself. If you want to assemble your own agents from scratch, the foundation-model APIs are open and you can build on them; that's a different product than what we sell. The reason we run it for you is that the vertical-specific corpus, the integration plumbing, and the compliance posture are where local businesses bleed the most time — and those are exactly the layers a generic tool won't solve for you.",
  },
  {
    q: "How is this different from existing vertical software?",
    a: "Most vertical software adds another dashboard for someone to maintain. agentplain integrates with the CRM, inbox, transaction system, and accounting tool you already use — and replaces the manual work that lives between them. Your service partner does the integration work, not you. Drafting every email. Writing every listing or proposal. Building every status report. Chasing every deadline. You keep your tools.",
  },
  {
    q: "Can my firm actually use it today?",
    a: "Yes. You sign up free, your service partner handles the install (connecting your available tools on the /integrations page — email, calendar, document, accounting, e-signature today — loading your vertical's corpus, walking through the workspace), and the fleet starts drafting within the first few days. Every vertical carries ratified JTBD tables and a committed per-vertical integration roadmap; each vertical page shows what's connectable today and what's on the roadmap.",
  },
  {
    q: "Does the fleet send anything on its own?",
    a: "No. The fleet drafts, proposes, and advises — your existing systems send. The Compliance Sentinel pre-checks every customer-facing draft. The recruiting agent drafts the opener. The mortgage agent drafts the relock comparison. Every draft queues for the human's review before it leaves your firm. We never auto-send, never move money, never make commitments.",
  },
  {
    q: "What data do you need access to?",
    a: "OAuth into your email (Gmail, Outlook), file substrate (Google Drive, OneDrive), spreadsheets (Excel), e-signature (DocuSign), messaging (Slack, Teams), and accounting (QuickBooks Online) — those connect tiles live on the /integrations page today. The vertical-specific feeds — MLS for real estate, AMS for insurance, LOS for mortgage, practice-management for CPA / law / RIA — sit on the per-vertical integration roadmap; your service partner sets up what's available with you on a call and runs the unbuilt ones by hand until those adapters land. The fleet reads what's needed for the task, drafts the response, and returns the draft to your review queue. We don't use your client list to train foundation models.",
  },
  {
    q: "How does pricing work?",
    a: "Three tiers of service partnership, all per seat, month-to-month, first month free. (1) Regular — standard partnership, monthly review cadence, $199 solo sliding to $99 at 50+ seats. (2) Partner — named service partner with weekly review cadence and deeper customization, $299 solo sliding to $199 at scale. (3) Max — ad-hoc service partnership for firms with non-standard scope; quoted to the engagement, sales-led. No pilot fees. No setup charges. Cancel anytime from your billing settings.",
  },
  {
    q: "What's the difference between Regular, Partner, and Max?",
    a: "Cadence and dedication. Regular is the standard service partnership: a partner installs, runs a monthly review call, handles tuning between calls. Most local-business shops fit Regular. Partner adds a named service partner who's dedicated to your account, runs a weekly review, owns customization, and handles change management as your ops shift — typically firms with more complex ops or higher stakes per draft. Max is sales-led: ad-hoc service partnership for firms whose ops don't fit the productized shape — different cadence, different deliverables, quoted to scope.",
  },
  {
    q: "When would I want Partner instead of Regular?",
    a: "Three common patterns. (1) Your week-over-week change is high — new listings, new clients, new compliance rules — and you want a weekly review instead of a monthly one. (2) Your stakes per draft are higher than the average shop (litigation work, wealth management, broker-of-record-sensitive comms) and you want a partner who's dedicated to your account and knows your conventions. (3) You're growing or restructuring and want change management built into the relationship, not retrofitted later. If none of those apply, Regular usually fits.",
  },
  {
    q: "What is /custom and how is it different from Max?",
    a: "Max is a service-partnership tier — recurring per-seat relationship with non-standard scope. /custom is engagement work: a written spec, a 4–6 week build, a fixed price ($5K–$15K typical plus $200–$500/mo maintenance), then handoff. You'd reach /custom when you need something the productized tiers don't include: a bespoke compliance corpus, a white-label deployment, a custom integration to a tool that isn't on our roadmap, 100+ seats, custom reporting. You can be on Regular OR Partner AND have a /custom engagement in flight at the same time.",
  },
  {
    q: "What's the ROI math?",
    a: "Value delivered per practitioner runs $2,900–$10,600/mo — hours saved × your productive-hour rate, plus mistakes avoided, plus deals closed faster. Against the $99 → $299 per-seat subscription cost depending on tier, the typical ROI multiple is 15x to 110x. Run your own numbers in the calculator on the pricing page.",
  },
  {
    q: "Why should anyone believe you?",
    a: "Four things. (1) We run the service partnership on flatsbo — our own brokerage — before we sell it. The ~35 cron-fired agents in production there are the working precursor of what we sell, operating on a real local business. (2) Outside counsel is reviewing the per-vertical compliance corpus. (3) Every claim on this site cites a memory rule we can show you. (4) Every agent action is visible in your workspace — nothing your service partner does is behind a curtain.",
  },
  {
    q: "Is my data safe?",
    a: "The fleet reads through read-only OAuth and pulls only what a task needs. To do the work, your content is processed by the AI providers that power the fleet (OpenAI for retrieval embeddings, Anthropic for drafting) and stored in our database under per-workspace isolation. The full data-handling specifics — including the current subprocessor list — live in our privacy policy. Liability for licensed activities — anything that requires a state license — stays with you and your firm. We don't act as a brokerage, lender, insurance carrier, law firm, RIA, or any other licensed party. Your service partner runs the AI ops; you run the licensed business.",
  },
  {
    q: "Is my data resold or used to train someone else's model?",
    a: "We don't resell your data, and we don't train foundation models — agentplain has no training infrastructure. Your inbox, client list, transaction records, and drafts are not used to build agentplain or anyone else's product on our side. What the AI providers themselves do with API content is governed by their terms — our privacy policy names the subprocessors and links to their data-usage policies.",
  },
  {
    q: "Who owns the drafts and the work product?",
    a: "You do. Every draft the fleet produces belongs to your firm — your IP, your record, your liability. We don't claim a license to the work, we don't republish it, we don't analyze it across customers. The fleet drafts on your behalf the way a contractor drafts on your behalf: the output is yours from the moment it lands in your queue.",
  },
  {
    q: "What happens if I cancel?",
    a: "Cancel from billing settings anytime — month-to-month from day one. Your seats stop billing at the end of the current month. The fleet stops drafting at that boundary; nothing keeps writing into your tools after you've ended the relationship. Self-serve workspace export is on the roadmap and not shipped yet — if you need your handoff log, approval history, or draft archive before cancellation, ask your service partner. What happens to your data after a workspace closes lives in our privacy policy; we don't use your client list to train models and we don't keep it to relaunch.",
  },
  {
    q: "What about HIPAA or other regulated-data postures?",
    a: "Honest answer: agentplain is not currently sold as a HIPAA-eligible service, and the locked ten verticals don't include healthcare (medical is parked per our roadmap). For verticals we DO serve, the regulatory posture is consistent: human review on every customer-facing output, liability for licensed activities stays with you, the per-vertical compliance corpus is counsel-reviewed (TCPA, RESPA, fair-housing for realty; analog corpuses for the other nine). If you have a regulated-data scope outside the ratified ten, route to /custom — we'll scope it as a written engagement or decline honestly, not pretend it's a productized fit.",
  },
];

// Back-compat alias for any historical imports.
const items = FAQ_ITEMS;

export default function FAQ() {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-8">
      {items.map((item) => (
        <details
          key={item.q}
          className="group border-b border-rule py-5"
        >
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6">
            <span className="font-display text-xl leading-snug text-ink md:text-2xl">
              {item.q}
            </span>
            <span
              aria-hidden
              className="font-mono text-xl text-mute transition group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}
