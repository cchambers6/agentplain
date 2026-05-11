import Section from "@/components/Section";
import type { VerticalTier } from "@/lib/verticals/types";

// Pricing per `project_stripe_both_surfaces.md` L13 + L30.
// Per-seat is uniform across all tiers ($49/mo, $500/yr).
const PILOT_PRICE: Record<VerticalTier, { name: string; price: string }> = {
  regular: { name: "Regular", price: "$1,500" },
  plus: { name: "Plus", price: "$2,750" },
  max: { name: "Max", price: "$4,500" },
};

export default function PricingTierBanner({ tier }: { tier: VerticalTier }) {
  const active = PILOT_PRICE[tier];

  return (
    <Section
      tone="deep"
      eyebrow="Pricing"
      title={
        <>
          {active.name} tier ·{" "}
          <span className="text-signal">{active.price}</span> / 30-day pilot
        </>
      }
      intro="Two surfaces, one Stripe account. The 30-day pilot is a paid working engagement that ends with an outcome report. Per-seat scaled-SaaS pricing applies once the customer surface goes live."
    >
      <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
        <Cell
          label="Regular"
          price="$1,500"
          tag="30-day pilot"
          active={tier === "regular"}
        />
        <Cell
          label="Plus"
          price="$2,750"
          tag="30-day pilot"
          active={tier === "plus"}
        />
        <Cell
          label="Max"
          price="$4,500"
          tag="30-day pilot"
          active={tier === "max"}
        />
        <Cell
          label="Per seat (scaled SaaS)"
          price="$49"
          tag="/ seat / month · $500 / yr"
          active={false}
          accent
        />
      </div>

      <p className="mt-8 max-w-3xl font-mono text-[12px] leading-relaxed text-slate-soft">
        Source: `project_stripe_both_surfaces.md` L13 (pilot tiers) and L30
        (per-seat). High-touch pilot tier is invoice-based; scaled SaaS is
        Stripe Checkout. Tier mapping per `project_vertical_tier_mapping.md`.
      </p>
    </Section>
  );
}

function Cell({
  label,
  price,
  tag,
  active,
  accent = false,
}: {
  label: string;
  price: string;
  tag: string;
  active: boolean;
  accent?: boolean;
}) {
  const border = active ? "ring-2 ring-inset ring-signal" : "";
  const bg = accent ? "bg-paper-deep" : "bg-paper";
  return (
    <div className={`${bg} ${border} p-7`}>
      <p
        className={`font-mono text-[11px] tracking-eyebrow uppercase ${
          active ? "text-signal" : "text-slate"
        }`}
      >
        {label}
        {active && " · this vertical"}
      </p>
      <p className="mt-4 font-display text-3xl leading-none text-ink md:text-4xl">
        {price}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-soft">{tag}</p>
    </div>
  );
}
