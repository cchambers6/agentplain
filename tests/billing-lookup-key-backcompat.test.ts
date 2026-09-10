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
// `verticalTier` to the workspace default -- a data-corrupting regression
// with no error and no alarm.
//
// This file exists specifically to make that regression fail loudly.
//
// ---------------------------------------------------------------------
// WHY THIS FILE DOES NOT CALL `legacyLookupKeyFor()` TO BUILD ITS TABLE
// ---------------------------------------------------------------------
//
// An earlier version of this test iterated `TIER_ORDER x SEAT_BAND_ORDER`
// and formatted each key with `legacyLookupKeyFor()` -- the exact same
// derivation `LEGACY_LOOKUP_KEYS` itself used at the time. A test that
// derives its expectations the same way the source derives its values
// PROVES NOTHING: collapse `TIER_ORDER` and both sides shrink together,
// in agreement, green.
//
// `EXPECTED_LEGACY_KEYS` below is therefore written out longhand as an
// INDEPENDENT SECOND DERIVATION. It is a transcription of what Stripe
// holds, not a computation over today's constants. If the source and this
// table ever disagree, that disagreement is the finding.
//
// Every loop reports `examined N of 15` and FAILS AT ZERO. This repo has a
// recorded failure where `assert.deepEqual(x, [])` passed green against an
// empty input set, making "found nothing" and "examined nothing"
// indistinguishable. An empty loop here must be a red test, not a quiet one.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  seatBandFromLookupKey,
  tierFromLookupKey,
} from "@/lib/billing/webhook-dispatch";
import {
  FLAT_MONTHLY_LOOKUP_KEY,
  LEGACY_LOOKUP_KEYS,
  LEGACY_LOOKUP_KEY_COUNT,
  SEAT_BAND_ORDER,
  TIER_ORDER,
  legacyLookupKeyFor,
} from "@/lib/pricing/tiers";

/**
 * The 15 keys Stripe actually holds, transcribed by hand.
 *
 * DO NOT REPLACE THIS WITH A LOOP. It is deliberately redundant with
 * `LEGACY_LOOKUP_KEYS`; the redundancy IS the test. Deriving it would make
 * this suite agree with itself.
 */
const EXPECTED_LEGACY_KEYS: ReadonlyArray<{
  key: string;
  tier: string;
  band: string;
}> = [
  { key: "agentplain_regular_seats_1_monthly", tier: "regular", band: "SEATS_1" },
  { key: "agentplain_regular_seats_2_9_monthly", tier: "regular", band: "SEATS_2_9" },
  { key: "agentplain_regular_seats_10_24_monthly", tier: "regular", band: "SEATS_10_24" },
  { key: "agentplain_regular_seats_25_49_monthly", tier: "regular", band: "SEATS_25_49" },
  { key: "agentplain_regular_seats_50_99_monthly", tier: "regular", band: "SEATS_50_99" },
  { key: "agentplain_plus_seats_1_monthly", tier: "plus", band: "SEATS_1" },
  { key: "agentplain_plus_seats_2_9_monthly", tier: "plus", band: "SEATS_2_9" },
  { key: "agentplain_plus_seats_10_24_monthly", tier: "plus", band: "SEATS_10_24" },
  { key: "agentplain_plus_seats_25_49_monthly", tier: "plus", band: "SEATS_25_49" },
  { key: "agentplain_plus_seats_50_99_monthly", tier: "plus", band: "SEATS_50_99" },
  { key: "agentplain_max_seats_1_monthly", tier: "max", band: "SEATS_1" },
  { key: "agentplain_max_seats_2_9_monthly", tier: "max", band: "SEATS_2_9" },
  { key: "agentplain_max_seats_10_24_monthly", tier: "max", band: "SEATS_10_24" },
  { key: "agentplain_max_seats_25_49_monthly", tier: "max", band: "SEATS_25_49" },
  { key: "agentplain_max_seats_50_99_monthly", tier: "max", band: "SEATS_50_99" },
];

