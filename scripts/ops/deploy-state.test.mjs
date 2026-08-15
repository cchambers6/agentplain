// Deliberate-failure tests for the deploy-state check. The canonical fixture
// is the 2026-08-11 real condition: last successful production deployment
// 2026-06-17, every production deployment since in state failure. The test is
// literally "would this have caught the eight-week outage" — on 2026-07-02
// (first ERROR) and on 2026-06-24 (7 days without success), both yes.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./deploy-state.mjs";

const NOW = "2026-08-11T12:00:00Z";

function report(overrides = {}) {
  return {
    generated: NOW,
    environment: "Production",
    latest_production_deployment: { sha: "a".repeat(40), created_at: "2026-08-10T22:04:19Z", state: "success" },
    last_successful_production_deployment: { sha: "a".repeat(40), created_at: "2026-08-10T22:04:19Z", days_ago: 0.6 },
    consecutive_failed_deployments_since_success: 0,
    origin_main: { sha: "a".repeat(40), deployed_to_production: true, undeployed_since: null, commits_not_in_production: 0 },
    walk: { deployments_examined: 1, exhausted_without_success: false },
    ...overrides,
  };
}

test("healthy state produces zero actions and a green run", () => {
  const r = evaluate(report());
  assert.equal(r.red, false);
  assert.equal(r.actions.length, 0);
});

test("the 2026-08-11 real condition fires BOTH alarms", () => {
  const r = evaluate(
    report({
      latest_production_deployment: { sha: "bcaccbe" + "0".repeat(33), created_at: "2026-08-10T22:04:19Z", state: "failure" },
      last_successful_production_deployment: { sha: "c".repeat(40), created_at: "2026-06-17T14:00:00Z", days_ago: 54.9 },
      consecutive_failed_deployments_since_success: 120,
      origin_main: { sha: "bcaccbe" + "0".repeat(33), deployed_to_production: false, undeployed_since: "2026-06-17T14:00:00Z", commits_not_in_production: 180 },
    })
  );
  assert.equal(r.red, true);
  assert.equal(r.actions.length, 2);
  const slugs = r.actions.map((a) => a.slug).sort();
  assert.deepEqual(slugs, ["deploy:error", "deploy:stale"]);
  const stale = r.actions.find((a) => a.slug === "deploy:stale");
  assert.match(stale.body, /deployed_to_production: \*\*false\*\*|deployed to production: \*\*false\*\*/);
  assert.match(stale.body, /undeployed since 2026-06-17T14:00:00Z/);
});

test("no success found within the walk window still alarms (never silently green)", () => {
  const r = evaluate(
    report({
      latest_production_deployment: { sha: "d".repeat(40), created_at: "2026-08-10T22:04:19Z", state: "failure" },
      last_successful_production_deployment: null,
      consecutive_failed_deployments_since_success: 500,
      origin_main: { sha: "d".repeat(40), deployed_to_production: null, undeployed_since: "unknown", commits_not_in_production: null },
      walk: { deployments_examined: 500, exhausted_without_success: true },
    })
  );
  assert.equal(r.red, true);
  assert.equal(r.actions.filter((a) => a.type === "create").length, 2);
});

test("existing open issues are not duplicated while the condition persists", () => {
  const r = evaluate(
    report({
      latest_production_deployment: { sha: "e".repeat(40), created_at: "2026-08-10T22:04:19Z", state: "error" },
      last_successful_production_deployment: { sha: "f".repeat(40), created_at: "2026-06-17T14:00:00Z", days_ago: 54.9 },
      origin_main: { sha: "e".repeat(40), deployed_to_production: false, undeployed_since: "2026-06-17T14:00:00Z", commits_not_in_production: 10 },
    }),
    { openErrorIssue: { number: 7 }, openStaleIssue: { number: 8 } }
  );
  assert.equal(r.red, true);
  assert.equal(r.actions.length, 0);
});

test("recovery closes both open issues", () => {
  const r = evaluate(report(), { openErrorIssue: { number: 7 }, openStaleIssue: { number: 8 } });
  assert.equal(r.red, false);
  assert.deepEqual(
    r.actions.map((a) => [a.type, a.number]).sort((x, y) => x[1] - y[1]),
    [
      ["close", 7],
      ["close", 8],
    ]
  );
});
