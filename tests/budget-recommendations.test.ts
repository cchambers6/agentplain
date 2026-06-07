/**
 * tests/budget-recommendations.test.ts
 *
 * The MRR-proportional budget RECOMMENDATION (`lib/billing/recommendations.ts`).
 * This is the math PR #145 originally enforced; after reconciliation onto
 * PR #146's locked seam it is advice only — nothing here is read by the LLM
 * gate. These tests pin the plan §2 "break-even budget per workspace" table
 * and the MRR-resolution fallbacks. Pure functions, no DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECOMMENDED_COGS_FRACTION,
  recommendBudgetCapUsd,
  recommendBudgetCapUsdFromRow,
  resolveWorkspaceMrr,
  type WorkspaceMrrInputs,
} from '@/lib/billing/recommendations';

describe('recommended-budget fraction', () => {
  it('is 30% of MRR (the 70%-margin target)', () => {
    assert.ok(Math.abs(RECOMMENDED_COGS_FRACTION - 0.3) < 1e-9);
  });
});

describe('recommendBudgetCapUsd — plan §2 table', () => {
  it('$199/seat (Regular, 1 seat) → ~$60/mo', () => {
    assert.equal(recommendBudgetCapUsd(199), 60); // round(59.7)
  });
  it('$149/seat (Regular, 10–24 band) → ~$45/mo', () => {
    assert.equal(recommendBudgetCapUsd(149), 45); // round(44.7)
  });
  it('$99/seat (Regular, 50–99 band) → ~$30/mo', () => {
    assert.equal(recommendBudgetCapUsd(99), 30); // round(29.7)
  });
  it('non-positive / non-finite MRR → 0', () => {
    assert.equal(recommendBudgetCapUsd(0), 0);
    assert.equal(recommendBudgetCapUsd(-100), 0);
    assert.equal(recommendBudgetCapUsd(Number.NaN), 0);
  });
});

describe('resolveWorkspaceMrr — input resolution', () => {
  it('prefers the live Subscription (tier + seats → MRR)', () => {
    const inputs = resolveWorkspaceMrr({
      verticalTier: 'REGULAR',
      tierPriceUsdMonthly: null,
      subscription: { tier: 'REGULAR', seats: 1 },
    });
    assert.deepEqual(inputs, {
      tier: 'regular',
      seats: 1,
      mrrUsd: 199,
      source: 'subscription',
    } satisfies WorkspaceMrrInputs);
  });

  it('multi-seat MRR scales by the seat band × seats', () => {
    // 10 seats → SEATS_10_24 band → $149/seat → $1490 MRR.
    const inputs = resolveWorkspaceMrr({
      verticalTier: 'REGULAR',
      tierPriceUsdMonthly: null,
      subscription: { tier: 'REGULAR', seats: 10 },
    });
    assert.equal(inputs.mrrUsd, 149 * 10);
    assert.equal(inputs.seats, 10);
  });

  it('falls back to the manual-invoice price when no Subscription', () => {
    const inputs = resolveWorkspaceMrr({
      verticalTier: 'PLUS',
      tierPriceUsdMonthly: 250_00,
      subscription: null,
    });
    assert.deepEqual(inputs, {
      tier: 'plus',
      seats: 1,
      mrrUsd: 250,
      source: 'workspace-manual',
    } satisfies WorkspaceMrrInputs);
  });

  it('falls back to ladder pricing at 1 seat when nothing else', () => {
    const inputs = resolveWorkspaceMrr({
      verticalTier: 'REGULAR',
      tierPriceUsdMonthly: null,
      subscription: null,
    });
    assert.equal(inputs.mrrUsd, 199);
    assert.equal(inputs.source, 'workspace-default');
  });

  it('out-of-ladder seat counts (100+) do not throw', () => {
    const inputs = resolveWorkspaceMrr({
      verticalTier: 'MAX',
      tierPriceUsdMonthly: null,
      subscription: { tier: 'MAX', seats: 150 },
    });
    assert.equal(inputs.tier, 'max');
    assert.ok(inputs.mrrUsd > 0);
  });
});

describe('recommendBudgetCapUsdFromRow', () => {
  it('Regular 1 seat → $60', () => {
    assert.equal(
      recommendBudgetCapUsdFromRow({
        verticalTier: 'REGULAR',
        tierPriceUsdMonthly: null,
        subscription: { tier: 'REGULAR', seats: 1 },
      }),
      60,
    );
  });

  it('manual-invoice $250 (Plus) → $75', () => {
    assert.equal(
      recommendBudgetCapUsdFromRow({
        verticalTier: 'PLUS',
        tierPriceUsdMonthly: 250_00,
        subscription: null,
      }),
      75, // round(250 * 0.30)
    );
  });

  it('Max (quote-based) → null (no productized price to anchor a rec)', () => {
    assert.equal(
      recommendBudgetCapUsdFromRow({
        verticalTier: 'MAX',
        tierPriceUsdMonthly: null,
        subscription: { tier: 'MAX', seats: 5 },
      }),
      null,
    );
  });
});
