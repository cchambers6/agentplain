// Canonical pricing for agentplain. ONE FLAT PRICE.
//
// Ratified by Conner: "We need flat costs. Tiering based on vertical won't
// be received by the market." The per-seat ladder with volume bands, and
// per-vertical tier assignment as a PRICE input, are retired.
//
// THE NUMBER LIVES IN `lib/billing/facts.ts` (`MONTHLY_PRICE_USD_CENTS`),
// not here. That module is the leaf SSOT with no billing/pricing imports,
// so `lib/env.ts` and this file can both read it without a cycle. This file
// re-exports it below so existing `@/lib/pricing/tiers` importers resolve
// the price unchanged.
//
// WHAT SURVIVED THE COLLAPSE, AND WHY:
//
//   * `TierName` / `TIER_ORDER` / `SELF_SERVE_TIERS` / `isSelfServeTier`
//     are NO LONGER PRICE INPUTS, but they are NOT dead. They are welded to
//     the Prisma `WorkspaceVerticalTier` enum (REGULAR/PLUS/MAX), and
//     collapsing the enum needs a migration — five migrations are already
//     stuck behind the failed `20260618000003_client_portal` and production
//     has not deployed since 2026-06-17. So the union stays.
//     Their REMAINING job is the SALES MOTION, not the price: `max` is
//     quote-based and `isSelfServeTier("max") === false` keeps law out of
//     self-serve Checkout. Widening that would put a quote-only vertical
//     on sale, which is Conner's decision and not an agent's — so this
//     change deliberately leaves the gate exactly where it was.
//
//   * `SEAT_BANDS` / `SEAT_BAND_ORDER` / `seatBandForSeats` survive for the
//     same migration reason: the Prisma `SeatBand` enum and the persisted
//     `Subscription.seatBand` / `Subscription.seats` columns cannot be
//     dropped without a migration. They are now RECORD-KEEPING ONLY. No
//     price reads them.
//
//   * `PER_SEAT_MONTHLY_USD_CENTS`, `perSeatMonthlyUsdCents`,
//     `monthlyChargeUsdCents` and `tierLadderBands` are kept as SHIMS that
//     return the flat price. Deleting them would break ~10 call sites, four
//     of which render to customers. A shim is cheaper than that cascade.
//
// Stripe Products + Prices are still resolved by `lookup_key`, never by
// hardcoded id, so this file stays the single source of truth and the setup
// script stays idempotent against rerun. `lookupKeyFor()` now returns ONE
// canonical flat key; `legacyLookupKeyFor()` + `LEGACY_LOOKUP_KEYS` retain
// the 15 retired keys so `lib/billing/webhook-dispatch.ts` can keep parsing
// webhooks for subscriptions that were created before this change.

import type { SeatBand, WorkspaceVerticalTier } from "@prisma/client";
// Price + trial / money-back facts live in the billing SSOT and are
// re-exported below so existing `@/lib/pricing/tiers` importers keep
// working unchanged.
import {
  ANNUAL_PRICE_USD_CENTS,
  MONEY_BACK_GUARANTEE_DAYS,
  MONTHLY_PRICE_USD_CENTS,
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
  monthlyPriceUsdCents,
  trialPeriodDaysForVertical,
} from "@/lib/billing/facts";

// The price SSOT, re-exported for the existing importer surface.
export {
  ANNUAL_PRICE_USD_CENTS,
  MONEY_BACK_GUARANTEE_DAYS,
  MONTHLY_PRICE_USD_CENTS,
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
  monthlyPriceUsdCents,
  trialPeriodDaysForVertical,
};

// ── Tier identity (NOT a price input) ──────────────────────────────────────

// Vestigial as a price dimension; live as a sales-motion + DB-identity
// dimension. Mirrors the Prisma `WorkspaceVerticalTier` enum, which cannot
// be collapsed without a migration (see header).
export type TierName = "regular" | "plus" | "max";

export const TIER_ORDER: readonly TierName[] = ["regular", "plus", "max"];

