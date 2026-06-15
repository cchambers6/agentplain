/**
 * lib/kaizen/__tests__/pattern-detectors.test.ts
 *
 * Unit tests for the kaizen pattern detectors. The detectors are pure functions
 * over already-loaded arrays, so we mock the YAML inputs by constructing typed
 * fixtures inline — no filesystem, no Librarian.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findExpensiveSessions,
  findRetryStorms,
  findLowCVBarScores,
  findFailedOrchestrators,
  analyzeModelEfficiency,
  findCostDiscrepancies,
  analyzeBudget,
  summarizeWindow,
  cheaperAlternative,
  normalizeTitle,
  CV_BAR_PASS,
} from '../pattern-detectors.js';
import type { SessionCost, CvBarScore, BudgetState } from '../data-readers.js';

// ─── Fixture factories ───────────────────────────────────────────────────────

function session(over: Partial<SessionCost> = {}): SessionCost {
  return {
    session_id: over.session_id ?? 'local_' + Math.abs(hash(JSON.stringify(over))),
    title: 'Some wave',
    model: 'claude-opus-4-8',
    model_context_size: '200k',
    started_at: '2026-06-12T17:00:00Z',
    completed_at: '2026-06-12T17:50:00Z',
    tokens_in: 800_000,
    tokens_out: 100_000,
    estimated_cost_usd: 6.5,
    outcome: 'delivered',
    tier: 3,
    ...over,
  };
}

function score(over: Partial<CvBarScore> = {}): CvBarScore {
  return {
    pr_number: over.pr_number ?? 100,
    pr_title: 'fix: something',
    session_id: 'local_x',
    model: 'claude-opus-4-8',
    self_score: 4,
    persona: 'SMB owner',
    reasoning: 'lands clean',
    scored_at: '2026-06-12T18:00:00Z',
    ...over,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// ─── findExpensiveSessions ───────────────────────────────────────────────────

describe('findExpensiveSessions', () => {
  it('returns only sessions over threshold, costliest first', () => {
    const sessions = [
      session({ session_id: 'a', estimated_cost_usd: 10 }),
      session({ session_id: 'b', estimated_cost_usd: 80 }),
      session({ session_id: 'c', estimated_cost_usd: 45 }),
    ];
    const result = findExpensiveSessions(sessions, 40);
    assert.deepEqual(result.map((s) => s.session_id), ['b', 'c']);
  });

  it('returns empty for an empty input', () => {
    assert.deepEqual(findExpensiveSessions([], 10), []);
  });
});

// ─── findRetryStorms ──────────────────────────────────────────────────────────

describe('findRetryStorms', () => {
  it('groups by pr_number and flags 3+ attempts', () => {
    const sessions = [
      session({ session_id: 's1', pr_number: 50, outcome: 'errored', estimated_cost_usd: 5 }),
      session({ session_id: 's2', pr_number: 50, outcome: 'killed', estimated_cost_usd: 6 }),
      session({ session_id: 's3', pr_number: 50, outcome: 'delivered', estimated_cost_usd: 7, completed_at: '2026-06-12T19:00:00Z' }),
      session({ session_id: 's4', pr_number: 99, outcome: 'delivered' }),
    ];
    const storms = findRetryStorms(sessions);
    assert.equal(storms.length, 1);
    const storm = storms[0];
    assert.equal(storm.workKey, 'pr#50');
    assert.equal(storm.attempts, 3);
    assert.equal(storm.failedAttempts, 2);
    assert.equal(storm.finalOutcome, 'delivered');
    assert.equal(storm.totalCostUsd, 18);
  });

  it('groups by normalized title when no pr_number', () => {
    const sessions = [
      session({ session_id: 't1', title: 'Wave-3 realty first touch', pr_number: undefined }),
      session({ session_id: 't2', title: 'Realty First Touch (retry)', pr_number: undefined }),
      session({ session_id: 't3', title: 'realty first touch — attempt 2', pr_number: undefined }),
    ];
    const storms = findRetryStorms(sessions);
    assert.equal(storms.length, 1);
    assert.equal(storms[0].attempts, 3);
  });

  it('respects a custom minAttempts threshold', () => {
    const sessions = [
      session({ session_id: 'a', pr_number: 1 }),
      session({ session_id: 'b', pr_number: 1 }),
    ];
    assert.equal(findRetryStorms(sessions).length, 0);
    assert.equal(findRetryStorms(sessions, { minAttempts: 2 }).length, 1);
  });
});

describe('normalizeTitle', () => {
  it('collapses wave/block/retry decorations to the same key', () => {
    assert.equal(
      normalizeTitle('Wave-3 Realty First Touch (retry)'),
      normalizeTitle('realty first touch — attempt 2'),
    );
  });
});

// ─── findLowCVBarScores ──────────────────────────────────────────────────────

describe('findLowCVBarScores', () => {
  it('returns scores below the bar, worst first', () => {
    const scores = [
      score({ pr_number: 1, self_score: 5 }),
      score({ pr_number: 2, self_score: 2 }),
      score({ pr_number: 3, self_score: 3 }),
    ];
    const low = findLowCVBarScores(scores);
    assert.deepEqual(low.map((s) => s.pr_number), [2, 3]);
  });

  it('uses CV_BAR_PASS=4 as the default cutoff', () => {
    const scores = [score({ self_score: 4 }), score({ self_score: 3 })];
    assert.equal(findLowCVBarScores(scores).length, 1);
    assert.equal(CV_BAR_PASS, 4);
  });
});

// ─── findFailedOrchestrators ──────────────────────────────────────────────────

describe('findFailedOrchestrators', () => {
  it('returns only errored/killed sessions', () => {
    const sessions = [
      session({ session_id: 'ok', outcome: 'delivered' }),
      session({ session_id: 'err', outcome: 'errored' }),
      session({ session_id: 'kil', outcome: 'killed' }),
      session({ session_id: 'part', outcome: 'partial' }),
    ];
    const failed = findFailedOrchestrators(sessions);
    assert.deepEqual(failed.map((s) => s.session_id).sort(), ['err', 'kil']);
  });
});

// ─── analyzeModelEfficiency ──────────────────────────────────────────────────

describe('analyzeModelEfficiency', () => {
  it('flags an expensive model with sub-bar cv scores as a downgrade candidate', () => {
    const sessions = [
      session({ model: 'claude-opus-4-8', estimated_cost_usd: 120 }),
      session({ model: 'claude-opus-4-8', estimated_cost_usd: 80 }),
    ];
    const scores = [
      score({ model: 'claude-opus-4-8', self_score: 3 }),
      score({ model: 'claude-opus-4-8', self_score: 2 }),
    ];
    const eff = analyzeModelEfficiency(sessions, scores);
    const opus = eff.find((e) => e.model === 'claude-opus-4-8')!;
    assert.equal(opus.flag, 'expensive-low-value');
    assert.equal(opus.avgCostUsd, 100);
    assert.equal(opus.avgCvBar, 2.5);
  });

  it('marks a model with no scores as insufficient-data', () => {
    const eff = analyzeModelEfficiency(
      [session({ model: 'claude-sonnet-4-6', estimated_cost_usd: 5 })],
      [],
    );
    assert.equal(eff[0].flag, 'insufficient-data');
    assert.equal(eff[0].avgCvBar, null);
  });

  it('marks a cheap, high-scoring model as efficient', () => {
    const eff = analyzeModelEfficiency(
      [session({ model: 'claude-sonnet-4-6', estimated_cost_usd: 4 })],
      [score({ model: 'claude-sonnet-4-6', self_score: 5 })],
    );
    assert.equal(eff[0].flag, 'efficient');
  });
});

// ─── findCostDiscrepancies ────────────────────────────────────────────────────

describe('findCostDiscrepancies', () => {
  it('flags an unpriced model', () => {
    const d = findCostDiscrepancies([
      session({ model: 'claude-mystery-9', estimated_cost_usd: 5 }),
    ]);
    assert.equal(d.length, 1);
    assert.equal(d[0].reason, 'unpriced-model');
  });

  it('flags a recorded cost that disagrees with recompute beyond tolerance', () => {
    // 800k in + 100k out on opus-4-8 = 0.8*5 + 0.1*25 = $6.50. Record $50 → mismatch.
    const d = findCostDiscrepancies([
      session({ model: 'claude-opus-4-8', tokens_in: 800_000, tokens_out: 100_000, estimated_cost_usd: 50 }),
    ]);
    assert.equal(d.length, 1);
    assert.equal(d[0].reason, 'mismatch');
    assert.equal(d[0].recomputedUsd, 6.5);
  });

  it('accepts a recorded cost within tolerance', () => {
    const d = findCostDiscrepancies([
      session({ model: 'claude-opus-4-8', tokens_in: 800_000, tokens_out: 100_000, estimated_cost_usd: 6.5 }),
    ]);
    assert.deepEqual(d, []);
  });
});

// ─── analyzeBudget ───────────────────────────────────────────────────────────

function budget(over: Partial<BudgetState['current_week']> = {}): BudgetState {
  const base: BudgetState['current_week'] = {
    starts_at: '2026-06-15T00:00:00Z',
    ends_at: '2026-06-22T00:00:00Z',
    tier_1_continuous: { cap_usd: 70, spent_usd: 0, remaining_usd: 70, pct_used: 0 },
    tier_2_daily: { cap_usd: 2100, spent_usd: 0, remaining_usd: 2100, pct_used: 0 },
    tier_3_weekly: { cap_usd: 2500, spent_usd: 0, remaining_usd: 2500, pct_used: 0 },
    tier_4_wholistic: { cap_usd: 4000, spent_usd: 0, remaining_usd: 4000, pct_used: 0 },
    tier_5_burst: { active: false, activated_by: null, cap_usd_lift: null },
    total_cap_usd: 8670,
    total_spent_usd: 0,
    total_projected_eow_usd: 0,
    ...over,
  };
  return { schema_version: 1, current_week: base, historical_weeks: [] };
}

describe('analyzeBudget', () => {
  it('flags over-cap risk when projection exceeds total cap', () => {
    const a = analyzeBudget(budget({ total_projected_eow_usd: 9000 }));
    assert.equal(a.overCapRisk, true);
  });

  it('flags tiers at or above the warn threshold', () => {
    const a = analyzeBudget(
      budget({
        tier_3_weekly: { cap_usd: 2500, spent_usd: 2200, remaining_usd: 300, pct_used: 88 },
      }),
    );
    assert.equal(a.tierBreaches.length, 1);
    assert.equal(a.tierBreaches[0].tier, 3);
    assert.equal(a.tierBreaches[0].pctUsed, 88);
  });

  it('reports no breaches on a fresh week', () => {
    const a = analyzeBudget(budget());
    assert.equal(a.tierBreaches.length, 0);
    assert.equal(a.overCapRisk, false);
  });
});

// ─── summarizeWindow ──────────────────────────────────────────────────────────

describe('summarizeWindow', () => {
  it('counts outcomes, totals cost, and averages cv-bar', () => {
    const sessions = [
      session({ session_id: 'a', outcome: 'delivered', estimated_cost_usd: 10 }),
      session({ session_id: 'b', outcome: 'errored', estimated_cost_usd: 5 }),
      session({ session_id: 'c', outcome: 'partial', estimated_cost_usd: 2.5 }),
    ];
    const scores = [score({ self_score: 4 }), score({ self_score: 2 })];
    const s = summarizeWindow(sessions, scores);
    assert.equal(s.sessionsAnalyzed, 3);
    assert.equal(s.delivered, 1);
    assert.equal(s.failed, 1);
    assert.equal(s.partial, 1);
    assert.equal(s.totalCostUsd, 17.5);
    assert.equal(s.avgCvBar, 3);
  });

  it('reports null avgCvBar with no scores', () => {
    assert.equal(summarizeWindow([], []).avgCvBar, null);
  });
});

// ─── cheaperAlternative ───────────────────────────────────────────────────────

describe('cheaperAlternative', () => {
  it('suggests the closest cheaper priced model', () => {
    assert.equal(cheaperAlternative('claude-opus-4-8'), 'claude-sonnet-4-6');
    assert.equal(cheaperAlternative('claude-sonnet-4-6'), 'claude-haiku-4-5');
  });

  it('returns null for the cheapest model and unknown models', () => {
    assert.equal(cheaperAlternative('claude-haiku-4-5'), null);
    assert.equal(cheaperAlternative('claude-unknown'), null);
  });
});
