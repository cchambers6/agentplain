import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import PricingTier from "@/components/PricingTier";

export const metadata: Metadata = {
  title: "Pricing — agentplain",
  description:
    "Two surfaces, two pricing models. Brokerage 30-day pilots at $1,500 / $2,750 / $4,500. Self-serve individual practitioner at $49 / month or $500 / year.",
};

const brokeragePricing = [
  {
    name: "Starter",
    price: "$1,500",
    cadence: "30-day pilot",
    positioning: "For an owner-operator brokerage testing the thesis.",
    includes: [
      "A focused subset of catalog agents tuned to your workflow",
      "Connected to one CRM and one shared inbox",
      "Weekly check-in",
      "Light-touch implementation (3–5 hours of your time)",
      "Outcome report at day 30",
    ],
    excludes: ["Custom agent development", "Multi-system integrations"],
  },
  {
    name: "Standard",
    price: "$2,750",
    cadence: "30-day pilot",
    positioning: "Best fit for most brokerages with 5–15 producing agents.",
    includes: [
      "Curated catalog agents tuned to your office",
      "CRM, inbox, and one MLS or transaction system",
      "Bi-weekly working sessions",
      "Production reporting tuned to your KPIs",
      "Compliance review of recent listings",
      "Outcome report and continuation proposal",
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
      "CRM, inbox, MLS, accounting export, one custom system",
      "Weekly senior-implementer sessions",
      "Custom production-reporting templates",
      "Continuation proposal with named monthly rate",
    ],
    excludes: [
      "More than one custom agent during the pilot (additional builds priced at continuation)",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Pricing</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Two surfaces.
            <br />
            <span className="text-signal">Two prices.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            High-touch brokerage engagements run as 30-day paid pilots with
            an outcome report at the end. The self-serve app for individual
            practitioners runs as a flat monthly. No seat charges, no
            per-agent fees, no per-integration fees on either side.
          </p>
        </div>
      </section>

      {/* BROKERAGE TIER */}
      <Section
        tone="deep"
        eyebrow="High-touch · brokerage tier"
        title="30-day pilot. Opt-in continuation."
        intro="A scoped working engagement. We deploy a curated catalog into your workspace, build any custom agents the engagement needs, and run the fleet on your real workflows for 30 days. Continuation is opt-in at the end with a named monthly rate."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {brokeragePricing.map((tier) => (
            <PricingTier key={tier.name} {...tier} />
          ))}
        </div>

        <div className="mt-10 max-w-3xl">
          <Link
            href="/brokerages"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See the brokerage details →
          </Link>
        </div>
      </Section>

      {/* SELF-SERVE TIER */}
      <Section
        eyebrow="Self-serve · individual tier"
        title="$49 a month. Or $500 a year."
        intro="A scaled version of the same agent platform, sized for an individual practitioner. The self-serve app is in active build (Phase 3); we will not charge before the first cohort of catalog agents is stable for unattended use."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <article className="flex h-full flex-col border border-ink bg-paper p-7 shadow-[6px_6px_0_0_#5F8060]">
            <div className="mb-6">
              <p className="eyebrow mb-3">Monthly</p>
              <p className="font-mono text-4xl text-ink md:text-5xl">$49</p>
              <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                per month
              </p>
            </div>
            <p className="mb-6 font-display text-xl leading-snug text-ink">
              Month-to-month. Cancel any time. No annual commitment.
            </p>
            <ul className="mb-6 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                <span>All catalog agents available to the self-serve tier</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                <span>Standard integrations (CRM, inbox, calendar)</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                <span>Workspace audit log and rollback</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                <span>Email support</span>
              </li>
            </ul>
            <div className="mt-auto pt-2">
              <a
                href="mailto:hello@agentplain.com?subject=agentplain%20self-serve%20waitlist%20monthly"
                className="btn-primary w-full"
              >
                Join the waitlist
              </a>
            </div>
          </article>

          <article className="flex h-full flex-col border border-rule bg-paper p-7">
            <div className="mb-6">
              <p className="eyebrow mb-3">Annual</p>
              <p className="font-mono text-4xl text-ink md:text-5xl">$500</p>
              <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                per year · two months free
              </p>
            </div>
            <p className="mb-6 font-display text-xl leading-snug text-ink">
              For practitioners who already know they want it.
            </p>
            <ul className="mb-6 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                <span>Everything in monthly</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                <span>Two months free vs. monthly</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
                <span>Locked-in pricing for the year</span>
              </li>
            </ul>
            <div className="mt-auto pt-2">
              <a
                href="mailto:hello@agentplain.com?subject=agentplain%20self-serve%20waitlist%20annual"
                className="btn-secondary w-full"
              >
                Join the waitlist
              </a>
            </div>
          </article>
        </div>

        <div className="mt-10 max-w-3xl border-t border-rule pt-6">
          <Link
            href="/for-agents"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See the self-serve details →
          </Link>
        </div>
      </Section>

      {/* WHAT IS THE SAME */}
      <Section
        tone="deep"
        eyebrow="What is the same on both tiers"
        title="The bits that should never depend on what you pay."
      >
        <ul className="grid gap-3 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
            <span>Workspace data isolated by row-level security</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
            <span>Approval gate on customer-facing drafts</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
            <span>Per-workspace audit log on every action</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
            <span>You own the work product</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
            <span>Customer data not retained as training data</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-signal" />
            <span>Liability for licensed activities stays with you</span>
          </li>
        </ul>

        <div className="mt-10 max-w-3xl border-t border-rule pt-6">
          <Link
            href="/trust"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            Trust and security in detail →
          </Link>
        </div>
      </Section>
    </>
  );
}
