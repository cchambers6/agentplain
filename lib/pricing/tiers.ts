// Canonical per-seat pricing ladder for agentplain.
//
// Source of truth: orchestrator memory `project_stripe_both_surfaces.md`
// (locked 2026-05-09). The ladder rows below mirror lines 17–26 of that
// memory exactly. Any change to this file requires a corresponding
// memory amendment AND a Stripe dashboard update via `scripts/stripe/setup-products.ts`.
//
// Stripe Products + Prices are NOT hardcoded by id — they're resolved by
// `lookup_key` (see `lookupKeyFor` below) so this file is the single
// source of truth and the setup script is idempotent against rerun.
//
// Per `feedback_no_quick_fixes`: the lookup-key strategy is the right
// fix, not the cheap one. 15 hardcoded env vars are vendor lock and
// brittle. Lookup keys live on the Price object inside Stripe and
// survive Price archival/replacement.

import type { SeatBand, WorkspaceVerticalTier } from "@prisma/client";

export type TierName = "regular" | "plus" | "max";

export const TIER_ORDER: readonly TierName[] = ["regular", "plus", "max"];

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

// project_stripe_both_surfaces lines 43–44: "First month free across all
// three tiers" via 30-day trial. The brief explicitly overrides the
// memory's "Card on file" framing to "NEVER at signup" per
// feedback_max_friction_reduction_for_trials rule #5 (no
// credit-card-required-to-see-pricing) — interpreted to extend to
// trial entry. Conflict flagged in the PR description.
export const TRIAL_PERIOD_DAYS = 30;

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

export function tierProductName(tier: TierName): string {
  return `agentplain ${capitalize(tier)}`;
}

export function tierProductLookupKey(tier: TierName): string {
  return `agentplain_${tier}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
