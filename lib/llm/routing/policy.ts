/**
 * lib/llm/routing/policy.ts
 *
 * The config seam. ONE file decides which model each job class gets, what
 * effort it runs at, and what happens when that model is unavailable or the
 * workspace is over budget.
 *
 * WHAT THIS REPLACES
 * ──────────────────
 * Model choice lived in three places that drifted apart:
 *   - `lib/llm/model-tiers.ts` — three constants, 169 usages across 33 files
 *   - `lib/llm/routing-provider.ts` — a second, inlined surface→model table
 *   - ~142 raw model-id string literals scattered through lib/ and app/
 * Eleven distinct id strings were in the tree, including retired models
 * (`claude-opus-4-0`, `claude-sonnet-4-5`) and date-suffixed forms the current
 * API guidance says never to write (`claude-haiku-4-5-20251001`).
 * `model-tiers.ts` now re-exports from here, so all 169 call sites keep working
 * and the decision has exactly one home.
 *
 * TWO POLICIES, ONE SWITCH
 * ────────────────────────
 * `POLICY_CURRENT` encodes what production does TODAY, exactly — so this PR is
 * a no-op by construction and the diff is reviewable without reasoning about
 * behaviour change. `POLICY_PROPOSED` is the new routing. `ACTIVE_POLICY`
 * selects between them and defaults to CURRENT.
 *
 * Ratification is a one-line change. That is deliberate: model routing is
 * Conner's call, and a proposal that quietly takes effect on merge is not a
 * proposal.
 *
 * PRICES (USD per million tokens, from the claude-api reference, cached
 * 2026-06-24 — NOT from lib/billing/usage/pricing.ts, which is stale; see the
 * proposal doc):
 *   Haiku 4.5   claude-haiku-4-5    $1  / $5    200K ctx   no `effort` param
 *   Sonnet 5    claude-sonnet-5     $2  / $10   1M ctx
 *   Opus 5      claude-opus-5       $5  / $25   1M ctx     thinking on by default
 *   Fable 5.1   claude-fable-5-1    $10 / $50   1M ctx     thinking always on
 */

import type { JobClass } from './job-classes';

/** Canonical ids. Never date-suffixed — the suffixed forms are not the API's. */
export const HAIKU_4_5 = 'claude-haiku-4-5';
export const SONNET_5 = 'claude-sonnet-5';
export const OPUS_5 = 'claude-opus-5';
export const FABLE_5_1 = 'claude-fable-5-1';

/**
 * Effort is the first quality lever INSIDE a model, and it is cheaper to pull
 * than a model upgrade. `null` means "do not send the parameter" — required
 * for Haiku 4.5, which rejects `effort`.
 */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null;

export interface RouteDecision {
  readonly model: string;
  readonly effort: Effort;
  /** Where to go when `model` is unavailable or the workspace is over budget. */
  readonly fallbackModel: string;
  readonly fallbackEffort: Effort;
  /**
   * TRUE when taking the fallback lowers quality on something a customer reads
   * or acts on. The runtime must surface these rather than degrade silently —
   * that is a product decision, not a routing one.
   */
  readonly fallbackDegradesCustomerOutput: boolean;
  /** Eligible for the Batch API (50% off) when the caller tolerates L3. */
  readonly batchEligible: boolean;
  /** Why this model, in one line. Kept next to the decision so it stays true. */
  readonly rationale: string;
}

export type RoutingPolicy = Readonly<Record<JobClass, RouteDecision>>;

/**
 * TODAY. Mirrors `model-tiers.ts` as it stands on origin/main, mapped onto the
 * job classes. Present so the seam can land without changing behaviour.
 * The models here are previous-generation on purpose — that is the fact.
 */
