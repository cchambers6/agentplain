import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  STAGES,
  STAGE_ORDER,
  TOUCH_KINDS,
  isOutreachStage,
  isStuck,
  isTerminal,
  isTouchKind,
} from "@/lib/outreach/stages";

// Pins lib/outreach/stages.ts to the ratified pipeline in
// docs/sales/deep-dive-2026-07-02/06-pipeline-and-forecasting.md — the
// ladder order, the forecast weights, the terminal set, and the stuck rule.
// If doc 06 is re-ratified, update both together.

describe("outreach stage ladder (doc 06 §1)", () => {
  it("keeps the ratified ladder order", () => {
    assert.deepEqual(STAGE_ORDER, [
      "LIST",
      "FIT",
      "DISCOVERY",
      "DP_TALK",
      "AGREEMENT",
      "ACTIVATION",
      "ACTIVE_PILOT",
      "NOT_YET",
      "LOST",
    ]);
  });

  it("keeps the ratified forecast weights", () => {
    assert.deepEqual(
      STAGE_ORDER.map((s) => [s, STAGES[s].weight]),
      [
        ["LIST", 0],
        ["FIT", 0.05],
        ["DISCOVERY", 0.2],
        ["DP_TALK", 0.4],
        ["AGREEMENT", 0.75],
        ["ACTIVATION", 0.9],
        ["ACTIVE_PILOT", 1],
        ["NOT_YET", 0],
        ["LOST", 0],
      ],
    );
  });

  it("weights climb monotonically along the live ladder", () => {
    const live = STAGE_ORDER.filter((s) => !STAGES[s].terminal);
    for (let i = 1; i < live.length; i++) {
      assert.ok(
        STAGES[live[i]!].weight >= STAGES[live[i - 1]!].weight,
        `${live[i]} should not weigh less than ${live[i - 1]}`,
      );
    }
  });

  it("exactly NOT_YET and LOST are terminal", () => {
    assert.deepEqual(
      STAGE_ORDER.filter((s) => isTerminal(s)),
      ["NOT_YET", "LOST"],
    );
  });
});

describe("stuck rule (doc 06: every non-terminal row carries a next action)", () => {
  it("a live row without a next-action date is stuck", () => {
    assert.equal(isStuck({ stage: "FIT", nextActionDate: null }), true);
  });
  it("a live row with a next-action date is not stuck", () => {
    assert.equal(
      isStuck({ stage: "FIT", nextActionDate: new Date("2026-07-06") }),
      false,
    );
  });
  it("terminal rows are never stuck", () => {
    assert.equal(isStuck({ stage: "LOST", nextActionDate: null }), false);
    assert.equal(isStuck({ stage: "NOT_YET", nextActionDate: null }), false);
  });
});

describe("form-input guards", () => {
  it("accepts every ladder stage and rejects junk", () => {
    for (const s of STAGE_ORDER) assert.equal(isOutreachStage(s), true);
    assert.equal(isOutreachStage("QUALIFIED"), false);
    assert.equal(isOutreachStage(""), false);
  });

  it("accepts every touch kind and rejects junk", () => {
    for (const k of Object.keys(TOUCH_KINDS)) {
      assert.equal(isTouchKind(k), true);
    }
    assert.equal(isTouchKind("SMOKE_SIGNAL"), false);
  });

  it("every stage and touch kind carries an operator-facing label", () => {
    for (const s of STAGE_ORDER) {
      assert.ok(STAGES[s].label.length > 0);
      assert.ok(STAGES[s].entry.length > 0);
    }
    for (const label of Object.values(TOUCH_KINDS)) {
      assert.ok(label.length > 0);
    }
  });
});
