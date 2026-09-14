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
// SUPERSEDED BY RATIFICATION 2026-09-14, NOT YET BY CODE. Conner
// ratified PER SEAT, FLAT BANDS: a seat
// count multiplies by its band's rate, and the WHOLE bill is charged at
// that one rate. These are NOT tax-style graduated brackets — a 10-seat
// workspace pays 10 x $81, not 1 x $99 + 8 x $89 + 1 x $81. See
// `SEAT_RATE_BANDS` below.
//
// What survived the 2026-06 flat-price ratification, and why it is not
// contradicted: Conner's objection was to "tiering based on VERTICAL."
// Every vertical still pays the same rate at the same seat count. The
// only price input is seat count.
//
// $99/month = $1,188/year AT ONE SEAT ONLY. Under per-seat banding the
// annual figure is a function of seat count; any surface quoting a bare
// "$1,188/yr" is quoting the 1-seat case and must say so.
// Derived against measured delivered value and
// anchored to the WEAKEST vertical, not the strongest — law floor
// $3,000/yr (2.5x), real-estate floor $4,000/yr (3.4x), CPA floor
// $7,000/yr (5.9x). $149/mo would put a law customer at the floor at
// 1.7x, which does not survive a budget review.
//
// CHANGING THIS NUMBER IS CONNER'S CALL, NOT AN AGENT'S. It is pinned in
// `tests/billing-pricing.test.ts` so a silent edit fails the gate.

/**
 * The HEADLINE rate: USD cents, per seat, per month, at ONE seat.
 *
 * This is the number on the pricing page and the top of the rate table.
 * It is NOT "the price of a subscription" any more — a subscription's
 * price is `monthlyTotalUsdCents(seats)`. Kept under its original name
 * and value (9900) because ~38 surfaces read it and, at one seat, it is
 * still exactly right. Pinned in `tests/billing-pricing.test.ts`.
 */
export const MONTHLY_PRICE_USD_CENTS = 9900;

/**
 * Annualised list price in USD cents at ONE seat (12 x headline). No
 * annual discount. For a real workspace use
 * `monthlyTotalUsdCents(seats) * 12`.
 */
export const ANNUAL_PRICE_USD_CENTS = MONTHLY_PRICE_USD_CENTS * 12;

/**
 * The headline per-seat rate in USD cents, at one seat.
 *
 * PRESERVED SIGNATURE, NARROWED MEANING. This used to be "the whole
 * bill." Under per-seat banding it is the 1-seat rate. Every caller that
 * wants what a workspace actually owes must call `monthlyTotalUsdCents`.
 *
 * @deprecated for totals. Use `monthlyTotalUsdCents(seats)`. Still
 * correct as the headline/"from" figure and as the 1-seat price.
 */
export function monthlyPriceUsdCents(): number {
  return MONTHLY_PRICE_USD_CENTS;
}

/**
 * Pricing model discriminator — describes WHAT THE ENGINE DOES, not what
 * has been ratified.
 *
 * Still "flat-monthly" on purpose. The per-seat rate table below is
 * ratified and defined, but no code path reads it yet: Stripe quantity is
 * still pinned to 1 and `lookupKeyFor()` still resolves one flat Price.
 * This constant flips to "per-seat-flat-bands" in the engine PR that
 * actually rewires those, so that at no point does the discriminator
 * disagree with what a customer is charged.
 */
export const PRICING_MODEL = "flat-monthly" as const;

// ── Per-seat rate table (ratified 2026-09-14) ────────────────────────────
//
// NOTHING READS THIS YET. It is landed ahead of the engine change so the
// rates and the no-inversion guard can be reviewed on their own, without
// a Stripe-facing diff in the same PR. `PRICING_MODEL` above is still
// "flat-monthly" and that is accurate: until the engine PR lands, every
// customer is still billed one flat $99.
//
// FLAT BANDS, NOT GRADUATED BRACKETS. A workspace's entire bill is
// `seats x rate(seats)`. Crossing a boundary reprices every seat.
//
// That makes an inverted table a live risk: if a band's rate falls far
// enough, the first seat count in the higher band can cost LESS than the
// last seat count in the lower one, and a customer is rewarded for
// buying a seat they do not need. The rates below were chosen so every
// boundary rises:
//
//   9 x $89 = $801   ->  10 x $81 = $810   (+$9)
//   24 x $81 = $1944 ->  25 x $78 = $1950  (+$6)
//   49 x $78 = $3822 ->  50 x $77 = $3850  (+$28)
//   1 x $99 = $99    ->   2 x $89 = $178   (+$79)
//
// The 24->25 boundary clears by $6/month. It is the tightest seam in the
// table: dropping the 25-49 rate to $77 would invert it. DO NOT EDIT A
// RATE WITHOUT RE-RUNNING `tests/billing-seat-rate-table.test.ts`, which
// checks every adjacent seat pair from 1 to 99, not just the four
// boundaries.
//
// Band boundaries deliberately match the Prisma `SeatBand` enum exactly,
// so no migration is required. That alignment is asserted in the test.

