// Single source of truth for agentplain's billing-policy FACTS.
//
// Every customer-facing surface that states a billing mechanic — marketing
// copy, the pricing page, the signup form, billing settings, the ToS /
// guarantee pages, lifecycle emails, and the env defaults — must read these
// constants instead of hardcoding their own number or sentence. When a policy
// changes, it changes here once and propagates.
//
// Ratified policy (2026-06-14, `feedback`/`project_truth_wave_trial_policy`):
//   * Card captured at signup via Stripe Checkout (default ON).
//   * 7-day trial by default; CPA + Law get 14 days (one full slow-cadence
//     cycle to deliver value before billing starts).
//   * 14-day money-back guarantee, independent of trial length.
//   * Cancel anytime.
//   * Conner-time (named human service hours) is a Max / Custom benefit ONLY.
//     Partner gets priority email/chat support + a quarterly async check-in —
//     NEVER reserved Conner hours or scheduled Conner calls.
//
// This module is a LEAF: it imports nothing from the rest of the billing /
// pricing layer so any module (including `lib/env.ts` and `lib/pricing/
// tiers.ts`) can import it without a cycle. `lib/pricing/tiers.ts` re-exports
// the trial / money-back constants below so existing importers keep working.

// ── Price ────────────────────────────────────────────────────────────────
//
// FLAT PRICE. Ratified by Conner: "We need flat costs. Tiering based on
// vertical won't be received by the market." Per-seat rates and volume
// bands are retired; there is ONE price and it lives on the next line.
//
// $99/month = $1,188/year. Derived against measured delivered value and
// anchored to the WEAKEST vertical, not the strongest — law floor
// $3,000/yr (2.5x), real-estate floor $4,000/yr (3.4x), CPA floor
// $7,000/yr (5.9x). $149/mo would put a law customer at the floor at
// 1.7x, which does not survive a budget review.
//
// CHANGING THIS NUMBER IS CONNER'S CALL, NOT AN AGENT'S. It is pinned in
// `tests/billing-pricing.test.ts` so a silent edit fails the gate.

/** The one price. Monthly, in USD cents, for every customer and every vertical. */
export const MONTHLY_PRICE_USD_CENTS = 9900;

/** Annualised list price in USD cents (12 x monthly). No annual discount. */
export const ANNUAL_PRICE_USD_CENTS = MONTHLY_PRICE_USD_CENTS * 12;

/**
 * The flat monthly charge in USD cents. Takes no arguments BY DESIGN — the
 * price does not vary by tier, seat count, seat band, or vertical. Callers
 * that still thread a tier or a seat count are passing vestigial arguments.
 */
export function monthlyPriceUsdCents(): number {
  return MONTHLY_PRICE_USD_CENTS;
}

/** Pricing model discriminator. Was "per-seat-banded" before the flat-price ratification. */
export const PRICING_MODEL = "flat-monthly" as const;

// ── Trial ────────────────────────────────────────────────────────────────

/** Default trial length in days (ratified 2026-06-14). */
export const TRIAL_PERIOD_DAYS = 7;

/** Extended trial for slow-cadence verticals (CPA + Law). */
export const TRIAL_PERIOD_DAYS_EXTENDED = 14;

/**
 * Vertical slugs that receive the extended 14-day trial. Compared
 * case-insensitively against the slug returned by the signup form.
 */
export const EXTENDED_TRIAL_VERTICAL_SLUGS: ReadonlySet<string> = new Set([
  "cpa",
  "law",
]);

/** Trial length for a given vertical slug. CPA/Law → 14, everything else → 7. */
export function trialPeriodDaysForVertical(verticalSlug: string): number {
  return EXTENDED_TRIAL_VERTICAL_SLUGS.has(verticalSlug.toLowerCase())
    ? TRIAL_PERIOD_DAYS_EXTENDED
    : TRIAL_PERIOD_DAYS;
}

// ── Guarantee + signup mechanics ───────────────────────────────────────────

/** Money-back window in days, measured from first charge. Operator-processed. */
export const MONEY_BACK_GUARANTEE_DAYS = 14;

/** Card is captured at signup (Stripe Checkout) by default. */
export const CARD_REQUIRED_AT_SIGNUP = true;

/** Subscriptions can be cancelled at any time, effective end of period. */
export const CANCEL_ANYTIME = true;

// ── Human-service ("Conner-time") policy ───────────────────────────────────

/**
 * Tiers (by on-disk enum identity) that include named human service hours.
 * Max only. `plus` (customer-facing "Partner") and `regular` do NOT.
 */
export const CONNER_TIME_TIERS: ReadonlySet<string> = new Set(["max"]);

/** Whether a tier (regular | plus | max) includes named human service hours. */
export function includesConnerTime(tier: string): boolean {
  return CONNER_TIME_TIERS.has(tier.toLowerCase());
}

/**
 * The Partner-tier support model. NO reserved Conner hours, NO scheduled
 * Conner calls — priority email/chat + a quarterly async check-in template.
 * Surfaces (pricing card, ROI calc, marketing) read this so the description
 * never drifts back to the retired "4 reserved hours" framing.
 */
export const PARTNER_SUPPORT = {
  channels: ["email", "chat"] as const,
  supportEmail: "hello@agentplain.com",
  quarterlyAsyncCheckIn: true,
  includesConnerTime: false,
  description:
    "Priority email/chat support and a quarterly async check-in with your service team.",
} as const;

// ── Aggregate ──────────────────────────────────────────────────────────────

/** Convenience bundle for surfaces that want the whole policy at once. */
export const BILLING_FACTS = {
  pricingModel: PRICING_MODEL,
  monthlyPriceUsdCents: MONTHLY_PRICE_USD_CENTS,
  annualPriceUsdCents: ANNUAL_PRICE_USD_CENTS,
  trialPeriodDays: TRIAL_PERIOD_DAYS,
  trialPeriodDaysExtended: TRIAL_PERIOD_DAYS_EXTENDED,
  extendedTrialVerticalSlugs: EXTENDED_TRIAL_VERTICAL_SLUGS,
  moneyBackGuaranteeDays: MONEY_BACK_GUARANTEE_DAYS,
  cardRequiredAtSignup: CARD_REQUIRED_AT_SIGNUP,
  cancelAnytime: CANCEL_ANYTIME,
  connerTimeTiers: CONNER_TIME_TIERS,
  partnerSupport: PARTNER_SUPPORT,
} as const;
