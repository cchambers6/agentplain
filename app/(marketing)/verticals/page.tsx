import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/Section";
import HeroBackdrop from "@/components/marketing/HeroBackdrop";
import DesignPartnerGrid from "@/components/trust/DesignPartnerGrid";
import { getAllVerticals } from "@/lib/verticals";
import { alternatesFor } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Verticals",
  description:
    "One managed AI fleet, ten verticals — real estate to RIA. Per-seat service partnership from $99/seat; bespoke scope on /custom. Run for you.",
  alternates: alternatesFor("/verticals"),
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
      <section className="relative overflow-hidden border-b border-rule bg-paper">
        <HeroBackdrop scene="verticals" />
        <div className="relative container-wide py-20 md:py-28">
          <p className="dateline mb-6">Ten verticals · 2026</p>
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
            $199 → $99, Partner $299 → $199, Max quoted to scope. 7-day free
            trial (14 days for CPA &amp; Law), card at signup. Month-to-month.
          </p>
        </div>
      </section>

      <Section
        eyebrow="The ten"
        title="Pick your vertical."
        intro="Every vertical lands at the same three-tier ladder. Vertical-aware compliance corpus, JTBD tables, and integration roadmap are scoped per vertical — the tier choice (Regular / Partner / Max) is about cadence and depth of service partnership, not which vertical you're in."
      >
        <Grid items={all} />

        {/* On-ramp affordance — `/general` is a surface, not an eleventh
            vertical. Lives below the grid so it doesn't read as one of the
            ratified ten, but on the same page so a visitor outside the ten
            still has an honest landing path. */}
        <div className="mt-10 border border-rule bg-paper p-7 md:flex md:items-center md:justify-between md:gap-8 md:p-8">
          <div className="max-w-2xl">
            <p className="eyebrow mb-2">Don&apos;t see your industry?</p>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Same service partnership, lighter scaffolding. Universal admin
              (inbox triage, scheduling, follow-up, basic documentation)
              against common-denominator tools — Gmail, Outlook, Google
              Calendar, QuickBooks. No vertical-specific compliance corpus;
              if you need one we scope it as a Custom engagement.
            </p>
          </div>
          <Link
            href="/general"
            className="mt-5 inline-flex items-center gap-2 text-ink underline md:mt-0"
          >
            See the on-ramp →
          </Link>
        </div>
      </Section>

      {/* Founding design partners (2026-07-19) — the vertical-picker page is
          where a prospect sizes up who else runs this. Reads
          lib/trust/proof.ts; honest launching state until partners land. */}
      <Section tone="deep" eyebrow="Who runs this today">
        <DesignPartnerGrid />
      </Section>

      <Section
        tone="forest"
        eyebrow="Outside the tiers?"
        title="When the productized tiers don't cover it, we scope custom."
        intro="Bespoke compliance corpus, white-label, custom integration to a tool that isn't on the roadmap, 100+ seats. Different from Max (a tier with non-standard scope): /custom is engagement work against a written spec."
      >
        <div className="border border-mid-rule p-8 md:p-10">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-eyebrow text-wheat">
            Custom engagement
          </p>
          <p className="max-w-3xl text-[15px] leading-relaxed text-paper/80">
            Starts at <span className="foil">$5K</span>. Typical scope
            $5K–$15K plus $200–$500/mo maintenance. Scoping call, written spec,
            4–6 week build, handoff, ongoing maintenance. No surprise charges.
          </p>
          <Link
            href="/custom"
            className="mt-5 inline-flex items-center gap-2 text-paper underline"
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
