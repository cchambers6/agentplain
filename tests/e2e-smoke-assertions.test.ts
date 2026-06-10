/**
 * tests/e2e-smoke-assertions.test.ts
 *
 * Offline unit tests for the smoke harness's PURE assertion + matrix logic
 * (evaluateResponse, buildRouteChecks). NO database, NO network — these are
 * the functions the runnable harness uses to decide PASS/FAIL, isolated from
 * `fetch` so the decision logic is verifiable without a running app.
 *
 * NOTE: importing tests/e2e/smoke-authenticated.ts pulls in the pure helpers
 * only; the runnable `main()` is guarded behind an `invokedDirectly` check so
 * importing it never seeds a DB or hits the network.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildRouteChecks,
  evaluateResponse,
  type RouteCheck,
} from "@/tests/e2e/smoke-authenticated";
import { buildSeedPlan } from "@/tests/fixtures/seed-test-workspace";

const CHECK: RouteCheck = {
  name: "demo",
  path: "/x",
  kind: "json",
  expectMarkers: ["ALPHA", "BETA"],
};

describe("evaluateResponse", () => {
  it("passes on 200 with all markers present", () => {
    const o = evaluateResponse(CHECK, 200, "...ALPHA...BETA...");
    assert.equal(o.ok, true);
    assert.deepEqual(o.missingMarkers, []);
  });

  it("fails on a non-200 even when markers are present", () => {
    const o = evaluateResponse(CHECK, 302, "ALPHA BETA");
    assert.equal(o.ok, false);
    assert.equal(o.status, 302);
  });

  it("fails on 200 when a marker is missing, and reports which", () => {
    const o = evaluateResponse(CHECK, 200, "only ALPHA here");
    assert.equal(o.ok, false);
    assert.deepEqual(o.missingMarkers, ["BETA"]);
  });

  it("treats a redirect to sign-in as a FAIL (auth not honored)", () => {
    // redirect: 'manual' surfaces the 307/302 status; we never follow it.
    const o = evaluateResponse(CHECK, 307, "");
    assert.equal(o.ok, false);
  });
});

describe("buildRouteChecks", () => {
  it("covers approvals (API + page), briefings, onboarding, and home", () => {
    const plan = buildSeedPlan({ key: "routes" });
    const checks = buildRouteChecks(plan, plan.workspace.id);
    const names = checks.map((c) => c.name);
    assert.ok(names.some((n) => n.includes("approvals API")));
    assert.ok(names.some((n) => n.includes("approvals page")));
    assert.ok(names.some((n) => n.includes("briefings")));
    assert.ok(names.some((n) => n.includes("onboarding")));
    assert.ok(names.some((n) => n.includes("workspace home")));
  });

  it("routes the JSON API via Bearer and HTML pages via Cookie", () => {
    const plan = buildSeedPlan();
    const checks = buildRouteChecks(plan, plan.workspace.id);
    const api = checks.find((c) => c.path.startsWith("/api/"));
    const home = checks.find((c) => c.name.includes("workspace home"));
    assert.equal(api?.kind, "json");
    assert.equal(home?.kind, "html");
  });

  it("asserts the seeded approval markers on the approvals surfaces", () => {
    const plan = buildSeedPlan({ key: "assert" });
    const checks = buildRouteChecks(plan, plan.workspace.id);
    const approvalsApi = checks.find((c) => c.path.startsWith("/api/"))!;
    for (const m of plan.markers.approvals) {
      assert.ok(approvalsApi.expectMarkers.includes(m));
    }
  });

  it("asserts the workspace name on the home surface and the briefing marker on briefings", () => {
    const plan = buildSeedPlan({ key: "home" });
    const checks = buildRouteChecks(plan, plan.workspace.id);
    const home = checks.find((c) => c.name.includes("workspace home"))!;
    const briefings = checks.find((c) => c.name.includes("briefings"))!;
    assert.ok(home.expectMarkers.includes(plan.markers.workspaceName));
    assert.ok(briefings.expectMarkers.includes(plan.markers.briefing));
  });
});
