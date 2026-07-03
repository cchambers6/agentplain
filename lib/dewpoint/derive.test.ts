/**
 * lib/dewpoint/derive.test.ts
 *
 * Pins the dew-point interpretation logic: comfort bands, fog and
 * condensation risk, the Magnus back-calculation, the best-comfort-window
 * scan, and the forecast roll-up.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  comfortForDewpoint,
  fogRisk,
  condensationRisk,
  dewpointFromTempHumidity,
  bestComfortWindow,
  summarizeForecast,
  toFahrenheit,
  type DewpointHour,
} from "./derive";

describe("comfortForDewpoint", () => {
  it("classifies a dry morning", () => {
    assert.equal(comfortForDewpoint(5).level, "dry");
  });
  it("classifies the sticky band", () => {
    assert.equal(comfortForDewpoint(20).level, "sticky");
  });
  it("classifies oppressive air", () => {
    assert.equal(comfortForDewpoint(22).level, "oppressive");
  });
  it("saturates at miserable for extreme dew points", () => {
    assert.equal(comfortForDewpoint(27).level, "miserable");
  });
  it("uses < (upper-exclusive) band boundaries", () => {
    // 10.0 is the top of "dry"; exactly 10 falls into the next band.
    assert.equal(comfortForDewpoint(9.9).level, "dry");
    assert.equal(comfortForDewpoint(10).level, "very-comfortable");
  });
});

describe("fogRisk", () => {
  it("flags near-saturation as high", () => {
    assert.equal(fogRisk({ time: "t", temperatureC: 10, dewpointC: 9.5 }).level, "high");
  });
  it("flags a small spread as moderate", () => {
    assert.equal(fogRisk({ time: "t", temperatureC: 12, dewpointC: 10 }).level, "moderate");
  });
  it("clears a wide spread", () => {
    assert.equal(fogRisk({ time: "t", temperatureC: 25, dewpointC: 8 }).level, "none");
  });
});

describe("condensationRisk", () => {
  it("predicts sweating when the surface is below the dew point", () => {
    assert.equal(condensationRisk(15, 4).level, "high");
  });
  it("names frost when the dew point is at or below freezing", () => {
    const r = condensationRisk(-2, -3);
    assert.equal(r.level, "high");
    assert.match(r.reason, /frost/);
  });
  it("clears a warm surface", () => {
    assert.equal(condensationRisk(5, 20).level, "none");
  });
});

describe("dewpointFromTempHumidity", () => {
  it("equals air temperature at 100% humidity", () => {
    const td = dewpointFromTempHumidity(20, 100);
    assert.ok(Math.abs(td - 20) < 0.1, `expected ~20, got ${td}`);
  });
  it("matches a known reference point (25°C, 50% RH ≈ 13.9°C)", () => {
    const td = dewpointFromTempHumidity(25, 50);
    assert.ok(Math.abs(td - 13.9) < 0.3, `expected ~13.9, got ${td}`);
  });
  it("falls below air temperature as humidity drops", () => {
    assert.ok(dewpointFromTempHumidity(30, 20) < 30);
  });
});

describe("bestComfortWindow", () => {
  const hrs = (dps: number[]): DewpointHour[] =>
    dps.map((dp, i) => ({ time: `2026-07-03T${String(i).padStart(2, "0")}:00`, temperatureC: dp + 5, dewpointC: dp }));

  it("finds the longest run under the threshold", () => {
    const w = bestComfortWindow(hrs([20, 12, 11, 10, 22, 9]), 16);
    assert.ok(w);
    assert.equal(w!.hours, 3);
    assert.equal(w!.start, "2026-07-03T01:00");
    assert.equal(w!.end, "2026-07-03T03:00");
    assert.equal(w!.peakDewpointC, 12);
  });

  it("returns null when nothing qualifies", () => {
    assert.equal(bestComfortWindow(hrs([20, 21, 22]), 16), null);
  });
});

describe("summarizeForecast", () => {
  const sample: DewpointHour[] = [
    { time: "2026-07-03T06:00", temperatureC: 11, dewpointC: 10.5 }, // near saturation -> high fog
    { time: "2026-07-03T12:00", temperatureC: 28, dewpointC: 21 }, // peak, sticky
    { time: "2026-07-03T22:00", temperatureC: 15, dewpointC: 8 }, // trough, dry
  ];

  it("identifies peak, trough, and average", () => {
    const s = summarizeForecast(sample);
    assert.equal(s.peak.hour.dewpointC, 21);
    assert.equal(s.peak.comfort.level, "sticky");
    assert.equal(s.trough.hour.dewpointC, 8);
    assert.equal(s.averageDewpointC, toFixed1((10.5 + 21 + 8) / 3));
  });

  it("surfaces the worst fog risk with its time", () => {
    const s = summarizeForecast(sample);
    assert.equal(s.fog.level, "high");
    assert.equal(s.fog.time, "2026-07-03T06:00");
  });

  it("writes a non-empty summary", () => {
    assert.ok(summarizeForecast(sample).summary.length > 0);
  });

  it("throws on empty input", () => {
    assert.throws(() => summarizeForecast([]));
  });
});

describe("toFahrenheit", () => {
  it("converts freezing and boiling", () => {
    assert.equal(toFahrenheit(0), 32);
    assert.equal(toFahrenheit(100), 212);
  });
});

function toFixed1(n: number): number {
  return Math.round(n * 10) / 10;
}
