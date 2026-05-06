type FAQItem = {
  q: string;
  a: string;
};

const items: FAQItem[] = [
  {
    q: "What is agentplain?",
    a: "A pre-trained fleet of AI agents built for small-to-mid brokerages. Seven agents handle the recurring operational work — listing intake, buyer routing, showings, compliance review, CRM hygiene, production reporting, recruiter prep — so brokerage owners stop spending nights on admin and start spending them on production and recruiting.",
  },
  {
    q: "Is this just ChatGPT with extra steps?",
    a: "No. ChatGPT is a tool you have to drive. Each agentplain agent is scoped to one job, pre-loaded with brokerage-specific context, and connected to the systems where the work actually lives — your CRM, MLS exports, email inbox. They run in the background and surface things you need to decide on.",
  },
  {
    q: "How is this different from existing brokerage software?",
    a: "Most brokerage software adds another dashboard for someone to maintain. agentplain takes work off your plate. We don't replace your CRM or MLS — we sit on top of them and reduce the number of tabs your team has to keep open.",
  },
  {
    q: "What data do you need access to?",
    a: "For the pilot: read-only access to your CRM, your shared inbox, and an export of recent listings. Nothing changes in your systems unless you approve the change. We do not need MLS write access, and we do not store contact data outside your stack longer than the pilot requires.",
  },
  {
    q: "What happens after the 30-day pilot?",
    a: "You decide whether to continue. The pilot is opt-in to a continuing engagement at the end — there is no auto-renew. If you keep going, the monthly rate is set per brokerage, scoped to which agents you want active, and can be paused.",
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
    a: "Two things, honestly. First, this is V0 — the agents are real and they work, but they are early and they will surface edge cases we have not seen. We pay attention and we ship fixes fast. Second, brokerages with deeply non-standard workflows take longer to onboard. If you run an unusual stack, we will tell you up-front whether the pilot makes sense.",
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
              className="font-mono text-xl text-slate-soft transition group-open:rotate-45"
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
