/**
 * lib/kaizen/pattern-detectors.ts
 *
 * Pure, deterministic functions that turn the kaizen data layer into named
 * patterns. Every function takes already-loaded arrays — no I/O — so they are
 * trivially unit-testable with mocked inputs (see __tests__/).
 *
 * The detectors find facts. They do NOT decide what to do about them — that is
 * proposal-generator.ts's job, and ultimately the scheduled Opus session's
 * judgment. Keeping detection deterministic means the retro's evidence is
 * reproducible: same YAML in, same patterns out.
 */

import type { SessionCost, CvBarScore, BudgetState } from './data-readers.js';
import { estimateCostUsd, priceFor } from './pricing.js';

// ─── The customer-value bar ──────────────────────────────────────────────────
// The OS spec gates feature waves at "self-scored 4+ to PR". A score below 4 is
// below the bar — the prompt that produced it didn't land.
export const CV_BAR_PASS = 4;

// ─── Expensive sessions ───────────────────────────────────────────────────────

/**
 * Sessions whose estimated cost exceeds `thresholdUsd`, sorted most-expensive
 * first. "Ran over budget" in the plainest sense.
 */
export function findExpensiveSessions(
  sessions: SessionCost[],
  thresholdUsd: number,
): SessionCost[] {
  return sessions
    .filter((s) => s.estimated_cost_usd > thresholdUsd)
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd);
}

// ─── Retry storms ──────────────────────────────────────────────────────────────

export interface RetryStorm {
  /** Stable key the attempts were grouped by (pr#N or a normalized title). */
  workKey: string;
  /** Human-readable label (the title of the first attempt in the group). */
  title: string;
  /** Total sessions that attacked this same unit of work in the window. */
  attempts: number;
  /** Of those, how many ended errored/killed/partial (i.e. did not deliver). */
  failedAttempts: number;
  sessionIds: string[];
  /** Summed estimated cost across every attempt — the true price of the storm. */
  totalCostUsd: number;
  /** Outcome of the last attempt (by completed_at), if any delivered/closed it. */
  finalOutcome: SessionCost['outcome'] | null;
}

/**
 * Group sessions by the unit of work they targeted and flag any unit attacked
 * `minAttempts` (default 3) or more times — the "orchestrator retried 3+ times"
 * signal. Work is keyed by pr_number when present, else by a normalized title.
 */