/** Guard the guard: the hand-written table must itself be 15 rows. */
assert.equal(
  EXPECTED_LEGACY_KEYS.length,
  15,
  "EXPECTED_LEGACY_KEYS was edited to the wrong length -- every " +
    "`examined N of 15` count below is measured against it",
);

describe("LEGACY_LOOKUP_KEYS is a frozen closed set, not a derived one", () => {
  it("has exactly 15 entries", () => {
    assert.equal(
      LEGACY_LOOKUP_KEY_COUNT,
      15,
      "LEGACY_LOOKUP_KEY_COUNT is the declared size of a CLOSED historical " +
        "set. It can never legitimately change.",
    );
    assert.equal(
      LEGACY_LOOKUP_KEYS.length,
      LEGACY_LOOKUP_KEY_COUNT,
      `LEGACY_LOOKUP_KEYS has ${LEGACY_LOOKUP_KEYS.length} entries, expected ` +
        `${LEGACY_LOOKUP_KEY_COUNT}. Stripe still holds all 15 retired keys; ` +
        "dropping one silently resets a legacy workspace's tier and seat " +
        "band on its next webhook.",
    );
  });

  it("is frozen, so it cannot be shrunk at runtime", () => {
    assert.equal(
      Object.isFrozen(LEGACY_LOOKUP_KEYS),
      true,
      "LEGACY_LOOKUP_KEYS must be Object.freeze()d -- a readonly TYPE is " +
        "erased at runtime and does not stop `.pop()` or `.splice()`.",
    );
    let examined = 0;
    for (const entry of LEGACY_LOOKUP_KEYS) {
      assert.equal(
        Object.isFrozen(entry),
        true,
        `legacy entry ${entry.key} must be frozen`,
      );
      examined++;
    }
    assert.ok(examined > 0, "examined 0 of 15 entries -- the set was empty");
    assert.equal(examined, 15, `examined ${examined} of 15 entries`);
  });

  // The whole point of the change. `LEGACY_LOOKUP_KEYS` describes what
  // Stripe already holds; deriving it from present-day constants makes a
  // historical fact shrink when today's constants shrink. A cleanup
  // migration collapsing `WorkspaceVerticalTier` is anticipated, so this
  // is a scheduled hazard, not a hypothetical one.
  it("does not derive itself from TIER_ORDER, SEAT_BAND_ORDER or the formatter", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../lib/pricing/tiers.ts", import.meta.url)),
      "utf8",
    );
    const start = src.indexOf("export const LEGACY_LOOKUP_KEYS");
    assert.ok(
      start !== -1,
      "could not locate the LEGACY_LOOKUP_KEYS declaration in tiers.ts",
    );
    const end = src.indexOf("\n]);", start);
    assert.ok(
      end !== -1,
      "could not locate the end of the LEGACY_LOOKUP_KEYS declaration",
    );
    // Initializer only -- the doc comment above it legitimately NAMES these
    // identifiers while explaining why they must not be used here.
    const declaration = src.slice(start, end);

    let examined = 0;
    for (const forbidden of [
      "TIER_ORDER",
      "SEAT_BAND_ORDER",
      "legacyLookupKeyFor",
      "flatMap",
    ]) {
      assert.equal(
        declaration.includes(forbidden),
        false,
        `LEGACY_LOOKUP_KEYS must not be derived from \`${forbidden}\`. It is ` +
          "a closed historical set describing keys Stripe already holds; " +
          "deriving it from a present-day constant means a future collapse " +
          "of that constant silently shrinks the set with no error.",
      );
      examined++;
    }
    assert.ok(examined > 0, "examined 0 of 4 forbidden identifiers");
    assert.equal(examined, 4, `examined ${examined} of 4 forbidden identifiers`);
  });

  it("is exactly the 15 literal strings Stripe holds", () => {
    assert.deepEqual(
      [...LEGACY_LOOKUP_KEYS.map((k) => k.key)].sort(),
      [...EXPECTED_LEGACY_KEYS.map((k) => k.key)].sort(),
    );
  });
});

