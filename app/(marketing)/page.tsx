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
      "Walks a new listing from intake form to a draft package your broker reviews before MLS submission. Drafts copy, lists likely-missing disclosures, and flags fair-housing language. In design — first runs Q3 2026.",
  },
  {
    index: "02",
    name: "Buyer Inquiry Router",
    description:
      "Classifies inbound buyer inquiries by intent and attaches context for the right human in your office. Routes by your rules, not by a free-text prompt. Inbox + CRM connectors — coming Q3 2026.",
  },
  {
    index: "03",
    name: "Showing Scheduler",
    description:
      "Drafts showing-coordination messages for the buyer, the buyer's agent, and the listing agent. Tracks the back-and-forth and surfaces conflicts for a human reviewer — your existing scheduling tool sends and confirms.",
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
      "Drafts a weekly CRM-hygiene digest: likely duplicates, phone/address normalization candidates, and stale records to retire. Your operator applies the changes inside your CRM. CRM integration — coming Q3 2026.",
  },
  {
    index: "06",
    name: "Production Reporter",
    description:
      "Drafts production reports — agent-by-agent, week over week — from the activity data you export. Variance commentary written by the agent, reviewed by you. Direct CRM/MLS data pull — coming Q3 2026.",
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
    name: "Regular",
    price: "$199",
    cadence: "per seat · month-to-month",
    positioning:
      "For realty, mortgage, insurance, property management, title & escrow, and recruiting.",
    includes: [
      "Per-seat ladder: $199 (solo) sliding to $99 (50–99 seats)",
      "Month-to-month from day one — no annual contract",
      "First month free across all three tiers",
      "Weekly outcome digest: leads routed, listings prepped, hours returned",
      "Human review on every customer-facing output",
    ],
    excludes: [
      "Live OAuth into CRM, inbox, and MLS (coming Q3 2026)",
      "Compliance-grade gates beyond fair-housing/RESPA basics",
    ],
  },
  {
    name: "Plus",
    price: "$299",
    cadence: "per seat · month-to-month",
    positioning:
      "For home-services contractors (HVAC, roofing, plumbing) and CPA / tax-prep firms.",
    includes: [
      "Per-seat ladder: $299 (solo) sliding to $199 (50–99 seats)",
      "Month-to-month from day one — no annual contract",
      "First month free across all three tiers",
      "Vertical-specific drafting prompts and review checklists",
      "Human review on every customer-facing output",
    ],
    excludes: [
      "Live OAuth into CRM, inbox, and MLS (coming Q3 2026)",
      "On-site implementation",
    ],
    featured: true,
  },
  {
    name: "Max",
    price: "$499",
    cadence: "per seat · month-to-month",
    positioning:
      "For small / mid-size law firms and RIA / wealth-management practices.",
    includes: [
      "Per-seat ladder: $499 (solo) sliding to $299 (50–99 seats)",
      "Month-to-month from day one — no annual contract",
      "First month free across all three tiers",
      "Compliance archive (SEC/FINRA-style retention) on the roadmap",
      "Human review on every customer-facing output",
    ],
    excludes: [
      "Live OAuth into CRM, inbox, and MLS (coming Q3 2026)",
      "Custom agent development beyond the realty fleet",
    ],
  },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-24 pt-20 md:pb-32 md:pt-28">
          <p className="eyebrow mb-6">v0 · design partner phase · realty first</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink sm:text-6xl md:text-[5.5rem] md:leading-[1.02]">
            Intelligence.
            <br />
            <span className="text-clay">Rooted in reality.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            agentplain is a pre-trained AI agent fleet for professional-services
            firms — realty first. Seven agents are scoped for the operational
            work that keeps owners awake: listing intake, buyer routing,
            compliance review, CRM hygiene, production reporting, recruiting.
            The fleet is in design partner build today; first runs with customer
            data are scheduled for Q3 2026.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/about" className="btn-primary">
              How it works
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
            <Stat label="Agents in design (realty fleet)" value="7" />
            <Stat label="First month" value="Free" />
            <Stat label="Vertical at v0" value="Realty" />
          </div>
        </div>
      </section>

      {/* WHAT AGENTPLAIN DOES */}
      <Section
        eyebrow="What agentplain does"
        title="A small fleet, doing the work professional-services firms keep deferring."
        intro="Three things, on purpose. We integrate with the CRM, MLS, and inbox you already pay for — we don't ask you to migrate. Then we replace the manual work that lives between them. No new dashboard for your team to maintain."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          <Pillar
            number="01"
            title="A pre-trained agent fleet"
            body="Each agent is scoped to one operational job. Realty agents arrive trained on brokerage workflows, fair-housing language, and the systems brokerages actually use. No prompt engineering required from your team."
          />
          <Pillar
            number="02"
            title="Quiet operations"
            body="The fleet drafts in the inbox you already pay for and queues updates back to your CRM, every output gated by your human review. We don't send outbound on your behalf — drafts surface to you; your existing system sends. CRM + inbox integrations — coming Q3 2026."
          />
          <Pillar
            number="03"
            title="Measured outcomes"
            body="First month is free across all three tiers. A weekly outcome digest: leads routed, listings prepped, compliance flags surfaced, hours returned. No vanity metrics."
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
        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-mute">
          v0 fleet covers the realty vertical. The other nine verticals on our
          roadmap — mortgage, insurance, property management, title &amp;
          escrow, recruiting, home services, CPA / tax, law, and RIA — light up
          after realty hits functional acceptance.
        </p>
      </Section>

      {/* PRICING */}
      <Section
        id="pricing"
        eyebrow="Pricing — three tiers, per seat"
        title="Three tiers. Per seat. First month free."
        intro="Month-to-month from day one. Card on file at sign-up, month 1 = $0, month 2 onward at your tier's per-seat rate. Cancel anytime from your billing settings."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {pricing.map((tier) => (
            <PricingTier key={tier.name} {...tier} />
          ))}
        </div>

        <div className="mt-10 max-w-3xl border-t border-rule pt-8">
          <p className="eyebrow mb-3">What&apos;s the same across all three tiers</p>
          <ul className="grid gap-2 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
            <li>— First month free; month-to-month after</li>
            <li>— Human review on every customer-facing output</li>
            <li>— Liability for licensed activities stays with your broker</li>
            <li>— Weekly outcome digest</li>
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
            That is what we are building toward. The first month is free —
            by the time you decide to keep paying, the fleet has either earned
            its seat or it has not.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20interest"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Talk to us
              <span aria-hidden>→</span>
            </a>
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
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
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
      <p className="font-mono text-[11px] tracking-eyebrow text-clay">
        {number}
      </p>
      <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
        {title}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