// Tiers a customer can self-serve subscribe to via Stripe Checkout. `max`
// stays quote-based: it is a DIFFERENT SALES MOTION, not a different price.
// `/custom` bespoke scope ($5K-$15K + maintenance) is a genuinely different
// product and is unaffected by the flat-price change.
//
// DELIBERATELY UNCHANGED by the flat-price collapse. Flat pricing dissolves
// the PRICE half of the tier concept, not the quote-only gate. Widening this
// to include `max` would make law (the max-tier vertical) self-serve
// purchasable — putting a vertical on sale, which is Conner's call.
export const SELF_SERVE_TIERS: readonly TierName[] = ["regular", "plus"];

export function isSelfServeTier(t: TierName): boolean {
  return SELF_SERVE_TIERS.includes(t);
}

// ── Seat bands (RECORD-KEEPING ONLY — no longer price-bearing) ──────────────

// VESTIGIAL FOR PRICING. `enum SeatBand`, `Subscription.seatBand` and
// `Subscription.seats` remain in `prisma/schema.prisma` and are still
// written, because dropping them requires a migration and the migration
// lane is blocked behind the failed `20260618000003_client_portal`
// (five migrations queued; production last deployed 2026-06-17). Nothing
// below is read to compute a price any more.
export const SEAT_BAND_ORDER: readonly SeatBand[] = [
  "SEATS_1",
  "SEATS_2_9",
  "SEATS_10_24",
  "SEATS_25_49",
  "SEATS_50_99",
];

export interface SeatBandRange {
  band: SeatBand;
  minSeats: number;
  maxSeats: number;
  /** Human-friendly band label, e.g. "1 seat" / "2–9 seats". */
  label: string;
}

export const SEAT_BANDS: Record<SeatBand, SeatBandRange> = {
  SEATS_1: { band: "SEATS_1", minSeats: 1, maxSeats: 1, label: "1 seat" },
  SEATS_2_9: { band: "SEATS_2_9", minSeats: 2, maxSeats: 9, label: "2–9 seats" },
  SEATS_10_24: {
    band: "SEATS_10_24",
    minSeats: 10,
    maxSeats: 24,
    label: "10–24 seats",
  },
  SEATS_25_49: {
    band: "SEATS_25_49",
    minSeats: 25,
    maxSeats: 49,
    label: "25–49 seats",
  },
  SEATS_50_99: {
    band: "SEATS_50_99",
    minSeats: 50,
    maxSeats: 99,
    label: "50–99 seats",
  },
};

// ── Price accessors (all flat; tier + seat arguments are vestigial) ─────────

/**
 * SHIM. Every cell is the one flat price. Retained because eight modules
 * still read it, four of them customer-rendering. Reading any cell is
 * equivalent to reading `MONTHLY_PRICE_USD_CENTS` — the shape survives so
 * the copy PR can retire the call sites one at a time.
 *
 * @deprecated Read `MONTHLY_PRICE_USD_CENTS` from `@/lib/billing/facts`.
 */
export const PER_SEAT_MONTHLY_USD_CENTS: Record<
  TierName,
  Record<SeatBand, number>
> = Object.fromEntries(
  TIER_ORDER.map((tier) => [
    tier,
    Object.fromEntries(
      SEAT_BAND_ORDER.map((band) => [band, MONTHLY_PRICE_USD_CENTS]),
    ) as Record<SeatBand, number>,
  ]),
) as Record<TierName, Record<SeatBand, number>>;

export interface TierLadderRow {
  band: string;
  /** Whole-dollar price formatted for display, e.g. "$99". */
  price: string;
}

/**
 * SHIM. The ladder is now a single rung. Returns ONE row so the marketing
 * renderers that `.map()` over it keep working while showing one price.
 *
 * @deprecated The concept of a ladder is retired. Render the flat price.
 */
export function tierLadderBands(_tier?: TierName): TierLadderRow[] {
  return [
    { band: "Flat monthly", price: `$${MONTHLY_PRICE_USD_CENTS / 100}` },
  ];
}

/**
 * Seat band for a seat count. RECORD-KEEPING ONLY — no price reads this.
 * Still throws above the ladder so seat input validation keeps its shape.
 */
