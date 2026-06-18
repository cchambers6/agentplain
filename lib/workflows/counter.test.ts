import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatCounterLine,
  formatSavedTime,
  projectTrialValue,
  storyCounter,
} from "./counter";
import { generalStory } from "./verticals/general";

describe("counter · formatSavedTime", () => {
  it("minutes under an hour", () => {
    assert.equal(formatSavedTime(0), "0 minutes");
    assert.equal(formatSavedTime(1), "1 minute");
    assert.equal(formatSavedTime(27), "27 minutes");
    assert.equal(formatSavedTime(59), "59 minutes");
  });

  it("whole and partial hours", () => {
    assert.equal(formatSavedTime(60), "1 hr");
    assert.equal(formatSavedTime(65), "1 hr 5 min");
    assert.equal(formatSavedTime(153), "2 hr 33 min");
    assert.equal(formatSavedTime(120), "2 hr");
  });

  it("never goes negative", () => {
    assert.equal(formatSavedTime(-10), "0 minutes");
  });
});

describe("counter · formatCounterLine", () => {
  it("singularizes at one action", () => {
    assert.equal(
      formatCounterLine({ actions: 1, savedMinutes: 10, verb: "drafted", noun: "replies" }),
      "Plaino drafted 1 reply · saved 10 minutes",
    );
  });

  it("pluralizes above one", () => {
    assert.equal(
      formatCounterLine({ actions: 3, savedMinutes: 27, verb: "drafted", noun: "replies" }),
      "Plaino drafted 3 replies · saved 27 minutes",
    );
  });

  it("neutral fallback without verb/noun", () => {
    assert.equal(
      formatCounterLine({ actions: 5, savedMinutes: 20 }),
      "Plaino handled 5 items · saved 20 minutes",
    );
  });

  it("zero actions reads as getting started", () => {
    assert.match(
      formatCounterLine({ actions: 0, savedMinutes: 0, verb: "drafted", noun: "replies" }),
      /getting started/,
    );
  });
});

describe("counter · projectTrialValue", () => {
  it("multiplies per-run by trial cadence", () => {
    const p = projectTrialValue({ perRunMinutes: 27, runsPerTrial: 14 });
    assert.equal(p.trialMinutes, 378);
    assert.match(p.label, /over a 7-day trial/);
  });

  it("guards against zero cadence", () => {
    const p = projectTrialValue({ perRunMinutes: 30, runsPerTrial: 0 });
    assert.equal(p.runsPerTrial, 1);
  });
});

describe("counter · storyCounter", () => {
  it("derives totals from a real story", () => {
    const c = storyCounter(generalStory());
    assert.ok(c.actions > 0);
    assert.ok(c.savedMinutes > 0);
  });
});
