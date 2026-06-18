import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_MINUTES,
  projectStory,
  stepActionCount,
  stepSavedMinutes,
  storyDurationMs,
  totalActions,
  totalSavedMinutes,
  type WorkflowStory,
} from "./runtime";

function fixture(): WorkflowStory {
  return {
    vertical: "REAL_ESTATE",
    headline: "h",
    trigger: "t",
    sourceLabel: "s",
    connectIntegrationId: "ci",
    connectLabel: "cl",
    connectWhy: "why",
    counterVerb: "drafted",
    counterNoun: "replies",
    runsPerTrial: 10,
    steps: [
      { id: "a", label: "A", detail: "da", action: "read", runMs: 1000 }, // 2
      { id: "b", label: "B", detail: "db", action: "draft-email", runMs: 2000 }, // 10
      {
        id: "c",
        label: "C",
        detail: "dc",
        action: "request-doc",
        count: 47,
        runMs: 3000,
      }, // 3*47 = 141
    ],
  };
}

describe("runtime · calibration", () => {
  it("fixes the mandate's two anchors", () => {
    assert.equal(ACTION_MINUTES["draft-email"], 10);
    assert.equal(ACTION_MINUTES["enrich"], 5);
  });

  it("credits batch steps per item", () => {
    const story = fixture();
    assert.equal(stepSavedMinutes(story.steps[2]!), 141);
    assert.equal(stepActionCount(story.steps[2]!), 47);
  });

  it("treats a countless step as a single action", () => {
    const story = fixture();
    assert.equal(stepActionCount(story.steps[0]!), 1);
    assert.equal(stepSavedMinutes(story.steps[0]!), 2);
  });
});

describe("runtime · projectStory", () => {
  it("nothing done at 0 — first step running, rest pending", () => {
    const p = projectStory(fixture(), 0);
    assert.equal(p.completedSteps, 0);
    assert.equal(p.actions, 0);
    assert.equal(p.savedMinutes, 0);
    assert.equal(p.complete, false);
    assert.deepEqual(
      p.steps.map((s) => s.status),
      ["running", "pending", "pending"],
    );
  });

  it("credits only completed steps", () => {
    const p = projectStory(fixture(), 2);
    assert.equal(p.completedSteps, 2);
    assert.equal(p.actions, 2); // read(1) + draft(1)
    assert.equal(p.savedMinutes, 12); // 2 + 10
    assert.deepEqual(
      p.steps.map((s) => s.status),
      ["done", "done", "running"],
    );
  });

  it("counts batch items once the batch step completes", () => {
    const p = projectStory(fixture(), 3);
    assert.equal(p.complete, true);
    assert.equal(p.actions, 49); // 1 + 1 + 47
    assert.equal(p.savedMinutes, 153); // 2 + 10 + 141
    assert.ok(p.steps.every((s) => s.status === "done"));
  });

  it("clamps out-of-range completedCount", () => {
    assert.equal(projectStory(fixture(), -5).completedSteps, 0);
    assert.equal(projectStory(fixture(), 99).completedSteps, 3);
    assert.equal(projectStory(fixture(), 99).complete, true);
  });
});

describe("runtime · totals", () => {
  it("total saved + actions match a full run", () => {
    const story = fixture();
    assert.equal(totalSavedMinutes(story), 153);
    assert.equal(totalActions(story), 49);
  });

  it("duration sums runMs", () => {
    assert.equal(storyDurationMs(fixture()), 6000);
  });
});
