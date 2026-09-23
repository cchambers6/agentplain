/**
 * lib/llm/model-tiers.ts
 *
 * BACK-COMPAT SHIM. The three tier constants below are now DERIVED from
 * `lib/llm/routing/policy.ts`, which is the single place model choice lives.
 *
 * WHY THIS FILE STILL EXISTS
 * ──────────────────────────
 * 169 usages across 33 files import `MODEL_OPUS` / `MODEL_SONNET` /
 * `MODEL_HAIKU`. Rewriting all of them in the same change that introduces the
 * seam would make the diff unreviewable and couple a mechanical rename to a
 * routing decision that has not been ratified. So the constants stay, the
 * values come from the policy, and call sites migrate to `routeFor(jobClass)`
 * one surface at a time.
 *
 * WHY THE TIER NAMES ARE THE PROBLEM
 * ──────────────────────────────────
 * `MODEL_OPUS` names the ANSWER, not the question. A new workload cannot be
 * routed by it without someone deciding by feel whether the job "feels like an
 * Opus job", and the name goes stale the moment the model list moves — as it
 * has: this file pinned `claude-opus-4-7` and `claude-sonnet-4-6`, both
 * previous-generation, plus a date-suffixed Haiku id that is not the API's
 * canonical form. `routing/job-classes.ts` replaces the feel with four axes
 * scored from facts about the work.
 *
 * New code should import `routeFor` from `./routing/policy` and pass a
 * `JobClass`. These three exports are for the existing call sites only.
 */

import { POLICY_CURRENT, routeFor } from './routing/policy';

/**
 * Customer-facing draft / brief / synthesis. Quality over cost.
 * Now: whatever the active policy assigns to the COMPOSE class.
 */
export const MODEL_OPUS: string = routeFor('COMPOSE', POLICY_CURRENT).model;

/**
 * Customer-adjacent moderate-reasoning work (extraction, refine, schedule
 * proposals). Now: whatever the active policy assigns to TRANSFORM.
 */
export const MODEL_SONNET: string = routeFor('TRANSFORM', POLICY_CURRENT).model;

/**
 * Internal narrow classifier — discrete categorical / binary decisions.
 * Now: whatever the active policy assigns to TRIAGE.
 */
export const MODEL_HAIKU: string = routeFor('TRIAGE', POLICY_CURRENT).model;
