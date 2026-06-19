/**
 * lib/workflows/counter.ts
 *
 * Pure formatting + projection for the saved-time counter — the "Plaino
 * drafted 3 replies · saved 27 minutes today" line that ticks as the killer
 * workflow runs. Kept framework-free so it is fully unit-tested under
 * `npm test`; `components/workspace/SavedTimeCounter.tsx` is a thin animated
 * shell over these functions.
 *
 * Every number here is derived from the runtime's calibrated per-action
 * minutes (see `runtime.ts`) — no figure is invented at format time.
 */

import type { WorkflowStory } from "./runtime";
import { totalActions, totalSavedMinutes } from "./runtime";

/** "27 minutes", "1 hr 5 min", "2 hr". Plain, lowercase, no exclamation. */
export function formatSavedTime(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} ${m === 1 ? "minute" : "minutes"}`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${hrs} hr`;
  return `${hrs} hr ${rem} min`;
}

/**
 * The counter line. `verb` is the dominant action verb for the workflow
 * ("drafted", "chased", "screened") and `noun` its object ("replies",
 * "requests"). Falls back to a neutral "handled N items" when none given.
 */
export function formatCounterLine(args: {
  actions: number;
  savedMinutes: number;
  verb?: string;
  noun?: string;
}): string {
  const { actions, savedMinutes, verb, noun } = args;
  const saved = formatSavedTime(savedMinutes);
  if (actions <= 0) {
    return `Plaino is getting started · 0 minutes saved`;
  }
  const what =
    verb && noun
      ? `${verb} ${actions} ${actions === 1 ? singular(noun) : noun}`
      : `handled ${actions} ${actions === 1 ? "item" : "items"}`;
  return `Plaino ${what} · saved ${saved}`;
}

function singular(noun: string): string {
  if (noun === "replies") return "reply";
  if (noun.endsWith("s")) return noun.slice(0, -1);
  return noun;
}

// ─── Trial-value projection (the "day 7" evaluation moment) ───────────────────

export interface TrialProjection {
  /** Saved minutes the single demo run is worth. */
  perRunMinutes: number;
  /** Conservative runs-of-this-kind across a 7-day trial. */
  runsPerTrial: number;
  /** Projected minutes saved over the trial. */
  trialMinutes: number;
  /** Pre-formatted, e.g. "about 5 hr over your 7-day trial". */
  label: string;
}

/**
 * Project what work like this adds up to across the trial. Deliberately
 * conservative and labeled an estimate on sample data wherever it renders —
 * it motivates the connect step without overclaiming (the mandate's
 * no-fabricated-hours rule). `runsPerTrial` is the per-vertical cadence the
 * story file supplies (leads/week, late units/week, …).
 */
export function projectTrialValue(args: {
  perRunMinutes: number;
  runsPerTrial: number;
}): TrialProjection {
  const perRunMinutes = Math.max(0, Math.round(args.perRunMinutes));
  const runsPerTrial = Math.max(1, Math.round(args.runsPerTrial));
  const trialMinutes = perRunMinutes * runsPerTrial;
  return {
    perRunMinutes,
    runsPerTrial,
    trialMinutes,
    label: `about ${formatSavedTime(trialMinutes)} over a 7-day trial`,
  };
}

/** Convenience: full-story counter values straight from a story definition. */
export function storyCounter(story: WorkflowStory): {
  actions: number;
  savedMinutes: number;
} {
  return {
    actions: totalActions(story),
    savedMinutes: totalSavedMinutes(story),
  };
}
