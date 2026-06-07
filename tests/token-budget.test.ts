/**
 * tests/token-budget.test.ts
 *
 * Covers feat/per-workspace-token-budget — the LLM-seam ENFORCEMENT half of
 * the per-workspace token budget, reconciled onto PR #146's locked budget
 * seam. The only enforced cap is the operator-set explicit `$/mo` cap; the
 * MRR-proportional figure is a recommendation only (tested in
 * `budget-recommendations.test.ts`).
 *
 *   1. Gate-decision mapping (pure): OVER → BLOCK, WARN → WARN, OK/NO_CAP/null
 *      → ALLOW.
 *   2. The two reconciliation invariants:
 *      - A NO_CAP workspace NEVER short-circuits, even when usage dwarfs the
 *        MRR-based recommendation.
 *      - An explicit cap of $X short-circuits at $X regardless of MRR.
 *   3. BudgetEnforcingLlmProvider: ALLOW/WARN → inner called; BLOCK → inner
 *      NOT called, returns a typed OVER_BUDGET error; a throwing gate fails
 *      OPEN (inner called); name is delegated.
 *   4. persistBudgetGate skip path (no DB): untagged / non-UUID → ALLOW.
 *
 * No DB is required — pure functions + injected stubs. Cold-start-safe; runs
 * in the same `node --test` pass as the rest of the project.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  budgetGateOutcome,
  deriveBudgetStatus,
  persistBudgetGate,
  type BudgetGate,
} from '@/lib/billing/budget';
import { recommendBudgetCapUsd } from '@/lib/billing/recommendations';
import { BudgetEnforcingLlmProvider } from '@/lib/llm/budget-enforcing-provider';
import { llmOk } from '@/lib/llm/types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '@/lib/llm/types';

const USD = 100_000_000n; // micro-cents per dollar
const usd = (dollars: number): bigint =>
  BigInt(Math.round(dollars * 100)) * 1_000_000n;

// A gate built the way the production gate builds its decision: derive the
// status from (spend, cap) and map the state to an outcome. This is exactly
// `persistBudgetGate` minus the DB read, so the wrapper tests exercise the
// real decision path.
function gateFor(consumedMicroCents: bigint, capUsdMonthly: number | null): BudgetGate {
  return async (meta) => {
    const workspaceId = meta?.workspaceId ?? null;
    const status = deriveBudgetStatus({
      workspaceId: workspaceId ?? 'stub',
      consumedMicroCents,
      capUsdMonthly,
    });
    return {
      outcome: budgetGateOutcome(status.state),
      workspaceId,
      state: status.state,
      status,
    };
  };
}

describe('budgetGateOutcome — state → gate outcome', () => {
  it('blocks ONLY on OVER', () => {
    assert.equal(budgetGateOutcome('OVER'), 'BLOCK');
  });
  it('warns (allows) on WARN', () => {
    assert.equal(budgetGateOutcome('WARN'), 'WARN');
  });
  it('allows on OK, NO_CAP, and an unresolved null', () => {
    assert.equal(budgetGateOutcome('OK'), 'ALLOW');
    assert.equal(budgetGateOutcome('NO_CAP'), 'ALLOW');
    assert.equal(budgetGateOutcome(null), 'ALLOW');
  });
});

describe('reconciliation invariant — NO_CAP never short-circuits', () => {
  it('a workspace with no explicit cap is ALLOW even when usage dwarfs the recommendation', () => {
    // $199/seat Regular → recommended budget is ~$60/mo …
    const recommended = recommendBudgetCapUsd(199);
    assert.equal(recommended, 60);
    // … but with NO explicit cap configured, $500 of spend (>> $60) is still
    // NO_CAP and therefore never throttled.
    const status = deriveBudgetStatus({
      workspaceId: '11111111-1111-1111-1111-111111111111',
      consumedMicroCents: usd(500),
      capUsdMonthly: null,
    });
    assert.equal(status.state, 'NO_CAP');
    assert.ok(status.consumedUsd > recommended); // genuinely past the rec
    assert.equal(budgetGateOutcome(status.state), 'ALLOW');
  });
});

describe('reconciliation invariant — explicit cap short-circuits at $X regardless of MRR', () => {
  it('blocks at the cap, not at any MRR-derived number', () => {
    const capUsd = 40; // operator-set, deliberately BELOW the $60 rec for $199 MRR
    // Comfortably under the cap → OK → allowed.
    const under = deriveBudgetStatus({
      workspaceId: 'ws',
      consumedMicroCents: usd(10),
      capUsdMonthly: capUsd,
    });
    assert.equal(under.state, 'OK');
    assert.notEqual(budgetGateOutcome(under.state), 'BLOCK');
    // At the cap → OVER → blocked. The $199 MRR (rec $60) is irrelevant: the
    // explicit $40 cap is what governs.
    const at = deriveBudgetStatus({
      workspaceId: 'ws',
      consumedMicroCents: usd(40),
      capUsdMonthly: capUsd,
    });
    assert.equal(at.state, 'OVER');
    assert.equal(budgetGateOutcome(at.state), 'BLOCK');
    // Above a cap that is ABOVE the rec also blocks — the cap is the sole
    // authority either way.
    const highCapOver = deriveBudgetStatus({
      workspaceId: 'ws',
      consumedMicroCents: usd(81),
      capUsdMonthly: 80,
    });
    assert.equal(budgetGateOutcome(highCapOver.state), 'BLOCK');
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

const REQ: LlmCompletionRequest = {
  system: 's',
  messages: [{ role: 'user', content: 'hi' }],
  meta: { workspaceId: '33333333-3333-3333-3333-333333333333', skill: 'draft' },
};

describe('BudgetEnforcingLlmProvider', () => {
  it('ALLOW (OK under cap) → inner is called and its result returned', async () => {
    const inner = new RecordingInner();
    const provider = new BudgetEnforcingLlmProvider(inner, gateFor(usd(10), 100));
    const res = await provider.complete(REQ);
    assert.equal(inner.calls.length, 1);
    assert.equal(res.ok, true);
  });

  it('ALLOW (NO_CAP, huge spend) → inner is called', async () => {
    const inner = new RecordingInner();
    const provider = new BudgetEnforcingLlmProvider(inner, gateFor(usd(9999), null));
    const res = await provider.complete(REQ);
    assert.equal(inner.calls.length, 1);
    assert.equal(res.ok, true);
  });

  it('WARN (>=80% of cap) → still allowed (inner called)', async () => {
    const inner = new RecordingInner();
    const provider = new BudgetEnforcingLlmProvider(inner, gateFor(usd(85), 100));
    const res = await provider.complete(REQ);
    assert.equal(inner.calls.length, 1);
    assert.equal(res.ok, true);
  });

  it('BLOCK (OVER cap) → inner NOT called, returns typed OVER_BUDGET error', async () => {
    const inner = new RecordingInner();
    const provider = new BudgetEnforcingLlmProvider(inner, gateFor(usd(120), 100));
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
    const provider = new BudgetEnforcingLlmProvider(inner, gateFor(usd(0), 100));
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
