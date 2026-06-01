import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INPUT_STEPS,
  STEP_ORDER,
  STEP_META,
  isStepId,
  nextStepAfter,
} from "@/lib/onboarding/steps";

// Wave-9 expanded the state machine from 4 to 6 steps (5 input + done
// sentinel). The deeper behavior coverage lives in
// `lib/onboarding/steps.test.ts`; this top-level test pins the contract
// the wizard renders and the customer surfaces depend on.
describe("onboarding state machine — wave-9 6-step contract", () => {
  it("has six canonical steps in order", () => {
    assert.deepEqual(STEP_ORDER, [
      "confirm_details",
      "connect_integration",
      "pick_skills",
      "set_preferences",
      "first_fire_watch",
      "done",
    ]);
  });

  it("INPUT_STEPS drops the done sentinel", () => {
    assert.deepEqual(INPUT_STEPS, [
      "confirm_details",
      "connect_integration",
      "pick_skills",
      "set_preferences",
      "first_fire_watch",
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
    assert.equal(isStepId("pick_skills"), true);
    assert.equal(isStepId("set_preferences"), true);
    assert.equal(isStepId("first_fire_watch"), true);
    assert.equal(isStepId("done"), true);
    assert.equal(isStepId("garbage"), false);
    assert.equal(isStepId(""), false);
    assert.equal(isStepId(null), false);
    assert.equal(isStepId(undefined), false);
    assert.equal(isStepId(42), false);
  });

  it("nextStepAfter advances linearly through the five input steps", () => {
    assert.equal(nextStepAfter("confirm_details"), "connect_integration");
    assert.equal(nextStepAfter("connect_integration"), "pick_skills");
    assert.equal(nextStepAfter("pick_skills"), "set_preferences");
    assert.equal(nextStepAfter("set_preferences"), "first_fire_watch");
    assert.equal(nextStepAfter("first_fire_watch"), "done");
  });

  it("nextStepAfter(done) stays at done", () => {
    assert.equal(nextStepAfter("done"), "done");
  });
});