export const POLICY_CURRENT: RoutingPolicy = {
  TRIAGE: {
    model: 'claude-haiku-4-5-20251001',
    effort: null,
    fallbackModel: 'claude-sonnet-4-6',
    fallbackEffort: null,
    fallbackDegradesCustomerOutput: false,
    batchEligible: false,
    rationale: 'MODEL_HAIKU as pinned today (date-suffixed id, as in tree).',
  },
  EXTRACT: {
    model: 'claude-haiku-4-5-20251001',
    effort: null,
    fallbackModel: 'claude-sonnet-4-6',
    fallbackEffort: null,
    fallbackDegradesCustomerOutput: false,
    batchEligible: false,
    rationale: 'MODEL_HAIKU as pinned today.',
  },
  TRANSFORM: {
    model: 'claude-sonnet-4-6',
    effort: null,
    fallbackModel: 'claude-opus-4-7',
    fallbackEffort: null,
    fallbackDegradesCustomerOutput: false,
    batchEligible: false,
    rationale: 'MODEL_SONNET as pinned today.',
  },
  COMPOSE: {
    model: 'claude-opus-4-7',
    effort: null,
    fallbackModel: 'claude-sonnet-4-6',
    fallbackEffort: null,
    fallbackDegradesCustomerOutput: true,
    batchEligible: false,
    rationale: 'MODEL_OPUS as pinned today — customer-reads output.',
  },
  JUDGE: {
    model: 'claude-opus-4-7',
    effort: null,
    fallbackModel: 'claude-sonnet-4-6',
    fallbackEffort: null,
    fallbackDegradesCustomerOutput: true,
    batchEligible: false,
    rationale: 'MODEL_OPUS as pinned today.',
  },
  FRONTIER: {
    model: 'claude-opus-4-7',
    effort: null,
    fallbackModel: 'claude-opus-4-7',
    fallbackEffort: null,
    fallbackDegradesCustomerOutput: true,
    batchEligible: false,
    rationale: 'No frontier tier exists today; MODEL_OPUS absorbs it.',
  },
} as const;

/**
 * PROPOSED. Cheapest model that clears each bar, with the reason stated.
 *
 * The deliberate NON-move: COMPOSE stays on an Opus-tier model. Sonnet 5 at
 * `high` would cut that rate by 60% and is the single largest saving available,
 * but COMPOSE is output the customer reads. Downgrading it is a product
 * decision, so it is written up in the proposal as a separately ratifiable
 * option and NOT taken here. Flagging beats choosing.
 */
export const POLICY_PROPOSED: RoutingPolicy = {
  TRIAGE: {
    model: HAIKU_4_5,
    effort: null,
    fallbackModel: SONNET_5,
    fallbackEffort: 'low',
    fallbackDegradesCustomerOutput: false,
    batchEligible: true,
    rationale:
      'The answer is in the input. Haiku reaches it; depth buys nothing. ' +
      'The repo cost-architecture already measures Haiku-gates-Opus as the single biggest lever.',
  },
  EXTRACT: {
    model: HAIKU_4_5,
    effort: null,
    fallbackModel: SONNET_5,
    fallbackEffort: 'low',
    fallbackDegradesCustomerOutput: false,
    batchEligible: true,
    rationale:
      'Structured pull from unstructured text — still retrieval, not reasoning. ' +
      'Falls back to Sonnet 5 when input exceeds Haiku\'s 200K window.',
  },
  TRANSFORM: {
    model: SONNET_5,
    effort: 'low',
    fallbackModel: OPUS_5,
    fallbackEffort: 'low',
    fallbackDegradesCustomerOutput: false,
    batchEligible: true,
    rationale:
      'One inference hop the customer may read, so not Haiku — but one hop does ' +
      'not need depth, so `low` effort. Sonnet 5 ($2/$10) is both cheaper and newer ' +
      'than the Sonnet 4.6 ($3/$15) it replaces: a strict improvement, no trade.',
  },
  COMPOSE: {
    model: OPUS_5,
    effort: 'high',
    fallbackModel: SONNET_5,
    fallbackEffort: 'high',
    fallbackDegradesCustomerOutput: true,
    batchEligible: false,
    rationale:
      'The customer reads this. Opus 5 is the same $5/$25 as the Opus 4.7 it ' +
      'replaces, so the upgrade is free. Sonnet 5 high would save 60% and is the ' +
      'largest single saving on the table — offered for ratification, not taken.',
  },
  JUDGE: {
    model: OPUS_5,
    effort: 'high',
    fallbackModel: FABLE_5_1,
    fallbackEffort: 'high',
    fallbackDegradesCustomerOutput: false,
    batchEligible: false,
    rationale:
      'The customer ACTS on this, or it is irreversible or regulated. Being wrong ' +
      'costs more than the tokens. Fallback goes UP, not down — the only class where it does.',
  },
  FRONTIER: {
    model: FABLE_5_1,
    effort: 'high',
    fallbackModel: OPUS_5,
    fallbackEffort: 'max',
    fallbackDegradesCustomerOutput: true,
    batchEligible: false,
    rationale:
      'Long-horizon, >200K context, plan-and-revise. Fable 5.1 at $10/$50 is the ' +
      'most expensive route here and must stay rare — it is a class, not a default.',
  },
} as const;

/**
 * The switch. Ratification flips this one identifier.
 * Defaults to CURRENT so merging this PR changes no behaviour.
 */
export const ACTIVE_POLICY: RoutingPolicy = POLICY_CURRENT;

/** Resolve a job class to a concrete routing decision. */
export function routeFor(
  jobClass: JobClass,
  policy: RoutingPolicy = ACTIVE_POLICY,
): RouteDecision {
  return policy[jobClass];
}
