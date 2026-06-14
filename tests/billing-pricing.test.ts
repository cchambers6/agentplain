// Pricing-ladder sanity. The canonical values live in
// `project_stripe_both_surfaces.md` lines 17–26; this test pins the
// implementation in `lib/pricing/tiers.ts` against that memory so a
// drift PR shows up here before it hits Stripe.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MONEY_BACK_GUARANTEE_DAYS,
  PER_SEAT_MONTHLY_USD_CENTS,
  SEAT_BANDS,
  SELF_SERVE_TIERS,
  TIER_ORDER,
  TIER_TAGLINE,
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
  TRIAL_WARNING_THRESHOLDS_DAYS,
  allLookupKeys,
  isSelfServeTier,
  lookupKeyFor,
  monthlyChargeUsdCents,
  seatBandForSeats,
  tierDisplayName,
  tierFromVerticalTier,
  tierProductLookupKey,
  tierProductName,
  trialPeriodDaysForVertical,
  verticalTierFromTier,
} from "@/lib/pricing/tiers";

describe("pricing ladder — canonical match", () => {
  it("matches the regular tier table exactly", () => {
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.regular.SEATS_1, 19900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.regular.SEATS_2_9, 17900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.regular.SEATS_10_24, 14900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.regular.SEATS_25_49, 11900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.regular.SEATS_50_99, 9900);
  });
  it("matches the plus tier table exactly", () => {
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.plus.SEATS_1, 29900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.plus.SEATS_2_9, 27900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.plus.SEATS_10_24, 24900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.plus.SEATS_25_49, 21900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.plus.SEATS_50_99, 19900);
  });
  it("matches the max tier table exactly", () => {
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.max.SEATS_1, 49900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.max.SEATS_2_9, 44900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.max.SEATS_10_24, 39900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.max.SEATS_25_49, 34900);
    assert.equal(PER_SEAT_MONTHLY_USD_CENTS.max.SEATS_50_99, 29900);
  });

  it("uses 7-day default trial (ratified 2026-06-14)", () => {
    assert.equal(TRIAL_PERIOD_DAYS, 7);
  });

  it("uses 14-day extended trial for CPA + Law", () => {
    assert.equal(TRIAL_PERIOD_DAYS_EXTENDED, 14);
    assert.equal(trialPeriodDaysForVertical("cpa"), 14);
    assert.equal(trialPeriodDaysForVertical("law"), 14);
    assert.equal(trialPeriodDaysForVertical("real-estate"), 7);
    assert.equal(trialPeriodDaysForVertical("general"), 7);
  });

  it("money-back guarantee is 14 days", () => {
    assert.equal(MONEY_BACK_GUARANTEE_DAYS, 14);
  });

  it("warning thresholds are 7/3/1 days", () => {
    assert.deepEqual([...TRIAL_WARNING_THRESHOLDS_DAYS], [7, 3, 1]);
  });
});

describe("seatBandForSeats", () => {
  it("places each canonical seat count in the right band", () => {
    assert.equal(seatBandForSeats(1), "SEATS_1");
    assert.equal(seatBandForSeats(2), "SEATS_2_9");
    assert.equal(seatBandForSeats(9), "SEATS_2_9");
    assert.equal(seatBandForSeats(10), "SEATS_10_24");
    assert.equal(seatBandForSeats(24), "SEATS_10_24");
    assert.equal(seatBandForSeats(25), "SEATS_25_49");
    assert.equal(seatBandForSeats(49), "SEATS_25_49");
    assert.equal(seatBandForSeats(50), "SEATS_50_99");
    assert.equal(seatBandForSeats(99), "SEATS_50_99");
  });

  it("rejects 100+ — that's the enterprise/custom path", () => {
    assert.throws(() => seatBandForSeats(100), /100\+|enterprise|custom/i);
  });

  it("rejects 0 and negative", () => {
    assert.throws(() => seatBandForSeats(0), /seats/i);
    assert.throws(() => seatBandForSeats(-1), /seats/i);
  });
});