export function seatBandForSeats(seats: number): SeatBand {
  if (seats < 1) {
    throw new Error(`seatBandForSeats: seats must be >= 1, got ${seats}`);
  }
  if (seats >= 100) {
    throw new Error(
      "seatBandForSeats: 100+ seats falls outside the recorded seat bands " +
        "— route to a custom engagement.",
    );
  }
  if (seats === 1) return "SEATS_1";
  if (seats <= 9) return "SEATS_2_9";
  if (seats <= 24) return "SEATS_10_24";
  if (seats <= 49) return "SEATS_25_49";
  return "SEATS_50_99";
}

/**
 * SHIM. Arguments are ignored; the price is flat.
 *
 * @deprecated Call `monthlyPriceUsdCents()` from `@/lib/billing/facts`.
 */
export function perSeatMonthlyUsdCents(
  _tier?: TierName,
  _band?: SeatBand,
): number {
  return MONTHLY_PRICE_USD_CENTS;
}

/**
 * The monthly charge. FLAT — independent of tier and of seat count.
 *
 * Kept (rather than deleted) because it has six call sites, four of which
 * render to a customer: the billing settings page, the usage page, the
 * dunning mailer and the trial-expiration warning mailer. The return shape
 * is preserved so none of them need to change in this PR.
 *
 * `perSeatCents` and `totalCents` are now EQUAL and both equal the flat
 * price. `band` is reported for record-keeping only.
 *
 * Behaviour change: this no longer throws at 100+ seats. Under a flat price
 * a 100-seat workspace owes exactly the same $99, so throwing would break
 * four rendering surfaces to defend a ladder that no longer exists. The
 * recorded band clamps to the top band instead.
 */
export function monthlyChargeUsdCents(
  _tier?: TierName,
  seats?: number,
): { band: SeatBand; perSeatCents: number; totalCents: number } {
  const n = typeof seats === "number" && seats >= 1 ? seats : 1;
  const band = seatBandForSeats(Math.min(n, 99));
  return {
    band,
    perSeatCents: MONTHLY_PRICE_USD_CENTS,
    totalCents: MONTHLY_PRICE_USD_CENTS,
  };
}

// ── Stripe lookup keys ─────────────────────────────────────────────────────

/**
 * The ONE canonical Stripe `lookup_key` for the flat monthly Price.
 * `scripts/stripe/setup-products.ts` is the only writer.
 */
export const FLAT_MONTHLY_LOOKUP_KEY = "agentplain_flat_monthly";

/** The Stripe Product lookup key backing the flat Price. */
export const FLAT_PRODUCT_LOOKUP_KEY = "agentplain_flat";

/**
 * The canonical lookup key. Arguments are accepted and IGNORED so the
 * existing `priceIdFor(tier, band)` provider signatures keep compiling;
 * every (tier, band) now resolves to the single flat Price.
 */
export function lookupKeyFor(_tier?: TierName, _band?: SeatBand): string {
  return FLAT_MONTHLY_LOOKUP_KEY;
}

export function allLookupKeys(): { key: string }[] {
  return [{ key: FLAT_MONTHLY_LOOKUP_KEY }];
}

// ── Retired lookup keys — BACK-COMPAT WINDOW, DO NOT DELETE ────────────────
//
// Subscriptions created before the flat-price change carry Prices whose
// `lookup_key` is one of the 15 retired `agentplain_<tier>_<band>_monthly`
// strings. Stripe keeps sending those on every webhook for the life of the
// subscription. `lib/billing/webhook-dispatch.ts` parses them, so these
// must survive until every legacy subscription has been migrated in Stripe.

/** The retired per-(tier, band) key shape. Parsing only — never issued. */
export function legacyLookupKeyFor(tier: TierName, band: SeatBand): string {
  return `agentplain_${tier}_${band.toLowerCase()}_monthly`;
}

/**
 * How many keys were ever issued under the retired shape. A CLOSED SET.
 * 3 tiers x 5 seat bands were live from the first Stripe setup run until
 * the flat-price collapse; no sixteenth key was ever issued, so this
 * number can never legitimately grow OR shrink.
 */
