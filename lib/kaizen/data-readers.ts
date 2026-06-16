/**
 * lib/kaizen/data-readers.ts
 *
 * Typed readers for the three YAML files the weekly kaizen retro consumes:
 * session-costs.yaml, cv-bar-scores.yaml, calibration.yaml. Plus budget-state
 * for the budget-analysis section.
 *
 * This wraps the canonical readers in lib/memory/data-readers.ts rather than
 * re-parsing YAML — there is one source of truth for the data layer. We add a
 * single convenience loader, `loadKaizenInputs`, that pulls everything the
 * retro needs scoped to a time window (default: last 7 days).
 *
 * Read-only, like the underlying readers. All writes go through the Librarian's
 * INBOX — see memory/data/README.md and lib/kaizen/session-stamp.ts.
 */

import {
  readSessionCosts,
  readCvBarScores,
  readCalibration,
  readBudgetState,
  type SessionCost,
  type CvBarScore,
  type Calibration,
  type BudgetState,
} from '../memory/data-readers.js';

// Re-export the types + the three primary readers so kaizen callers have a
// single import surface and don't reach across into lib/memory directly.
export {
  readSessionCosts,
  readCvBarScores,
  readCalibration,
  readBudgetState,
};
export type { SessionCost, CvBarScore, Calibration, BudgetState };

export const DEFAULT_WINDOW_DAYS = 7;

export interface KaizenInputs {
  /** Size of the look-back window in days. */
  windowDays: number;
  /** Inclusive lower bound — sessions started on/after this are in scope. */
  since: Date;
  /** The "now" the window was computed against (exclusive upper bound for display). */
  asOf: Date;
  sessions: SessionCost[];
  cvBarScores: CvBarScore[];
  calibration: Calibration;
  budget: BudgetState;
}

/**
 * Load everything the weekly retro reads, scoped to the look-back window.
 *
 * `now` is injectable so the retro is reproducible and testable; the CLI passes
 * `new Date()`. cv-bar scores are filtered to the window by `scored_at` so the
 * retro only reasons about PRs scored in the period it's reporting on.
 */
export async function loadKaizenInputs(opts?: {
  windowDays?: number;
  now?: Date;
}): Promise<KaizenInputs> {
  const windowDays = opts?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const asOf = opts?.now ?? new Date();
  const since = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const [sessions, allScores, calibration, budget] = await Promise.all([
    readSessionCosts({ since }),
    readCvBarScores(),
    readCalibration(),
    readBudgetState(),
  ]);

  const sinceMs = since.getTime();
  const cvBarScores = allScores.filter((s) => {
    const t = new Date(s.scored_at).getTime();
    return Number.isFinite(t) ? t >= sinceMs : true; // keep unparseable dates; flagged downstream
  });

  return { windowDays, since, asOf, sessions, cvBarScores, calibration, budget };
}