describe("monthlyChargeUsdCents", () => {
  it("multiplies per-seat by seat count", () => {
    const r = monthlyChargeUsdCents("regular", 5);
    assert.equal(r.band, "SEATS_2_9");
    assert.equal(r.perSeatCents, 17900);
    assert.equal(r.totalCents, 5 * 17900);
  });

  it("works at the top of the ladder", () => {
    const r = monthlyChargeUsdCents("max", 75);
    assert.equal(r.band, "SEATS_50_99");
    assert.equal(r.perSeatCents, 29900);
    assert.equal(r.totalCents, 75 * 29900);
  });
});

describe("lookup keys", () => {
  it("produces stable per-(tier,band) keys", () => {
    assert.equal(lookupKeyFor("regular", "SEATS_1"), "agentplain_regular_seats_1_monthly");
    assert.equal(lookupKeyFor("max", "SEATS_50_99"), "agentplain_max_seats_50_99_monthly");
  });

  it("yields exactly 15 keys across the matrix", () => {
    const keys = allLookupKeys();
    assert.equal(keys.length, 15);
    assert.equal(new Set(keys.map((k) => k.key)).size, 15);
  });

  it("product lookup keys are tier-scoped", () => {
    assert.equal(tierProductLookupKey("regular"), "agentplain_regular");
  });
});

describe("tier <-> verticalTier translation", () => {
  it("REGULAR/PLUS/MAX round-trip", () => {
    for (const t of TIER_ORDER) {
      assert.equal(tierFromVerticalTier(verticalTierFromTier(t)), t);
    }
  });
});

describe("SEAT_BANDS labels", () => {
  it("has a label for every band", () => {
    assert.equal(SEAT_BANDS.SEATS_1.label, "1 seat");
    assert.equal(SEAT_BANDS.SEATS_2_9.label, "2–9 seats");
    assert.equal(SEAT_BANDS.SEATS_50_99.label, "50–99 seats");
  });
});

// Three customer-facing tiers per the 2026-05-15 amendment to
// `project_stripe_both_surfaces.md`. The DB enum stays regular/plus/max
// for stable identity; "Plus" is the on-disk identity for the
// customer-facing "Partner" tier. These tests pin the display rename
// so a future PR that renames `plus` → `partner` (or vice-versa) in
// either layer surfaces the drift here.
describe("tier display naming (2026-05-15 Partner rename)", () => {
  it("maps regular → Regular, plus → Partner, max → Max", () => {
    assert.equal(tierDisplayName("regular"), "Regular");
    assert.equal(tierDisplayName("plus"), "Partner");
    assert.equal(tierDisplayName("max"), "Max");
  });
  it("Stripe Product name reflects the display rename", () => {
    assert.equal(tierProductName("regular"), "agentplain Regular");
    assert.equal(tierProductName("plus"), "agentplain Partner");
    assert.equal(tierProductName("max"), "agentplain Max");
  });
  it("every tier has a tagline", () => {
    for (const t of TIER_ORDER) {
      const tagline = TIER_TAGLINE[t];
      assert.equal(typeof tagline, "string");
      assert.ok(tagline.length > 10, `tagline too short for ${t}`);
    }
  });
  it("Partner tier tagline does not mention reserved hours (ratified 2026-06-14)", () => {
    assert.ok(
      !TIER_TAGLINE.plus.match(/\d+\s+hour/i),
      "Partner tagline must not promise a specific reserved-hours count",
    );
  });
});

// SELF_SERVE_TIERS gates the sign-up flow, the billing-page tier toggle,
// and the change-plan action. Max is intentionally excluded — Max is
// quote-based and never reaches Stripe Checkout per the 2026-05-15
// amendment to `project_stripe_both_surfaces.md`. A regression that
// silently widens this would let a hand-crafted POST provision a Max
// workspace through the self-serve path, which would bypass operator
// triage. Tests pin the contract.
describe("self-serve tier gating", () => {
  it("regular + plus are self-serve; max is not", () => {
    assert.equal(isSelfServeTier("regular"), true);
    assert.equal(isSelfServeTier("plus"), true);
    assert.equal(isSelfServeTier("max"), false);
  });
  it("SELF_SERVE_TIERS list matches the predicate", () => {
    const fromList = new Set(SELF_SERVE_TIERS);
    for (const t of TIER_ORDER) {
      assert.equal(fromList.has(t), isSelfServeTier(t));
    }
  });
});
