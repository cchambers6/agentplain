import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import SeatTierTable from "@/components/SeatTierTable";
import StackComparison from "@/components/StackComparison";
import RoiCalculator from "@/components/RoiCalculator";

export const metadata: Metadata = {
  title: "Pricing — agentplain",
  description:
    "Per-seat pricing from $199/mo solo down to $79/mo at 50+ seats. Replaces $510–$1,560/mo of typical realtor tooling. Annual saves two months. ROI calculator and full comparison below.",
};

const includes = [
  "Every catalog agent for your vertical, on every seat",
  "Standard integrations (CRM, inbox, calendar, MLS export)",
  "Compliance gate on every customer-facing output",
  "Per-workspace audit log and rollback",
  "Workspace data isolated by row-level security",
  "Email + chat support",
  "All product updates as catalog grows",
];

const addons = [
  {
    name: "Custom agent builds",
    body: "If your office has a job the catalog does not cover, we scope and build the agent for it. Becomes part of your workspace, versioned and rollback-able. Scoped engagement, priced per build.",
  },
  {
    name: "Custom integrations",
    body: "Internal API, in-house transaction system, niche CRM that's not in the standard adapter set. Adapter built and shipped to your workspace. Scoped engagement, priced per adapter.",
  },
  {
    name: "Onboarding sprint",
    body: "Two-week white-glove onboarding for offices that want a senior implementer on-site (virtually) during the first deals. Optional. Most offices skip it.",
  },
];