export const LEGACY_LOOKUP_KEY_COUNT = 15;

/**
 * All 15 retired keys, with the tier and band each one decodes to.
 *
 * ===================================================================
 * FROZEN LITERAL. DO NOT DERIVE THIS FROM `TIER_ORDER`, FROM
 * `SEAT_BAND_ORDER`, FROM `legacyLookupKeyFor()`, OR FROM ANY OTHER
 * PRESENT-DAY CONSTANT. DO NOT REMOVE AN ENTRY.
 * ===================================================================
 *
 * WHY THIS IS WRITTEN OUT LONGHAND INSTEAD OF GENERATED:
 *
 * This list is not a description of what agentplain sells. It is a
 * description of WHAT STRIPE ALREADY HOLDS -- a fixed historical fact
 * about rows in someone else's database that we cannot edit and did not
 * write. It is data about the past.
 *
 * It was previously built as:
 *
 *     TIER_ORDER.flatMap((tier) =>
 *       SEAT_BAND_ORDER.map((band) => ...))
 *
 * which quietly made a historical fact a FUNCTION OF TODAY'S CONSTANTS.
 * Both of those arrays are documented three screens above as vestigial,
 * surviving only because the Prisma enums they mirror cannot be dropped
 * until the migration lane unblocks. A cleanup migration collapsing
 * `WorkspaceVerticalTier` is anticipated, not hypothetical -- and on the
 * day someone trims `TIER_ORDER` to one member, the derived list would
 * have silently gone from 15 keys to 5. Nothing would throw. Stripe
 * would keep sending the other 10 forever, `tierFromLookupKey` would
 * start returning `null` for them, and both call sites in
 * `lib/billing/webhook-dispatch.ts` fall back to workspace defaults on
 * `null` -- so every legacy workspace on a dropped tier would have its
 * tier and seat band silently RESET on its next Stripe webhook. Silent,
 * data-corrupting, and indistinguishable from normal operation.
 *
 * Writing the keys out as literals removes that coupling entirely: a
 * future collapse of `TIER_ORDER` or `SEAT_BAND_ORDER` now CANNOT reach
 * this set. `Object.freeze` blocks the runtime shrink (`.pop()`,
 * `.splice()`) as well. The count and the parseability of every entry
 * are pinned in `tests/billing-lookup-key-backcompat.test.ts`, which
 * runs on every PR via `.github/workflows/tests.yml`.
 *
 * `legacyLookupKeyFor()` above is retained for callers that need to
 * FORMAT a key, and the test cross-checks it against these literals --
 * but this array must never be built from it. If the two ever disagree,
 * THESE LITERALS ARE RIGHT, because Stripe holds these exact strings.
 */
