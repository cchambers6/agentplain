// Stripe lookup-key reverse-parsing: BACK-COMPAT WINDOW.
//
// `lib/billing/webhook-dispatch.ts` reverse-parses `price.lookup_key` off
// LIVE Stripe webhooks. After the flat-price change there are two key
// shapes in flight at once, and BOTH must parse:
//
//   new:    agentplain_flat_monthly
//   legacy: agentplain_<tier>_<band>_monthly   (15 of them)
//
// Stripe keeps sending the legacy shape for every subscription created
// before the change, for the life of that subscription. If the parser
// stopped understanding them, `tierFromLookupKey` would return null on a
// real webhook and the dispatcher would silently reset that workspace's
// `verticalTier` to the workspace default — a data-corrupting regression
// with no error and no alarm.
//
// This file exists specifically to make that regression fail loudly.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  seatBandFromLookupKey,
  tierFromLookupKey,
} from "@/lib/billing/webhook-dispatch";
import {
  FLAT_MONTHLY_LOOKUP_KEY,
  LEGACY_LOOKUP_KEYS,
  SEAT_BAND_ORDER,
  TIER_ORDER,
  legacyLookupKeyFor,
} from "@/lib/pricing/tiers";

describe("legacy lookup keys still parse (pre-flat-price subscriptions)", () => {
  it("decodes the tier from all 15 retired keys", () => {
    let examined = 0;
    for (const tier of TIER_ORDER) {
      for (const band of SEAT_BAND_ORDER) {
        const key = legacyLookupKeyFor(tier, band);
        assert.equal(
          tierFromLookupKey(key),
          tier,
          `legacy key ${key} must still decode to tier ${tier}`,
        );
        examined++;
      }
    }
    assert.equal(examined, 15, `examined ${examined} of 15 legacy keys`);
  });

  it("decodes the seat band from all 15 retired keys", () => {
    let examined = 0;
    for (const tier of TIER_ORDER) {
      for (const band of SEAT_BAND_ORDER) {
        const key = legacyLookupKeyFor(tier, band);
        assert.equal(
          seatBandFromLookupKey(key),
          band,
          `legacy key ${key} must still decode to band ${band}`,
        );
        examined++;
      }
    }
    assert.equal(examined, 15, `examined ${examined} of 15 legacy keys`);
  });

  // Hard-coded, NOT derived from legacyLookupKeyFor(). If someone changes
  // the legacy key format, deriving both sides would agree with itself and
  // pass; these literals are what Stripe actually holds.
  it("parses the exact literal strings Stripe holds", () => {
    assert.equal(
      tierFromLookupKey("agentplain_regular_seats_1_monthly"),
      "regular",
    );
    assert.equal(
      seatBandFromLookupKey("agentplain_regular_seats_1_monthly"),
      "SEATS_1",
    );
    assert.equal(tierFromLookupKey("agentplain_plus_seats_2_9_monthly"), "plus");
    assert.equal(
      seatBandFromLookupKey("agentplain_plus_seats_2_9_monthly"),
      "SEATS_2_9",
    );
    assert.equal(
      tierFromLookupKey("agentplain_max_seats_50_99_monthly"),
      "max",
    );
    assert.equal(
      seatBandFromLookupKey("agentplain_max_seats_50_99_monthly"),
      "SEATS_50_99",
    );
    assert.equal(
      tierFromLookupKey("agentplain_regular_seats_10_24_monthly"),
      "regular",
    );
    assert.equal(
      seatBandFromLookupKey("agentplain_plus_seats_25_49_monthly"),
      "SEATS_25_49",
    );
  });

  it("the retired key set is exactly the 15 that were ever issued", () => {
    assert.deepEqual(
      [...LEGACY_LOOKUP_KEYS.map((k) => k.key)].sort(),
      [
        "agentplain_max_seats_10_24_monthly",
        "agentplain_max_seats_1_monthly",
        "agentplain_max_seats_25_49_monthly",
        "agentplain_max_seats_2_9_monthly",
        "agentplain_max_seats_50_99_monthly",
        "agentplain_plus_seats_10_24_monthly",
        "agentplain_plus_seats_1_monthly",
        "agentplain_plus_seats_25_49_monthly",
        "agentplain_plus_seats_2_9_monthly",
        "agentplain_plus_seats_50_99_monthly",
        "agentplain_regular_seats_10_24_monthly",
        "agentplain_regular_seats_1_monthly",
        "agentplain_regular_seats_25_49_monthly",
        "agentplain_regular_seats_2_9_monthly",
        "agentplain_regular_seats_50_99_monthly",
      ].sort(),
    );
  });
});

describe("the new flat key parses", () => {
  it("is recognised and carries neither tier nor band", () => {
    // Returning null is CORRECT: the flat key encodes no tier and no seat
    // band. Both call sites in webhook-dispatch fall back on null — the
    // workspace keeps its existing verticalTier and the band is derived
    // from the Stripe item quantity.
    assert.equal(tierFromLookupKey(FLAT_MONTHLY_LOOKUP_KEY), null);
    assert.equal(seatBandFromLookupKey(FLAT_MONTHLY_LOOKUP_KEY), null);
    assert.equal(tierFromLookupKey("agentplain_flat_monthly"), null);
  });
});

describe("unknown and empty keys", () => {
  it("return null rather than guessing", () => {
    for (const key of [
      null,
      undefined,
      "",
      "agentplain_regular",
      "agentplain_regular_seats_1",
      "agentplain_regular_seats_3_7_monthly",
      "agentplain_gold_seats_1_monthly",
      "some_other_product_seats_1_monthly",
      "agentplain_flat_yearly",
    ]) {
      assert.equal(tierFromLookupKey(key), null, `tier for ${String(key)}`);
      assert.equal(seatBandFromLookupKey(key), null, `band for ${String(key)}`);
    }
  });

  it("does not match an archived legacy key", () => {
    // setup-products archives a superseded price as `<key>_archived_<ts>`.
    assert.equal(
      tierFromLookupKey("agentplain_regular_seats_1_monthly_archived_123"),
      null,
    );
  });
});
