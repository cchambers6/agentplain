// PER-SEAT RATE TABLE — NO-INVERSION GUARD
//
// agentplain prices PER SEAT with FLAT BANDS (ratified 2026-09-14): a
// workspace's whole bill is `seats x rate(seats)`, where `rate` is the
// single rate for the band the seat count lands in. These are NOT
// graduated brackets — crossing a boundary reprices EVERY seat.
//
// That is what makes this file necessary. Because a boundary reprices
// the whole bill, a rate that drops too steeply makes the first seat
// count in the higher band cost LESS than the last seat count in the
// lower band. The customer is then rewarded for buying a seat they do
// not need, and support fields a ticket asking why 25 seats is cheaper
// than 24.
//
// This is not hypothetical. The proposal preceding the ratified table
// inverted at THREE of its FOUR boundaries and nobody noticed until
// someone computed it by hand. A rate table is exactly the kind of
// artifact that looks right — five tidy descending numbers — while
// being wrong, because the wrongness lives in the products, not the
// factors.
//
// So this suite does not check the four boundaries. It checks EVERY
// adjacent seat pair from 1 to 99, which is the only formulation that
// cannot be defeated by a future edit that moves a boundary.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SELF_SERVE_SEATS,
  MONTHLY_PRICE_USD_CENTS,
  SEAT_RATE_BANDS,
  monthlyTotalUsdCents,
  perSeatMonthlyUsdCentsFor,
  seatRateBandFor,
} from "@/lib/billing/facts";

const ALL_SEATS = Array.from(
  { length: MAX_SELF_SERVE_SEATS },
  (_, i) => i + 1,
);

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

describe("per-seat rate table: structure", () => {
  it("covers 1..MAX_SELF_SERVE_SEATS contiguously with no gap or overlap", () => {
    assert.ok(SEAT_RATE_BANDS.length > 0, "rate table is empty");
    assert.equal(SEAT_RATE_BANDS[0].minSeats, 1, "table must start at 1 seat");
    assert.equal(
      SEAT_RATE_BANDS[SEAT_RATE_BANDS.length - 1].maxSeats,
      MAX_SELF_SERVE_SEATS,
      "table must end at MAX_SELF_SERVE_SEATS",
    );
    for (let i = 0; i < SEAT_RATE_BANDS.length; i++) {
      const b = SEAT_RATE_BANDS[i];
      assert.ok(
        b.minSeats <= b.maxSeats,
        `band ${b.band} has minSeats > maxSeats`,
      );
      if (i > 0) {
        assert.equal(
          b.minSeats,
          SEAT_RATE_BANDS[i - 1].maxSeats + 1,
          `gap or overlap between ${SEAT_RATE_BANDS[i - 1].band} and ${b.band}`,
        );
      }
    }
  });

  it("band boundaries match the Prisma SeatBand enum exactly (no migration needed)", () => {
    // These are the enum members as they exist in prisma/schema.prisma.
    // If a rate-table boundary ever drifts from the enum, the persisted
    // `Subscription.seatBand` stops describing the price that was charged.
    const expected = [
      { band: "SEATS_1", minSeats: 1, maxSeats: 1 },
      { band: "SEATS_2_9", minSeats: 2, maxSeats: 9 },
      { band: "SEATS_10_24", minSeats: 10, maxSeats: 24 },
      { band: "SEATS_25_49", minSeats: 25, maxSeats: 49 },
      { band: "SEATS_50_99", minSeats: 50, maxSeats: 99 },
    ];
    assert.equal(
      SEAT_RATE_BANDS.length,
      expected.length,
      "rate table has a different number of bands than the SeatBand enum",
    );
    SEAT_RATE_BANDS.forEach((b, i) => {
      assert.equal(b.band, expected[i].band);
      assert.equal(b.minSeats, expected[i].minSeats, `${b.band} minSeats`);
      assert.equal(b.maxSeats, expected[i].maxSeats, `${b.band} maxSeats`);
    });
  });

  it("the headline price is the 1-seat rate", () => {
    // Surfaces render MONTHLY_PRICE_USD_CENTS as the "from" figure. If it
    // ever stops equalling the cheapest-entry-point rate, the pricing page
    // is quoting a number no customer can actually pay.
    assert.equal(
      perSeatMonthlyUsdCentsFor(1),
      MONTHLY_PRICE_USD_CENTS,
      "MONTHLY_PRICE_USD_CENTS must equal the 1-seat rate",
    );
  });

  it("rates are non-increasing as seat count rises (volume discount is monotone)", () => {
    for (let i = 1; i < SEAT_RATE_BANDS.length; i++) {
      const prev = SEAT_RATE_BANDS[i - 1];
      const cur = SEAT_RATE_BANDS[i];
      assert.ok(
        cur.monthlyUsdCentsPerSeat <= prev.monthlyUsdCentsPerSeat,
        `rate rises from ${prev.band} (${usd(prev.monthlyUsdCentsPerSeat)}) ` +
          `to ${cur.band} (${usd(cur.monthlyUsdCentsPerSeat)}) — a larger ` +
          `workspace must never pay MORE per seat`,
      );
    }
  });
});

