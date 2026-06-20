// Canonical per-seat pricing ladder for agentplain.
//
// Source of truth: orchestrator memory `project_stripe_both_surfaces.md`
// (locked 2026-05-09, three-tier customer-facing surfacing reinstated
// 2026-05-15 — Regular / Partner / Max). The ladder rows below mirror the
// underlying enum (regular / plus / max) — `plus` is the on-disk identity
// for the customer-facing "Partner" tier; the display layer renders that
// translation via `tierDisplayName` so the DB enum, Stripe Product, and
// Subscription rows stay stable while marketing copy reads "Partner".
//
// Stripe Products + Prices are NOT hardcoded by id — they're resolved by
// `lookup_key` (see `lookupKeyFor` below) so this file is the single
// source of truth and the setup script is idempotent against rerun.
//
// Max is quote-based per `project_stripe_both_surfaces.md` (2026-05-15
// amendment) — `PER_SEAT_MONTHLY_USD_CENTS.max` rows exist for SDK
// contract continuity but `isSelfServeTier` returns false for max so
// customer flows never reach Stripe Checkout for it. Max prospects flow
// through `/custom?type=max` → `Inquiry` row → operator triage → manual
// workspace provisioning.
//
// Per `feedback_no_quick_fixes`: the lookup-key strategy is the right
// fix, not the cheap one. 15 hardcoded env vars are vendor lock and
// brittle. Lookup keys live on the Price object inside Stripe and
// survive Price archival/replacement.

import type { SeatBand, WorkspaceVerticalTier } from "@prisma/client";
// Trial / money-back facts live in the billing SSOT and are re-exported below
// so existing `@/lib/pricing/tiers` importers keep working unchanged.
import {
  MONEY_BACK_GUARANTEE_DAYS,
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
  trialPeriodDaysForVertical,
} from "@/lib/billing/facts";

export type TierName = "regular" | "plus" | "max";

export const TIER_ORDER: readonly TierName[] = ["regular", "plus", "max"];

// Tiers a customer can self-serve subscribe to via Stripe Checkout. Max is
// quote-based (no Stripe Product surfaced) per the 2026-05-15 amendment to
// `project_stripe_both_surfaces.md`. Code that drives sign-up, billing-page
// upgrade CTAs, and the operator tier override consults this — direct
// equality checks against `"max"` would drift if a fourth tier landed.
export const SELF_SERVE_TIERS: readonly TierName[] = ["regular", "plus"];

export function isSelfServeTier(t: TierName): boolean {
  return SELF_SERVE_TIERS.includes(t);
}

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
  /** undefined for the open-ended top of the ladder (50–99 in current spec). */
  maxSeats: number;
  /** Human-friendly band label, e.g. "1 seat" / "2–9 seats". */
  label: string;
}

// The seat-count ranges per band. The 100+ row in the canonical table is
// handled out-of-band (custom build engagement) — not part of the
// self-serve ladder.
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

// Per-seat monthly USD price in cents. Mirrors project_stripe_both_surfaces
// lines 17–26 exactly. Cells:
//
//   Volume        Regular   Plus     Max
//   1 seat        $199      $299     $499
//   2–9           $179      $279     $449
//   10–24         $149      $249     $399
//   25–49         $119      $219     $349
//   50–99         $99       $199     $299
//
// `* 100` keeps the spec readable while persisting cents for Stripe.
export const PER_SEAT_MONTHLY_USD_CENTS: Record<
  TierName,
  Record<SeatBand, number>
> = {
  regular: {
    SEATS_1: 199 * 100,
    SEATS_2_9: 179 * 100,
    SEATS_10_24: 149 * 100,
    SEATS_25_49: 119 * 100,
    SEATS_50_99: 99 * 100,
  },
  plus: {
    SEATS_1: 299 * 100,
    SEATS_2_9: 279 * 100,
    SEATS_10_24: 249 * 100,
    SEATS_25_49: 219 * 100,
    SEATS_50_99: 199 * 100,
  },
  max: {
    SEATS_1: 499 * 100,
    SEATS_2_9: 449 * 100,
    SEATS_10_24: 399 * 100,
    SEATS_25_49: 349 * 100,
    SEATS_50_99: 299 * 100,
  },
};

// Marketing display label per seat band — the customer-facing band name
// rendered on every pricing surface ("Solo (1 seat)" reads warmer than the
// enum-derived "1 seat"). Kept here, not in the renderers, so the homepage,
// /pricing, and the vertical pricing banner all show identical band labels.
const SEAT_BAND_DISPLAY_LABEL: Record<SeatBand, string> = {
  SEATS_1: "Solo (1 seat)",
  SEATS_2_9: "2–9 seats",
  SEATS_10_24: "10–24 seats",
  SEATS_25_49: "25–49 seats",
  SEATS_50_99: "50–99 seats",
};

