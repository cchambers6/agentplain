type FAQItem = {
  q: string;
  a: string;
};

const items: FAQItem[] = [
  {
    q: "What is agentplain?",
    a: "A platform for AI agent fleets that run the recurring operations work inside small-to-mid businesses — lead response, listings, marketing, transactions, compliance — using agents that work inside the inbox and CRM your team already uses. Realty is the first vertical we are running end-to-end. Per-seat pricing from $79 to $199 a seat depending on team size.",
  },
  {
    q: "How is this different from ChatGPT or generic AI tools?",
    a: "ChatGPT is a tool you have to drive. Each agentplain agent is scoped to one operational job, pre-trained for the vertical it operates in, and connected to the systems where the work actually lives — your CRM, your inbox, your transaction system. They run in the background and surface things you need to decide on.",
  },
  {
    q: "What does my team actually save?",
    a: "Two lines. First, tooling: the typical realtor stack runs $510–$1,560 per realtor per month across CRM add-ons, lead-gen, listing copy retainers, drip, social schedulers, and transaction management. agentplain replaces the work those tools do. Second, time: most realtors get back 10–15 hours a week from admin work the agents handle. Open the calculator on the pricing page to run your own numbers.",
  },
  {
    q: "Are you only for real-estate brokerages?",
    a: "Realty is the first vertical we run end-to-end — the catalog and integrations are tuned to brokerage operations today. Mortgage, insurance, property management, and title/escrow are on the roadmap. We will name a launch date for any of those once there is a real customer in pilot, not before.",
  },
  {
    q: "Do you build custom agents?",
    a: "Yes. Custom agent builds are a scoped engagement on top of seat pricing — priced per build, not gated behind a tier. Same for custom integration adapters when your office runs on an in-house system or a CRM outside our standard adapter set. Most offices never need a custom build; the catalog covers recurring realty work end-to-end.",
  },
  {
    q: "What systems do you integrate with?",
    a: "Whatever your team already runs operations in — CRM, email, calendar, transaction systems, MLS exports, file storage, internal services. Read-only access by default. Write access is opt-in per integration with explicit human review on customer-facing outputs in the first week. The integration patterns are adapter-based; we are not married to a single vendor stack.",
  },
  {
    q: "Do you send email or SMS on my customers' behalf?",
    a: "No. Agents draft into your existing inbox so the email is sent from your domain by your team. They do not stand up a parallel outbound channel. Same for any other customer-facing communication — agents work inside your tools, your domain, and your sender reputation.",
  },
  {
    q: "How does seat pricing work exactly?",
    a: "Per realtor / licensed agent on your team. The price-per-seat steps down at 2, 10, 25, and 50 seats. Annual saves two months. No platform fee on top. Brokers, admins, and assistants are not separate seats — they are part of the office workflow that the realtor seats already cover. 100+ seats is custom-priced enterprise.",
  },
  {
    q: "Can we start small and add seats?",
    a: "Yes. Most brokerages start with their highest-producing realtors, prove the math on real deals, and roll out the rest of the office. The seat-tier price-per-seat updates automatically when you cross a band.",
  },
  {
    q: "What happens if a realtor leaves?",
    a: "Drop the seat at the end of the billing period — no proration headaches in either direction. On annual, unused seats roll into a credit for the next renewal.",
  },
  {
    q: "Is my data safe?",
    a: "Customer data stays in your stack. Workspaces are isolated by row-level security in our database. Integration credentials are encrypted at rest. Agents pull what they need to do a task, return a result, and do not retain client lists or transaction records as training data. Liability for licensed activities — anything that requires a real estate or other professional license — stays with you. We do not act as a brokerage.",
  },
  {
    q: "What's the catch?",
    a: "Two things, honestly. First, this is the early stage of a new product — the agents are real and they work, but they will surface edge cases we have not seen. We pay attention and ship fixes fast. Second, businesses with deeply non-standard workflows take longer to onboard. If you run an unusual stack, we will tell you up front whether the math works and how long the integration will take.",
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
