/**
 * lib/billing/budget-alerts.test.ts
 *
 * Unit tests for the pure budget-alert logic: period keys, the dedup
 * watermark read/merge, the per-dimension threshold decision, the combined
 * workspace evaluation, and the email composition. No DB, no clock, no email
 * provider — every IO dependency is injected by the sweep, not these functions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { deriveBudgetStatus, type WorkspaceDualBudget } from './budget';
import {
  BUDGET_ALERT_THRESHOLDS,
  BUDGET_ALERT_SETTINGS_KEY,
  monthlyPeriodKey,
  dailyPeriodKey,
  readBudgetAlertState,
  withBudgetAlertState,
  decideDimensionAlert,
  evaluateWorkspaceAlerts,
  composeBudgetAlertEmail,
} from './budget-alerts';

const statusFor = (consumedUsd: number, cap: number | null) =>
  deriveBudgetStatus({
    workspaceId: 'ws',
    consumedMicroCents: BigInt(Math.round(consumedUsd * 100)) * 1_000_000n,
    capUsdMonthly: cap,
  });

describe('period keys (UTC)', () => {
  it('monthlyPeriodKey is YYYY-MM', () => {
    assert.equal(monthlyPeriodKey(new Date('2026-06-17T20:00:00Z')), '2026-06');
    assert.equal(monthlyPeriodKey(new Date('2026-01-01T00:00:00Z')), '2026-01');
  });

  it('dailyPeriodKey is YYYY-MM-DD', () => {
    assert.equal(dailyPeriodKey(new Date('2026-06-17T20:00:00Z')), '2026-06-17');
  });

  it('thresholds are 50/75/90 ascending', () => {
    assert.deepEqual([...BUDGET_ALERT_THRESHOLDS], [0.5, 0.75, 0.9]);
  });
});

describe('readBudgetAlertState / withBudgetAlertState', () => {
  it('returns {} for missing/garbage settings', () => {
    assert.deepEqual(readBudgetAlertState(null), {});
    assert.deepEqual(readBudgetAlertState('nope'), {});
    assert.deepEqual(readBudgetAlertState({}), {});
  });

  it('round-trips a written watermark', () => {
    const state = {
      monthly: { periodKey: '2026-06', firedPct: 0.75 },
      daily: { periodKey: '2026-06-17', firedPct: 0.5 },
    };
    const merged = withBudgetAlertState({ other: 1 }, state);
    assert.equal((merged as Record<string, unknown>).other, 1);
    assert.deepEqual(readBudgetAlertState(merged), state);
  });

  it('drops malformed dimension entries', () => {
    const blob = {
      [BUDGET_ALERT_SETTINGS_KEY]: { monthly: { periodKey: 5, firedPct: 'x' } },
    };
    assert.deepEqual(readBudgetAlertState(blob), {});
  });

  it('does not mutate the input settings', () => {
    const input = { a: 1 };
    withBudgetAlertState(input, { monthly: { periodKey: '2026-06', firedPct: 0.5 } });
    assert.deepEqual(input, { a: 1 });
  });
});

describe('decideDimensionAlert', () => {
  it('does not fire when percentUsed is null (no cap)', () => {
    const d = decideDimensionAlert({ percentUsed: null, periodKey: '2026-06', prior: undefined });
    assert.equal(d.shouldFire, false);
    assert.equal(d.threshold, null);
  });

  it('does not fire below the first threshold', () => {
    const d = decideDimensionAlert({ percentUsed: 0.49, periodKey: '2026-06', prior: undefined });
    assert.equal(d.shouldFire, false);
  });

  it('fires the first threshold at exactly 50%', () => {
    const d = decideDimensionAlert({ percentUsed: 0.5, periodKey: '2026-06', prior: undefined });
    assert.equal(d.shouldFire, true);
    assert.equal(d.threshold, 0.5);
    assert.deepEqual(d.nextState, { periodKey: '2026-06', firedPct: 0.5 });
  });

  it('fires the HIGHEST un-fired threshold when found already high', () => {
    const d = decideDimensionAlert({ percentUsed: 0.92, periodKey: '2026-06', prior: undefined });
    assert.equal(d.threshold, 0.9);
  });

  it('does not re-fire a threshold already fired this period', () => {
    const prior = { periodKey: '2026-06', firedPct: 0.75 };
    const d = decideDimensionAlert({ percentUsed: 0.8, periodKey: '2026-06', prior });
    assert.equal(d.shouldFire, false);
    assert.equal(d.nextState.firedPct, 0.75);
  });

  it('fires the next threshold above the prior watermark', () => {
    const prior = { periodKey: '2026-06', firedPct: 0.5 };
    const d = decideDimensionAlert({ percentUsed: 0.92, periodKey: '2026-06', prior });
    assert.equal(d.threshold, 0.9);
  });

  it('resets the watermark when the period key rolls', () => {
    const prior = { periodKey: '2026-05', firedPct: 0.9 };
    const d = decideDimensionAlert({ percentUsed: 0.6, periodKey: '2026-06', prior });
    assert.equal(d.shouldFire, true);
    assert.equal(d.threshold, 0.5);
  });

  it('OVER (>=1.0) fires the 90% threshold', () => {
    const d = decideDimensionAlert({ percentUsed: 1.3, periodKey: '2026-06', prior: undefined });
    assert.equal(d.threshold, 0.9);
  });
});

describe('evaluateWorkspaceAlerts', () => {
  const now = new Date('2026-06-17T12:00:00Z');

  const dual = (monthlyPct: number | null, dailyPct: number | null): WorkspaceDualBudget => ({
    monthly: monthlyPct === null ? statusFor(0, null) : statusFor(monthlyPct * 200, 200),
    daily: dailyPct === null ? statusFor(0, null) : statusFor(dailyPct * 25, 25),
  });

  it('returns no fires when nothing crossed', () => {
    const out = evaluateWorkspaceAlerts(dual(0.1, 0.1), {}, now);
    assert.equal(out.fires.length, 0);
    // watermarks still tracked at 0 for this period
    assert.equal(out.nextState.monthly?.firedPct, 0);
    assert.equal(out.nextState.daily?.firedPct, 0);
  });

  it('fires only the monthly dimension when only it crossed', () => {
    const out = evaluateWorkspaceAlerts(dual(0.8, 0.1), {}, now);
    assert.equal(out.fires.length, 1);
    assert.equal(out.fires[0].dimension, 'monthly');
    assert.equal(out.fires[0].threshold, 0.75);
  });

  it('fires both dimensions when both crossed in one sweep', () => {
    const out = evaluateWorkspaceAlerts(dual(0.55, 0.95), {}, now);
    const dims = out.fires.map((f) => f.dimension).sort();
    assert.deepEqual(dims, ['daily', 'monthly']);
    const daily = out.fires.find((f) => f.dimension === 'daily');
    assert.equal(daily?.threshold, 0.9);
  });

  it('respects prior watermarks across dimensions', () => {
    const prior = {
      monthly: { periodKey: '2026-06', firedPct: 0.75 },
      daily: { periodKey: '2026-06-17', firedPct: 0 },
    };
    const out = evaluateWorkspaceAlerts(dual(0.8, 0.6), prior, now);
    // monthly already fired 75% and is only at 80% → no new monthly fire;
    // daily crosses 50% fresh → fires.
    assert.equal(out.fires.length, 1);
    assert.equal(out.fires[0].dimension, 'daily');
    assert.equal(out.fires[0].threshold, 0.5);
  });
});

describe('composeBudgetAlertEmail', () => {
  it('subject names the top threshold + dimension', () => {
    const email = composeBudgetAlertEmail({
      workspaceName: 'Acme Realty',
      fires: [{ dimension: 'monthly', threshold: 0.75, status: statusFor(150, 200) }],
      usageUrl: 'https://app.example.com/app/workspace/x/usage',
    });
    assert.match(email.subject, /75%/);
    assert.match(email.subject, /Acme Realty/);
    assert.match(email.html, /See your usage/);
    assert.match(email.text, /workspace\/x\/usage/);
  });

  it('the 90% email mentions the pause-at-cap consequence', () => {
    const email = composeBudgetAlertEmail({
      workspaceName: 'Acme',
      fires: [{ dimension: 'daily', threshold: 0.9, status: statusFor(22.5, 25) }],
      usageUrl: 'https://x/usage',
    });
    assert.match(email.text, /pause|paused/i);
  });

  it('a sub-90% email reassures nothing changes yet', () => {
    const email = composeBudgetAlertEmail({
      workspaceName: 'Acme',
      fires: [{ dimension: 'monthly', threshold: 0.5, status: statusFor(100, 200) }],
      usageUrl: 'https://x/usage',
    });
    assert.match(email.text, /Nothing changes right now/i);
  });
});
