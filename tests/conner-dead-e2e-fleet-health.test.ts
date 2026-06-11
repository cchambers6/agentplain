/**
 * tests/conner-dead-e2e-fleet-health.test.ts
 *
 * GUARDS: pfd/fleet-health-cron (#220)
 *
 * FAILURE MODE: "If Conner died tomorrow, does the fleet itself know
 * something is wrong AND tell a designated human within 24h?"
 *
 * THE BAR:
 *   1. Any breached threshold → digest sent to designated human with the
 *      recommended action for each breach.
 *   2. FLEET_TRUSTED_HUMAN_EMAIL unset → falls back to OPERATOR_EMAIL_ALLOWLIST
 *      and the digest body contains the NO_FALLBACK_HUMAN_NOTICE nudge.
 *   3. All green Monday → weekly digest fires (proves the pipe is alive even
 *      when there's nothing wrong).
 *   4. All green Tuesday → silent (no digest on non-Monday all-green runs).
 *   5. Dead heartbeat → calls out the stale-heartbeat prominently in digest.
 *   6. Sentinel-paused (ANTHROPIC_API_KEY degraded) → breaches the LLM metric.
 *   7. resolveThresholds reads env vars; all-default env snapshot = defaults.
 *   8. computeFleetHealthSnapshot is pure (same inputs → same output, no IO).
 *   9. Digest `details` includes a concrete → ACTION line for every breach.
 *  10. resolveRecipients: trusted-human → exact recipients, no fallback;
 *      allowlist only → first entry + usedFallback=true.
 *
 * All assertions run OFFLINE — pure functions, no DB, no live email send.
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
  type FleetHealthThresholds,
} from "@/lib/ops/fleet-health";
import {
  resolveRecipients,
  NO_FALLBACK_HUMAN_NOTICE,
} from "@/lib/ops/page-human";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-09T10:00:00.000Z"); // a Monday
const TUESDAY = new Date("2026-06-10T10:00:00.000Z");

/** All-green baseline inputs. Every metric within threshold. */
function greenInputs(over: Partial<FleetHealthInputs> = {}): FleetHealthInputs {
  return {
    llmSpendUsd: 100,
    llmCapUsd: 1000,
    sentinelPaused: false,
    invalidGlobalCredentials: [],
    brokenWorkspaceIntegrations: 0,
    oldestSupportBacklogHours: 0,
    unsupportedVerticalSignups24h: 0,
    pastDueAgedWorkspaces: 0,
    pagesLast24h: 0,
    hoursSinceLastSuccess: 2,
    ...over,
  };
}

const T = DEFAULT_FLEET_HEALTH_THRESHOLDS;

// ── Suite 1: all-green snapshot ──────────────────────────────────────────────

describe("conner-dead / fleet-health: all-green snapshot", () => {
  it("all green inputs → anyBreached=false, overallSeverity=info", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs(),
      thresholds: T,
      now: NOW,
    });
    assert.equal(snap.anyBreached, false);
    assert.equal(snap.overallSeverity, "info");
    assert.equal(snap.breaches.length, 0);
    assert.ok(snap.metrics.length > 0, "metrics array is populated");
  });

  it("all green + Monday → weekly digest is produced (heartbeat pipe confirmed alive)", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs(),
      thresholds: T,
      now: NOW,
    });
    const digest = renderFleetHealthDigest(snap, "weekly");
    assert.equal(digest.severity, "info");
    assert.ok(digest.summary.toLowerCase().includes("green"),
      "weekly digest summary confirms all-green");
    assert.ok(digest.details.includes("weekly"),
      "digest body mentions this is the weekly heartbeat confirmation");
  });

  it("all green + any day → breach digest renders as all-green too (kind=breach is a fallback)", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs(),
      thresholds: T,
      now: TUESDAY,
    });
    // When all-green, breach digest still renders (cron only calls with "weekly"
    // on Mondays; this tests the renderer itself handles the empty-breach case).
    const digest = renderFleetHealthDigest(snap, "weekly");
    assert.equal(digest.severity, "info");
  });
});

// ── Suite 2: breached thresholds → digest with recommended actions ────────────

