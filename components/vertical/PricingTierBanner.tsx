import Link from "next/link";
import Section from "@/components/Section";
import {
  PARTNER_RESERVED_HOURS_PER_MONTH,
  TIER_TAGLINE,
  tierDisplayName,
  type TierName,
} from "@/lib/pricing/tiers";
import type { VerticalTier } from "@/lib/verticals/types";

// Pricing surface on a vertical landing page. Anchored to the 2026-05-15
// three-tier ratification in `memory/project_stripe_both_surfaces.md`
// (Regular / Partner / Max — supersedes the 2026-05-12 single-tier
// surfacing). The recommended tier per vertical comes from the content
// module's `tier` field; copy reads through `tierDisplayName()` so the
// on-disk `plus` enum value never leaks to customers as "Plus" — it
// always renders "Partner".
//
// Renderer contract:
// - Regular   → ladder card grid with per-band prices, links to /pricing
// - Partner   → ladder card grid with Partner per-band prices, named-
//               service-partner-hours bullet, links to /pricing
// - Max       → quote-based card with "Talk to a service partner" CTA
//               routing to /custom?type=max
//
// `VerticalTier` and `TierName` are the same string union — `plus` and
// `regular` and `max` — so `tierDisplayName(tier)` accepts either and
// the type cast is a documentation cast, not a runtime conversion.

const REGULAR_LADDER: { band: string; price: string }[] = [
  { band: "Solo (1 seat)", price: "$199" },
  { band: "2–9 seats", price: "$179" },
  { band: "10–24 seats", price: "$149" },
  { band: "25–49 seats", price: "$119" },
  { band: "50–99 seats", price: "$99" },
];

const PARTNER_LADDER: { band: string; price: string }[] = [
  { band: "Solo (1 seat)", price: "$299" },
  { band: "2–9 seats", price: "$279" },
  { band: "10–24 seats", price: "$249" },
  { band: "25–49 seats", price: "$219" },
  { band: "50–99 seats", price: "$199" },
];

export default function PricingTierBanner({ tier }: { tier?: VerticalTier }) {
  const resolvedTier: TierName = (tier ?? "regular") as TierName;
  const displayName = tierDisplayName(resolvedTier);

  if (resolvedTier === "max") {
    return (
      <Section
        id="pricing"
        tone="deep"
        eyebrow="Pricing"
        title={
          <>
            <span className="text-clay">Max</span> · quote-based engagement
          </>
        }
        intro={TIER_TAGLINE.max}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border border-rule bg-paper p-6">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              What Max covers
            </p>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>High-intensity service for regulated verticals</li>
              <li>Multi-state ops or multi-jurisdiction compliance corpus</li>
              <li>White-label or dedicated team</li>
              <li>Bespoke compliance review beyond standard skills</li>
            </ul>
          </div>
          <div className="border border-rule bg-paper p-6">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              How Max works
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              We scope the engagement together — service intensity, integration
              depth, dedicated team — and quote month-to-month or annual.
              Max is service intensity at standard skill scope; for capability
              builds we don&apos;t have yet,{" "}
              <Link href="/custom" className="text-ink underline">
                /custom
              </Link>{" "}
              is the right path.
            </p>
            <Link
              href="/custom?type=max"
              className="mt-6 inline-flex btn-primary"
            >
              Talk to a service partner →
            </Link>
          </div>
        </div>
        <p className="mt-6 max-w-3xl font-mono text-[12px] leading-relaxed text-mute">
          Source: <code className="text-[12px]">project_stripe_both_surfaces.md</code>
          {" "}(Max tier per the 2026-05-15 three-tier ratification — AD-HOC
          quote-based, not a fixed per-seat price).
        </p>
      </Section>
    );
  }

  const ladder = resolvedTier === "plus" ? PARTNER_LADDER : REGULAR_LADDER;
  const headlineLow = ladder[ladder.length - 1].price;
  const headlineHigh = ladder[0].price;

  return (
    <Section
      id="pricing"
      tone="deep"
      eyebrow="Pricing"
      title={
        <>
          <span className="text-clay">{displayName}</span> · per-seat,{" "}
          <span className="text-clay">{headlineHigh}</span> solo, sliding to{" "}
          <span className="text-clay">{headlineLow}</span> at 50+ seats
        </>
      }
      intro={
        resolvedTier === "plus"
          ? `Per seat, month-to-month. Includes ${PARTNER_RESERVED_HOURS_PER_MONTH} hours per month of a named service partner — review-gate adjustment, integration depth, monthly business review. First month is free; cancel any time.`
          : "Per seat, month-to-month. Standard managed AI ops + onboarding bundled in. First month is free; cancel any time."
      }
    >
      <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-5">
        {ladder.map((row) => (
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
          Need higher-intensity service, multi-state ops, white-label, or a
          dedicated team?{" "}
          <Link href="/custom?type=max" className="text-ink underline">
            Step up to Max →
          </Link>
          {" · "}
          Need a capability we don&apos;t ship yet?{" "}
          <Link href="/custom" className="text-ink underline">
            Build with us on /custom →
          </Link>
        </p>
      </div>

      <p className="mt-6 max-w-3xl font-mono text-[12px] leading-relaxed text-mute">
        Source: <code className="text-[12px]">project_stripe_both_surfaces.md</code>
        {" "}({displayName} tier per the 2026-05-15 three-tier ratification).
      </p>
    </Section>
  );
}
