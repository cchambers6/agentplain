import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WELCOME_TOUR_STEPS,
  NAV_TOUR_KEYS,
} from "@/lib/onboarding/tour-steps";

// Pins the first-run walkthrough's contract so a nav rename or a copy edit
// can't silently break it. The tour itself is exercised end-to-end in the
// Playwright customer-path suite; here we lock the declarative wiring.

describe("welcome tour step config", () => {
  it("opens with a centered welcome gate and closes with a centered end card", () => {
    const first = WELCOME_TOUR_STEPS[0];
    const last = WELCOME_TOUR_STEPS[WELCOME_TOUR_STEPS.length - 1];
    assert.equal(first.id, "welcome");
    assert.equal(first.selector, null);
    assert.equal(first.placement, "center");
    assert.equal(last.id, "end");
    assert.equal(last.selector, null);
    assert.equal(last.placement, "center");
  });

  it("every anchored step targets a data-tour key the layout actually stamps", () => {
    const stamped = new Set(Object.values(NAV_TOUR_KEYS));
    const anchored = WELCOME_TOUR_STEPS.filter((s) => s.selector !== null);
    // Five anchored steps: Overview / Talk / Connections / Approvals / Settings.
    assert.equal(anchored.length, 5);
    for (const step of anchored) {
      const match = /\[data-tour="([^"]+)"\]/.exec(step.selector ?? "");
      assert.ok(match, `step ${step.id} selector must be a [data-tour=...] hook`);
      assert.ok(
        stamped.has(match![1]),
        `step ${step.id} targets "${match![1]}" which NAV_TOUR_KEYS does not stamp`,
      );
    }
  });

  it("each step carries an eyebrow, title, and body", () => {
    for (const step of WELCOME_TOUR_STEPS) {
      assert.ok(step.eyebrow.length > 0, `${step.id} missing eyebrow`);
      assert.ok(step.title.length > 0, `${step.id} missing title`);
      assert.ok(step.body.length > 20, `${step.id} body too thin`);
    }
  });

  it("approvals copy respects the no-outbound stance (Plaino never sends)", () => {
    // project_no_outbound_architecture: agents draft/advise; the customer's
    // own system executes the send. The approvals step must not claim Plaino
    // sends on the customer's behalf.
    const approvals = WELCOME_TOUR_STEPS.find((s) => s.id === "approvals");
    assert.ok(approvals);
    assert.match(approvals!.body, /you sign/i);
    assert.doesNotMatch(approvals!.body, /\bI('| wi)?ll send\b/i);
  });
});
