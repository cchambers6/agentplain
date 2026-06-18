/**
 * lib/billing/budget-daily.test.ts
 *
 * Unit tests for the daily-cap extension to the budget seam: the daily
 * settings-key resolver/merger and the controlling-status picker that lets
 * the gate block on whichever of (daily, monthly) is stricter.
 *
 * No DB, no network. Pure functions only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAILY_BUDGET_SETTINGS_KEY,
  resolveDailyBudgetCapUsd,
  withDailyBudgetCapUsd,
  controllingBudgetStatus,
  deriveBudgetStatus,
  BUDGET_SETTINGS_KEY,
} from './budget';

describe('resolveDailyBudgetCapUsd', () => {
  it('returns null when the daily key is absent', () => {
    assert.equal(resolveDailyBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 200 }), null);
  });

  it('reads the daily key independently of the monthly key', () => {
    const settings = {
      [BUDGET_SETTINGS_KEY]: 200,
      [DAILY_BUDGET_SETTINGS_KEY]: 25,
    };
    assert.equal(resolveDailyBudgetCapUsd(settings), 25);
  });

  it('rejects non-positive / non-number daily caps', () => {
    assert.equal(resolveDailyBudgetCapUsd({ [DAILY_BUDGET_SETTINGS_KEY]: 0 }), null);
    assert.equal(resolveDailyBudgetCapUsd({ [DAILY_BUDGET_SETTINGS_KEY]: -5 }), null);
    assert.equal(resolveDailyBudgetCapUsd({ [DAILY_BUDGET_SETTINGS_KEY]: '25' }), null);
  });

  it('honors the fallback when absent', () => {
    assert.equal(resolveDailyBudgetCapUsd({}, 10), 10);
  });
});

describe('withDailyBudgetCapUsd', () => {
  it('sets the daily key without touching the monthly key', () => {
    const out = withDailyBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 200 }, 25);
    assert.equal(out[DAILY_BUDGET_SETTINGS_KEY], 25);
    assert.equal(out[BUDGET_SETTINGS_KEY], 200);
  });

  it('clears the daily key when null', () => {
    const out = withDailyBudgetCapUsd(
      { [DAILY_BUDGET_SETTINGS_KEY]: 25, other: true },
      null,
    );
    assert.equal(out[DAILY_BUDGET_SETTINGS_KEY], undefined);
    assert.equal(out.other, true);
  });

  it('rounds fractional caps and does not mutate the input', () => {
    const input = { [DAILY_BUDGET_SETTINGS_KEY]: 10 };
    const out = withDailyBudgetCapUsd(input, 25.7);
    assert.equal(out[DAILY_BUDGET_SETTINGS_KEY], 26);
    assert.equal(input[DAILY_BUDGET_SETTINGS_KEY], 10);
  });
});

describe('controllingBudgetStatus', () => {
  const status = (consumedUsd: number, cap: number | null) =>
    deriveBudgetStatus({
      workspaceId: 'ws',
      consumedMicroCents: BigInt(consumedUsd) * 100_000_000n,
      capUsdMonthly: cap,
    });

  it('returns the OVER dimension over a WARN/OK dimension', () => {
    const monthly = status(50, 200); // OK
    const daily = status(25, 25); // OVER (100%)
    assert.equal(controllingBudgetStatus(monthly, daily), daily);
  });

  it('returns the WARN dimension over an OK/NO_CAP dimension', () => {
    const monthly = status(10, 200); // OK
    const daily = status(22, 25); // 88% → WARN
    assert.equal(controllingBudgetStatus(monthly, daily), daily);
  });

  it('prefers the first arg (monthly) on a tie', () => {
    const monthly = status(200, 200); // OVER
    const daily = status(25, 25); // OVER
    assert.equal(controllingBudgetStatus(monthly, daily), monthly);
  });

  it('treats NO_CAP as non-controlling against any real spend state', () => {
    const monthly = status(180, 200); // 90% → WARN
    const daily = status(999, null); // NO_CAP
    assert.equal(controllingBudgetStatus(monthly, daily), monthly);
  });
});
