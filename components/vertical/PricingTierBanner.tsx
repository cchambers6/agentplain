import Section from "@/components/Section";
import type { VerticalTier } from "@/lib/verticals/types";

// Pricing per `project_stripe_both_surfaces.md` (three-tier per-seat ladder,
// pilot SKUs deprecated 2026-05-09). Each tier has a per-seat ladder that
// slides by seat count; first month is free across all three tiers.
const TIER_LADDER: Record<
  VerticalTier,
  {
    name: string;
    solo: string;
    floor: string;
    floorBand: string;
  }
> = {
  regular: {
    name: "Regular",
    solo: "$199",
    floor: "$99",
    floorBand: "50–99 seats",
  },
  plus: {
    name: "Plus",
    solo: "$299",
    floor: "$199",
    floorBand: "50–99 seats",
  },
  max: {
    name: "Max",
    solo: "$499",
    floor: "$299",
    floorBand: "50–99 seats",
  },
};

export default function PricingTierBanner({ tier }: { tier: VerticalTier }) {
  const active = TIER_LADDER[tier];

  return (
    <Section
      tone="deep"
      eyebrow="Pricing"
      title={
        <>
          {active.name} tier · per seat ·{" "}
          <span className="text-signal">{active.solo}</span> sliding to{" "}
          <span className="text-signal">{active.floor}</span>
        </>
      }
      intro="Three tiers, per seat, month-to-month. First month is free across every tier. Card on file at sign-up, month 1 = $0, month 2 onward at your tier's per-seat rate. Cancel any time."
    >
      <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
        <Cell
          label="Regular"
          solo="$199"
          floor="$99"
          band="50–99 seats"
          active={tier === "regular"}
        />
        <Cell
          label="Plus"
          solo="$299"
          floor="$199"
          band="50–99 seats"
          active={tier === "plus"}
        />
        <Cell
          label="Max"
          solo="$499"
          floor="$299"
          band="50–99 seats"
          active={tier === "max"}
        />
      </div>

      <p className="mt-8 max-w-3xl font-mono text-[12px] leading-relaxed text-slate-soft">
        Source: `project_stripe_both_surfaces.md` (per-seat ladder; pilot SKUs
        deprecated 2026-05-09). Tier mapping per
        `project_vertical_tier_mapping.md`. 100+ seats moves to enterprise terms.
      </p>
    </Section>
  );
}

function Cell({
  label,
  solo,
  floor,
  band,
  active,
}: {
  label: string;
  solo: string;
  floor: string;
  band: string;
  active: boolean;
}) {
  const border = active ? "ring-2 ring-inset ring-signal" : "";
  return (
    <div className={`bg-paper ${border} p-7`}>
      <p
        className={`font-mono text-[11px] tracking-eyebrow uppercase ${
          active ? "text-signal" : "text-slate"
        }`}
      >
        {label}
        {active && " · this vertical"}
      </p>
      <p className="mt-4 font-display text-3xl leading-none text-ink md:text-4xl">
        {solo}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-soft">
        per seat · solo (1 seat)
      </p>
      <p className="mt-4 font-display text-2xl leading-none text-ink-soft">
        {floor}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-soft">
        per seat · {band}
      </p>
    </div>
  );
}
