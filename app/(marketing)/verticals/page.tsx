import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/Section";
import { getAllVerticals } from "@/lib/verticals";

export const metadata: Metadata = {
  title: "Verticals — agentplain",
  description:
    "agentplain ships into nine locked verticals at three pricing tiers. Real estate is in pilot today; the other eight have ratified ICP fit and committed integration roadmaps.",
};

const TIER_LABEL: Record<string, string> = {
  regular: "Regular · $1,500",
  plus: "Plus · $2,750",
  max: "Max · $4,500",
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
            Nine verticals.
            <br />
            <span className="text-signal">Three tiers.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Each vertical maps to a tier per
            `project_vertical_tier_mapping.md`. The platform is
            vertical-agnostic by design; the agent catalogs, integrations, and
            compliance posture per vertical are not.
          </p>
        </div>
      </section>

      <Section
        eyebrow={TIER_LABEL.regular}
        title="Regular tier — $1,500 / 30-day pilot."
        intro="Foundation-tier pilots for SMB owner-operator practices with a focused fleet of 3–5 agents at install."
      >
        <Grid items={regular} />
      </Section>

      <Section
        tone="deep"
        eyebrow={TIER_LABEL.plus}
        title="Plus tier — $2,750 / 30-day pilot."
        intro="Growth-tier pilots for practices with deeper integration surface or larger seat counts at install."
      >
        <Grid items={plus} />
      </Section>

      <Section
        eyebrow={TIER_LABEL.max}
        title="Max tier — $4,500 / 30-day pilot."
        intro="Scale-tier pilots for high-margin, compliance-heavy practices where the fleet justifies the price ceiling."
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
          <p className="font-mono text-[11px] tracking-eyebrow text-signal">
            {v.hero.eyebrow}
          </p>
          <h3 className="mt-3 font-display text-2xl leading-tight text-ink md:text-3xl">
            {v.name}
          </h3>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
            {v.hero.headline}
          </p>
          <p className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] tracking-eyebrow text-slate group-hover:text-signal">
            Read the page <span aria-hidden>→</span>
          </p>
        </Link>
      ))}
    </div>
  );
}