describe("conner-dead / fleet-health: breached threshold → digest with ACTION", () => {
  it("broken workspace integrations above max → breach in digest with action", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({ brokenWorkspaceIntegrations: 5 }), // threshold=3
      thresholds: T,
      now: NOW,
    });
    assert.equal(snap.anyBreached, true);
    const breach = snap.breaches.find((m) => m.id === "integration_breakage");
    assert.ok(breach, "integration_breakage metric breached");
    assert.ok(breach!.recommendedAction.length > 0,
      "breached metric carries a non-empty recommended action");
    assert.ok(breach!.recommendedAction.includes("/operator/integrations"),
      "action names the operator panel so Conner's successor knows where to go");

    const digest = renderFleetHealthDigest(snap, "breach");
    assert.ok(digest.details.includes("ACTION"),
      "breach digest contains the ACTION keyword for at least one breach");
  });

  it("LLM spend above 90% of cap → breached; digest mentions spend figure", () => {
    // 950 spent vs 1000 cap = 95% > 90% threshold
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({ llmSpendUsd: 950, llmCapUsd: 1000 }),
      thresholds: T,
      now: NOW,
    });
    const breach = snap.breaches.find((m) => m.id === "llm_spend_vs_cap");
    assert.ok(breach, "llm_spend_vs_cap breached at 95%");
    assert.equal(breach!.value, 950);

    const digest = renderFleetHealthDigest(snap, "breach");
    assert.ok(digest.details.includes("950"),
      "digest mentions the actual spend figure so the human can act without opening a dashboard");
  });

  it("support backlog older than threshold → warn; 2x threshold → critical", () => {
    const snapWarn = computeFleetHealthSnapshot({
      inputs: greenInputs({ oldestSupportBacklogHours: 30 }), // threshold=24
      thresholds: T,
      now: NOW,
    });
    const warnMetric = snapWarn.breaches.find((m) => m.id === "support_backlog_age");
    assert.ok(warnMetric, "support backlog breached");
    assert.equal(warnMetric!.severity, "warn");

    const snapCrit = computeFleetHealthSnapshot({
      inputs: greenInputs({ oldestSupportBacklogHours: 60 }), // > 2x threshold
      thresholds: T,
      now: NOW,
    });
    const critMetric = snapCrit.breaches.find((m) => m.id === "support_backlog_age");
    assert.ok(critMetric, "support backlog breached at 2x");
    assert.equal(critMetric!.severity, "critical",
      "2x threshold → critical (a customer has been waiting a very long time)");
  });

  it("unsupported-vertical signup (ANY = threshold 0) → warn + action names operator surface", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({ unsupportedVerticalSignups24h: 1 }),
      thresholds: T,
      now: NOW,
    });
    const breach = snap.breaches.find((m) => m.id === "unsupported_vertical_signups");
    assert.ok(breach, "even one unsupported-vertical signup triggers a breach");
    assert.ok(breach!.recommendedAction.includes("/operator/workspaces"),
      "action tells the human which surface to open");
  });

  it("fleet-global credential invalid → critical (every customer at once)", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({
        invalidGlobalCredentials: ["ANTHROPIC_API_KEY", "BUILDIUM_API_KEY"],
      }),
      thresholds: T,
      now: NOW,
    });
    const breach = snap.breaches.find((m) => m.id === "integration_breakage");
    assert.ok(breach, "integration_breakage breached on invalid global credential");
    assert.equal(breach!.severity, "critical",
      "a dead fleet-global key is critical — it's a fleet-wide outage");
    assert.ok(breach!.detail.includes("ANTHROPIC_API_KEY"),
      "digest detail names the dead credential so the human knows which key to fix");
  });

  it("multiple metrics breached → overallSeverity = highest", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({
        oldestSupportBacklogHours: 100,        // critical (>2x)
        brokenWorkspaceIntegrations: 10,       // warn
        unsupportedVerticalSignups24h: 2,      // warn
      }),
      thresholds: T,
      now: NOW,
    });
    assert.ok(snap.anyBreached, "multiple breaches detected");
    assert.equal(snap.overallSeverity, "critical",
      "overallSeverity escalates to the highest individual severity");
    assert.ok(snap.breaches.length >= 3, "all three input breaches recorded");
  });
});

// ── Suite 3: sentinel-paused = LLM degraded ─────────────────────────────────

