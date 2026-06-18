/**
 * lib/guarantee/evaluation.ts
 *
 * The Day-7 guarantee decision, in one pure place. Both the cron (which
 * emails the offer) and the workspace surface (which renders the
 * walk-away card) evaluate eligibility through here, so "did we clear the
 * bar?" has a single answer no matter who asks.
 *
 * Deliberately pure — no DB, no env reads. Callers pass the bar + the
 * total; this just does the comparison and the human-facing formatting.
 * The env-backed bar/window live in `lib/env.ts` (guaranteeBarHours,
 * guaranteeEvaluationDays); resolve them at the edge and pass them in.
 */

export interface GuaranteeEvaluationInput {
  /** Minutes the fleet has saved the workspace so far. */
  totalMinutesSaved: number;
  /** The bar, in minutes (guaranteeBarHours × 60). */
  barMinutes: number;
  /** Workspace age in whole days since signup. */
  ageDays: number;
  /** The evaluation day (guaranteeEvaluationDays). */
  evaluationDays: number;
}

export interface GuaranteeEvaluation {
  /** True once the workspace has reached the evaluation day. */
  isDue: boolean;
  /** True when saved time meets or exceeds the bar. */
  meetsBar: boolean;
  /** Minutes short of the bar (0 when met). */
  deficitMinutes: number;
  /** True when the walk-away offer should surface: due AND under bar. */
  walkAwayEligible: boolean;
}

/** Convert an hours bar to whole minutes. Centralized so rounding is
 *  consistent everywhere the bar is compared. */
export function barHoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

export function evaluateGuarantee(
  input: GuaranteeEvaluationInput,
): GuaranteeEvaluation {
  const isDue = input.ageDays >= input.evaluationDays;
  const meetsBar = input.totalMinutesSaved >= input.barMinutes;
  const deficitMinutes = meetsBar
    ? 0
    : Math.max(0, input.barMinutes - input.totalMinutesSaved);
  return {
    isDue,
    meetsBar,
    deficitMinutes,
    walkAwayEligible: isDue && !meetsBar,
  };
}

/** Format minutes as a short human string: "47 min", "3.5 hrs", "5 hrs". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  // One decimal, but drop a trailing ".0".
  const rounded = Math.round(hours * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} hr${rounded === 1 ? '' : 's'}`;
}
