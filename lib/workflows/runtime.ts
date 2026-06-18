/**
 * lib/workflows/runtime.ts
 *
 * The "story" engine behind the VISIBLE killer-workflow runtime. A workflow is
 * a deterministic STORY: a trigger ("9:14pm — a new buyer lead landed") and an
 * ordered list of steps Plaino runs in response (read → enrich → draft →
 * schedule → log). The runtime renders each step live and ticks a saved-time
 * counter as steps complete — the thing that turns a trial into a paying
 * customer because they WATCH it work.
 *
 * This module is PURE + framework-agnostic: types, the calibrated per-action
 * minute-savings table, and projection functions over a story. No React, no
 * I/O, no LLM, no `Date.now()` / `Math.random()`. The React player
 * (`components/workspace/KillerWorkflowRuntime.tsx`) drives the timing and
 * calls `projectStory(story, completedCount)` each tick to get what to show.
 *
 * Saved-time honesty (the build mandate's "use calibrated per-action estimates,
 * never fabricate hours saved"): every step's saving is a fixed, defensible
 * per-action minute value from `ACTION_MINUTES` — the time the same task takes
 * a person by hand — multiplied by the step's item `count` when it is a batch
 * (e.g. 47 document requests). The number on screen is always
 * `sum(perActionMinutes × count)` over completed steps. Nothing is invented at
 * render time.
 */

import type { Vertical } from "@prisma/client";

// ─── Action calibration ──────────────────────────────────────────────────────
// Each action kind maps to the minutes the SAME task takes a person by hand.
// These are deliberately conservative and named so they can be defended line by
// line (feedback_no_guesses_no_estimates). The mandate fixed two of them:
// a drafted email = 10 min, a lead enrichment = 5 min — the rest sit around
// those anchors.

export type WorkflowActionKind =
  | "read" // read / catch an inbound
  | "enrich" // research / enrich a lead or contact
  | "classify" // qualify / triage / prioritize / screen
  | "draft-email" // draft one personalized email or reply
  | "draft-document" // draft a document (fee agreement, COI, checklist)
  | "schedule" // propose times / draft a calendar invite
  | "coordinate" // coordinate a vendor or third party
  | "request-doc" // draft one document-request / chase
  | "notify" // draft a status update to a party
  | "update-record"; // update the CRM / system of record

/** Minutes the action saves the owner, per item. Calibrated, not guessed. */
export const ACTION_MINUTES: Record<WorkflowActionKind, number> = {
  read: 2,
  enrich: 5,
  classify: 3,
  "draft-email": 10,
  "draft-document": 15,
  schedule: 6,
  coordinate: 8,
  "request-doc": 3,
  notify: 3,
  "update-record": 4,
};

// ─── Story shape ─────────────────────────────────────────────────────────────

export type WorkflowStepStatus = "pending" | "running" | "done";

export interface WorkflowStep {
  /** Stable id, unique within a story. */
  id: string;
  /** Verb-led action label shown in the running list: "Drafted the reply". */
  label: string;
  /** One concrete detail line with the synthetic specifics. */
  detail: string;
  /** The calibrated action kind this step performs. */
  action: WorkflowActionKind;
  /** Item count for batch steps (e.g. 47 document requests). Default 1.
   *  Saved minutes for the step = ACTION_MINUTES[action] × count. */
  count?: number;
  /** Milliseconds the player "runs" this step before completing it. Drives
   *  the live feel; never affects the saved-minutes math. */
  runMs: number;
}

export interface WorkflowStory {
  /** `null` = the general (on-ramp) story. */
  vertical: Vertical | null;
  /** Canonical killer-workflow promise — leads the surface (locked copy). */
  headline: string;
  /** The "when X happens" trigger line that opens the story. */
  trigger: string;
  /** Plain label for where the sample data comes from. */
  sourceLabel: string;
  /** The marketplace tile id the "make it real" CTA deep-links to. */
  connectIntegrationId: string;
  /** Human label for that integration ("Follow Up Boss"). */
  connectLabel: string;
  /** What connecting unlocks, plain language. */
  connectWhy: string;
  /** Dominant action verb for the counter line ("drafted", "chased"). */
  counterVerb: string;
  /** Object of that verb for the counter line ("replies", "requests"). */
  counterNoun: string;
  /** Conservative count of runs like this across a 7-day trial — drives the
   *  trial-value projection (the "day 7" evaluation moment). */
  runsPerTrial: number;
  steps: WorkflowStep[];
}

// ─── Pure projection ─────────────────────────────────────────────────────────

/** Saved minutes a single step is worth (per-action × count). */
export function stepSavedMinutes(step: WorkflowStep): number {
  return ACTION_MINUTES[step.action] * (step.count ?? 1);
}

/** "Actions" a step represents — its item count (batch steps count each item)
 *  so the counter can say "drafted 47 requests" honestly. */
export function stepActionCount(step: WorkflowStep): number {
  return step.count ?? 1;
}

export interface ProjectedStep extends WorkflowStep {
  status: WorkflowStepStatus;
  savedMinutes: number;
}

export interface StoryProjection {
  steps: ProjectedStep[];
  /** Steps fully completed so far. */
  completedSteps: number;
  /** Total steps in the story. */
  totalSteps: number;
  /** Actions completed (sums batch item counts). */
  actions: number;
  /** Saved minutes accrued from completed steps. */
  savedMinutes: number;
  /** True once every step is done. */
  complete: boolean;
}

/**
 * Project a story at a given number of completed steps. The step at index
 * `completedCount` (if any) is the one currently "running"; everything before
 * is `done`, everything after is `pending`. Counter values reflect only the
 * `done` steps — work is credited when it finishes, never while in flight.
 *
 * `completedCount` is clamped to `[0, steps.length]`, so callers can advance it
 * freely without bounds-checking.
 */
export function projectStory(
  story: WorkflowStory,
  completedCount: number,
): StoryProjection {
  const total = story.steps.length;
  const done = Math.max(0, Math.min(completedCount, total));

  let actions = 0;
  let savedMinutes = 0;
  const steps: ProjectedStep[] = story.steps.map((step, i) => {
    const status: WorkflowStepStatus =
      i < done ? "done" : i === done ? "running" : "pending";
    const saved = stepSavedMinutes(step);
    if (status === "done") {
      actions += stepActionCount(step);
      savedMinutes += saved;
    }
    return { ...step, status, savedMinutes: saved };
  });

  return {
    steps,
    completedSteps: done,
    totalSteps: total,
    actions,
    savedMinutes,
    complete: done >= total,
  };
}

/** Total saved minutes when the whole story has run — the headline payoff. */
export function totalSavedMinutes(story: WorkflowStory): number {
  return story.steps.reduce((sum, s) => sum + stepSavedMinutes(s), 0);
}

/** Total actions when the whole story has run. */
export function totalActions(story: WorkflowStory): number {
  return story.steps.reduce((sum, s) => sum + stepActionCount(s), 0);
}

/** Total wall-clock the player takes to run the whole story, in ms. */
export function storyDurationMs(story: WorkflowStory): number {
  return story.steps.reduce((sum, s) => sum + s.runMs, 0);
}