describe("legacy lookup keys still parse (pre-flat-price subscriptions)", () => {
  it("decodes tier AND band from all 15 retired keys", () => {
    let examined = 0;
    for (const { key, tier, band } of EXPECTED_LEGACY_KEYS) {
      assert.equal(
        tierFromLookupKey(key),
        tier,
        `legacy key ${key} must still decode to tier ${tier}`,
      );
      assert.equal(
        seatBandFromLookupKey(key),
        band,
        `legacy key ${key} must still decode to band ${band}`,
      );
      examined++;
    }
    assert.ok(
      examined > 0,
      "examined 0 of 15 legacy keys -- the expectation table was empty, so " +
        "this test proved nothing. A zero-iteration loop must be RED.",
    );
    assert.equal(examined, 15, `examined ${examined} of 15 legacy keys`);
  });

  it("carries the tier and band each key decodes to, in the exported set", () => {
    let examined = 0;
    for (const { key, tier, band } of EXPECTED_LEGACY_KEYS) {
      const entry = LEGACY_LOOKUP_KEYS.find((k) => k.key === key);
      assert.ok(entry, `LEGACY_LOOKUP_KEYS is missing the retired key ${key}`);
      assert.equal(entry.tier, tier, `${key} must be recorded as tier ${tier}`);
      assert.equal(entry.band, band, `${key} must be recorded as band ${band}`);
      examined++;
    }
    assert.ok(examined > 0, "examined 0 of 15 legacy keys");
    assert.equal(examined, 15, `examined ${examined} of 15 legacy keys`);
  });

  // Cross-check the FORMATTER against the frozen data, without letting the
  // formatter define the data. Subset direction only: every key derivable
  // from today's constants must appear in the frozen set. This stays true
  // after a future enum collapse (the frozen set is a superset by design),
  // which is exactly why it is safe to assert and why the reverse direction
  // is NOT asserted here.
  it("still formats keys that are present in the frozen set", () => {
    let examined = 0;
    const frozen = new Set(LEGACY_LOOKUP_KEYS.map((k) => k.key));
    for (const tier of TIER_ORDER) {
      for (const band of SEAT_BAND_ORDER) {
        const key = legacyLookupKeyFor(tier, band);
        assert.equal(
          frozen.has(key),
          true,
          `legacyLookupKeyFor(${tier}, ${band}) produced ${key}, which is ` +
            "not in the frozen legacy set -- the key FORMAT changed",
        );
        examined++;
      }
    }
    assert.ok(
      examined > 0,
      "examined 0 formatter outputs -- TIER_ORDER or SEAT_BAND_ORDER is " +
        "empty. That is survivable for the frozen set (which is the point) " +
        "but it means this cross-check verified nothing.",
    );
  });

  // Hard-coded spot checks, independent of every loop above.
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
    assert.equal(tierFromLookupKey("agentplain_max_seats_50_99_monthly"), "max");
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
});

describe("the new flat key parses", () => {
  it("is recognised and carries neither tier nor band", () => {
    // Returning null is CORRECT: the flat key encodes no tier and no seat
    // band. Both call sites in webhook-dispatch fall back on null -- the
    // workspace keeps its existing verticalTier and the band is derived
    // from the Stripe item quantity.
    assert.equal(tierFromLookupKey(FLAT_MONTHLY_LOOKUP_KEY), null);
    assert.equal(seatBandFromLookupKey(FLAT_MONTHLY_LOOKUP_KEY), null);
    assert.equal(tierFromLookupKey("agentplain_flat_monthly"), null);
  });
});

describe("unknown and empty keys", () => {
  it("return null rather than guessing", () => {
    let examined = 0;
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
      examined++;
    }
    assert.equal(examined, 9, `examined ${examined} of 9 unknown keys`);
  });

  it("does not match an archived legacy key", () => {
    // setup-products archives a superseded price as `<key>_archived_<ts>`.
    assert.equal(
      tierFromLookupKey("agentplain_regular_seats_1_monthly_archived_123"),
      null,
    );
  });
});
