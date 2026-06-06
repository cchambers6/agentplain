/**
 * tests/token-budget.test.ts
 *
 * Covers feat/per-workspace-token-budget-2026-06-03 — the per-workspace
 * token-budget governor (production+growth plan §2).
 *
 *   1. Ceiling math (pure):
 *      - 30%-of-MRR ceiling reproduces the plan's table ($199→~$60,
 *        $99→~$30); Max tier is uncapped (null).
 *   2. Status classification (pure, BigInt-exact):
 *      - OK below 80%, WATCH at/above 80%, OVER at/above 100%, uncapped→OK.
 *   3. Input resolution (pure given a selected row):
 *      - Subscription preferred; manual-invoice price fallback; ladder
 *        default; out-of-ladder seat counts don't throw.
 *   4. Snapshot composition (pure).
 *   5. BudgetEnforcingLlmProvider:
 *      - ALLOW / WARN → inner called; BLOCK → inner NOT called, returns a
 *        typed OVER_BUDGET error; a throwing gate fails OPEN (inner called).
 *   6. persistBudgetGate skip path (no DB): untagged / non-UUID → ALLOW.
 *
 * No DB is required — pure functions + injected stubs. Cold-start-safe;
 * runs in the same `node --test` pass as the rest of the project.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUDGET_COGS_CEILING_FRACTION,
  budgetFractionFor,
  budgetInputsFromRow,
  budgetStatusFor,
  composeSnapshot,
  getFleetBudgetSnapshots,
  getWorkspaceBudgetSnapshot,
  monthlyTokenCeilingMicroCents,
  persistBudgetGate,
  startOfMonthUtc,
  type WorkspaceBudgetInputs,
} from '@/lib/billing/budget';
import { BudgetEnforcingLlmProvider } from '@/lib/llm/budget-enforcing-provider';
import { llmOk } from '@/lib/llm/types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '@/lib/llm/types';
import type { BudgetGate } from '@/lib/billing/budget';

const MC = 1_000_000n; // micro-cents per cent

describe('token budget — ceiling math', () => {
  it('ceiling is 30% of MRR (the 70%-margin target)', () => {
    // Computed as 1 − 0.70; tolerate IEEE-754 dust (all real uses round).
    assert.ok(Math.abs(BUDGET_COGS_CEILING_FRACTION - 0.3) < 1e-9);
  });

  it('$199/seat (Regular, 1 seat) → ~$60/mo ceiling', () => {
    // 19900 cents * 0.30 = 5970 cents = $59.70.
    assert.equal(
      monthlyTokenCeilingMicroCents('regular', 199_00),
      5970n * MC,
    );
  });

  it('$99/seat (Regular, 50–99 band) → ~$30/mo ceiling', () => {
    // 9900 * 0.30 = 2970 cents = $29.70.
    assert.equal(monthlyTokenCeilingMicroCents('regular', 99_00), 2970n * MC);
  });

  it('Max tier is uncapped regardless of MRR', () => {
    assert.equal(monthlyTokenCeilingMicroCents('max', 499_00), null);
    assert.equal(monthlyTokenCeilingMicroCents('max', 0), null);
  });

  it('Partner (plus) carries a higher absolute ceiling than Regular', () => {
    // Same seat band, higher price → higher cap (Partner expects more usage).
    const regular = monthlyTokenCeilingMicroCents('regular', 199_00)!;
    const plus = monthlyTokenCeilingMicroCents('plus', 299_00)!;
    assert.ok(plus > regular);
  });
});

describe('token budget — status classification', () => {
  const ceiling = 1000n; // micro-cents (toy value)

  it('uncapped ceiling is always OK', () => {
    assert.equal(budgetStatusFor(10_000n, null), 'OK');
    assert.equal(budgetStatusFor(0n, 0n), 'OK');
  });

  it('OK below 80%', () => {
    assert.equal(budgetStatusFor(0n, ceiling), 'OK');
    assert.equal(budgetStatusFor(799n, ceiling), 'OK');
  });

  it('WATCH at and above 80%, below 100%', () => {
    assert.equal(budgetStatusFor(800n, ceiling), 'WATCH');
    assert.equal(budgetStatusFor(999n, ceiling), 'WATCH');
  });

  it('OVER at and above 100%', () => {
    assert.equal(budgetStatusFor(1000n, ceiling), 'OVER');
    assert.equal(budgetStatusFor(5000n, ceiling), 'OVER');
  });

  it('fraction is spend/ceiling, 0 when uncapped', () => {
    assert.equal(budgetFractionFor(500n, 1000n), 0.5);
    assert.equal(budgetFractionFor(500n, null), 0);
  });
});

describe('token budget — input resolution', () => {
  it('prefers the live Subscription (tier + seats → MRR)', () => {
    const inputs = budgetInputsFromRow({
      verticalTier: 'REGULAR',
      tierPriceUsdMonthly: null,
      subscription: { tier: 'REGULAR', seats: 1 },
    });
    assert.deepEqual(inputs, {
      tier: 'regular',
      seats: 1,
      mrrCents: 199_00,
      source: 'subscription',
    } satisfies WorkspaceBudgetInputs);
  });

  it('multi-seat MRR scales by the seat band × seats', () => {
    // 10 seats → SEATS_10_24 band → $149/seat → $1490 MRR.
    const inputs = budgetInputsFromRow({
      verticalTier: 'REGULAR',
      tierPriceUsdMonthly: null,
      subscription: { tier: 'REGULAR', seats: 10 },
    });
    assert.equal(inputs.mrrCents, 149_00 * 10);
    assert.equal(inputs.seats, 10);
  });

  it('falls back to the manual-invoice price when no Subscription', () => {
    const inputs = budgetInputsFromRow({
      verticalTier: 'PLUS',
      tierPriceUsdMonthly: 250_00,
      subscription: null,
    });
    assert.deepEqual(inputs, {
      tier: 'plus',
      seats: 1,
      mrrCents: 250_00,
      source: 'workspace-manual',
    } satisfies WorkspaceBudgetInputs);
  });

  it('falls back to ladder pricing at 1 seat when nothing else', () => {
    const inputs = budgetInputsFromRow({
      verticalTier: 'REGULAR',
      tierPriceUsdMonthly: null,
      subscription: null,
    });
    assert.equal(inputs.mrrCents, 199_00);
    assert.equal(inputs.source, 'workspace-default');
  });

  it('out-of-ladder seat counts (100+) do not throw', () => {
    const inputs = budgetInputsFromRow({
      verticalTier: 'MAX',
      tierPriceUsdMonthly: null,
      subscription: { tier: 'MAX', seats: 150 },
    });
    assert.equal(inputs.tier, 'max');
    assert.ok(inputs.mrrCents > 0);
  });
});

describe('token budget — snapshot composition', () => {
  it('marks OVER when spend exceeds the ceiling', () => {
    const periodStart = startOfMonthUtc(new Date('2026-06-15T12:00:00Z'));
    const snap = composeSnapshot({
      workspaceId: '11111111-1111-1111-1111-111111111111',
      inputs: {
        tier: 'regular',
        seats: 1,
        mrrCents: 199_00,
        source: 'subscription',
      },
      spendMicroCents: 6_000n * MC, // $60 > $59.70 ceiling
      periodStart,
    });
    assert.equal(snap.status, 'OVER');
    assert.equal(snap.ceilingMicroCents, 5970n * MC);
    assert.ok(snap.fraction > 1);
    assert.equal(snap.periodStart.toISOString(), '2026-06-01T00:00:00.000Z');
  });

  it('uncapped (Max) snapshot is OK with null ceiling', () => {
    const snap = composeSnapshot({
      workspaceId: '22222222-2222-2222-2222-222222222222',
      inputs: { tier: 'max', seats: 5, mrrCents: 499_00, source: 'subscription' },
      spendMicroCents: 50_000n * MC,
      periodStart: startOfMonthUtc(new Date('2026-06-15T12:00:00Z')),
    });
    assert.equal(snap.ceilingMicroCents, null);
    assert.equal(snap.status, 'OK');
    assert.equal(snap.fraction, 0);
  });
});

describe('startOfMonthUtc', () => {
  it('is UTC midnight on the 1st', () => {
    assert.equal(
      startOfMonthUtc(new Date('2026-06-30T23:59:59Z')).toISOString(),
      '2026-06-01T00:00:00.000Z',
    );
    assert.equal(
      startOfMonthUtc(new Date('2026-01-01T00:00:00Z')).toISOString(),
      '2026-01-01T00:00:00.000Z',
    );
  });
});

// ── Enforcement wrapper ──────────────────────────────────────────────────

class RecordingInner implements LlmProvider {
  readonly name = 'test' as const;
  readonly calls: LlmCompletionRequest[] = [];
  async complete(req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    this.calls.push(req);
    return llmOk({
      text: 'ok',
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
      model: req.model ?? 'unknown',
    });
  }
}

function gateReturning(
  outcome: 'ALLOW' | 'WARN' | 'BLOCK',
): BudgetGate {
  return async (meta) => ({
    outcome,
    workspaceId: meta?.workspaceId ?? null,
    status: outcome === 'BLOCK' ? 'OVER' : outcome === 'WARN' ? 'WATCH' : 'OK',
    snapshot: null,
  });
}

const REQ: LlmCompletionRequest = {
  system: 's',
  messages: [{ role: 'user', content: 'hi' }],
  meta: { workspaceId: '33333333-3333-3333-3333-333333333333', skill: 'draft' },
};

describe('BudgetEnforcingLlmProvider', () => {
  it('ALLOW → inner is called and its result returned', async () => {
    const inner = new RecordingInner();
    const provider = new BudgetEnforcingLlmProvider(inner, gateReturning('ALLOW'));
    const res = await provider.complete(REQ);
    assert.equal(inner.calls.length, 1);
    assert.equal(res.ok, true);
  });

  it('WARN → still allowed (inner called)', async () => {
    const inner = new RecordingInner();
    const provider = new BudgetEnforcingLlmProvider(inner, gateReturning('WARN'));
    const res = await provider.complete(REQ);
    assert.equal(inner.calls.length, 1);
    assert.equal(res.ok, true);
  });

  it('BLOCK → inner NOT called, returns typed OVER_BUDGET error', async () => {
    const inner = new RecordingInner();
    const provider = new BudgetEnforcingLlmProvider(inner, gateReturning('BLOCK'));
    const res = await provider.complete(REQ);
    assert.equal(inner.calls.length, 0);
    assert.equal(res.ok, false);
    assert.equal(res.ok === false && res.error.code, 'OVER_BUDGET');
  });

  it('a throwing gate fails OPEN (inner called)', async () => {
    const inner = new RecordingInner();
    const throwing: BudgetGate = async () => {
      throw new Error('db down');
    };
    const provider = new BudgetEnforcingLlmProvider(inner, throwing);
    const res = await provider.complete(REQ);
    assert.equal(inner.calls.length, 1);
    assert.equal(res.ok, true);
  });

  it('delegates the provider name to the inner provider', () => {
    const inner = new RecordingInner();
    const provider = new BudgetEnforcingLlmProvider(inner, gateReturning('ALLOW'));
    assert.equal(provider.name, 'test');
  });
});

describe('persistBudgetGate — skip path (no DB)', () => {
  it('untagged call → ALLOW without touching the DB', async () => {
    const d = await persistBudgetGate(undefined);
    assert.equal(d.outcome, 'ALLOW');
    assert.equal(d.workspaceId, null);
  });

  it('non-UUID workspaceId → ALLOW without touching the DB', async () => {
    const d = await persistBudgetGate({ workspaceId: 'not-a-uuid' });
    assert.equal(d.outcome, 'ALLOW');
    assert.equal(d.workspaceId, null);
  });
});

// Type-level: the read API is exported with the shapes the UI imports.
void getWorkspaceBudgetSnapshot;
void getFleetBudgetSnapshots;
