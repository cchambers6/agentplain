/**
 * lib/ops/fleet-health.test.ts
 *
 * The pure core: each metric computes from raw inputs, breach → severity +
 * recommended action, all-green renders the weekly confirmation, thresholds
 * resolve from env. No DB, no clock beyond the supplied `now`.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeFleetHealthSnapshot,
  renderFleetHealthDigest,
  resolveThresholds,
  DEFAULT_FLEET_HEALTH_THRESHOLDS,
  verticalHasLiveWorkflow,
  type FleetHealthInputs,
} from "./fleet-health";

const NOW = new Date("2026-06-10T10:00:00Z");

/** A fully-green input set. Individual tests override one field to breach. */
function greenInputs(): FleetHealthInputs {
  return {
    llmSpendUsd: 100,
    llmCapUsd: 1000,
    sentinelPaused: false,
    invalidGlobalCredentials: [],
    brokenWorkspaceIntegrations: 0,
    oldestSupportBacklogHours: 2,
    unsupportedVerticalSignups24h: 0,
    pastDueAgedWorkspaces: 0,
    pagesLast24h: 0,
    hoursSinceLastSuccess: 23,
  };
}

describe("computeFleetHealthSnapshot — all green", () => {
  it("breaches nothing and is info-severity", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs(),
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    assert.equal(snap.anyBreached, false);
    assert.deepEqual(snap.breaches, []);
    assert.equal(snap.overallSeverity, "info");
    assert.equal(snap.metrics.length, 7);
    assert.equal(snap.heartbeatWasStale, false);
  });
});

describe("computeFleetHealthSnapshot — each metric breaches independently", () => {
  it("LLM spend over the warn fraction breaches with a cap recommendation", () => {
    const inputs = greenInputs();
    inputs.llmSpendUsd = 950; // 95% of the $1000 cap, default warn 0.9
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "llm_spend_vs_cap");
    assert.ok(m, "spend metric breached");
    assert.match(m!.recommendedAction, /cap/i);
  });

  it("sentinel-paused forces a spend breach even when spend is low", () => {
    const inputs = greenInputs();
    inputs.sentinelPaused = true;
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "llm_spend_vs_cap");
    assert.ok(m, "paused sentinel breaches the spend gauge");
    assert.match(m!.detail, /sentinel-paused/i);
    assert.match(m!.recommendedAction, /ANTHROPIC_API_KEY|paused/i);
  });

  it("a dead fleet-global credential is critical and names restore-in-Vercel", () => {
    const inputs = greenInputs();
    inputs.invalidGlobalCredentials = ["STRIPE"];
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "integration_breakage");
    assert.ok(m);
    assert.equal(m!.severity, "critical");
    assert.match(m!.recommendedAction, /Vercel/);
    assert.equal(snap.overallSeverity, "critical");
  });

  it("per-workspace breakage over the count threshold warns", () => {
    const inputs = greenInputs();
    inputs.brokenWorkspaceIntegrations = 4; // default max 3
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "integration_breakage");
    assert.ok(m);
    assert.equal(m!.severity, "warn");
    assert.match(m!.recommendedAction, /\/operator\/integrations/);
  });

  it("support backlog over 2x threshold escalates to critical", () => {
    const inputs = greenInputs();
    inputs.oldestSupportBacklogHours = 50; // > 24*2
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "support_backlog_age");
    assert.ok(m);
    assert.equal(m!.severity, "critical");
    assert.match(m!.recommendedAction, /\/operator\/support/);
  });

  it("any unsupported-vertical signup breaches (default max 0)", () => {
    const inputs = greenInputs();
    inputs.unsupportedVerticalSignups24h = 1;
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "unsupported_vertical_signups");
    assert.ok(m);
    assert.match(m!.recommendedAction, /killer workflow|first-value/i);
  });

  it("any aged PAST_DUE workspace breaches (default max 0)", () => {
    const inputs = greenInputs();
    inputs.pastDueAgedWorkspaces = 2;
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "past_due_aged");
    assert.ok(m);
    assert.match(m!.recommendedAction, /PAST_DUE/);
  });

  it("page volume over the threshold warns", () => {
    const inputs = greenInputs();
    inputs.pagesLast24h = 6; // default max 5
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "pages_last_24h");
    assert.ok(m);
    assert.match(m!.recommendedAction, /page_human|root/i);
  });
});

