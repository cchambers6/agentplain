import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/Section";
import { getAllVerticals } from "@/lib/verticals";

export const metadata: Metadata = {
  title: "Verticals — agentplain",
  description:
    "agentplain is a service partnership built for ten locked verticals. Three tiers (Regular $199 → $99, Partner $299 → $199, Max quoted) cover every vertical; bespoke engagements live on /custom.",
};

// Verticals index page. Anchored to the simplified pricing model per
// `project_stripe_both_surfaces.md` (locked 2026-05-12 — single productized
// tier; anything beyond Regular routes to /custom). Per
// `feedback_everything_tells_a_story.md`, every element earns its place;
// the 3-tier section grid (deleted 2026-05-12) implied Plus/Max were
// productized buyable surfaces, which they are not.

export default function VerticalsIndexPage() {
  const all = getAllVerticals();

  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">All verticals</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Ten verticals.
            <br />
            <span className="text-clay">Different ops. Same value loop.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Each vertical-aware fleet lifts up local businesses by doing the
            work that takes their time and money away from the people they
            serve. Different domain rules, same pattern: the fleet handles
            the recurring ops, your service team runs the partnership, the
            human keeps the relationships.
          </p>
          <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-mute">
            Three service-partnership tiers cover every vertical — Regular
            $199 → $99, Partner $299 → $199, Max quoted to scope. First month
            free. Month-to-month.
          </p>
        </div>
      </section>

      <Section
        eyebrow="The ten"
        title="Pick your vertical."
        intro="Every vertical lands at the same three-tier ladder. Vertical-aware compliance corpus, JTBD tables, and integration roadmap are scoped per vertical — the tier choice (Regular / Partner / Max) is about cadence and depth of service partnership, not which vertical you're in."
      >
        <Grid items={all} />
      </Section>

      <Section
        tone="deep"
        eyebrow="Outside the tiers?"
        title="When the productized tiers don't cover it, we scope custom."
        intro="Bespoke compliance corpus, white-label, custom integration to a tool that isn't on the roadmap, 100+ seats. Different from Max (a tier with non-standard scope): /custom is engagement work against a written spec."
      >
        <div className="border border-rule bg-paper p-8 md:p-10">
          <p className="eyebrow mb-3">Custom engagement</p>
          <p className="max-w-3xl text-[15px] leading-relaxed text-ink-soft">
            Starts at $5K. Typical scope $5K–$15K plus $200–$500/mo
            maintenance. Scoping call, written spec, 4–6 week build, handoff,
            ongoing maintenance. No surprise charges.
          </p>
          <Link
            href="/custom"
            className="mt-5 inline-flex items-center gap-2 text-ink underline"
          >
            Build with us →
          </Link>
        </div>
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