export default function PricingPage() {
  return (
    <>
      {/* HERO + PER-DEAL ROI PROOF */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Pricing</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            $79 to $199 per seat / month.
            <br />
            <span className="text-signal">Pays for itself with one extra deal.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Per-seat pricing scaled by team size. Annual saves two months.
            No platform fee. Custom agent builds and custom integrations
            are scoped engagements — priced per build, not gated behind a
            tier.
          </p>

          <div className="mt-12 max-w-3xl border border-rule bg-paper-deep p-6 md:p-8">
            <p className="eyebrow mb-3">The math, plainly</p>
            <p className="font-display text-2xl leading-snug text-ink md:text-3xl">
              Close 1 extra deal per quarter from leads we nurture. At a
              2.5% commission on a $400K home, that's <span className="text-signal">$10,000</span>.
              Solo agentplain pays for itself in <span className="text-signal">~73 days</span>.
              Brokerages with 10+ realtors? Pays for itself before week 1.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-slate-soft">
              Run your own numbers in the calculator below.
            </p>
          </div>
        </div>
      </section>

      {/* SEAT TIERS */}
      <Section
        eyebrow="Seat tiers"
        title="The math gets better with team size."
        intro="Every seat on every tier gets the same product. The price per seat scales down as the team scales up. There is no platform fee on top."
      >
        <SeatTierTable />

        <div className="mt-10 grid gap-6 border-t border-rule pt-8 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-3">What every seat includes</p>
            <ul className="space-y-2 text-[15px] leading-relaxed text-ink-soft">
              {includes.map((i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-3">Add-ons (scoped engagements)</p>
            <ul className="space-y-3 text-[15px] leading-relaxed text-ink-soft">
              {addons.map((a) => (
                <li key={a.name}>
                  <span className="text-ink">{a.name}.</span> {a.body}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* COMPARISON TABLE */}
      <Section
        tone="deep"
        eyebrow="Replaces these tools"
        title="Your current stack is $510–$1,560 per realtor per month."
        intro="Most offices we talk to are paying somewhere in this range across CRM, lead-gen, listing copy, drip, social, transaction management, and showings. agentplain replaces the work those tools do — your team keeps the CRM and inbox they already use; the agents handle the rest."
      >
        <StackComparison />

        <p className="mt-8 max-w-3xl text-[14px] leading-relaxed text-slate-soft">
          We do not ask you to rip out your CRM or your inbox. The agents
          read and write inside what your office already runs on. The tools
          that get retired are the layers above them — the schedulers, the
          drip platforms, the per-listing copy retainers, the lead-gen
          add-ons.
        </p>
      </Section>

      {/* ROI CALCULATOR */}
      <Section
        id="calculator"
        eyebrow="ROI calculator"
        title="Run your own numbers."
        intro="Drag the sliders to your office's actual shape. The math updates live — what you save in tooling, what you save in time, and what one extra deal a quarter is worth on top."
      >
        <RoiCalculator />
      </Section>

      {/* WHAT IS THE SAME ON EVERY TIER */}
      <Section
        id="capabilities"
        tone="deep"
        eyebrow="On every tier"
        title="Same product. Same rails. Different sizing."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl text-ink">Always included</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Workspace data isolated by row-level security</li>
              <li>— Compliance gate on customer-facing outputs</li>
              <li>— Per-workspace audit log on every action</li>
              <li>— Versioned agents and rollback</li>
              <li>— You own the work product</li>
              <li>— Customer data not retained as training data</li>
              <li>— Liability for licensed activities stays with you</li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl text-ink">Never charged for</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Per-agent activation fees (every catalog agent is on every seat)</li>
              <li>— Per-integration fees on standard integrations</li>
              <li>— Platform / setup fee on top of seats</li>
              <li>— Storage or audit-log retention overage</li>
              <li>— Data-export fees if you ever leave</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-rule pt-6">
          <Link
            href="/capabilities"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See the full capability inventory →
          </Link>
        </div>
      </Section>

      {/* FAQ — pricing-specific */}
      <Section
        eyebrow="Pricing questions"
        title="The honest version."
      >
        <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-8">
          <PriceQA
            q="What is a 'seat'?"
            a="One realtor or licensed agent in your office who has the fleet running on their book. Brokers, admins, and assistants are not separate seats — they are part of the office workflow that the realtor seats already cover."
          />
          <PriceQA
            q="Is there a setup or platform fee?"
            a="No. Seats and add-ons are the only line items. Standard integrations, all catalog agents, the audit log, and the compliance gate are part of every seat."
          />
          <PriceQA
            q="What are custom builds priced at?"
            a="Per scope. A custom agent typically lands in the low-five-figures range for a single workflow; a custom integration is similar. We quote up front before we build. They are scoped engagements, not subscription tiers."
          />
          <PriceQA
            q="Do you charge per closed deal or take a commission split?"
            a="No. Flat per-seat pricing. We are not a brokerage and we do not carry licenses. If we helped you close more deals, you keep all the commission."
          />
          <PriceQA
            q="What if a realtor leaves mid-month?"
            a="Drop the seat at the end of the billing period — no proration headaches in either direction. On annual, unused seats roll into a credit for the next renewal."
          />
          <PriceQA
            q="Can we start small and add seats?"
            a="Yes. Most brokerages start with 3–5 of their highest-producing realtors, prove the math on real deals, and roll out the rest of the office. The price-per-seat tier you land in updates automatically when you cross a band."
          />
          <PriceQA
            q="What happens at 100+ seats?"
            a="Custom pricing, dedicated success lead, custom integrations included, and an SLA. Email hello@agentplain.com — we will scope an enterprise agreement."
          />
          <PriceQA
            q="Annual vs monthly — what is the actual savings?"
            a="Two months free. Annual is 10× the monthly price, not 12×. Same product, same flexibility on adding seats."
          />
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Ready to run the math on your own office?
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            Email goes to a real person. Calls are 30 minutes. We will tell
            you up front whether the math works for your team.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20pricing"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Get started
            </a>
            <Link
              href="/capabilities"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              See what's included
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function PriceQA({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-b border-rule py-5">
      <h3 className="font-display text-xl leading-snug text-ink md:text-2xl">
        {q}
      </h3>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        {a}
      </p>
    </div>
  );
}
