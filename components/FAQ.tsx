type FAQItem = {
  q: string;
  a: string;
};

const items: FAQItem[] = [
  {
    q: "What is agentplain?",
    a: "A pre-trained fleet of AI agents for professional-services firms — realty first, with mortgage, insurance, property management, title & escrow, recruiting, home services, CPA / tax, law, and RIA on the roadmap. Seven realty agents are scoped for listing intake, buyer routing, showings coordination, compliance review, CRM hygiene, production reporting, and recruiter prep. The fleet is in design partner build today.",
  },
  {
    q: "Is this just ChatGPT with extra steps?",
    a: "No. ChatGPT is a tool you have to drive. Each agentplain agent is scoped to one job and pre-trained on the realty workflow your team already follows. They are designed to run in the background and surface the things you need to decide on, not to wait for prompts.",
  },
  {
    q: "How is this different from existing brokerage software?",
    a: "Most brokerage software adds another dashboard for someone to maintain. agentplain is built to integrate with your CRM, MLS, inbox, and transaction system — then to replace the manual work that lives between them: drafting every email, writing every listing, building every marketing asset, chasing every deadline. You keep your tools.",
  },
  {
    q: "What data do you need access to?",
    a: "Today, an export of your recent listings, contacts, and inbox folders — uploaded by your team. Coming Q3 2026: OAuth into your CRM and Gmail / Outlook for read-only access. We never need MLS write access, and we don't retain contact data after a workspace closes.",
  },
  {
    q: "How does pricing work?",
    a: "Three tiers, per-seat, month-to-month. The first month is free. Month 2 onward you pay your tier's per-seat rate — Regular $199 → $99, Plus $299 → $199, Max $499 → $299, sliding as seat count grows. Cancel any time from your billing settings.",
  },
  {
    q: "Is my data safe?",
    a: "Brokerage data stays in your stack. agentplain pulls what it needs to do a task, returns a result, and does not retain client lists or transaction records as training data. Liability for licensed activities — anything that requires a real estate license — stays with your brokerage and your broker of record. We do not act as a brokerage.",
  },
  {
    q: "Do my agents need to learn anything new?",
    a: "No. The fleet talks to you and your broker, not to the agents in your office. Your agents keep using whatever they already use. Most of what changes is invisible to them — fewer dropped leads, faster listing turnaround, cleaner CRM.",
  },
  {
    q: "What's the catch?",
    a: "Two things, honestly. First, this is V0 — the realty fleet is in design partner build today; first runs with customer data are Q3 2026. Second, brokerages with deeply non-standard workflows take longer to onboard. We'll tell you up-front whether a workspace makes sense.",
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
