type FAQItem = {
  q: string;
  a: string;
};

// FAQ content. Every entry cross-references mission rule
// (`project_agentplain_mission_and_positioning.md`):
//   - No "agent counts" — "the fleet" is the unit
//   - No real-estate-only framing
//   - No pilot pricing references
//   - No "coming soon" without date/qualification
//   - Drafts / proposes / advises — never "sends" / "executes"

const items: FAQItem[] = [
  {
    q: "What is agentplain?",
    a: "A fleet of capable AI partners that runs inside your local business. The fleet reads from your existing tools — email, calendar, CRM, transaction systems, accounting — categorizes what matters, drafts what you'd otherwise type, schedules what needs scheduling, and coordinates across threads. The fleet drafts; you decide. Built for ten verticals: real estate, mortgage, insurance, property management, title & escrow, recruiting, home services contractors, CPA / tax firms, law firms, and RIA / wealth practices.",
  },
  {
    q: "Is this just ChatGPT with extra steps?",
    a: "No. ChatGPT is a horizontal tool you have to drive. The fleet is vertical-aware: it knows MLS workflows or tax-prep deadlines or IRS filing windows or fair-housing language — whatever your vertical needs. It runs in the background and surfaces drafts for your review; you don't prompt it to do its job.",
  },
  {
    q: "How is this different from existing vertical software?",
    a: "Most vertical software adds another dashboard for someone to maintain. agentplain integrates with the CRM, inbox, transaction system, and accounting tool you already use — and replaces the manual work that lives between them. Drafting every email. Writing every listing or proposal. Building every status report. Chasing every deadline. You keep your tools.",
  },
  {
    q: "Can my firm actually use it today?",
    a: "Yes — sign up free, pick your vertical, connect your first tool, and the fleet starts drafting within minutes. Real estate ships with the deepest integration set today; the other nine verticals carry ratified JTBD tables and a committed integration roadmap. Each vertical page shows what's locked and what's in flight.",
  },
  {
    q: "Does the fleet send anything on its own?",
    a: "No. The fleet drafts, proposes, and advises — your existing systems send. The Compliance Sentinel pre-checks every customer-facing draft. The recruiting agent drafts the opener. The mortgage agent drafts the relock comparison. Every draft queues for the human's review before it leaves your firm. We never auto-send, never move money, never make commitments.",
  },
  {
    q: "What data do you need access to?",
    a: "Read-only OAuth into your inbox, calendar, CRM, transaction system, and (for some verticals) accounting. Vertical-specific feeds where they exist — MLS for real estate, AMS for insurance, LOS for mortgage. The fleet reads what's needed for the task, drafts the response, and returns the draft to your review queue. We don't retain client lists as training data.",
  },
  {
    q: "How does pricing work?",
    a: "One plan, per-seat, month-to-month. $199 solo, sliding to $179 (2–9 seats), $149 (10–24), $119 (25–49), $99 (50–99). First month free. Month 2 onward you pay your seat band's rate. Cancel anytime from your billing settings. No annual contract, no pilot fees, no setup charges. Anything beyond plug-and-play — bespoke compliance, white-label, dedicated success, 100+ seats — is a Custom engagement scoped per customer on /custom.",
  },
  {
    q: "What's the ROI math?",
    a: "Value delivered per practitioner runs $2,900–$10,600/mo — hours saved × your productive-hour rate, plus mistakes avoided, plus deals closed faster. Against the $199 → $99 per-seat subscription cost, the typical ROI multiple is 15x to 110x. Run your own numbers in the calculator on the pricing page.",
  },
  {
    q: "Why should anyone believe you?",
    a: "Four things. (1) We run the same fleet model on ourselves to build the product — the brokerage in production today running ~35 cron-fired agents is a working precursor of what we sell. (2) Outside counsel is reviewing the per-vertical compliance corpus. (3) Every claim on this site cites a memory rule we can show you. (4) Every agent action is visible in the workspace — nothing happens behind the curtain.",
  },
  {
    q: "Is my data safe?",
    a: "Your data stays in your stack. The fleet pulls what it needs to do a task, returns a result, doesn't retain client lists or transaction records as training data. Liability for licensed activities — anything that requires a state license — stays with you and your firm. We don't act as a brokerage, lender, insurance carrier, law firm, RIA, or any other licensed party.",
  },
];

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