export interface TierLadderRow {
  band: string;
  /** Whole-dollar per-seat price formatted for display, e.g. "$199". */
  price: string;
}

// The per-seat ladder for a tier, formatted for marketing display. SINGLE
// SOURCE OF TRUTH so the homepage, /pricing, and the vertical pricing banner
// can never drift from PER_SEAT_MONTHLY_USD_CENTS. Before this helper the
// Partner 2–9 and 10–24 bands had been hand-typed $10 low on the homepage
// ($269/$239 vs the canonical $279/$249) — a silent under-quote. Deriving
// the bands makes that class of drift unrepresentable.
export function tierLadderBands(tier: TierName): TierLadderRow[] {
  return SEAT_BAND_ORDER.map((band) => ({
    band: SEAT_BAND_DISPLAY_LABEL[band],
    price: `$${PER_SEAT_MONTHLY_USD_CENTS[tier][band] / 100}`,
  }));
}

// Trial + money-back policy (ratified 2026-06-14) now lives in the billing
// SSOT `@/lib/billing/facts`. Re-exported here so the many existing
// `@/lib/pricing/tiers` importers keep resolving these names unchanged.
//   Default 7 days; CPA + Law get 14. Card captured at signup via Stripe
//   Checkout. 14-day money-back guarantee, independent of trial length.
export {
  MONEY_BACK_GUARANTEE_DAYS,
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
  trialPeriodDaysForVertical,
};

// Trial-end warning thresholds (days remaining). Cron at 06:00 ET emits
// one in-app banner + one email per threshold per subscription.
export const TRIAL_WARNING_THRESHOLDS_DAYS: readonly number[] = [7, 3, 1];

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

export function seatBandForSeats(seats: number): SeatBand {
  if (seats < 1) {
    throw new Error(`seatBandForSeats: seats must be >= 1, got ${seats}`);
  }
  if (seats >= 100) {
    throw new Error(
      "seatBandForSeats: 100+ seats falls outside the self-serve ladder " +
        "(project_stripe_both_surfaces line 26) — route to custom-build engagement.",
    );
  }
  if (seats === 1) return "SEATS_1";
  if (seats <= 9) return "SEATS_2_9";
  if (seats <= 24) return "SEATS_10_24";
  if (seats <= 49) return "SEATS_25_49";
  return "SEATS_50_99";
}

export function perSeatMonthlyUsdCents(
  tier: TierName,
  band: SeatBand,
): number {
  return PER_SEAT_MONTHLY_USD_CENTS[tier][band];
}

export function monthlyChargeUsdCents(
  tier: TierName,
  seats: number,
): { band: SeatBand; perSeatCents: number; totalCents: number } {
  const band = seatBandForSeats(seats);
  const perSeatCents = perSeatMonthlyUsdCents(tier, band);
  return { band, perSeatCents, totalCents: perSeatCents * seats };
}

// Stripe `lookup_key` for the Price object backing (tier, band) at monthly
// cadence. The prefix `agentplain_` namespaces against any future
// product Conner runs in the same Stripe account.
export function lookupKeyFor(tier: TierName, band: SeatBand): string {
  const suffix = band.toLowerCase(); // e.g. "seats_10_24"
  return `agentplain_${tier}_${suffix}_monthly`;
}

export function allLookupKeys(): { tier: TierName; band: SeatBand; key: string }[] {
  const out: { tier: TierName; band: SeatBand; key: string }[] = [];
  for (const tier of TIER_ORDER) {
    for (const band of SEAT_BAND_ORDER) {
      out.push({ tier, band, key: lookupKeyFor(tier, band) });
    }
  }
  return out;
}

// Customer-facing tier name. The DB enum is regular/plus/max for stable
// identity; the marketing/app surface renders "Partner" for plus per the
// 2026-05-15 brand decision. Stripe Product name follows the display
// translation so an operator reading invoices sees "agentplain Partner",
// not "agentplain Plus".
const TIER_DISPLAY_NAME: Record<TierName, string> = {
  regular: "Regular",
  plus: "Partner",
  max: "Max",
};

export function tierDisplayName(tier: TierName): string {
  return TIER_DISPLAY_NAME[tier];
}

export function tierProductName(tier: TierName): string {
  return `agentplain ${tierDisplayName(tier)}`;
}

export function tierProductLookupKey(tier: TierName): string {
  return `agentplain_${tier}`;
}

// Headline tagline for each tier. Ratified 2026-06-14: Partner no longer
// includes reserved Conner hours — it is self-serve + AI + priority email
// + quarterly async check-in template. Conner time is Max/Custom only.
export const TIER_TAGLINE: Record<TierName, string> = {
  regular: "Standard managed AI ops + onboarding bundled.",
  plus: "Everything in Regular, plus priority support and a quarterly async check-in with your service team.",
  max: "Quote-based engagement. High-intensity, multi-state, white-label, or dedicated team.",
};
