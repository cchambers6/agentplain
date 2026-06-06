/**
 * tests/billing-budget.test.ts
 *
 * The shared budget seam (`lib/billing/budget.ts`). The operator inspector
 * and the budget-enforcement wave both derive status from these pure
 * functions, so the OVER threshold, the cap resolution, and the micro-cent →
 * USD conversion are pinned here once.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BUDGET_SETTINGS_KEY,
  BUDGET_WARN_THRESHOLD,
  deriveBudgetState,
  deriveBudgetStatus,
  isOverBudget,
  microCentsToUsd,
  resolveBudgetCapUsd,
} from "@/lib/billing/budget";

const USD = 100_000_000n; // micro-cents per dollar

describe("microCentsToUsd", () => {
  it("converts exactly on whole dollars", () => {
    assert.equal(microCentsToUsd(200n * USD), 200);
    assert.equal(microCentsToUsd(0n), 0);
  });
});

describe("deriveBudgetState", () => {
  it("NO_CAP when percent is null", () => {
    assert.equal(deriveBudgetState(null), "NO_CAP");
  });
  it("OK below the warn threshold", () => {
    assert.equal(deriveBudgetState(0), "OK");
    assert.equal(deriveBudgetState(BUDGET_WARN_THRESHOLD - 0.01), "OK");
  });
  it("WARN from the threshold up to the cap", () => {
    assert.equal(deriveBudgetState(BUDGET_WARN_THRESHOLD), "WARN");
    assert.equal(deriveBudgetState(0.99), "WARN");
  });
  it("OVER at and beyond the cap", () => {
    assert.equal(deriveBudgetState(1), "OVER");
    assert.equal(deriveBudgetState(2.5), "OVER");
  });
});

describe("deriveBudgetStatus", () => {
  it("no cap → NO_CAP, null percent/remaining, raw spend preserved", () => {
    const s = deriveBudgetStatus({
      workspaceId: "ws-1",
      consumedMicroCents: 50n * USD,
      capUsdMonthly: null,
    });
    assert.equal(s.state, "NO_CAP");
    assert.equal(s.percentUsed, null);
    assert.equal(s.remainingUsd, null);
    assert.equal(s.consumedUsd, 50);
    assert.equal(s.capUsdMonthly, null);
  });

  it("under cap → OK with positive remaining", () => {
    const s = deriveBudgetStatus({
      workspaceId: "ws-1",
      consumedMicroCents: 40n * USD,
      capUsdMonthly: 100,
    });
    assert.equal(s.state, "OK");
    assert.equal(s.percentUsed, 0.4);
    assert.equal(s.remainingUsd, 60);
    assert.equal(isOverBudget(s), false);
  });

  it("at the warn threshold → WARN", () => {
    const s = deriveBudgetStatus({
      workspaceId: "ws-1",
      consumedMicroCents: 80n * USD,
      capUsdMonthly: 100,
    });
    assert.equal(s.state, "WARN");
  });

  it("over cap → OVER with negative remaining", () => {
    const s = deriveBudgetStatus({
      workspaceId: "ws-1",
      consumedMicroCents: 130n * USD,
      capUsdMonthly: 100,
      tokensThisPeriod: 9999,
    });
    assert.equal(s.state, "OVER");
    assert.equal(s.remainingUsd, -30);
    assert.equal(s.tokensThisPeriod, 9999);
    assert.equal(isOverBudget(s), true);
  });

  it("treats a zero or negative cap as no cap (avoids divide-by-zero)", () => {
    const zero = deriveBudgetStatus({
      workspaceId: "ws-1",
      consumedMicroCents: 10n * USD,
      capUsdMonthly: 0,
    });
    assert.equal(zero.state, "NO_CAP");
    assert.equal(zero.percentUsed, null);
  });
});

describe("resolveBudgetCapUsd", () => {
  it("reads a positive number under the settings key", () => {
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 250 }), 250);
  });
  it("falls back when the key is missing, zero, negative, or non-numeric", () => {
    assert.equal(resolveBudgetCapUsd({}, 99), 99);
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 0 }, 99), 99);
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: -5 }, 99), 99);
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: "200" }, 99), 99);
    assert.equal(resolveBudgetCapUsd(null, 99), 99);
    assert.equal(resolveBudgetCapUsd(undefined), null);
  });
});
