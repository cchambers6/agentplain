import { TierCard } from "@/components/marketing/HomeCards";
import {
  ANNUAL_PRICE_USD_CENTS,
  MONTHLY_PRICE_USD_CENTS,
  TRIAL_PERIOD_DAYS,
  MONEY_BACK_GUARANTEE_DAYS,
  PARTNER_SUPPORT,
} from "@/lib/billing/facts";

// The pricing block, as one reusable teaser.
//
// WAS a three-column grid (Regular / Partner / Max), each column rendering a
// five-row per-seat volume ladder from `tierLadderBands()`. Under flat pricing
// that produced TWO IDENTICAL PRICE COLUMNS — Regular and Partner both showing
// a single "$99 /seat/mo" row — while still presenting as a tier comparison.
// Nothing failed; the grid just stopped saying anything.
//
// Now: ONE price, plus the quoted-engagement path for firms that are scoped
// rather than checked out. `PARTNER_SUPPORT` still renders because priority
// support and the quarterly check-in are a real difference in SERVICE — they
// are simply not a difference in PRICE, so they read as an included feature
// line rather than a second column with a second number.
//
// Every number is DERIVED from `lib/billing/facts.ts`, so no surface that
// renders this component can drift from billing truth.

const FOOTNOTE = `${TRIAL_PERIOD_DAYS}-day free trial. Month-to-month. One flat price.`;

export function PriceTiers() {
  const monthly = `$${MONTHLY_PRICE_USD_CENTS / 100}`;
  const annual = (ANNUAL_PRICE_USD_CENTS / 100).toLocaleString("en-US");

  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-2">
      <TierCard
        name="The subscription"
        tagline="One price. Any size firm."
        description={`Our team installs the fleet, configures it for your vertical, and runs a monthly review. Day-to-day, the fleet drafts inside the workspace you log into. ${PARTNER_SUPPORT.description} Add as many people as you like — the price does not move.`}
        price={monthly}
        priceNote={`a month · $${annual} a year · any team size`}
        ctaLabel="Start free trial"
        ctaHref="/app/sign-up"
        ctaStyle="primary"
        footnote={FOOTNOTE}
        featured
      />
      <TierCard
        name="Scoped engagement"
        tagline="When your operation needs more than the standard shape."
        description="Some firms — law and RIA especially — are scoped rather than bought off the page: different cadence, different deliverables, a written engagement. Tell us what you need and we'll come back with one."
        quotedNote="Quoted to scope"
        ctaLabel="Talk to us"
        ctaHref="mailto:hello@agentplain.com?subject=agentplain%20engagement%20inquiry"
        ctaStyle="secondary"
        footnote="Sales-led — no self-checkout."
      />
    </div>
  );
}

/** The guarantee line surfaces read alongside the tier grid. Derived, linked. */
export const MONEY_BACK_DAYS = MONEY_BACK_GUARANTEE_DAYS;
