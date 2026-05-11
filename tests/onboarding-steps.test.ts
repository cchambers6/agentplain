import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STEP_ORDER,
  STEP_META,
  isStepId,
  nextStepAfter,
} from "@/lib/onboarding/steps";

describe("onboarding state machine", () => {
  it("has three canonical steps in order", () => {
    assert.deepEqual(STEP_ORDER, [
      "confirm_details",
      "connect_integration",
      "done",
    ]);
  });

  it("each step has metadata", () => {
    for (const s of STEP_ORDER) {
      const meta = STEP_META[s];
      assert.equal(meta.id, s);
      assert.ok(meta.label.length > 0);
      assert.ok(meta.description.length > 0);
    }
  });

  it("isStepId rejects non-canonical strings", () => {
    assert.equal(isStepId("confirm_details"), true);
    assert.equal(isStepId("connect_integration"), true);
    assert.equal(isStepId("done"), true);
    assert.equal(isStepId("garbage"), false);
    assert.equal(isStepId(""), false);
    assert.equal(isStepId(null), false);
    assert.equal(isStepId(undefined), false);
    assert.equal(isStepId(42), false);
  });

  it("nextStepAfter advances linearly", () => {
    assert.equal(nextStepAfter("confirm_details"), "connect_integration");
    assert.equal(nextStepAfter("connect_integration"), "done");
  });

  it("nextStepAfter(done) stays at done", () => {
    assert.equal(nextStepAfter("done"), "done");
  });
});
