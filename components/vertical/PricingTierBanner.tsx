import Link from "next/link";
import Section from "@/components/Section";
import type { VerticalTier } from "@/lib/verticals/types";

// Pricing surface on a vertical landing page. Anchored to the single
// productized Regular tier per `project_stripe_both_surfaces.md` (simplified
// 2026-05-12 — Plus/Max are no longer surfaced; anything beyond Regular
// routes to /custom).
//
// The `tier` prop is kept in the API surface for backward-compat with the
// per-vertical content schema (`lib/verticals/types.ts`), but it does NOT
// drive different UI per vertical anymore — every vertical lands at Regular.
// Schema-side Plus/Max remain valid (the Tier enum on disk is unchanged) so
// that future productization doesn't require a schema migration.

const LADDER = [
  { band: "Solo (1 seat)", price: "$199" },
  { band: "2–9 seats", price: "$179" },
  { band: "10–24 seats", price: "$149" },
  { band: "25–49 seats", price: "$119" },
  { band: "50–99 seats", price: "$99" },
];

export default function PricingTierBanner(_props: { tier?: VerticalTier }) {
  return (
    <Section
      id="pricing"
      tone="deep"
      eyebrow="Pricing"
      title={
        <>
          Per-seat ·{" "}
          <span className="text-clay">$199</span> solo, sliding to{" "}
          <span className="text-clay">$99</span> at 50+ seats
        </>
      }
      intro="One plan. Plug-and-play. First month is free; card on file at sign-up; month 1 = $0, month 2 onward at your seat band's rate. Cancel any time. Affordable access to enterprise-grade tools — that's the vision."
    >
      <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-5">
        {LADDER.map((row) => (
          <div key={row.band} className="bg-paper p-5">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              {row.band}
            </p>
            <p className="mt-3 font-display text-3xl leading-none text-ink">
              {row.price}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-mute">
              per seat / mo
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-3xl border-t border-rule pt-6">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Need something the standard fleet doesn&apos;t do? Bespoke compliance
          corpus, white-label, dedicated success, custom integration, 100+
          seats?{" "}
          <Link href="/custom" className="text-ink underline">
            Build with us →
          </Link>
        </p>
      </div>

      <p className="mt-6 max-w-3xl font-mono text-[12px] leading-relaxed text-mute">
        Source: <code className="text-[12px]">project_stripe_both_surfaces.md</code>
        {" "}
        (per-seat ladder; simplified to single-tier surfacing 2026-05-12).
      </p>
    </Section>
  );
}
