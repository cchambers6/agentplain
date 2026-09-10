// Flat-price sanity.
//
// agentplain has ONE price. This file used to pin all 15 cells of a
// per-seat volume ladder; the ladder is retired. What replaces it is a
// much smaller and much sharper contract: the price is 9900 cents, it is
// the same for every tier, every seat count and every vertical, and it
// comes from `lib/billing/facts.ts` rather than from `lib/pricing/tiers.ts`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ANNUAL_PRICE_USD_CENTS,
  BILLING_FACTS,
  CARD_REQUIRED_AT_SIGNUP,
  MONEY_BACK_GUARANTEE_DAYS,
  MONTHLY_PRICE_USD_CENTS,
  PRICING_MODEL,
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
  monthlyPriceUsdCents,
  trialPeriodDaysForVertical,
} from "@/lib/billing/facts";
import {
  FLAT_MONTHLY_LOOKUP_KEY,
  FLAT_PRODUCT_LOOKUP_KEY,
  LEGACY_LOOKUP_KEYS,
  PER_SEAT_MONTHLY_USD_CENTS,
  SEAT_BANDS,
  SEAT_BAND_ORDER,
  SELF_SERVE_TIERS,
  TIER_ORDER,
  TIER_TAGLINE,
  TRIAL_WARNING_THRESHOLDS_DAYS,
  allLookupKeys,
  isSelfServeTier,
  lookupKeyFor,
  monthlyChargeUsdCents,
  perSeatMonthlyUsdCents,
  seatBandForSeats,
  tierDisplayName,
  tierFromVerticalTier,
  tierLadderBands,
  tierProductLookupKey,
  tierProductName,
  verticalTierFromTier,
} from "@/lib/pricing/tiers";

// ─────────────────────────────────────────────────────────────────────────
// THE NUMBER.
//
// 9900 cents = $99/month = $1,188/year.
//
// CONNER RATIFIES CHANGES TO THIS NUMBER. An agent must not edit it. It is
// pinned here as a bare literal, deliberately NOT derived from the constant
// under test, so that editing `MONTHLY_PRICE_USD_CENTS` in
// `lib/billing/facts.ts` turns this suite red instead of silently
// re-pricing every customer-facing surface at once.
// ─────────────────────────────────────────────────────────────────────────
const RATIFIED_MONTHLY_PRICE_USD_CENTS = 9900;

describe("the price", () => {
  it("is 9900 cents / $99 per month (Conner ratifies changes to this)", () => {
    assert.equal(MONTHLY_PRICE_USD_CENTS, RATIFIED_MONTHLY_PRICE_USD_CENTS);
    assert.equal(monthlyPriceUsdCents(), RATIFIED_MONTHLY_PRICE_USD_CENTS);
  });

  it("annualises to $1,188", () => {
    assert.equal(ANNUAL_PRICE_USD_CENTS, 118800);
    assert.equal(ANNUAL_PRICE_USD_CENTS, RATIFIED_MONTHLY_PRICE_USD_CENTS * 12);
  });

  it("is declared as a flat model", () => {
    assert.equal(PRICING_MODEL, "flat-monthly");
    assert.equal(BILLING_FACTS.pricingModel, "flat-monthly");
    assert.equal(
      BILLING_FACTS.monthlyPriceUsdCents,
      RATIFIED_MONTHLY_PRICE_USD_CENTS,
    );
  });

  it("lives in the billing SSOT, which tiers.ts re-exports unchanged", async () => {
    const facts = await import("@/lib/billing/facts");
    const tiers = await import("@/lib/pricing/tiers");
    assert.equal(
      tiers.MONTHLY_PRICE_USD_CENTS,
      facts.MONTHLY_PRICE_USD_CENTS,
      "tiers.ts must re-export the SSOT value, not redeclare it",
    );
  });
});

