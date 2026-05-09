import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import PricingTier from "@/components/PricingTier";

export const metadata: Metadata = {
  title: "For brokerages — agentplain",
  description:
    "High-touch agent platform for small-to-mid brokerages. 30-day paid pilot, custom-tuned fleet, written outcome report at day 30. Three tiers — $1,500 / $2,750 / $4,500.",
};

const pricing = [
  {
    name: "Starter",
    price: "$1,500",
    cadence: "30-day pilot",
    positioning: "For an owner-operator brokerage testing the thesis.",
    includes: [
      "A focused subset of catalog agents tuned to your workflow",
      "Connected to one CRM and one shared inbox",
      "Weekly check-in with the agentplain team",
      "Light-touch implementation (3–5 hours of your time)",
      "Outcome report at day 30",
    ],
    excludes: [
      "Custom agent development",
      "Multi-system integrations beyond CRM and inbox",
    ],
  },
  {
    name: "Standard",
    price: "$2,750",
    cadence: "30-day pilot",
    positioning: "For most brokerages we work with. Best fit for 5–15 producing agents.",
    includes: [
      "Curated catalog agents tuned to your office",
      "Connected to your CRM, inbox, and one MLS or transaction system",
      "Bi-weekly working sessions",
      "Production reporting tuned to your KPIs",
      "Compliance review of recent listings",
      "Outcome report and continuation proposal at day 30",
    ],
    excludes: ["Custom agent development", "On-site implementation"],
    featured: true,
  },
  {
    name: "Full Engagement",
    price: "$4,500",
    cadence: "30-day pilot",
    positioning: "For brokerages serious about pulling owner time out of operations.",
    includes: [
      "Full catalog activation tuned to your office",
      "One custom-built agent for a job the catalog does not cover",
      "CRM, inbox, MLS, accounting export, and one custom system",
      "Weekly sessions with a senior implementer",
      "Custom production-reporting templates for your office",
      "Recruiting warm-start with your local agent list",
      "Continuation proposal with named monthly rate",
    ],
    excludes: [
      "More than one custom agent during the pilot (additional builds priced at continuation)",
    ],
  },
];

const timeline = [
  {
    week: "Week 0",
    title: "Kickoff and access",
    body: "60-minute scoping call. We confirm which catalog agents you want active, scope any custom agents to build, and identify which systems they connect to. Read-only credentials shared. No production changes yet.",
  },
  {
    week: "Week 1",
    title: "Quiet observation",
    body: "Agents run in shadow mode. They draft outputs but do not act. You and your broker review the drafts at the end of the week. We tune for your house style. Custom agents (if scoped) start their first build pass.",
  },
  {
    week: "Week 2–3",
    title: "Live operation",
    body: "Approved agents go live. They write back to your CRM, draft in your inbox, and surface decisions to the right person. Bi-weekly working session keeps the loop tight. Custom agents reach pilot-ready and join the fleet.",
  },
  {
    week: "Week 4",
    title: "Outcome report",
    body: "Written report. Tasks handled, leads routed, compliance items flagged, hours returned. Continuation proposal with a named monthly rate. You decide.",
  },
];

export default function BrokeragesPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">For brokerages and operators</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            A 30-day pilot.
            <br />
            <span className="text-signal">Opt-in at the end.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            The brokerage tier is a paid scoped engagement. We deploy a
            curated set of catalog agents into your workspace, build any
            custom agents the engagement needs, integrate with the systems
            your office runs on, and run the fleet on your real workflows
            for 30 days. You get a written outcome report at the end and a
            continuation proposal with a named monthly rate. Continuation is
            opt-in. No auto-renew.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20brokerage%20pilot"
              className="btn-primary"
            >
              Start a pilot
              <span aria-hidden>→</span>
            </a>
            <Link href="/platform" className="btn-secondary">
              How the platform works
              <span aria-hidden>→</span>
            </Link>
          </div>

          <p className="mt-12 max-w-3xl border-t border-rule pt-6 font-display text-3xl leading-snug text-ink md:text-4xl">
            Run a 25-agent brokerage with five.
          </p>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            That is the operating bar. The fleet handles enough of the
            recurring admin that the office stops building headcount around
            operations and starts building it around production.
          </p>
        </div>
      </section>

      {/* PRICING */}
      <Section
        id="pricing"
        eyebrow="Three tiers"
        title="Pick the smallest tier that covers what you want to test."
        intro="Most brokerages start at Standard. The Full Engagement is for owners who already know exactly which operational hours they want returned, and who want a custom agent shipped during the pilot."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {pricing.map((tier) => (
            <PricingTier key={tier.name} {...tier} />
          ))}
        </div>

        <div className="mt-10 max-w-3xl border-t border-rule pt-8">
          <p className="eyebrow mb-3">What's the same across all three tiers</p>
          <ul className="grid gap-2 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
            <li>— Read-only access to your systems by default</li>
            <li>— Human review on every customer-facing output in week one</li>
            <li>— Liability for licensed activities stays with your broker</li>
            <li>— Written outcome report at day 30</li>
            <li>— Workspace data isolated by row-level security</li>
            <li>— No data resold, no client list retained for training</li>
            <li>— You own the work product</li>
          </ul>
        </div>
      </Section>

      {/* TIMELINE */}
      <Section
        tone="deep"
        eyebrow="What 30 days looks like"
        title="A working engagement, not a demo."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {timeline.map((step) => (
            <article
              key={step.week}
              className="border border-rule bg-paper p-7"
            >
              <p className="eyebrow mb-3 text-signal">{step.week}</p>
              <h3 className="font-display text-2xl leading-tight text-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* WHAT WE WANT FROM YOU */}
      <Section
        eyebrow="What we ask of you"
        title="Honest about the lift on your side."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl text-ink">From the owner</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— A 60-minute scoping call to start</li>
              <li>— 30 minutes weekly for the working session</li>
              <li>— Approval gate on customer-facing drafts in week one</li>
              <li>— Honest feedback when an agent gets something wrong</li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl text-ink">From your stack</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Read access to the CRM the agents will operate in</li>
              <li>— A shared inbox the fleet can draft into</li>
              <li>— An MLS or transaction-system export, if relevant</li>
              <li>— A point of contact for IT questions</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Ready to start, or still deciding?
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            Either is fine. Email goes to a real person. Calls are 30 minutes,
            not 60, and we will tell you if you are not a fit.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20brokerage%20pilot"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start a pilot
            </a>
            <a
              href="mailto:hello@agentplain.com?subject=Book%20a%20call"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Book a 30-minute call
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
