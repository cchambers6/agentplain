import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import PricingTier from "@/components/PricingTier";

export const metadata: Metadata = {
  title: "Pilot — agentplain",
  description:
    "A 30-day paid pilot of the agentplain agent fleet. Three tiers, opt-in continuation, written outcome report at day 30.",
};

const pricing = [
  {
    name: "Starter",
    price: "$1,500",
    cadence: "30-day pilot",
    positioning: "For a single owner-operator brokerage testing the thesis.",
    includes: [
      "3 agents of your choice from the fleet",
      "Connected to one CRM and one shared inbox",
      "Weekly check-in with the agentplain team",
      "Light-touch implementation (3–5 hours of your time)",
      "Outcome report at day 30",
    ],
    excludes: [
      "Full 7-agent activation",
      "Custom workflows",
      "MLS write integrations",
    ],
  },
  {
    name: "Standard",
    price: "$2,750",
    cadence: "30-day pilot",
    positioning: "For most brokerages we work with. Best fit for 5–15 agents.",
    includes: [
      "5 agents of your choice from the fleet",
      "Connected to your CRM, inbox, and one MLS export",
      "Bi-weekly working sessions",
      "Production reporting tuned to your KPIs",
      "Compliance review of recent listings",
      "Outcome report and continuation proposal at day 30",
    ],
    excludes: ["Custom agent development", "On-site implementation"],
    featured: true,
  },
  {
    name: "Full Fleet",
    price: "$4,500",
    cadence: "30-day pilot",
    positioning: "For brokerages serious about pulling owner time out of operations.",
    includes: [
      "All 7 agents activated",
      "CRM, inbox, MLS, accounting export, and one custom system",
      "Weekly sessions with a senior implementer",
      "Custom production-reporting templates for your office",
      "Recruiter Assistant warm-start with your local agent list",
      "Continuation proposal with named monthly rate",
    ],
    excludes: ["Custom agent development beyond the seven shipped"],
  },
];

const timeline = [
  {
    week: "Week 0",
    title: "Kickoff and access",
    body: "60-minute scoping call. We confirm which agents you want active, which systems they connect to, and who on your team gets the daily summary. Read-only credentials shared. No production changes yet.",
  },
  {
    week: "Week 1",
    title: "Quiet observation",
    body: "Agents run in shadow mode. They draft outputs but do not act. You and your broker review the drafts at the end of the week. We tune for your house style.",
  },
  {
    week: "Week 2–3",
    title: "Live operation",
    body: "Approved agents go live. They write back to your CRM, draft in your inbox, and surface decisions to the right person. Bi-weekly working session keeps the loop tight.",
  },
  {
    week: "Week 4",
    title: "Outcome report",
    body: "Written report. Tasks handled, leads routed, compliance items flagged, hours returned. Continuation proposal with a named monthly rate. You decide.",
  },
];

export default function PilotPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Pilot programs</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            A 30-day pilot.
            <br />
            <span className="text-signal">Opt-in at the end.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            The pilot is a paid, scoped working engagement. You get the agent
            fleet running on your real workflows for thirty days, a written
            outcome report at the end, and a continuation proposal with a named
            monthly rate. Continuation is opt-in. There is no auto-renew.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20pilot%20interest"
              className="btn-primary"
            >
              Start a pilot
              <span aria-hidden>→</span>
            </a>
            <Link href="/#fleet" className="btn-secondary">
              See the fleet
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <Section
        id="start"
        eyebrow="Three tiers"
        title="Pick the smallest tier that covers what you want to test."
        intro="Most brokerages start at Standard. The full fleet is for owners who already know exactly which operational hours they want returned, and who want every agent active on day one."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {pricing.map((tier) => (
            <PricingTier key={tier.name} {...tier} />
          ))}
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
              <li>— Read-only access to your CRM</li>
              <li>— A shared inbox the fleet can draft into</li>
              <li>— An MLS export, if Compliance Sentinel is active</li>
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
              href="mailto:hello@agentplain.com?subject=agentplain%20pilot%20interest"
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
