/**
 * lib/billing/budget.test.ts
 *
 * Unit tests for the pure budget-state functions in budget.ts.
 * These functions are the shared gate/inspector seam — the same derivation
 * must be used by both the operator UI and the LLM enforcement wrapper, so
 * they are tested exhaustively here.
 *
 * No DB, no network, no API keys required.
 *
 * Covered:
 *   - deriveBudgetState: all four state transitions + boundary values
 *   - microCentsToUsd: exact conversion
 *   - deriveBudgetStatus: full status derivation (NO_CAP, OK, WARN, OVER)
 *   - isOverBudget: predicate for OVER state only
 *   - resolveBudgetCapUsd: settings key extraction + fallback
 *   - withBudgetCapUsd: settings merge / clear
 *   - budgetGateOutcome: gate decision mapping
 *   - WorkspaceOverBudgetError: error construction + message
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUDGET_WARN_THRESHOLD,
  deriveBudgetState,
  microCentsToUsd,
  deriveBudgetStatus,
  isOverBudget,
  resolveBudgetCapUsd,
  withBudgetCapUsd,
  budgetGateOutcome,
  WorkspaceOverBudgetError,
  BUDGET_SETTINGS_KEY,
} from './budget';

// ── deriveBudgetState ─────────────────────────────────────────────────────────

describe('deriveBudgetState', () => {
  it('returns NO_CAP when percentUsed is null', () => {
    assert.equal(deriveBudgetState(null), 'NO_CAP');
  });

  it('returns OK for 0 (no spend)', () => {
    assert.equal(deriveBudgetState(0), 'OK');
  });

  it('returns OK just below warn threshold', () => {
    assert.equal(deriveBudgetState(BUDGET_WARN_THRESHOLD - 0.001), 'OK');
  });

  it('returns WARN at exactly the warn threshold (0.8)', () => {
    assert.equal(deriveBudgetState(BUDGET_WARN_THRESHOLD), 'WARN');
  });

  it('returns WARN in the warn band (0.8 to just below 1.0)', () => {
    assert.equal(deriveBudgetState(0.9), 'WARN');
    assert.equal(deriveBudgetState(0.999), 'WARN');
  });

  it('returns OVER at exactly 1.0 (cap reached counts as over)', () => {
    assert.equal(deriveBudgetState(1.0), 'OVER');
  });

  it('returns OVER above 1.0 (already exceeded cap)', () => {
    assert.equal(deriveBudgetState(1.5), 'OVER');
    assert.equal(deriveBudgetState(2.0), 'OVER');
  });

  it('BUDGET_WARN_THRESHOLD is 0.8 (pinned so changes break the test)', () => {
    assert.equal(BUDGET_WARN_THRESHOLD, 0.8);
  });
});

// ── microCentsToUsd ───────────────────────────────────────────────────────────

describe('microCentsToUsd', () => {
  it('converts 0 → 0', () => {
    assert.equal(microCentsToUsd(0n), 0);
  });

  it('converts exactly one dollar', () => {
    // 1 dollar = 100 cents = 100_000_000 micro-cents
    assert.equal(microCentsToUsd(100_000_000n), 1);
  });

  it('converts a realistic monthly spend', () => {
    // $162 → 162 * 100_000_000 mc
    const mc = 162n * 100_000_000n;
    assert.equal(microCentsToUsd(mc), 162);
  });

  it('returns a number (not bigint)', () => {
    assert.equal(typeof microCentsToUsd(1n), 'number');
  });
});

// ── deriveBudgetStatus ────────────────────────────────────────────────────────

describe('deriveBudgetStatus', () => {
  const WS_ID = 'ws-test-1';

  it('returns NO_CAP status when cap is null', () => {
    const status = deriveBudgetStatus({
      workspaceId: WS_ID,
      consumedMicroCents: 50_000_000n, // $0.50
      capUsdMonthly: null,
    });
    assert.equal(status.state, 'NO_CAP');
    assert.equal(status.capUsdMonthly, null);
    assert.equal(status.percentUsed, null);
    assert.equal(status.remainingUsd, null);
    assert.equal(status.workspaceId, WS_ID);
  });

  it('returns NO_CAP when cap is 0 (non-positive cap is treated as no cap)', () => {
    const status = deriveBudgetStatus({
      workspaceId: WS_ID,
      consumedMicroCents: 0n,
      capUsdMonthly: 0,
    });
    assert.equal(status.state, 'NO_CAP');
    assert.equal(status.capUsdMonthly, null);
  });

  it('returns OK status for fresh workspace under cap', () => {
    const status = deriveBudgetStatus({
      workspaceId: WS_ID,
      consumedMicroCents: 10_000_000n, // $0.10
      capUsdMonthly: 200,              // $200 cap
    });
    assert.equal(status.state, 'OK');
    assert.ok(status.percentUsed !== null && status.percentUsed < BUDGET_WARN_THRESHOLD);
    assert.equal(status.capUsdMonthly, 200);
    assert.ok((status.remainingUsd ?? 0) > 0);
  });

  it('returns WARN status when near cap', () => {
    // 85% of $200 = $170 consumed
    const consumed = 170n * 100_000_000n;
    const status = deriveBudgetStatus({
      workspaceId: WS_ID,
      consumedMicroCents: consumed,
      capUsdMonthly: 200,
    });
    assert.equal(status.state, 'WARN');
    assert.ok(status.percentUsed !== null);
    assert.ok(Math.abs((status.percentUsed ?? 0) - 0.85) < 0.001);
  });

  it('returns OVER status when consumed equals cap', () => {
    // $200 consumed, $200 cap → 100% → OVER
    const consumed = 200n * 100_000_000n;
    const status = deriveBudgetStatus({
      workspaceId: WS_ID,
      consumedMicroCents: consumed,
      capUsdMonthly: 200,
    });
    assert.equal(status.state, 'OVER');
    assert.equal(status.percentUsed, 1.0);
    assert.equal(status.remainingUsd, 0);
  });

  it('returns OVER with negative remaining when exceeding cap', () => {
    // $250 consumed, $200 cap
    const consumed = 250n * 100_000_000n;
    const status = deriveBudgetStatus({
      workspaceId: WS_ID,
      consumedMicroCents: consumed,
      capUsdMonthly: 200,
    });
    assert.equal(status.state, 'OVER');
    assert.equal(status.remainingUsd, -50);
    assert.equal(status.consumedUsd, 250);
  });

  it('carries tokensThisPeriod from args (defaults to 0)', () => {
    const s1 = deriveBudgetStatus({ workspaceId: WS_ID, consumedMicroCents: 0n, capUsdMonthly: null });
    assert.equal(s1.tokensThisPeriod, 0);

    const s2 = deriveBudgetStatus({
      workspaceId: WS_ID,
      consumedMicroCents: 0n,
      capUsdMonthly: null,
      tokensThisPeriod: 12345,
    });
    assert.equal(s2.tokensThisPeriod, 12345);
  });

  it('consumedMicroCents on the result matches the arg exactly', () => {
    const mc = 123_456_789n;
    const status = deriveBudgetStatus({ workspaceId: WS_ID, consumedMicroCents: mc, capUsdMonthly: null });
    assert.equal(status.consumedMicroCents, mc);
  });
});

// ── isOverBudget ──────────────────────────────────────────────────────────────

describe('isOverBudget', () => {
  it('returns false for NO_CAP (unbudgeted workspace is never blocked)', () => {
    const status = deriveBudgetStatus({
      workspaceId: 'ws',
      consumedMicroCents: 999_999_999n,
      capUsdMonthly: null,
    });
    assert.equal(isOverBudget(status), false);
  });

  it('returns false for OK', () => {
    const status = deriveBudgetStatus({
      workspaceId: 'ws',
      consumedMicroCents: 10_000_000n,
      capUsdMonthly: 200,
    });
    assert.equal(isOverBudget(status), false);
  });

  it('returns false for WARN', () => {
    const status = deriveBudgetStatus({
      workspaceId: 'ws',
      consumedMicroCents: 170n * 100_000_000n,
      capUsdMonthly: 200,
    });
    assert.equal(isOverBudget(status), false);
  });

  it('returns true for OVER', () => {
    const status = deriveBudgetStatus({
      workspaceId: 'ws',
      consumedMicroCents: 200n * 100_000_000n,
      capUsdMonthly: 200,
    });
    assert.equal(isOverBudget(status), true);
  });
});

// ── resolveBudgetCapUsd ───────────────────────────────────────────────────────

describe('resolveBudgetCapUsd', () => {
  it('returns null for null settings', () => {
    assert.equal(resolveBudgetCapUsd(null), null);
  });

  it('returns null for undefined settings', () => {
    assert.equal(resolveBudgetCapUsd(undefined), null);
  });

  it('returns null for a non-object (string)', () => {
    assert.equal(resolveBudgetCapUsd('200'), null);
  });

  it('returns null when the settings key is absent', () => {
    assert.equal(resolveBudgetCapUsd({ somethingElse: 42 }), null);
  });

  it('returns null when the settings key is a string', () => {
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: '200' }), null);
  });

  it('returns null when the settings key is 0 (non-positive)', () => {
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 0 }), null);
  });

  it('returns null when the settings key is negative', () => {
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: -50 }), null);
  });

  it('returns the cap when present and valid', () => {
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 200 }), 200);
  });

  it('returns the fallback when the key is absent', () => {
    assert.equal(resolveBudgetCapUsd({}, 150), 150);
  });

  it('ignores the fallback when the key is valid', () => {
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 99 }, 500), 99);
  });

  it('preserves fractional cap values (e.g. 99.5)', () => {
    assert.equal(resolveBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 99.5 }), 99.5);
  });
});

// ── withBudgetCapUsd ──────────────────────────────────────────────────────────

describe('withBudgetCapUsd', () => {
  it('sets the cap key on an empty settings blob', () => {
    const out = withBudgetCapUsd(null, 200);
    assert.equal(out[BUDGET_SETTINGS_KEY], 200);
  });

  it('merges without dropping other existing keys', () => {
    const out = withBudgetCapUsd({ existingKey: 'hello' }, 150);
    assert.equal(out[BUDGET_SETTINGS_KEY], 150);
    assert.equal(out.existingKey, 'hello');
  });

  it('clears the cap when capUsd is null', () => {
    const existing = { [BUDGET_SETTINGS_KEY]: 200, otherKey: true };
    const out = withBudgetCapUsd(existing, null);
    assert.equal(out[BUDGET_SETTINGS_KEY], undefined);
    assert.equal(out.otherKey, true);
  });

  it('rounds fractional cap to the nearest whole dollar', () => {
    const out = withBudgetCapUsd({}, 99.7);
    assert.equal(out[BUDGET_SETTINGS_KEY], 100);
  });

  it('clears the cap when capUsd is 0 (non-positive)', () => {
    const out = withBudgetCapUsd({ [BUDGET_SETTINGS_KEY]: 200 }, 0);
    assert.equal(out[BUDGET_SETTINGS_KEY], undefined);
  });

  it('does NOT mutate the input settings object', () => {
    const input = { [BUDGET_SETTINGS_KEY]: 100 };
    withBudgetCapUsd(input, 200);
    assert.equal(input[BUDGET_SETTINGS_KEY], 100, 'original not mutated');
  });

  it('returns a plain object (not the same reference as input)', () => {
    const input = { other: 1 };
    const out = withBudgetCapUsd(input, 50);
    assert.notStrictEqual(out, input);
  });
});

// ── budgetGateOutcome ─────────────────────────────────────────────────────────

describe('budgetGateOutcome', () => {
  it('returns ALLOW for null state (untagged call)', () => {
    assert.equal(budgetGateOutcome(null), 'ALLOW');
  });

  it('returns ALLOW for NO_CAP', () => {
    assert.equal(budgetGateOutcome('NO_CAP'), 'ALLOW');
  });

  it('returns ALLOW for OK', () => {
    assert.equal(budgetGateOutcome('OK'), 'ALLOW');
  });

  it('returns WARN for WARN state (allowed but logged)', () => {
    assert.equal(budgetGateOutcome('WARN'), 'WARN');
  });

  it('returns BLOCK for OVER (explicit cap reached)', () => {
    assert.equal(budgetGateOutcome('OVER'), 'BLOCK');
  });
});

// ── WorkspaceOverBudgetError ──────────────────────────────────────────────────

describe('WorkspaceOverBudgetError', () => {
  it('is instanceof Error', () => {
    const err = new WorkspaceOverBudgetError('ws-1', null);
    assert.ok(err instanceof Error);
    assert.ok(err instanceof WorkspaceOverBudgetError);
  });

  it('has the right .name', () => {
    const err = new WorkspaceOverBudgetError('ws-1', null);
    assert.equal(err.name, 'WorkspaceOverBudgetError');
  });

  it('carries the workspaceId', () => {
    const err = new WorkspaceOverBudgetError('ws-abc', null);
    assert.equal(err.workspaceId, 'ws-abc');
  });

  it('carries a null status', () => {
    const err = new WorkspaceOverBudgetError('ws-1', null);
    assert.equal(err.status, null);
  });

  it('includes dollar amounts in the message when status has a cap', () => {
    const status = deriveBudgetStatus({
      workspaceId: 'ws-1',
      consumedMicroCents: 210n * 100_000_000n, // $210
      capUsdMonthly: 200,
    });
    const err = new WorkspaceOverBudgetError('ws-1', status);
    assert.ok(err.message.includes('210'), `message should include consumed: "${err.message}"`);
    assert.ok(err.message.includes('200'), `message should include cap: "${err.message}"`);
  });

  it('message omits dollar amounts when status is null', () => {
    const err = new WorkspaceOverBudgetError('ws-2', null);
    assert.ok(err.message.includes('ws-2'));
    assert.ok(!err.message.includes('$'), 'no dollar amounts when status is null');
  });
});