describe("the price does not vary", () => {
  it("is identical for every tier and every seat count", () => {
    for (const tier of TIER_ORDER) {
      for (const seats of [1, 2, 9, 10, 24, 25, 49, 50, 99, 100, 500]) {
        const charge = monthlyChargeUsdCents(tier, seats);
        assert.equal(
          charge.totalCents,
          RATIFIED_MONTHLY_PRICE_USD_CENTS,
          `tier=${tier} seats=${seats} must charge the flat price`,
        );
        assert.equal(charge.perSeatCents, RATIFIED_MONTHLY_PRICE_USD_CENTS);
      }
    }
  });

  it("does not multiply by seat count — 50 seats costs the same as 1", () => {
    assert.equal(
      monthlyChargeUsdCents("regular", 50).totalCents,
      monthlyChargeUsdCents("regular", 1).totalCents,
    );
  });

  it("no longer throws at 100+ seats (flat price has no ladder top)", () => {
    assert.doesNotThrow(() => monthlyChargeUsdCents("regular", 100));
    assert.equal(
      monthlyChargeUsdCents("regular", 100).totalCents,
      RATIFIED_MONTHLY_PRICE_USD_CENTS,
    );
  });

  it("every cell of the retired ladder shim returns the flat price", () => {
    let cells = 0;
    for (const tier of TIER_ORDER) {
      for (const band of SEAT_BAND_ORDER) {
        assert.equal(
          PER_SEAT_MONTHLY_USD_CENTS[tier][band],
          RATIFIED_MONTHLY_PRICE_USD_CENTS,
          `${tier}/${band} must be flat`,
        );
        assert.equal(
          perSeatMonthlyUsdCents(tier, band),
          RATIFIED_MONTHLY_PRICE_USD_CENTS,
        );
        cells++;
      }
    }
    // Guard against a vacuous pass: assert we actually examined the matrix.
    assert.equal(cells, 15, `examined ${cells} of 15 shim cells`);
  });

  it("the display ladder is a single rung showing the flat price", () => {
    const ladder = tierLadderBands();
    assert.equal(ladder.length, 1);
    assert.equal(ladder[0].price, "$99");
    // Same for every tier — no per-vertical price surface remains.
    for (const tier of TIER_ORDER) {
      assert.deepEqual(tierLadderBands(tier), ladder);
    }
  });
});

describe("Stripe naming", () => {
  it("issues exactly one canonical lookup key", () => {
    const keys = allLookupKeys();
    assert.equal(keys.length, 1);
    assert.equal(keys[0].key, "agentplain_flat_monthly");
    assert.equal(FLAT_MONTHLY_LOOKUP_KEY, "agentplain_flat_monthly");
    assert.equal(FLAT_PRODUCT_LOOKUP_KEY, "agentplain_flat");
  });

  it("lookupKeyFor ignores its vestigial tier/band arguments", () => {
    assert.equal(lookupKeyFor(), FLAT_MONTHLY_LOOKUP_KEY);
    for (const tier of TIER_ORDER) {
      for (const band of SEAT_BAND_ORDER) {
        assert.equal(lookupKeyFor(tier, band), FLAT_MONTHLY_LOOKUP_KEY);
      }
    }
  });

  it("there is one Product, not one per tier", () => {
    assert.equal(tierProductName(), "agentplain");
    assert.equal(tierProductLookupKey(), FLAT_PRODUCT_LOOKUP_KEY);
    for (const tier of TIER_ORDER) {
      assert.equal(tierProductName(tier), "agentplain");
      assert.equal(tierProductLookupKey(tier), FLAT_PRODUCT_LOOKUP_KEY);
    }
  });

  it("retains all 15 retired keys for webhook back-compat", () => {
    assert.equal(LEGACY_LOOKUP_KEYS.length, 15);
    assert.equal(new Set(LEGACY_LOOKUP_KEYS.map((k) => k.key)).size, 15);
    assert.ok(
      LEGACY_LOOKUP_KEYS.some(
        (k) => k.key === "agentplain_regular_seats_1_monthly",
      ),
    );
    assert.ok(
      LEGACY_LOOKUP_KEYS.some(
        (k) => k.key === "agentplain_max_seats_50_99_monthly",
      ),
    );
    // The retired keys must never collide with the canonical one.
    assert.ok(!LEGACY_LOOKUP_KEYS.some((k) => k.key === FLAT_MONTHLY_LOOKUP_KEY));
  });
});

