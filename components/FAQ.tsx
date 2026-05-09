type FAQItem = {
  q: string;
  a: string;
};

const items: FAQItem[] = [
  {
    q: "What is agentplain?",
    a: "A platform for AI agent fleets that run operations work inside small-to-mid businesses. Two surfaces — a high-touch program for brokerages and operators where we scope, build, and run the fleet for you, and a self-serve app for individual practitioners. Both surfaces use the same underlying agent catalog. Realty is the first vertical we are shipping end-to-end.",
  },
  {
    q: "Is this just ChatGPT with extra steps?",
    a: "No. ChatGPT is a tool you have to drive. Each agentplain agent is scoped to one job, pre-trained for the vertical it operates in, and connected to the systems where the work actually lives — your CRM, your inbox, your transaction system. They run in the background and surface things you need to decide on.",
  },
  {
    q: "Are you only for real-estate brokerages?",
    a: "Realty is the first vertical we run end-to-end — that is where pilots are running today. The platform is vertical-agnostic; the same operating model extends to other small-to-mid B2B operations with recurring admin. We name new verticals when there is a real customer in pilot, not before.",
  },
  {
    q: "How big is the agent catalog?",
    a: "Larger than any single customer needs. Each vertical has its own catalog, and we add catalog agents as we run them on real work. A typical brokerage engagement deploys a curated subset of catalog agents tuned to that office, plus any custom agents we build during the pilot.",
  },
  {
    q: "Do you build custom agents?",
    a: "Yes. Custom agents are part of the brokerage tier. If your operation has a job the catalog does not cover, we scope and build the agent for it. It becomes part of your workspace, is versioned, and inherits the same review, audit, and rollback rails as catalog agents.",
  },
  {
    q: "What systems do you integrate with?",
    a: "We integrate with whatever your team already runs operations in — CRM, email, transaction systems, file storage, internal services. Read-only access by default. Write access is opt-in per integration with explicit human review on customer-facing outputs in week one. The integration patterns are adapter-based; we are not married to a single vendor stack.",
  },
  {
    q: "Do you send email or SMS on my customers' behalf?",
    a: "No. Agents draft into your existing inbox so the email is sent from your domain by your team. They do not stand up a parallel outbound channel. Same for any other customer-facing communication — agents work inside your tools, your domain, and your sender reputation.",
  },
  {
    q: "How is this different from existing software?",
    a: "Most software adds another dashboard for someone to maintain. agentplain takes work off your plate. We do not replace your CRM, your MLS, or your team — we sit on top of them and reduce the number of tabs your office has to keep open.",
  },
  {
    q: "What data do you need access to?",
    a: "Whatever the agents you select need to do their job, scoped to the smallest workable surface. For most pilots that starts with read-only CRM access, an inbox the agents can draft into, and exports of the workflows we are improving. Nothing changes in your systems unless you approve the change.",
  },
  {
    q: "What happens after the 30-day brokerage pilot?",
    a: "You decide whether to continue. The pilot is opt-in to a continuing engagement at the end — no auto-renew. If you keep going, the monthly rate is set per brokerage, scoped to which agents you want active, and can be paused.",
  },
  {
    q: "Is my data safe?",
    a: "Customer data stays in your stack. Workspaces are isolated by row-level security in the database. Agents pull what they need to do a task, return a result, and do not retain client lists or transaction records as training data. Liability for licensed activities — anything that requires a real estate or other professional license — stays with you. We do not act as a brokerage.",
  },
  {
    q: "What's the catch?",
    a: "Two things, honestly. First, this is the early stage of a new product — the agents are real and they work, but they will surface edge cases we have not seen. We pay attention and ship fixes fast. Second, businesses with deeply non-standard workflows take longer to onboard. If you run an unusual stack, we will tell you up front whether the engagement makes sense.",
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
