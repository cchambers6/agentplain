/**
 * lib/llm/routing-provider.ts
 *
 * RoutingLlmProvider — cost-aware per-task-class model selection.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The production+growth plan §2 headline: heavy workspaces' Anthropic token
 * spend approaches (or exceeds) the subscription price.  Wave-8 hard-wired
 * every KNOWN call site to the right model tier (MODEL_HAIKU / MODEL_SONNET /
 * MODEL_OPUS via `model-tiers.ts`).  This wrapper is the forward-looking
 * safety net: any NEW call site that forgets to set `model:` will
 * automatically receive a sensible tier based on its `meta.sourceSurface`
 * tag — the same metadata field that already flows to the usage recorder.
 * It does NOTHING (zero bytes differ) when the flag is off.
 *
 * COMPOSE POSITION
 * ────────────────
 * The documented compose order is  Logging( Budget( Sentinel( Caching( inner ) ) ) ).
 * Routing is inserted between Budget and Sentinel:
 *
 *     Logging( Budget( Routing( Sentinel( Caching( inner ) ) ) ) )
 *
 * Rationale (each requirement drives one layer boundary):
 *
 *   • OUTSIDE Caching — routing rewrites `request.model`; the rewrite must
 *     happen BEFORE the cache layer so the resolved model is part of the
 *     cache context.  A model-A response must never be served from a
 *     model-B cache slot.
 *
 *   • OUTSIDE Sentinel — if the key is the paused sentinel the call is a
 *     no-op anyway; routing can run harmlessly and sentinel short-circuits
 *     it.  More importantly, routing INSIDE sentinel would silently skip
 *     the model assignment on every paused call, which makes correctness
 *     harder to reason about.
 *
 *   • INSIDE Budget — an OVER-budget workspace never even reaches routing.
 *     Routing cost is zero for blocked calls.
 *
 *   • INSIDE Logging (outermost) — LoggingLlmProvider reads `res.value.model`
 *     which the provider chain fills from the actual completion.  The
 *     Anthropic adapter returns the model Anthropic used; routing's rewrite
 *     of `request.model` is visible to the adapter, so the log line carries
 *     the routed model id rather than `undefined`.
 *
 * FLAG BEHAVIOR — the most important invariant in this file
 * ─────────────────────────────────────────────────────────
 * `LLM_MODEL_ROUTING` unset (or `off`): the wrapper is constructed but is a
 *   PURE PASS-THROUGH.  `complete()` forwards the exact same request object
 *   reference to the inner provider — byte-for-byte identical to a stack
 *   that never included this wrapper.  The condition is checked on EVERY
 *   call (not just at construction) so an operator hot-swap survives a
 *   long-lived provider instance.
 *
 * `LLM_MODEL_ROUTING=on`: the wrapper rewrites `request.model` ONLY when the
 *   caller left it absent (undefined / falsy).  If the caller already set a
 *   model — as every wave-8 call site does — the request is forwarded
 *   untouched.  The routing only fills a vacuum; it never clobbers an explicit
 *   decision.
 *
 * Per `feedback_no_silent_vendor_lock`: no `@anthropic-ai/sdk` import — the
 *   wrapper speaks only the provider-neutral `LlmProvider` contract.
 * Per `feedback_runner_portability`: composes over any inner provider.
 * Per `feedback_cold_start_safe_agents`: env is read per-call so a flag
 *   flip takes effect without rebuilding the provider.
 */

import type { LlmSourceSurfaceTag } from './types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from './types';

// ── Policy table ─────────────────────────────────────────────────────────────
//
// Maps each `LlmSourceSurfaceTag` to the canonical model tier string.
// When a surface tag is NOT in this map the wrapper does not assign a model
// (safe default: if we cannot classify we do not guess).
//
// Tier rationale (matches `model-tiers.ts` calibration):
//   HAIKU   — narrow-classifier surfaces: discrete categorical / binary
//             decisions (classify, triage, office-admin). Haiku reaches the
//             same answer as Opus at ~25× lower cost.
//   SONNET  — moderate-reasoning work: extraction, coordination, scheduling,
//             follow-up chasing.  Comparable quality to today's default at
//             ~5× lower cost.
//   OPUS    — customer-reads output: drafts, briefings, support replies, chat,
//             compliance, finance, analytics.  Quality over cost per Conner's
//             calibration ("I don't want to sacrifice product performance …
//             Customer-facing surfaces stay on Opus").
//
// These are the same model ids already pinned in `lib/llm/model-tiers.ts`.
// They are inlined here (not imported) so the policy table is fully
// self-contained and readable in one place.

export type ModelRoutingPolicy = Readonly<Record<LlmSourceSurfaceTag, string>>;

