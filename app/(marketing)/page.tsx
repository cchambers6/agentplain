import Link from "next/link";
import Section from "@/components/Section";
import AgentCard from "@/components/AgentCard";
import PricingTier from "@/components/PricingTier";
import FAQ from "@/components/FAQ";

const agents = [
  {
    index: "01",
    name: "Listing Coordinator",
    description:
      "Walks a new listing from intake form to MLS-ready package. Pulls public data, drafts copy for human review, and flags missing disclosures before they slow the deal down.",
  },
  {
    index: "02",
    name: "Buyer Inquiry Router",
    description:
      "Reads inbound inquiries from email, web forms, and CRM webhooks. Classifies intent, attaches the right context, and routes to the right agent in your office — without dropping leads on weekends.",
  },
  {
    index: "03",
    name: "Showing Scheduler",
    description:
      "Coordinates showings across the buyer, the buyer's agent, and the listing agent. Confirms, reschedules, and logs activity back to the CRM so nobody has to chase calendars.",
  },
  {
    index: "04",
    name: "Compliance Sentinel",
    description:
      "Reviews customer-facing drafts and listing copy for fair-housing language, disclosure gaps, and broker-of-record requirements. Surfaces issues before they reach the consumer.",
  },
  {
    index: "05",
    name: "CRM Hygiene",
    description:
      "Dedupes contacts, normalizes phones and addresses, fills missing fields from public records, and keeps stale records flagged. Quietly maintains the asset most brokerages neglect.",
  },
  {
    index: "06",
    name: "Production Reporter",
    description:
      "Generates the production reports owners actually want — agent-by-agent, week over week, month over month. Variance commentary written by the agent, reviewed by you.",
  },
  {
    index: "07",
    name: "Recruiter Assistant",
    description:
      "Researches local agents who fit your brokerage profile, drafts outbound openers, and tracks the pipeline. The recruiting work owners say they will do and rarely have time for.",
  },
];

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
    excludes: [
      "Custom agent development",
      "On-site implementation",
    ],
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
    excludes: [
      "Custom agent development beyond the seven shipped",
    ],
  },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-24 pt-20 md:pb-32 md:pt-28">
          <p className="eyebrow mb-6">v0 · pilot phase · invite only</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink sm:text-6xl md:text-[5.5rem] md:leading-[1.02]">
            Intelligence.
            <br />
            <span className="text-signal">Rooted in reality.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            agentplain is a pre-trained AI agent fleet for small-to-mid
            brokerages. Seven agents handle the recurring operational work that
            keeps owners awake — listing intake, buyer routing, compliance, CRM
            hygiene, production reporting, recruiting. They run quietly, in the
            tools you already use.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/pilot" className="btn-primary">
              See the pilot
              <span aria-hidden>→</span>
            </Link>
            <a
              href="mailto:hello@agentplain.com?subject=Book%20a%20call"
              className="btn-secondary"
            >
              Book a call
              <span aria-hidden>→</span>
            </a>
          </div>

          <div className="mt-16 grid max-w-3xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
            <Stat label="Agents in the fleet" value="7" />
            <Stat label="Pilot length" value="30 days" />
            <Stat label="Verticals at v0" value="Realty" />
          </div>
        </div>
      </section>

      {/* WHAT AGENTPLAIN DOES */}
      <Section
        eyebrow="What agentplain does"
        title="A small fleet, doing the work brokerages keep deferring."
        intro="Three things, on purpose. We do not aim to replace your CRM, your MLS, or your people. We aim to remove the recurring tasks that bottleneck small brokerages — quietly, in the background, without another dashboard to maintain."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          <Pillar
            number="01"
            title="A pre-trained agent fleet"
            body="Each agent is scoped to one operational job. They arrive trained on brokerage workflows, fair-housing language, and the systems brokerages actually use. No prompt engineering required from your team."
          />
          <Pillar
            number="02"
            title="Quiet operations"
            body="The fleet runs in the background. It writes back to your CRM, drafts in your inbox, and flags decisions for human review. Your agents keep using what they already use."
          />
          <Pillar
            number="03"
            title="Measured outcomes"
            body="A 30-day pilot with a written report at the end. Number of leads routed, listings prepped, compliance flags surfaced, hours returned to the owner. No vanity metrics."
          />
        </div>
      </Section>

      {/* AGENT FLEET */}
      <Section
        id="fleet"
        tone="deep"
        eyebrow="The fleet · v0"
        title="Seven agents. Each one scoped to one job."
        intro="We start narrow on purpose. Each agent does one operational task well, with the human review steps that brokerage compliance requires. The list grows when an agent earns its slot, not before."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard
              key={a.name}
              index={a.index}
              name={a.name}
              description={a.description}
            />
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-slate-soft">
          v0 fleet covers the realty vertical. Insurance brokerage variants are
          in design partner conversations and not yet shipped.
        </p>
      </Section>

      {/* PRICING */}
      <Section
        id="pricing"
        eyebrow="Pilot pricing"
        title="A 30-day pilot. Opt-in at the end."
        intro="No annual contract, no auto-renew. The pilot is a paid working engagement that ends with an outcome report and your decision on whether to continue. Continuation is priced per brokerage at the end of the pilot."
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
            <li>— Human review on every customer-facing output</li>
            <li>— Liability for licensed activities stays with your broker</li>
            <li>— Written outcome report at day 30</li>
            <li>— No data resold, no client list retained</li>
            <li>— You own the work product</li>
          </ul>
        </div>
      </Section>

      {/* FAQ */}
      <Section
        id="faq"
        tone="deep"
        eyebrow="Questions worth asking"
        title="The honest version."
      >
        <FAQ />
      </Section>

      {/* FOOTER CTA */}
      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-32">
          <p className="eyebrow mb-6 text-paper/60">The thesis, plainly</p>
          <p className="max-w-3xl font-display text-4xl leading-[1.1] md:text-6xl md:leading-[1.05]">
            Run a 25-agent brokerage with five.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/75">
            That is what we are building toward. The pilot is the first step —
            the fleet handles enough of the operations workload that owners stop
            building headcount around admin and start building it around
            production.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/pilot"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              See the pilot
              <span aria-hidden>→</span>
            </Link>
            <a
              href="mailto:hello@agentplain.com"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              hello@agentplain.com
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}

function Pillar({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-signal">
        {number}
      </p>
      <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
        {title}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
