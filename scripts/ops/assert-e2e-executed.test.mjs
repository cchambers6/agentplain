// Tests for the E2E evidence assertion.
//
// The distinction that matters: "everything passed" and "nothing ran" must not
// produce the same verdict, and neither must "I could not tell".

import test from "node:test";
import assert from "node:assert/strict";
import { countOutcomes, verdict } from "./assert-e2e-executed.mjs";

test("counts from the stats block when present", () => {
  const c = countOutcomes({ stats: { expected: 12, unexpected: 1, flaky: 2, skipped: 5 } });
  assert.equal(c.source, "stats");
  assert.equal(c.executed, 15);
  assert.equal(c.skipped, 5);
});

test("all-skipped is NOT a pass — this is the actual bug", () => {
  // e2e-nightly's real shape with no E2E_BASE_URL: everything skips, Playwright
  // exits 0, the workflow goes green.
  const v = verdict(countOutcomes({ stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 41 } }));
  assert.equal(v.ok, false);
  assert.equal(v.code, "zero-executed");
});

test("a genuinely empty report is not a pass either", () => {
  const v = verdict(countOutcomes({ stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 } }));
  assert.equal(v.ok, false);
  assert.equal(v.code, "zero-executed");
});

test("real coverage passes, skips alongside it are fine", () => {
  const v = verdict(countOutcomes({ stats: { expected: 30, unexpected: 0, flaky: 0, skipped: 11 } }));
  assert.equal(v.ok, true);
  assert.match(v.message, /30 spec\(s\) executed \(11 skipped\)/);
});

test("failures still count as executed — this checks coverage, not outcome", () => {
  // Playwright's own exit code owns pass/fail. This assertion only answers
  // "did anything actually run", so unexpected results must count as work done.
  const v = verdict(countOutcomes({ stats: { expected: 0, unexpected: 3, flaky: 0, skipped: 0 } }));
  assert.equal(v.ok, true);
});

test("falls back to walking suites when stats is absent", () => {
  const c = countOutcomes({
    suites: [
      {
        specs: [
          { tests: [{ status: "expected" }, { status: "skipped" }] },
        ],
        suites: [{ specs: [{ tests: [{ status: "unexpected" }] }] }],
      },
    ],
  });
  assert.equal(c.source, "suites");
  assert.equal(c.executed, 2);
  assert.equal(c.skipped, 1);
});

test("reads status from the last result when not hoisted onto the test", () => {
  const c = countOutcomes({
    suites: [{ specs: [{ tests: [{ results: [{ status: "expected" }] }] }] }],
  });
  assert.equal(c.executed, 1);
});

test("an unreadable report is INCONCLUSIVE, never a pass", () => {
  const v = verdict(countOutcomes({}));
  assert.equal(v.ok, false);
  assert.equal(v.code, "unreadable");
  assert.match(v.message, /INCONCLUSIVE/);
});