/** The default routing policy.  Exported so the test suite can assert the
 *  exact table without instantiating a provider. */
export const DEFAULT_ROUTING_POLICY: ModelRoutingPolicy = {
  // ── HAIKU tier — internal narrow classifiers ──────────────────────────
  CATEGORIZE:       'claude-haiku-4-5-20251001',
  OFFICE_ADMIN:     'claude-haiku-4-5-20251001',
  INBOX_TRIAGE:     'claude-haiku-4-5-20251001',

  // ── SONNET tier — moderate-reasoning / extraction seams ──────────────
  COORDINATE:       'claude-sonnet-4-6',
  SCHEDULE:         'claude-sonnet-4-6',
  SCHEDULER_SWEEP:  'claude-sonnet-4-6',
  MEMORY_EXTRACT:   'claude-sonnet-4-6',
  FOLLOW_UP_CHASER: 'claude-sonnet-4-6',

  // ── OPUS tier — customer-reads output ────────────────────────────────
  DRAFT:             'claude-opus-4-7',
  SUPPORT_HANDLER:   'claude-opus-4-7',
  PLAINO_CHAT:       'claude-opus-4-7',
  PROCESS_DOC_DRAFTER: 'claude-opus-4-7',

  // ── SONNET tier — adjacent surfaces (not strictly internal, not
  //    the highest-stakes customer output) ─────────────────────────────
  OTHER: 'claude-sonnet-4-6',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the model id the routing policy assigns for the given surface tag,
 *  or `undefined` if the tag is absent or unmapped. */
export function resolveRoutedModel(
  surface: LlmSourceSurfaceTag | undefined,
  policy: ModelRoutingPolicy = DEFAULT_ROUTING_POLICY,
): string | undefined {
  if (!surface) return undefined;
  return (policy as Record<string, string>)[surface];
}

/** Pure transform: returns the request that should be forwarded given the
 *  routing policy.  Returns the SAME object reference when nothing changes
 *  (flag-off path or caller already set a model), so callers can cheaply
 *  detect a no-op.  Never mutates the input. */
export function applyRouting(
  request: LlmCompletionRequest,
  policy: ModelRoutingPolicy = DEFAULT_ROUTING_POLICY,
): LlmCompletionRequest {
  // Caller already made an explicit model choice — respect it unconditionally.
  if (request.model) return request;
  const routed = resolveRoutedModel(request.meta?.sourceSurface, policy);
  // No surface or unmapped surface — do not guess; forward as-is.
  if (!routed) return request;
  return { ...request, model: routed };
}

// ── RoutingLlmProvider ───────────────────────────────────────────────────────

export interface RoutingLlmProviderOptions {
  /** Master switch.  When false the wrapper is a pure pass-through on every
   *  call.  Wired to `LLM_MODEL_ROUTING` env var in `lib/llm/index.ts`.
   *  Default: false (off) — so the wrapper is safe to insert at any time
   *  without changing production behaviour. */
  enabled?: boolean;
  /** Override the policy table — used by tests and future per-operator
   *  routing overrides. */
  policy?: ModelRoutingPolicy;
}

export class RoutingLlmProvider implements LlmProvider {
  /** Mirror the inner provider's name so downstream telemetry is unaffected
   *  by the wrapper's presence (same transparent-delegation pattern as
   *  `CachingLlmProvider`, `BudgetEnforcingLlmProvider`, etc.). */
  get name(): LlmProvider['name'] {
    return this.inner.name;
  }

  private readonly inner: LlmProvider;
  private readonly enabled: boolean;
  private readonly policy: ModelRoutingPolicy;

  constructor(inner: LlmProvider, opts: RoutingLlmProviderOptions = {}) {
    this.inner = inner;
    this.enabled = opts.enabled === true; // default FALSE — off unless explicitly on
    this.policy = opts.policy ?? DEFAULT_ROUTING_POLICY;
  }

  /** The wrapped provider — for assertions in tests. */
  innerProvider(): LlmProvider {
    return this.inner;
  }

  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmResult<LlmCompletion>> {
    // The flag is re-read from `process.env` on every call so a live rotation
    // (`LLM_MODEL_ROUTING=on` → `off`) takes effect without restart.
    // This also means a test that sets `process.env.LLM_MODEL_ROUTING` before
    // calling can override the constructor value — the env always wins.
    const envFlag = process.env.LLM_MODEL_ROUTING;
    const active = envFlag === 'on' ? true : envFlag === 'off' ? false : this.enabled;

    if (!active) {
      // FLAG OFF: exact same object reference forwarded — provably identical
      // to a stack that never included this wrapper.
      return this.inner.complete(request);
    }

    // FLAG ON: apply routing (pure transform; same reference if no change).
    return this.inner.complete(applyRouting(request, this.policy));
  }
}