/** One rung of the per-seat rate table. */
export interface SeatRateBand {
  /** Prisma `SeatBand` enum member name. */
  readonly band: "SEATS_1" | "SEATS_2_9" | "SEATS_10_24" | "SEATS_25_49" | "SEATS_50_99";
  readonly minSeats: number;
  readonly maxSeats: number;
  /** USD cents per seat per month. Applied to EVERY seat, not just those in band. */
  readonly monthlyUsdCentsPerSeat: number;
}

/** The rate table. Ordered ascending by seat count; ranges are contiguous. */
export const SEAT_RATE_BANDS: readonly SeatRateBand[] = Object.freeze([
  Object.freeze({ band: "SEATS_1" as const, minSeats: 1, maxSeats: 1, monthlyUsdCentsPerSeat: 9900 }),
  Object.freeze({ band: "SEATS_2_9" as const, minSeats: 2, maxSeats: 9, monthlyUsdCentsPerSeat: 8900 }),
  Object.freeze({ band: "SEATS_10_24" as const, minSeats: 10, maxSeats: 24, monthlyUsdCentsPerSeat: 8100 }),
  Object.freeze({ band: "SEATS_25_49" as const, minSeats: 25, maxSeats: 49, monthlyUsdCentsPerSeat: 7800 }),
  Object.freeze({ band: "SEATS_50_99" as const, minSeats: 50, maxSeats: 99, monthlyUsdCentsPerSeat: 7700 }),
]);

/** Highest seat count the self-serve rate table covers. Above this: quote. */
export const MAX_SELF_SERVE_SEATS = 99;

/**
 * The rate band for a seat count.
 *
 * Throws below 1 and ABOVE `MAX_SELF_SERVE_SEATS` — deliberately, and
 * this is a behaviour change worth stating plainly. Under flat pricing a
 * 100-seat workspace owed the same $99 as a 1-seat workspace, so callers
 * clamped to the top band and moved on. Under per-seat banding that
 * clamp silently UNDERBILLS: a 150-seat workspace recorded as
 * `SEATS_50_99` prices as if it had at most 99 seats.
 *
 * 100+ is a quoted engagement. Callers must handle the throw and route
 * to sales rather than clamping.
 */
export function seatRateBandFor(seats: number): SeatRateBand {
  if (!Number.isInteger(seats)) {
    throw new Error(`seatRateBandFor: seats must be an integer, got ${seats}`);
  }
  if (seats < 1) {
    throw new Error(`seatRateBandFor: seats must be >= 1, got ${seats}`);
  }
  if (seats > MAX_SELF_SERVE_SEATS) {
    throw new Error(
      `seatRateBandFor: ${seats} seats is above the self-serve rate table ` +
        `(max ${MAX_SELF_SERVE_SEATS}). 100+ seats is a quoted engagement — ` +
        `route to sales instead of clamping, which would underbill.`,
    );
  }
  const row = SEAT_RATE_BANDS.find(
    (b) => seats >= b.minSeats && seats <= b.maxSeats,
  );
  if (!row) {
    // Unreachable while the table stays contiguous; the test pins that.
    throw new Error(`seatRateBandFor: no band covers ${seats} seats`);
  }
  return row;
}

/** USD cents per seat per month for a seat count. */
export function perSeatMonthlyUsdCentsFor(seats: number): number {
  return seatRateBandFor(seats).monthlyUsdCentsPerSeat;
}

/**
 * What a workspace of `seats` owes per month, in USD cents.
 * THIS is the subscription price. `MONTHLY_PRICE_USD_CENTS` is not.
 */
export function monthlyTotalUsdCents(seats: number): number {
  return seatRateBandFor(seats).monthlyUsdCentsPerSeat * seats;
}

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
  /** Headline (1-seat) rate. NOT a subscription total — see seatRateBands. */
  monthlyPriceUsdCents: MONTHLY_PRICE_USD_CENTS,
  annualPriceUsdCents: ANNUAL_PRICE_USD_CENTS,
  seatRateBands: SEAT_RATE_BANDS,
  maxSelfServeSeats: MAX_SELF_SERVE_SEATS,
  trialPeriodDays: TRIAL_PERIOD_DAYS,
  trialPeriodDaysExtended: TRIAL_PERIOD_DAYS_EXTENDED,
  extendedTrialVerticalSlugs: EXTENDED_TRIAL_VERTICAL_SLUGS,
  moneyBackGuaranteeDays: MONEY_BACK_GUARANTEE_DAYS,
  cardRequiredAtSignup: CARD_REQUIRED_AT_SIGNUP,
  cancelAnytime: CANCEL_ANYTIME,
  connerTimeTiers: CONNER_TIME_TIERS,
  partnerSupport: PARTNER_SUPPORT,
} as const;