describe("computeFleetHealthSnapshot — heartbeat self-monitoring", () => {
  it("a >48h gap since last success breaches critical and sets heartbeatWasStale", () => {
    const inputs = greenInputs();
    inputs.hoursSinceLastSuccess = 60;
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.breaches.find((b) => b.id === "heartbeat_staleness");
    assert.ok(m);
    assert.equal(m!.severity, "critical");
    assert.equal(snap.heartbeatWasStale, true);
    assert.match(m!.recommendedAction, /Inngest/);
  });

  it("first-ever run (null) does not breach the heartbeat metric", () => {
    const inputs = greenInputs();
    inputs.hoursSinceLastSuccess = null;
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const m = snap.metrics.find((b) => b.id === "heartbeat_staleness");
    assert.ok(m);
    assert.equal(m!.breached, false);
    assert.equal(snap.heartbeatWasStale, false);
  });
});

describe("renderFleetHealthDigest", () => {
  it("breach digest leads with breaches + recommended actions", () => {
    const inputs = greenInputs();
    inputs.invalidGlobalCredentials = ["RESEND"];
    inputs.pastDueAgedWorkspaces = 1;
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const digest = renderFleetHealthDigest(snap, "breach");
    assert.equal(digest.severity, "critical");
    assert.match(digest.summary, /breached/);
    assert.match(digest.details, /BREACHES/);
    assert.match(digest.details, /ACTION:/);
    assert.match(digest.details, /\/operator\/fleet-health/);
  });

  it("weekly all-green digest confirms the pipe works and pages no one critically", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs(),
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const digest = renderFleetHealthDigest(snap, "weekly");
    assert.equal(digest.severity, "info");
    assert.match(digest.summary, /all green/i);
    assert.match(digest.details, /weekly Monday confirmation/);
  });

  it("breach digest surfaces a stale-heartbeat banner at the top", () => {
    const inputs = greenInputs();
    inputs.hoursSinceLastSuccess = 72;
    const snap = computeFleetHealthSnapshot({
      inputs,
      thresholds: DEFAULT_FLEET_HEALTH_THRESHOLDS,
      now: NOW,
    });
    const digest = renderFleetHealthDigest(snap, "breach");
    assert.match(digest.details, /HEARTBEAT ITSELF HAD STOPPED/);
    assert.match(digest.summary, /stale heartbeat/);
  });
});

describe("resolveThresholds", () => {
  it("uses documented defaults when env is empty", () => {
    const t = resolveThresholds({} as NodeJS.ProcessEnv);
    assert.deepEqual(t, DEFAULT_FLEET_HEALTH_THRESHOLDS);
  });

  it("reads each env override", () => {
    const t = resolveThresholds({
      FLEET_HEALTH_SUPPORT_BACKLOG_MAX_HOURS: "12",
      FLEET_HEALTH_PAGES_LAST_24H_MAX: "10",
      FLEET_HEALTH_HEARTBEAT_STALE_MAX_HOURS: "36",
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(t.supportBacklogMaxHours, 12);
    assert.equal(t.pagesLast24hMax, 10);
    assert.equal(t.heartbeatStaleMaxHours, 36);
    // untouched ones keep defaults
    assert.equal(t.integrationBreakageMax, DEFAULT_FLEET_HEALTH_THRESHOLDS.integrationBreakageMax);
  });

  it("ignores a malformed override and keeps the default", () => {
    const t = resolveThresholds({
      FLEET_HEALTH_PAGES_LAST_24H_MAX: "not-a-number",
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(t.pagesLast24hMax, DEFAULT_FLEET_HEALTH_THRESHOLDS.pagesLast24hMax);
  });
});

describe("verticalHasLiveWorkflow (minimal registry-truth resolver)", () => {
  it("the fireable verticals are live", () => {
    for (const v of ["REAL_ESTATE", "CPA", "HOME_SERVICES", "LAW"] as const) {
      assert.equal(verticalHasLiveWorkflow(v), true, `${v} should be live`);
    }
  });

  it("an integration-gated vertical is not live yet", () => {
    assert.equal(verticalHasLiveWorkflow("INSURANCE"), false);
    assert.equal(verticalHasLiveWorkflow("MORTGAGE"), false);
  });

  it("a null vertical is covered by the general workflow", () => {
    assert.equal(verticalHasLiveWorkflow(null), true);
  });
});
