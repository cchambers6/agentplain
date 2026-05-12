import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/Section";
import { getAllVerticals } from "@/lib/verticals";

export const metadata: Metadata = {
  title: "Verticals — agentplain",
  description:
    "agentplain is built for ten locked verticals across three per-seat pricing tiers. Real estate is in design partner build today; the other nine have ratified ICP fit and committed integration roadmaps.",
};

const TIER_LABEL: Record<string, string> = {
  regular: "Regular · $199 → $99 per seat",
  plus: "Plus · $299 → $199 per seat",
  max: "Max · $499 → $299 per seat",
};

export default function VerticalsIndexPage() {
  const all = getAllVerticals();
  const regular = all.filter((v) => v.tier === "regular");
  const plus = all.filter((v) => v.tier === "plus");
  const max = all.filter((v) => v.tier === "max");

  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">All verticals</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Ten verticals.
            <br />
            <span className="text-clay">Three tiers.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Each vertical maps to a tier per
            `project_vertical_tier_mapping.md`. The platform is
            vertical-agnostic by design; the agent catalogs, integrations, and
            compliance posture per vertical are not. Pricing is per-seat,
            month-to-month, first month free.
          </p>
        </div>
      </section>

      <Section
        eyebrow={TIER_LABEL.regular}
        title="Regular tier — $199 → $99 per seat."
        intro="Foundation per-seat tier for small / mid-size owner-operator practices: real estate, mortgage, insurance, property management, title & escrow, recruiting. Solo seat $199/mo; sliding to $99/mo at 50–99 seats."
      >
        <Grid items={regular} />
      </Section>

      <Section
        tone="deep"
        eyebrow={TIER_LABEL.plus}
        title="Plus tier — $299 → $199 per seat."
        intro="Growth per-seat tier for verticals with deeper integration surface or higher per-job value: home services contractors and CPA / tax prep firms. Solo seat $299/mo; sliding to $199/mo at 50–99 seats."
      >
        <Grid items={plus} />
      </Section>

      <Section
        eyebrow={TIER_LABEL.max}
        title="Max tier — $499 → $299 per seat."
        intro="Scale per-seat tier for high-margin, compliance-heavy practices where billable-hour or fiduciary economics justify the price ceiling: law firms (small / mid-size) and RIA / wealth management. Solo seat $499/mo; sliding to $299/mo at 50–99 seats."
      >
        <Grid items={max} />
      </Section>
    </>
  );
}

function Grid({ items }: { items: ReturnType<typeof getAllVerticals> }) {
  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
      {items.map((v) => (
        <Link
          key={v.slug}
          href={`/${v.slug}`}
          className="group bg-paper p-7 transition hover:bg-paper-deep"
        >
          <p className="font-mono text-[11px] tracking-eyebrow text-clay">
            {v.hero.eyebrow}
          </p>
          <h3 className="mt-3 font-display text-2xl leading-tight text-ink md:text-3xl">
            {v.name}
          </h3>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
            {v.hero.headline}
          </p>
          <p className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] tracking-eyebrow text-mute group-hover:text-clay">
            Read the page <span aria-hidden>→</span>
          </p>
        </Link>
      ))}
    </div>
  );
}