export function findRetryStorms(
  sessions: SessionCost[],
  opts?: { minAttempts?: number },
): RetryStorm[] {
  const minAttempts = opts?.minAttempts ?? 3;
  const groups = new Map<string, SessionCost[]>();

  for (const s of sessions) {
    const key = workKeyFor(s);
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  const storms: RetryStorm[] = [];
  for (const [workKey, group] of groups) {
    if (group.length < minAttempts) continue;
    const byCompletion = [...group].sort(
      (a, b) =>
        new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime(),
    );
    storms.push({
      workKey,
      title: group[0].title,
      attempts: group.length,
      failedAttempts: group.filter((s) => s.outcome !== 'delivered').length,
      sessionIds: group.map((s) => s.session_id),
      totalCostUsd:
        Math.round(group.reduce((sum, s) => sum + s.estimated_cost_usd, 0) * 100) /
        100,
      finalOutcome: byCompletion.at(-1)?.outcome ?? null,
    });
  }

  // Costliest storms first — those are where the retro's attention should go.
  return storms.sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

/** pr#N if the session names a PR, otherwise a normalized form of the title. */
export function workKeyFor(s: SessionCost): string {
  if (typeof s.pr_number === 'number') return `pr#${s.pr_number}`;
  return `title:${normalizeTitle(s.title)}`;
}

/**
 * Collapse a session title to a comparable key: lowercase, drop a leading
 * "block x —" / "wave-N" marker and any trailing "(retry)"-style parenthetical,
 * strip non-alphanumerics. Two attempts at the same work usually share a title
 * modulo these decorations.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bwave[-\s]?\d+\b/g, ' ')
    .replace(/\bblock\s+[a-z0-9]+\b/g, ' ')
    .replace(/\bretry\b|\battempt\s*\d*\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ─── Low customer-value-bar scores ──────────────────────────────────────────────

/**
 * cv-bar scores below `threshold` (default 4 — the PR gate), worst first. These
 * are the prompts/waves whose output a customer wouldn't rate as valuable.
 */
export function findLowCVBarScores(
  scores: CvBarScore[],
  threshold: number = CV_BAR_PASS,
): CvBarScore[] {
  return scores
    .filter((s) => s.self_score < threshold)
    .sort((a, b) => a.self_score - b.self_score);
}

// ─── Failed orchestrators ──────────────────────────────────────────────────────

/** Sessions that errored or were killed — the loop did not complete its work. */
export function findFailedOrchestrators(sessions: SessionCost[]): SessionCost[] {
  return sessions
    .filter((s) => s.outcome === 'errored' || s.outcome === 'killed')
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );
}

// ─── Model efficiency (cost vs. customer value, per model) ───────────────────────

export interface ModelEfficiency {
  model: string;
  sessionCount: number;
  totalCostUsd: number;
  avgCostUsd: number;
  /** How many of this model's sessions carry a cv-bar score. */
  scoredCount: number;
  /** Mean cv-bar across this model's scored PRs, or null if none scored. */
  avgCvBar: number | null;
  /** Estimated cost per cv-bar point — lower is more efficient. */
  costPerCvPoint: number | null;
  flag: 'expensive-low-value' | 'efficient' | 'insufficient-data';
}

/**
 * Join sessions and cv-bar scores by model and compute cost-vs-value per model.
 * This is what surfaces "Opus 4.8 averaging $X but only Y/5 — Sonnet would be
 * cheaper for this work". The join is on the `model` field both records carry.
 *
 * `expensiveAvgUsd` (default $50) is the per-session average above which a model
 * is "expensive"; combined with a sub-bar avg cv score it earns the
 * expensive-low-value flag — the downgrade candidate.
 */
export function analyzeModelEfficiency(
  sessions: SessionCost[],
  scores: CvBarScore[],
  opts?: { expensiveAvgUsd?: number },
): ModelEfficiency[] {
  const expensiveAvgUsd = opts?.expensiveAvgUsd ?? 50;
  const byModel = new Map<
    string,
    { costs: number[]; scores: number[] }
  >();

  const ensure = (model: string) => {
    let e = byModel.get(model);
    if (!e) {
      e = { costs: [], scores: [] };
      byModel.set(model, e);
    }
    return e;
  };

  for (const s of sessions) ensure(s.model).costs.push(s.estimated_cost_usd);
  for (const s of scores) ensure(s.model).scores.push(s.self_score);

  const out: ModelEfficiency[] = [];
  for (const [model, { costs, scores: cvs }] of byModel) {
    const totalCostUsd = round2(costs.reduce((a, b) => a + b, 0));
    const avgCostUsd = costs.length ? round2(totalCostUsd / costs.length) : 0;
    const avgCvBar = cvs.length
      ? round2(cvs.reduce((a, b) => a + b, 0) / cvs.length)
      : null;
    const costPerCvPoint =
      avgCvBar && avgCvBar > 0 ? round2(avgCostUsd / avgCvBar) : null;

    let flag: ModelEfficiency['flag'];
    if (!costs.length || avgCvBar === null) {
      flag = 'insufficient-data';
    } else if (avgCostUsd >= expensiveAvgUsd && avgCvBar < CV_BAR_PASS) {
      flag = 'expensive-low-value';
    } else {
      flag = 'efficient';
    }

    out.push({
      model,
      sessionCount: costs.length,
      totalCostUsd,
      avgCostUsd,
      scoredCount: cvs.length,
      avgCvBar,
      costPerCvPoint,
      flag,
    });
  }

  return out.sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

// ─── Cost-attribution sanity (estimated vs. recorded) ────────────────────────────

export interface CostDiscrepancy {
  sessionId: string;
  title: string;
  model: string;
  recordedUsd: number;
  recomputedUsd: number | null;
  /** Absolute difference; null when the model isn't priced. */
  deltaUsd: number | null;
  reason: 'unpriced-model' | 'mismatch';
}

/**
 * Cross-check each session's recorded cost against a recompute from its token
 * counts + the price table. Surfaces stale/unpriced rows so the retro doesn't
 * reason on bad cost data. `tolerancePct` (default 15%) is the allowed drift
 * before a row is flagged as a mismatch.
 */
export function findCostDiscrepancies(
  sessions: SessionCost[],
  opts?: { tolerancePct?: number },
): CostDiscrepancy[] {
  const tolerancePct = opts?.tolerancePct ?? 15;
  const out: CostDiscrepancy[] = [];

  for (const s of sessions) {
    const recomputed = estimateCostUsd(s.model, s.tokens_in, s.tokens_out);
    if (recomputed === null) {
      out.push({
        sessionId: s.session_id,
        title: s.title,
        model: s.model,
        recordedUsd: s.estimated_cost_usd,
        recomputedUsd: null,
        deltaUsd: null,
        reason: 'unpriced-model',
      });
      continue;
    }
    const delta = Math.abs(recomputed - s.estimated_cost_usd);
    const allowed = Math.max(0.5, (s.estimated_cost_usd * tolerancePct) / 100);
    if (delta > allowed) {
      out.push({
        sessionId: s.session_id,
        title: s.title,
        model: s.model,
        recordedUsd: s.estimated_cost_usd,
        recomputedUsd: recomputed,
        deltaUsd: round2(delta),
        reason: 'mismatch',
      });
    }
  }

  return out.sort((a, b) => (b.deltaUsd ?? 0) - (a.deltaUsd ?? 0));
}

// ─── Budget analysis ────────────────────────────────────────────────────────────

export interface TierBreach {
  tier: number;
  label: string;
  capUsd: number;
  spentUsd: number;
  pctUsed: number;
}

export interface BudgetAnalysis {
  weekStartsAt: string;
  weekEndsAt: string;
  totalCapUsd: number;
  totalSpentUsd: number;
  totalPctUsed: number;
  projectedEowUsd: number;
  /** projected end-of-week spend exceeds the total cap. */
  overCapRisk: boolean;
  burstActive: boolean;
  /** Tiers at/above `warnPct` of their cap (default 80%). */
  tierBreaches: TierBreach[];
}

const TIER_LABELS: Record<number, string> = {
  1: 'continuous',
  2: 'daily',
  3: 'weekly',
  4: 'wholistic',
};

/** Summarize week-to-date burn and flag tiers near or over cap. */
export function analyzeBudget(
  budget: BudgetState,
  opts?: { warnPct?: number },
): BudgetAnalysis {
  const warnPct = opts?.warnPct ?? 80;
  const w = budget.current_week;
  const totalCapUsd = w.total_cap_usd;
  const totalSpentUsd = w.total_spent_usd;

  const tierBuckets: { tier: number; bucket: { cap_usd: number; spent_usd: number; pct_used: number } }[] = [
    { tier: 1, bucket: w.tier_1_continuous },
    { tier: 2, bucket: w.tier_2_daily },
    { tier: 3, bucket: w.tier_3_weekly },
    { tier: 4, bucket: w.tier_4_wholistic },
  ];

  const tierBreaches = tierBuckets
    .filter(({ bucket }) => bucket.pct_used >= warnPct)
    .map(({ tier, bucket }) => ({
      tier,
      label: TIER_LABELS[tier],
      capUsd: bucket.cap_usd,
      spentUsd: bucket.spent_usd,
      pctUsed: bucket.pct_used,
    }));

  return {
    weekStartsAt: w.starts_at,
    weekEndsAt: w.ends_at,
    totalCapUsd,
    totalSpentUsd,
    totalPctUsed: totalCapUsd > 0 ? round2((totalSpentUsd / totalCapUsd) * 100) : 0,
    projectedEowUsd: w.total_projected_eow_usd,
    overCapRisk: w.total_projected_eow_usd > totalCapUsd,
    burstActive: w.tier_5_burst.active,
    tierBreaches,
  };
}

// ─── Aggregate summary ───────────────────────────────────────────────────────────

export interface WindowSummary {
  sessionsAnalyzed: number;
  totalCostUsd: number;
  delivered: number;
  failed: number;
  partial: number;
  scoredPRs: number;
  avgCvBar: number | null;
  retryStorms: number;
}

export function summarizeWindow(
  sessions: SessionCost[],
  scores: CvBarScore[],
): WindowSummary {
  const totalCostUsd = round2(
    sessions.reduce((sum, s) => sum + s.estimated_cost_usd, 0),
  );
  const avgCvBar = scores.length
    ? round2(scores.reduce((sum, s) => sum + s.self_score, 0) / scores.length)
    : null;

  return {
    sessionsAnalyzed: sessions.length,
    totalCostUsd,
    delivered: sessions.filter((s) => s.outcome === 'delivered').length,
    failed: sessions.filter(
      (s) => s.outcome === 'errored' || s.outcome === 'killed',
    ).length,
    partial: sessions.filter((s) => s.outcome === 'partial').length,
    scoredPRs: scores.length,
    avgCvBar,
    retryStorms: findRetryStorms(sessions).length,
  };
}

// Cheaper-model suggestion for a downgrade proposal: the cheapest priced model
// strictly cheaper (by input rate) than the given one, or null.
export function cheaperAlternative(model: string): string | null {
  const current = priceFor(model);
  if (!current) return null;
  const cheaper = Object.entries({
    'claude-sonnet-4-6': priceFor('claude-sonnet-4-6')!,
    'claude-haiku-4-5': priceFor('claude-haiku-4-5')!,
  })
    .filter(([, p]) => p.inputPerM < current.inputPerM)
    .sort((a, b) => b[1].inputPerM - a[1].inputPerM); // closest-cheaper first
  return cheaper.length ? cheaper[0][0] : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