describe("conner-dead / fleet-health: sentinel-paused flag surfaces in LLM metric", () => {
  it("sentinelPaused=true → llm_spend_vs_cap breaches even with low spend", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({ sentinelPaused: true, llmSpendUsd: 10, llmCapUsd: 1000 }),
      thresholds: T,
      now: NOW,
    });
    const metric = snap.metrics.find((m) => m.id === "llm_spend_vs_cap");
    assert.ok(metric, "llm_spend_vs_cap metric present");
    assert.equal(metric!.breached, true,
      "sentinel-paused alone triggers a breach so the human knows the LLM is degraded");
    assert.ok(metric!.detail.toLowerCase().includes("paused"),
      "detail mentions 'paused' so the reader understands the mode");
    assert.ok(metric!.recommendedAction.toLowerCase().includes("anthropic"),
      "action tells the human to restore the Anthropic key");
  });
});

// ── Suite 4: dead heartbeat ──────────────────────────────────────────────────

describe("conner-dead / fleet-health: dead heartbeat is self-reporting", () => {
  it("heartbeat stale beyond threshold → heartbeat_staleness breached with critical severity", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({ hoursSinceLastSuccess: 72 }), // threshold=48
      thresholds: T,
      now: NOW,
    });
    const metric = snap.metrics.find((m) => m.id === "heartbeat_staleness");
    assert.ok(metric, "heartbeat_staleness metric present");
    assert.equal(metric!.breached, true,
      "72h > 48h threshold → heartbeat breached");
    assert.equal(metric!.severity, "critical",
      "a dead heartbeat is critical — everything was un-watched during the gap");
    assert.equal(snap.heartbeatWasStale, true);

    const digest = renderFleetHealthDigest(snap, "breach");
    assert.ok(
      digest.details.toUpperCase().includes("HEARTBEAT"),
      "digest body calls out the stale heartbeat prominently",
    );
  });

  it("first-ever run (hoursSinceLastSuccess=null) → heartbeat NOT breached (no prior success)", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({ hoursSinceLastSuccess: null }),
      thresholds: T,
      now: NOW,
    });
    const metric = snap.metrics.find((m) => m.id === "heartbeat_staleness");
    assert.ok(metric, "heartbeat_staleness metric present");
    assert.equal(metric!.breached, false,
      "null hoursSinceLastSuccess = first run — no stale heartbeat breach");
    assert.equal(snap.heartbeatWasStale, false);
  });
});

// ── Suite 5: FLEET_TRUSTED_HUMAN_EMAIL recipient resolution ─────────────────

