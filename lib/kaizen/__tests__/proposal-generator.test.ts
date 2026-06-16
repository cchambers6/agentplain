/**
 * lib/kaizen/__tests__/proposal-generator.test.ts
 *
 * Tests that generateRetro turns patterns into the right proposals + data gaps,
 * and that renderRetroMarkdown produces a sane document. Inputs are mocked
 * KaizenInputs objects — no filesystem.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRetro, renderRetroMarkdown } from '../proposal-generator.js';
import type { KaizenInputs, SessionCost, CvBarScore, BudgetState } from '../data-readers.js';

function session(over: Partial<SessionCost> = {}): SessionCost {
  return {
    session_id: 'local_' + (over.session_id ?? 's'),
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
    pr_number: 100,
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

function freshBudget(over: Partial<BudgetState['current_week']> = {}): BudgetState {
  return {
    schema_version: 1,
    current_week: {
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
    },
    historical_weeks: [],
  };
}

function inputs(over: Partial<KaizenInputs> = {}): KaizenInputs {
  return {
    windowDays: 7,
    since: new Date('2026-06-08T00:00:00Z'),
    asOf: new Date('2026-06-15T00:00:00Z'),
    sessions: [],
    cvBarScores: [],
    calibration: {
      schema_version: 1,
      last_rollup_at: null,
      prompt_patterns: [],
      model_routing: [],
      known_waste_patterns: [],
    },
    budget: freshBudget(),
    ...over,
  };
}

const FIXED_NOW = '2026-06-15T09:00:00Z';

describe('generateRetro — empty data', () => {
  it('emits a loud DATA MISSING gap when no sessions ran', () => {
    const retro = generateRetro(inputs(), { generatedAt: FIXED_NOW });
    assert.ok(retro.dataGaps.some((g) => g.includes('zero session-costs rows')));
    assert.equal(retro.summary.sessionsAnalyzed, 0);
    assert.equal(retro.generatedAt, FIXED_NOW);
  });

  it('does not invent proposals from nothing', () => {
    const retro = generateRetro(inputs(), { generatedAt: FIXED_NOW });
    assert.equal(retro.proposals.length, 0);
  });
});

describe('generateRetro — retry storm', () => {
  it('produces an orchestrator-prompt proposal for a failing storm', () => {
    const sessions = [
      session({ session_id: '1', pr_number: 50, outcome: 'errored' }),
      session({ session_id: '2', pr_number: 50, outcome: 'killed' }),
      session({ session_id: '3', pr_number: 50, outcome: 'errored' }),
    ];
    const retro = generateRetro(inputs({ sessions }), { generatedAt: FIXED_NOW });
    const storm = retro.proposals.find((p) =>
      p.title.startsWith('Retry storm'),
    );
    assert.ok(storm, 'expected a retry-storm proposal');
    assert.equal(storm!.category, 'orchestrator-prompt');
    assert.ok(storm!.evidence.some((e) => e.includes('pr#50')));
  });
});

describe('generateRetro — model routing', () => {
  it('proposes a downgrade for an expensive low-value model', () => {
    const sessions = [
      session({ session_id: '1', estimated_cost_usd: 120 }),
      session({ session_id: '2', estimated_cost_usd: 90 }),
    ];
    const scores = [
      score({ pr_number: 1, self_score: 3 }),
      score({ pr_number: 2, self_score: 2 }),
    ];
    const retro = generateRetro(inputs({ sessions, cvBarScores: scores }), {
      generatedAt: FIXED_NOW,
    });
    const routing = retro.proposals.find((p) => p.category === 'model-routing');
    assert.ok(routing, 'expected a model-routing proposal');
    assert.ok(routing!.recommendation.includes('claude-sonnet-4-6'));
  });
});

describe('generateRetro — budget', () => {
  it('raises an urgent budget proposal on over-cap projection', () => {
    const retro = generateRetro(
      inputs({ budget: freshBudget({ total_projected_eow_usd: 9500, total_spent_usd: 6000 }) }),
      { generatedAt: FIXED_NOW },
    );
    const b = retro.proposals.find((p) => p.category === 'budget');
    assert.ok(b);
    assert.equal(b!.severity, 'urgent');
  });
});

describe('generateRetro — low cv-bar', () => {
  it('proposes prompt tuning when PRs score below the bar', () => {
    const scores = [
      score({ pr_number: 1, self_score: 2, reasoning: 'engineer vocab leaked' }),
      score({ pr_number: 2, self_score: 3 }),
    ];
    // give a session so the cv-gap (not session-gap) message path is exercised
    const retro = generateRetro(
      inputs({ sessions: [session()], cvBarScores: scores }),
      { generatedAt: FIXED_NOW },
    );
    const prompt = retro.proposals.find(
      (p) => p.category === 'orchestrator-prompt' && p.title.includes('below the cv-bar'),
    );
    assert.ok(prompt);
  });
});

describe('renderRetroMarkdown', () => {
  it('renders headings, the gap section, and the model table', () => {
    const sessions = [
      session({ session_id: '1', estimated_cost_usd: 120 }),
      session({ session_id: '2', estimated_cost_usd: 90 }),
    ];
    const scores = [score({ self_score: 2 }), score({ pr_number: 2, self_score: 3 })];
    const retro = generateRetro(inputs({ sessions, cvBarScores: scores }), {
      generatedAt: FIXED_NOW,
    });
    const md = renderRetroMarkdown(retro);
    assert.match(md, /# Weekly Kaizen Retro/);
    assert.match(md, /## At a glance/);
    assert.match(md, /## Proposed improvements/);
    assert.match(md, /## Model routing/);
    assert.match(md, /claude-opus-4-8/);
  });

  it('shows the no-proposals note on a clean, well-populated week', () => {
    // sessions present, all delivered, no failures/storms/low-scores/expensive.
    // Cost must match the default token counts (800k/100k opus = $6.50) so the
    // cost-discrepancy detector stays quiet.
    const sessions = [
      session({ session_id: '1', estimated_cost_usd: 6.5, pr_number: 1 }),
      session({ session_id: '2', estimated_cost_usd: 6.5, pr_number: 2 }),
    ];
    const retro = generateRetro(inputs({ sessions }), { generatedAt: FIXED_NOW });
    const md = renderRetroMarkdown(retro);
    // With <3 scored PRs there's no positive-capture proposal, so the section is empty.
    assert.match(md, /No mechanical proposals this window/);
  });
});