describe("per-seat rate table: the table cannot invert", () => {
  it("adding a seat never lowers the bill, for every seat count 1..99", () => {
    let examined = 0;
    const population = MAX_SELF_SERVE_SEATS - 1;

    for (let seats = 1; seats < MAX_SELF_SERVE_SEATS; seats++) {
      const here = monthlyTotalUsdCents(seats);
      const next = monthlyTotalUsdCents(seats + 1);
      const crossesBand =
        seatRateBandFor(seats).band !== seatRateBandFor(seats + 1).band;

      assert.ok(
        next > here,
        `INVERSION at ${seats} -> ${seats + 1} seats: ` +
          `${seats} seats costs ${usd(here)} but ${seats + 1} seats costs ` +
          `${usd(next)}. ` +
          (crossesBand
            ? `This is a BAND BOUNDARY (${seatRateBandFor(seats).band} -> ` +
              `${seatRateBandFor(seats + 1).band}); the higher band's rate ` +
              `has been cut too far. Raise it until ` +
              `${seats + 1} x rate > ${usd(here)}.`
            : `This is INSIDE a band, which should be arithmetically ` +
              `impossible — check that monthlyTotalUsdCents still ` +
              `multiplies by seats.`),
      );
      examined++;
    }

    assert.equal(
      examined,
      population,
      `examined ${examined} of ${population} adjacent seat pairs`,
    );
    assert.ok(examined > 0, "examined 0 pairs — vacuous pass");
    console.log(`examined ${examined} of ${population} adjacent seat pairs`);
  });

  it("reports the margin at each band boundary (tightest seam is visible)", () => {
    let examined = 0;
    const boundaries = SEAT_RATE_BANDS.slice(1).map((b) => b.minSeats);

    for (const first of boundaries) {
      const last = first - 1;
      const margin = monthlyTotalUsdCents(first) - monthlyTotalUsdCents(last);
      assert.ok(
        margin > 0,
        `boundary ${last} -> ${first} inverts by ${usd(-margin)}`,
      );
      console.log(
        `  boundary ${String(last).padStart(2)} -> ${String(first).padStart(2)} ` +
          `seats: ${usd(monthlyTotalUsdCents(last))} -> ` +
          `${usd(monthlyTotalUsdCents(first))}  (+${usd(margin)})`,
      );
      examined++;
    }

    assert.equal(examined, boundaries.length);
    assert.ok(examined > 0, "examined 0 boundaries — vacuous pass");
    console.log(`examined ${examined} of ${boundaries.length} band boundaries`);
  });

  it("every seat count 1..99 prices as seats x its band rate (flat, not graduated)", () => {
    // Pins the FLAT-BAND semantics. Under graduated brackets a 10-seat
    // workspace would pay 1x99 + 8x89 + 1x81 = $892. Under flat bands it
    // pays 10x81 = $810. This assertion is what stops someone
    // "improving" the model into brackets without a ratification.
    let examined = 0;
    for (const seats of ALL_SEATS) {
      const band = seatRateBandFor(seats);
      assert.equal(
        monthlyTotalUsdCents(seats),
        band.monthlyUsdCentsPerSeat * seats,
        `seats=${seats} is not priced as a flat band`,
      );
      examined++;
    }
    assert.equal(examined, ALL_SEATS.length);
    assert.ok(examined > 0, "examined 0 seat counts — vacuous pass");
    console.log(`examined ${examined} of ${ALL_SEATS.length} seat counts`);
  });
});

describe("per-seat rate table: boundaries of the table itself", () => {
  it("throws below 1 seat", () => {
    assert.throws(() => seatRateBandFor(0), /seats must be >= 1/);
    assert.throws(() => seatRateBandFor(-5), /seats must be >= 1/);
  });

  it("throws on a non-integer seat count", () => {
    assert.throws(() => seatRateBandFor(2.5), /must be an integer/);
  });

  it("throws above 99 rather than clamping (clamping underbills)", () => {
    // The pre-existing webhook path clamped with
    // `Math.min(Math.max(seats,1),99)`. Harmless while band was cosmetic;
    // a silent underbill the moment band selects price. A 150-seat
    // workspace must not price as 99.
    for (const seats of [100, 150, 1000]) {
      assert.throws(
        () => seatRateBandFor(seats),
        /above the self-serve rate table/,
        `seats=${seats} must throw, not clamp`,
      );
    }
  });

  it("prices the documented reference points exactly", () => {
    // Hand-computed from the ratified table. Duplicated literals on
    // purpose: if someone edits a rate, this fails with the old and new
    // numbers side by side rather than silently agreeing with itself.
    const expected: Array<[number, number]> = [
      [1, 9900],
      [2, 17800],
      [9, 80100],
      [10, 81000],
      [24, 194400],
      [25, 195000],
      [49, 382200],
      [50, 385000],
      [99, 762300],
    ];
    let examined = 0;
    for (const [seats, cents] of expected) {
      assert.equal(
        monthlyTotalUsdCents(seats),
        cents,
        `${seats} seats should cost ${usd(cents)}`,
      );
      examined++;
    }
    assert.equal(examined, expected.length);
    assert.ok(examined > 0, "examined 0 reference points — vacuous pass");
    console.log(`examined ${examined} of ${expected.length} reference points`);
  });
});
