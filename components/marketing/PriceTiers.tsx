import { TierCard } from "@/components/marketing/HomeCards";
import { tierLadderBands } from "@/lib/pricing/tiers";
import {
  TRIAL_PERIOD_DAYS,
  MONEY_BACK_GUARANTEE_DAYS,
  PARTNER_SUPPORT,
} from "@/lib/billing/facts";

// The three-tier service-partnership grid, as one reusable block.
//
// Every number on it is DERIVED: the per-seat ladders come from
// `tierLadderBands()` (canonical `PER_SEAT_MONTHLY_USD_CENTS`), the trial
// length and money-back window from `lib/billing/facts.ts`. No surface that
// renders this component can drift from billing truth — which is the whole
// point of extracting it (design-system tighten, 2026-07-08; previously the
// homepage hand-typed "7-day free trial" three times).
//
// The /pricing page keeps its own richer long-form layout; this block is the
// TEASER shape — home page today, vertical pages when they want one.

const FOOTNOTE = `${TRIAL_PERIOD_DAYS}-day free trial. Month-to-month. Per seat.`;

export function PriceTiers() {
  const ladderBands = tierLadderBands("regular");
  const partnerBands = tierLadderBands("plus");

  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
      <TierCard
        name="Regular"
        tagline="Standard service partnership."
        description="Our team installs the fleet, configures it for your vertical, and runs a monthly review. Day-to-day, the fleet drafts inside the workspace you log into."
        bands={ladderBands}
        ctaLabel="Start free trial"
        ctaHref="/app/sign-up"
        ctaStyle="primary"
        footnote={FOOTNOTE}
      />
      <TierCard
        name="Partner"
        tagline="Priority support + a quarterly check-in."
        description={`Same fleet, plus ${PARTNER_SUPPORT.description.charAt(0).toLowerCase()}${PARTNER_SUPPORT.description.slice(1).replace(/\.$/, "")} — a faster line and a regular pulse on the fleet as your ops shift.`}
        bands={partnerBands}
        ctaLabel="Talk to a service partner"
        ctaHref="mailto:hello@agentplain.com?subject=agentplain%20Partner%20tier%20interest"
        ctaStyle="secondary"
        footnote={FOOTNOTE}
        featured
      />
      <TierCard
        name="Max"
        tagline="Ad-hoc service partnership."
        description="For firms whose ops don't fit the productized shape — quoted to scope, not by seat. Talk to us about what you need and we'll come back with a written engagement."
        quotedNote="Quoted per engagement"
        ctaLabel="Talk to us"
        ctaHref="mailto:hello@agentplain.com?subject=agentplain%20Max%20tier%20inquiry"
        ctaStyle="secondary"
        footnote="Sales-led — no self-checkout."
      />
    </div>
  );
}

/** The guarantee line surfaces read alongside the tier grid. Derived, linked. */
export const MONEY_BACK_DAYS = MONEY_BACK_GUARANTEE_DAYS;
