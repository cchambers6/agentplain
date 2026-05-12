import Link from "next/link";
import Section from "@/components/Section";
import AgentCard from "@/components/AgentCard";
import PricingTier from "@/components/PricingTier";
import FAQ from "@/components/FAQ";
import { getAllVerticals } from "@/lib/verticals";
import { tokens } from "@/lib/brand/tokens";

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

// REPLACE / INTEGRATE / AUGMENT — three-pillar framing per
// project_replace_integrate_augment.md. Each per-vertical landing page expands
// this triad with vertical-specific claims via ClaimsTriadGrid; the home page
// presents the platform-level frame.
const triad = [
  {
    label: "Replace",
    headline: "Work the fleet takes off your desk.",
    body: "8–12 hours/week of broker-owner coordination work — lead routing, listing-intake follow-up, showing scheduling, recruiting outreach, monthly reports — drafted by the fleet before it hits your inbox.",
  },
  {
    label: "Integrate",
    headline: "Sits on top of the tools you already pay for.",
    body: "Follow Up Boss, dotloop, FMLS / GAMLS, Microsoft 365 Graph, Google Workspace, QuickBooks. No migration, no second dashboard. Read-only at first; CRM + inbox writes — coming Q3 2026.",
  },
  {
    label: "Augment",
    headline: "Your broker-of-record still signs.",
    body: "The Compliance Sentinel pre-checks every customer-facing draft. The Recruiting agent drafts the opener. The Production Reporter writes the variance commentary. The human signs every output that leaves your firm.",
  },
];

export default function HomePage() {
  const verticals = getAllVerticals();
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
            {tokens.wordmark} is a pre-trained AI agent fleet for
            professional-services firms — realty first. Seven agents are scoped
            for the operational work that keeps owners awake: listing intake,
            buyer routing, compliance review, CRM hygiene, production reporting,
            recruiting. The fleet is in design partner build today; first runs
            with customer data are scheduled for Q3 2026.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/app/sign-up" className="btn-primary">
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link href="/verticals" className="btn-secondary">
              See all ten verticals
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-16 grid max-w-3xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
            <Stat label="Verticals on the roadmap" value="10" />
            <Stat label="First month" value="Free" />
            <Stat label="Live vertical at v0" value="Realty" />
          </div>
        </div>
      </section>

      {/* REPLACE / INTEGRATE / AUGMENT */}
      <Section
        eyebrow="What agentplain does, and doesn't"
        title="Replace. Integrate. Augment."
        intro="A small fleet doing the work professional-services firms keep deferring. Three columns, on purpose. Every entry is a specific commitment — no marketing fog."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
          {triad.map((p, i) => (
            <Triad
              key={p.label}
              number={String(i + 1).padStart(2, "0")}
              label={p.label}
              headline={p.headline}
              body={p.body}
            />
          ))}
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section
        id="how"
        tone="deep"
        eyebrow="How it works"
        title="Three steps. Then the fleet drafts every morning."
        intro="Onboarding takes ten minutes. After that, the fleet works in the background and surfaces drafts to you on your schedule — your existing CRM and inbox send."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          <Step
            number="01"
            title="Pick your vertical."
            body="Each of the ten verticals ships with its own pre-trained agent catalog, JTBD table, and integration list. No prompt engineering."
          />
          <Step
            number="02"
            title="Connect your tools."
            body="Read-only OAuth into the CRM, inbox, and accounting system you already pay for. The fleet reads what's there — we don't ask you to migrate."
          />
          <Step
            number="03"
            title="The fleet drafts; you decide."
            body="Every customer-facing output queues for your review. Approve, edit, or reject. Your existing system sends. The fleet never reaches the consumer on its own."
          />
        </div>
      </Section>

      {/* AGENT FLEET */}
      <Section
        id="fleet"
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

      {/* VERTICAL GRID */}
      <Section
        id="verticals"
        tone="deep"
        eyebrow="Verticals · ten on the roadmap"
        title="Built for ten professional-services verticals."
        intro="Each vertical maps to a tier — Regular, Plus, or Max — per project_vertical_tier_mapping.md. Real estate is in pilot today; the other nine carry ratified ICP fit and committed integration roadmaps."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {verticals.map((v) => (
            <Link
              key={v.slug}
              href={`/${v.slug}`}
              className="group flex flex-col bg-paper p-6 transition hover:bg-paper-deep"
            >
              <p className="font-mono text-[10px] tracking-eyebrow uppercase text-clay">
                {v.tier}
              </p>
              <p className="mt-3 font-display text-xl leading-tight text-ink">
                {v.name}
              </p>
              <p className="mt-auto pt-6 inline-flex items-center gap-2 font-mono text-[10px] tracking-eyebrow text-mute group-hover:text-clay">
                Read page <span aria-hidden>→</span>
              </p>
            </Link>
          ))}
        </div>
        <div className="mt-10">
          <Link
            href="/verticals"
            className="btn-secondary"
          >
            See all ten with tier breakdown
            <span aria-hidden>→</span>
          </Link>
        </div>
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
            That is what we are building toward. The first month is free — by
            the time you decide to keep paying, the fleet has either earned its
            seat or it has not.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20interest"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Talk to the operator
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

function Triad({
  number,
  label,
  headline,
  body,
}: {
  number: string;
  label: string;
  headline: string;
  body: string;
}) {
  return (
    <div className="flex flex-col bg-paper p-8 md:p-10">
      <div className="flex items-baseline gap-3">
        <p className="font-mono text-[11px] tracking-eyebrow text-clay">
          {number}
        </p>
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {label}
        </p>
      </div>
      <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
        {headline}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function Step({
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
      <h3 className="mt-4 font-display text-xl leading-tight text-ink md:text-2xl">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