// Tier identity survives the flat-price collapse because it is welded to the
// Prisma `WorkspaceVerticalTier` enum, which cannot be collapsed without a
// migration (five are stuck behind `20260618000003_client_portal`). Its job
// is now the SALES MOTION, not the price.
describe("tier identity (no longer a price input)", () => {
  it("still round-trips through the Prisma enum", () => {
    for (const t of TIER_ORDER) {
      assert.equal(tierFromVerticalTier(verticalTierFromTier(t)), t);
    }
  });

  it("keeps max quote-only — flat pricing does NOT put law on sale", () => {
    assert.equal(isSelfServeTier("regular"), true);
    assert.equal(isSelfServeTier("plus"), true);
    assert.equal(
      isSelfServeTier("max"),
      false,
      "widening this would make law self-serve purchasable — Conner's call",
    );
    assert.deepEqual([...SELF_SERVE_TIERS], ["regular", "plus"]);
  });

  it("still renders the 2026-05-15 Partner display name", () => {
    assert.equal(tierDisplayName("regular"), "Regular");
    assert.equal(tierDisplayName("plus"), "Partner");
    assert.equal(tierDisplayName("max"), "Max");
  });

  it("Partner tagline still promises no reserved hours", () => {
    assert.ok(!TIER_TAGLINE.plus.match(/\d+\s+hour/i));
  });
});

// Seat bands are record-keeping only: `enum SeatBand`,
// `Subscription.seatBand` and `Subscription.seats` stay in the schema
// because dropping them needs a migration, but nothing prices off them.
describe("seat bands (vestigial — record-keeping only)", () => {
  it("still classify seats for the persisted column", () => {
    assert.equal(seatBandForSeats(1), "SEATS_1");
    assert.equal(seatBandForSeats(9), "SEATS_2_9");
    assert.equal(seatBandForSeats(24), "SEATS_10_24");
    assert.equal(seatBandForSeats(49), "SEATS_25_49");
    assert.equal(seatBandForSeats(99), "SEATS_50_99");
  });

  it("still reject nonsense seat counts", () => {
    assert.throws(() => seatBandForSeats(0), /seats/i);
    assert.throws(() => seatBandForSeats(-1), /seats/i);
    assert.throws(() => seatBandForSeats(100), /custom|recorded/i);
  });

  it("keep their labels for the billing page", () => {
    assert.equal(SEAT_BANDS.SEATS_1.label, "1 seat");
    assert.equal(SEAT_BAND_ORDER.length, 5);
  });
});

// Trial / guarantee policy is unchanged by the flat-price ratification.
describe("trial + guarantee policy (unchanged)", () => {
  it("is 7 days by default, 14 for CPA + Law", () => {
    assert.equal(TRIAL_PERIOD_DAYS, 7);
    assert.equal(TRIAL_PERIOD_DAYS_EXTENDED, 14);
    assert.equal(trialPeriodDaysForVertical("cpa"), 14);
    assert.equal(trialPeriodDaysForVertical("law"), 14);
    assert.equal(trialPeriodDaysForVertical("real-estate"), 7);
  });

  it("captures a card at signup and guarantees 14 days", () => {
    assert.equal(CARD_REQUIRED_AT_SIGNUP, true);
    assert.equal(MONEY_BACK_GUARANTEE_DAYS, 14);
  });

  it("warns at 7/3/1 days remaining", () => {
    assert.deepEqual([...TRIAL_WARNING_THRESHOLDS_DAYS], [7, 3, 1]);
  });
});