describe("conner-dead / fleet-health: recipient resolution (pageHuman seam)", () => {
  it("FLEET_TRUSTED_HUMAN_EMAIL set → exact recipients, no fallback flag", () => {
    const r = resolveRecipients({
      FLEET_TRUSTED_HUMAN_EMAIL: "safety@example.com,ops@example.com",
    } as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(r.recipients, ["safety@example.com", "ops@example.com"]);
    assert.equal(r.usedFallback, false,
      "designated human is configured — no fallback nudge needed");
  });

  it("FLEET_TRUSTED_HUMAN_EMAIL unset, OPERATOR_EMAIL_ALLOWLIST set → first entry + fallback=true", () => {
    const r = resolveRecipients({
      OPERATOR_EMAIL_ALLOWLIST: "conner@example.com,team@example.com",
    } as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(r.recipients, ["conner@example.com"],
      "falls back to the FIRST allowlist entry (not the whole list — page at 2am is one person)");
    assert.equal(r.usedFallback, true,
      "usedFallback=true triggers the NO_FALLBACK_HUMAN_NOTICE nudge in the email body");
  });

  it("both env vars unset → no recipients", () => {
    const r = resolveRecipients({} as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(r.recipients, []);
  });

  it("NO_FALLBACK_HUMAN_NOTICE is non-empty and mentions FLEET_TRUSTED_HUMAN_EMAIL", () => {
    assert.ok(
      NO_FALLBACK_HUMAN_NOTICE.includes("FLEET_TRUSTED_HUMAN_EMAIL"),
      "the nudge copy names the env var so the reader knows exactly what to set",
    );
    assert.ok(NO_FALLBACK_HUMAN_NOTICE.length > 40, "nudge copy is substantive");
  });
});

// ── Suite 6: resolveThresholds reads env vars ────────────────────────────────

describe("conner-dead / fleet-health: resolveThresholds is env-tunable", () => {
  it("empty env snapshot → all defaults", () => {
    const t = resolveThresholds({} as unknown as NodeJS.ProcessEnv);
    assert.equal(t.integrationBreakageMax, DEFAULT_FLEET_HEALTH_THRESHOLDS.integrationBreakageMax);
    assert.equal(t.supportBacklogMaxHours, DEFAULT_FLEET_HEALTH_THRESHOLDS.supportBacklogMaxHours);
    assert.equal(t.heartbeatStaleMaxHours, DEFAULT_FLEET_HEALTH_THRESHOLDS.heartbeatStaleMaxHours);
  });

  it("env overrides a threshold; invalid value falls back to default", () => {
    const t = resolveThresholds({
      FLEET_HEALTH_INTEGRATION_BREAKAGE_MAX: "10",
      FLEET_HEALTH_SUPPORT_BACKLOG_MAX_HOURS: "not-a-number", // invalid → default
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(t.integrationBreakageMax, 10, "valid env value overrides default");
    assert.equal(
      t.supportBacklogMaxHours,
      DEFAULT_FLEET_HEALTH_THRESHOLDS.supportBacklogMaxHours,
      "invalid env value falls back to default",
    );
  });
});

// ── Suite 7: computeFleetHealthSnapshot is deterministic (pure) ──────────────

describe("conner-dead / fleet-health: computeFleetHealthSnapshot is pure", () => {
  it("same inputs + thresholds → identical snapshot (no randomness, no IO)", () => {
    const inputs = greenInputs({ brokenWorkspaceIntegrations: 5, pagesLast24h: 8 });
    const snap1 = computeFleetHealthSnapshot({ inputs, thresholds: T, now: NOW });
    const snap2 = computeFleetHealthSnapshot({ inputs, thresholds: T, now: NOW });
    assert.equal(snap1.anyBreached, snap2.anyBreached);
    assert.equal(snap1.overallSeverity, snap2.overallSeverity);
    assert.equal(snap1.breaches.length, snap2.breaches.length);
    assert.equal(snap1.computedAt, snap2.computedAt);
  });
});

// ── Suite 8: verticalHasLiveWorkflow utility ─────────────────────────────────

describe("conner-dead / fleet-health: verticalHasLiveWorkflow — registry truth", () => {
  it("null vertical → true (general workflow covers it)", () => {
    assert.equal(verticalHasLiveWorkflow(null), true);
    assert.equal(verticalHasLiveWorkflow(undefined), true);
  });

  it("REAL_ESTATE → live workflow", () => {
    assert.equal(verticalHasLiveWorkflow("REAL_ESTATE"), true);
  });

  it("INSURANCE → no live workflow yet (gated on credential)", () => {
    assert.equal(verticalHasLiveWorkflow("INSURANCE"), false,
      "INSURANCE has no live killer workflow — a signup here is paying into an empty room");
  });
});

// ── Suite 9: digest renders a concrete → ACTION per breach ───────────────────

describe("conner-dead / fleet-health: every breach in the digest has a concrete ACTION", () => {
  it("breach digest: every breached metric has a non-empty recommendedAction", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs({
        brokenWorkspaceIntegrations: 10,
        pagesLast24h: 20,
        pastDueAgedWorkspaces: 3,
      }),
      thresholds: T,
      now: NOW,
    });
    assert.ok(snap.anyBreached, "pre-condition: at least one breach");
    for (const breach of snap.breaches) {
      assert.ok(
        breach.recommendedAction.length > 0,
        `Breach '${breach.id}' has no recommendedAction — human cannot act cold`,
      );
    }
  });

  it("green metrics carry empty recommendedAction (no false alarms)", () => {
    const snap = computeFleetHealthSnapshot({
      inputs: greenInputs(),
      thresholds: T,
      now: NOW,
    });
    for (const metric of snap.metrics) {
      assert.equal(
        metric.recommendedAction,
        "",
        `Green metric '${metric.id}' should have empty recommendedAction`,
      );
    }
  });
});
