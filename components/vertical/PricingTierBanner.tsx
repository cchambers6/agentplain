import Link from "next/link";
import Section from "@/components/Section";
import {
  ANNUAL_PRICE_USD_CENTS,
  MONEY_BACK_GUARANTEE_DAYS,
  MONTHLY_PRICE_USD_CENTS,
  trialPeriodDaysForVertical,
} from "@/lib/billing/facts";
import {
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
// - Regular   → flat-price card, links to /pricing
// - Partner   → flat-price card + the support difference, links to /pricing
// - Max       → quote-based card with "Talk to a service partner" CTA
//               routing to /custom?type=max
//
// The price comes from `MONTHLY_PRICE_USD_CENTS` / `ANNUAL_PRICE_USD_CENTS`
// in `lib/billing/facts.ts` so this banner can never drift from billing.
// It is ONE price for every vertical and every headcount; `displayName` still
// renders because the tier names a SALES MOTION, never a price.
//
// `VerticalTier` and `TierName` are the same string union — `plus` and
// `regular` and `max` — so `tierDisplayName(tier)` accepts either and
// the type cast is a documentation cast, not a runtime conversion.

export default function PricingTierBanner({
  tier,
  verticalSlug,
}: {
  tier?: VerticalTier;
  /**
   * Vertical slug for trial-length resolution — CPA + Law carry the extended
   * trial per `lib/billing/facts.ts` (`trialPeriodDaysForVertical`). Optional
   * for back-compat; omitted falls back to the default trial length.
   */
  verticalSlug?: string;
}) {
  const resolvedTier: TierName = (tier ?? "regular") as TierName;
  const displayName = tierDisplayName(resolvedTier);
  const trialDays = trialPeriodDaysForVertical(verticalSlug ?? "");

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
        <div className="mt-8 max-w-3xl border-t border-rule pt-6">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Every agentplain subscription is month-to-month, with a {trialDays}
            -day free trial (card at signup) and a {MONEY_BACK_GUARANTEE_DAYS}
            -day money-back guarantee on the first charge —{" "}
            <Link href="/guarantee" className="text-ink underline">
              how the guarantee works →
            </Link>
          </p>
        </div>
      </Section>
    );
  }

  // ONE price. This block used to `.map()` over `tierLadderBands()` into a
  // five-column seat-band grid, with a headline reading
  // "<tier> · per-seat, $HIGH solo, sliding to $LOW at 50+ seats".
  // The shim now returns a SINGLE row, so headlineHigh === headlineLow and the
  // page rendered "$99 solo, sliding to $99 at 50+ seats" inside a five-column
  // grid holding one cell. Nothing threw.
  const monthly = `$${MONTHLY_PRICE_USD_CENTS / 100}`;
  const annual = (ANNUAL_PRICE_USD_CENTS / 100).toLocaleString("en-US");

  return (
    <Section
      id="pricing"
      tone="deep"
      eyebrow="Pricing"
      title={
        <>
          <span className="text-clay">{monthly}</span> a month on{" "}
          <span className="text-clay">{displayName}</span>. That&rsquo;s the
          whole price.
        </>
      }
      intro={
        resolvedTier === "plus"
          ? `One flat price, whatever your headcount — month-to-month. Includes priority support and a quarterly async check-in with your service team. ${trialDays}-day free trial, card at signup; cancel any time.`
          : `One flat price, whatever your headcount — month-to-month. Standard managed AI ops and onboarding bundled in. ${trialDays}-day free trial, card at signup; cancel any time.`
      }
    >
      <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
        <div className="bg-paper p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            Monthly
          </p>
          <p className="mt-3 font-display text-3xl leading-none text-ink">
            {monthly}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-mute">
            per month, flat
          </p>
        </div>
        <div className="bg-paper p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            Yearly
          </p>
          <p className="mt-3 font-display text-3xl leading-none text-ink">
            ${annual}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-mute">
            per year, flat
          </p>
        </div>
        <div className="bg-paper p-5">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            Team size
          </p>
          <p className="mt-3 font-display text-3xl leading-none text-ink">
            Any
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-mute">
            the price does not change
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-3xl border-t border-rule pt-6">
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Backed by a {MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee on
          your first charge —{" "}
          <Link href="/guarantee" className="text-ink underline">
            how the guarantee works →
          </Link>
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
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

    </Section>
  );
}
