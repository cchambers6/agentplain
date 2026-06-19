import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Vertical } from "@prisma/client";
import { killerWorkflowStoryFor, VERTICALS_WITH_STORY } from "./index";
import { totalActions, totalSavedMinutes } from "../runtime";

const BESPOKE: Vertical[] = ["REAL_ESTATE", "CPA", "LAW", "PROPERTY_MANAGEMENT"];

describe("verticals · resolver", () => {
  it("returns the general story for null / unmapped verticals", () => {
    assert.equal(killerWorkflowStoryFor(null).vertical, null);
    assert.equal(killerWorkflowStoryFor(undefined).vertical, null);
    // MORTGAGE has no bespoke story → general fallback.
    assert.equal(killerWorkflowStoryFor("MORTGAGE").vertical, null);
  });

  it("returns a bespoke story for each authored vertical", () => {
    for (const v of BESPOKE) {
      assert.equal(killerWorkflowStoryFor(v).vertical, v, `vertical ${v}`);
    }
  });

  it("exposes the authored set", () => {
    assert.deepEqual([...VERTICALS_WITH_STORY].sort(), [...BESPOKE].sort());
  });
});

describe("verticals · story integrity", () => {
  const verticals: Array<Vertical | null> = [...BESPOKE, null];

  for (const v of verticals) {
    it(`${v ?? "general"} story is well-formed`, () => {
      const s = killerWorkflowStoryFor(v);
      assert.ok(s.headline.length > 0, "headline");
      assert.ok(s.trigger.length > 0, "trigger");
      assert.ok(s.sourceLabel.length > 0, "sourceLabel");
      assert.ok(s.connectIntegrationId.length > 0, "connectIntegrationId");
      assert.ok(s.connectLabel.length > 0, "connectLabel");
      assert.ok(s.counterVerb.length > 0, "counterVerb");
      assert.ok(s.counterNoun.length > 0, "counterNoun");
      assert.ok(s.runsPerTrial > 0, "runsPerTrial");

      assert.ok(s.steps.length >= 4, "at least 4 steps");
      const ids = new Set(s.steps.map((st) => st.id));
      assert.equal(ids.size, s.steps.length, "unique step ids");
      for (const st of s.steps) {
        assert.ok(st.label.length > 0, "step label");
        assert.ok(st.detail.length > 0, "step detail");
        assert.ok(st.runMs > 0, "step runMs");
      }

      // Every story produces a positive, real payoff.
      assert.ok(totalSavedMinutes(s) > 0, "saved minutes");
      assert.ok(totalActions(s) > 0, "actions");
    });
  }

  it("CPA runs the 47-request batch the mandate scoped", () => {
    const s = killerWorkflowStoryFor("CPA");
    const batch = s.steps.find((st) => st.count === 47);
    assert.ok(batch, "has a 47-item batch step");
    assert.equal(batch!.action, "request-doc");
    // 47 requests dominate the actions tally.
    assert.ok(totalActions(s) >= 47);
  });

  it("never names a third-party AI vendor in customer copy", () => {
    for (const v of verticals) {
      const s = killerWorkflowStoryFor(v);
      const blob = JSON.stringify(s).toLowerCase();
      assert.ok(!/claude|anthropic|openai|gpt/.test(blob), `clean copy for ${v}`);
    }
  });
});