export const LEGACY_LOOKUP_KEYS: readonly {
  tier: TierName;
  band: SeatBand;
  key: string;
}[] = Object.freeze([
  Object.freeze({
    tier: "regular" as TierName,
    band: "SEATS_1" as SeatBand,
    key: "agentplain_regular_seats_1_monthly",
  }),
  Object.freeze({
    tier: "regular" as TierName,
    band: "SEATS_2_9" as SeatBand,
    key: "agentplain_regular_seats_2_9_monthly",
  }),
  Object.freeze({
    tier: "regular" as TierName,
    band: "SEATS_10_24" as SeatBand,
    key: "agentplain_regular_seats_10_24_monthly",
  }),
  Object.freeze({
    tier: "regular" as TierName,
    band: "SEATS_25_49" as SeatBand,
    key: "agentplain_regular_seats_25_49_monthly",
  }),
  Object.freeze({
    tier: "regular" as TierName,
    band: "SEATS_50_99" as SeatBand,
    key: "agentplain_regular_seats_50_99_monthly",
  }),
  Object.freeze({
    tier: "plus" as TierName,
    band: "SEATS_1" as SeatBand,
    key: "agentplain_plus_seats_1_monthly",
  }),
  Object.freeze({
    tier: "plus" as TierName,
    band: "SEATS_2_9" as SeatBand,
    key: "agentplain_plus_seats_2_9_monthly",
  }),
  Object.freeze({
    tier: "plus" as TierName,
    band: "SEATS_10_24" as SeatBand,
    key: "agentplain_plus_seats_10_24_monthly",
  }),
  Object.freeze({
    tier: "plus" as TierName,
    band: "SEATS_25_49" as SeatBand,
    key: "agentplain_plus_seats_25_49_monthly",
  }),
  Object.freeze({
    tier: "plus" as TierName,
    band: "SEATS_50_99" as SeatBand,
    key: "agentplain_plus_seats_50_99_monthly",
  }),
  Object.freeze({
    tier: "max" as TierName,
    band: "SEATS_1" as SeatBand,
    key: "agentplain_max_seats_1_monthly",
  }),
  Object.freeze({
    tier: "max" as TierName,
    band: "SEATS_2_9" as SeatBand,
    key: "agentplain_max_seats_2_9_monthly",
  }),
  Object.freeze({
    tier: "max" as TierName,
    band: "SEATS_10_24" as SeatBand,
    key: "agentplain_max_seats_10_24_monthly",
  }),
  Object.freeze({
    tier: "max" as TierName,
    band: "SEATS_25_49" as SeatBand,
    key: "agentplain_max_seats_25_49_monthly",
  }),
  Object.freeze({
    tier: "max" as TierName,
    band: "SEATS_50_99" as SeatBand,
    key: "agentplain_max_seats_50_99_monthly",
  }),
]);

// ── Tier <-> Prisma enum bridge ────────────────────────────────────────────
//
// Unchanged. The Prisma `WorkspaceVerticalTier` enum still has three
// members and cannot lose one without a migration, so both directions stay
// total. Under flat pricing the value no longer selects a price; it records
// which sales motion the workspace arrived through.

const TIER_FROM_VERTICAL_TIER: Record<WorkspaceVerticalTier, TierName> = {
  REGULAR: "regular",
  PLUS: "plus",
  MAX: "max",
};

const VERTICAL_TIER_FROM_TIER: Record<TierName, WorkspaceVerticalTier> = {
  regular: "REGULAR",
  plus: "PLUS",
  max: "MAX",
};

export function tierFromVerticalTier(t: WorkspaceVerticalTier): TierName {
  return TIER_FROM_VERTICAL_TIER[t];
}

export function verticalTierFromTier(t: TierName): WorkspaceVerticalTier {
  return VERTICAL_TIER_FROM_TIER[t];
}

// ── Trial warnings + display naming ────────────────────────────────────────

// Trial-end warning thresholds (days remaining). Cron at 06:00 ET emits
// one in-app banner + one email per threshold per subscription.
export const TRIAL_WARNING_THRESHOLDS_DAYS: readonly number[] = [7, 3, 1];

// Customer-facing tier name. The DB enum is regular/plus/max for stable
// identity; the marketing/app surface renders "Partner" for plus per the
// 2026-05-15 brand decision.
const TIER_DISPLAY_NAME: Record<TierName, string> = {
  regular: "Regular",
  plus: "Partner",
  max: "Max",
};

export function tierDisplayName(tier: TierName): string {
  return TIER_DISPLAY_NAME[tier];
}

export function tierProductName(_tier?: TierName): string {
  return "agentplain";
}

export function tierProductLookupKey(_tier?: TierName): string {
  return FLAT_PRODUCT_LOOKUP_KEY;
}

// Headline tagline. Ratified 2026-06-14: Partner does not include reserved
// Conner hours. NOTE: these describe tier DIFFERENCES that flat pricing has
// dissolved for regular/plus. Rewriting them is customer copy and belongs to
// the follow-up copy PR, not to this engine change.
export const TIER_TAGLINE: Record<TierName, string> = {
  regular: "Standard managed AI ops + onboarding bundled.",
  plus: "Everything in Regular, plus priority support and a quarterly async check-in with your service team.",
  max: "Quote-based engagement. High-intensity, multi-state, white-label, or dedicated team.",
};
