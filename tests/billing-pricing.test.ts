// Pricing-ladder sanity. The canonical values live in
// `project_stripe_both_surfaces.md` lines 17–26; this test pins the
// implementation in `lib/pricing/tiers.ts` against that memory so a
// drift PR shows up here before it hits Stripe.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PER_SEAT_MONTHLY_USD_CENTS,
  SEAT_BANDS,
  TIER_ORDER,
  TRIAL_PERIOD_DAYS,
  TRIAL_WARNING_THRESHOLDS_DAYS,
  allLookupKeys,
  lookupKeyFor,
  monthlyChargeUsdCents,
  seatBandForSeats,
  tierFromVerticalTier,
  tierProductLookupKey,
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

  it("uses 30-day trial per the brief", () => {
    assert.equal(TRIAL_PERIOD_DAYS, 30);
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
