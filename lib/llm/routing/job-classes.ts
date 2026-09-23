/**
 * lib/llm/routing/job-classes.ts
 *
 * What the WORK demands — the four axes that decide which model a workload
 * needs. This file defines the axes and the classes; `policy.ts` maps classes
 * to models. Keeping those apart is the point: the axes describe the job and
 * change rarely; the model list changes every few months.
 *
 * WHY AXES AND NOT TIERS
 * ─────────────────────
 * The scheme this replaces had three names — OPUS / SONNET / HAIKU — which
 * describe the ANSWER, not the question. A new workload could not be routed
 * without someone deciding, by feel, whether it "felt like an Opus job", and
 * the tier names went stale the moment the model list moved (they now point at
 * `claude-opus-4-7` and `claude-sonnet-4-6`, both previous-generation).
 *
 * The test for this file: hand it a workload nobody has seen before, score the
 * four axes from facts about the work, and get a model out without an opinion.
 * If that does not work, the scheme is not finished.
 */

/**
 * CONSEQUENCE — what happens when the output is wrong.
 * The dominant axis: it is the only one where being cheap can cost real money.
 */
export type Consequence =
  | 'C0' // internal only, reversible, cheap to redo. A wrong answer is noise.
  | 'C1' // internal, but feeds a decision a human will review.
  | 'C2' // the customer READS it. A wrong answer is visible and embarrassing.
  | 'C3'; // the customer ACTS on it, or it is irreversible or regulated.

/** REASONING — how far the answer is from the input. */
export type Reasoning =
  | 'R0' // the answer is IN the input: classify, extract, route, match.
  | 'R1' // one inference hop: summarize, rewrite, translate, reformat.
  | 'R2' // synthesis across sources, weighing tradeoffs, judgement.
  | 'R3'; // open-ended: plan, revise, self-correct over multiple steps.

/**
 * CONTEXT — how much has to be in the window.
 * A hard filter, not a preference: Haiku 4.5 is a 200K model while every other
 * current model is 1M, so X2 eliminates Haiku outright.
 */
export type ContextSize =
  | 'X0' // under ~30K tokens
  | 'X1' // ~30K–200K
  | 'X2'; // over 200K — excludes Haiku 4.5 by capability, not by preference

/** LATENCY — how long the caller can wait. Cost modifier, never a quality gate. */
export type Latency =
  | 'L0' // a person is watching a cursor blink. Seconds.
  | 'L1' // near-real-time. Tens of seconds.
  | 'L2' // background job. Minutes.
  | 'L3'; // deferrable to a batch window — eligible for the Batch API at 50%.

export interface JobDemand {
  readonly consequence: Consequence;
  readonly reasoning: Reasoning;
  readonly context: ContextSize;
  readonly latency: Latency;
}

/**
 * The job classes. Each is a REGION of the axis space, not a synonym for a
 * model — two classes may land on the same model today and diverge tomorrow.
 */
export type JobClass =
  | 'TRIAGE' // C0–C1, R0, X0–X1 — the answer is in the input
  | 'EXTRACT' // C1, R0–R1, X0–X1 — structured pull from unstructured text
  | 'TRANSFORM' // C1–C2, R1, X0–X1 — one hop, customer may read it
  | 'COMPOSE' // C2, R2 — customer reads it, needs synthesis
  | 'JUDGE' // C3, R2–R3 — customer acts on it, or it is irreversible
  | 'FRONTIER'; // C3, R3, X2 — genuinely hardest; long-horizon, huge context

export const JOB_CLASSES: readonly JobClass[] = [
  'TRIAGE',
  'EXTRACT',
  'TRANSFORM',
  'COMPOSE',
  'JUDGE',
  'FRONTIER',
] as const;

const CONSEQUENCE_RANK: Record<Consequence, number> = { C0: 0, C1: 1, C2: 2, C3: 3 };
const REASONING_RANK: Record<Reasoning, number> = { R0: 0, R1: 1, R2: 2, R3: 3 };

/**
 * The mechanical rule. Score the four axes from facts about the work, get a
 * class. No judgement call, no "this feels like" — which is the whole point.
 *
 * Consequence and reasoning are taken as a MAXIMUM rather than an average:
 * a trivially simple task whose output the customer acts on is still a
 * high-consequence task, and a genuinely hard problem is hard even when
 * nobody sees the answer. Averaging them would let one axis hide the other.
 */
export function classifyJob(demand: JobDemand): JobClass {
  const c = CONSEQUENCE_RANK[demand.consequence];
  const r = REASONING_RANK[demand.reasoning];
  const huge = demand.context === 'X2';

  // REASONING sets the capability bar; CONSEQUENCE can only raise it.
  // Reversing those two was the first bug in this file: letting consequence
  // drive the bar routed every customer-read one-line summary to a synthesis
  // model, which is how a cost-aware scheme quietly stops being one.

  // C3 — the customer acts on it, or it is irreversible or regulated. Being
  // wrong costs more than any token saving, whatever the task's difficulty.
  if (c >= 3) return huge && r >= 3 ? 'FRONTIER' : 'JUDGE';

  // R3 — open-ended plan-and-revise. Escalated even when nobody reads it: a
  // model that cannot do the task returns a confident wrong answer, and that
  // is more expensive than the tokens saved by asking it.
  if (r >= 3) return huge ? 'FRONTIER' : 'JUDGE';

  // R2 — real synthesis across sources. Needs a capable model regardless of
  // who reads it; consequence below C3 does not change the capability needed.
  if (r === 2) return 'COMPOSE';

  // R1 — one inference hop. Consequence decides whether it can run on the
  // cheapest tier: if the customer reads it, it cannot.
  if (r === 1) return c >= 2 ? 'TRANSFORM' : 'EXTRACT';

  // R0 — the answer is in the input.
  return 'TRIAGE';
}
