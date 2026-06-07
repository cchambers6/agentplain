/**
 * lib/llm/paused.ts
 *
 * Sentinel-aware short-circuit for the Anthropic credential.
 *
 * When Conner pauses spend he rotates `ANTHROPIC_API_KEY` to a deliberate
 * sentinel value — `sk-ant-PAUSED-2026-06-02-conner-restore-when-back`.
 * The sentinel is a real, non-empty string, so it passes the
 * "is the key set?" check in both `lib/llm/index.ts` and
 * `lib/plaino/degraded-mode.ts` — and then EVERY call to the model failed
 * with a 401 at the vendor. The customer-facing Plaino widget surfaced
 * that as a dead chat (PR #154).
 *
 * Resolution: detect the sentinel by prefix BEFORE the call reaches the
 * cache layer or the model, so the doomed auth round-trip is never even
 * attempted.
 *
 * Three seams cooperate, on purpose:
 *   1. `SentinelLlmProvider` — the composable wrapper layer wired into
 *      `getLlmProvider()` as `Logging( Budget( Sentinel( Caching( … ) ) ) )`.
 *      It sits OUTSIDE caching (the cache only matters if the call would
 *      actually happen) and INSIDE budget (an over-budget workspace is
 *      blocked before we even look at the key). When the configured
 *      `ANTHROPIC_API_KEY` is the sentinel it short-circuits to `PAUSED`;
 *      otherwise it passes straight through to the inner chain.
 *   2. `PausedLlmProvider` — the no-network leaf the wrapper delegates the
 *      paused response to. Its `complete()` returns `llmError('PAUSED', …)`
 *      immediately. This keeps the no-throw adapter contract
 *      (`lib/llm/types.ts`) intact, so the ~dozen existing
 *      `getLlmProvider()` callers keep degrading gracefully — they already
 *      branch on `!result.ok`. Making the factory throw instead would
 *      convert every one of those callers into a hard 500 the moment prod
 *      runs the sentinel key, which is the opposite of graceful degradation.
 *   3. `LlmPausedError` — a typed error a caller MAY throw/catch at its
 *      own boundary when it prefers throw ergonomics over a result
 *      branch. The chat route attaches it to the structured paused log
 *      so the event carries a stable error name in Sentry.
 *
 * Per `feedback_no_silent_vendor_lock` + `project_living_portable_architecture`:
 * the sentinel shape (`sk-ant-PAUSED-…`) is Anthropic-specific and stays
 * here, behind the provider seam — no skill, route, or component hard-codes it.
 */

import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from './types';
import { llmError } from './types';

/** Prefix Conner rotates the key to when pausing spend. Any value that
 *  starts with this is the sentinel, regardless of the trailing date /
 *  note (`sk-ant-PAUSED-2026-06-02-conner-restore-when-back`). */
export const PAUSED_API_KEY_PREFIX = 'sk-ant-PAUSED-';

/** True when the configured Anthropic key is the deliberate paused
 *  sentinel rather than a live credential. Null/undefined/empty → false
 *  (that's the "missing key" case, handled separately upstream). */
export function isPausedApiKey(key?: string | null): boolean {
  return typeof key === 'string' && key.startsWith(PAUSED_API_KEY_PREFIX);
}

/**
 * Typed error for callers that prefer throw/catch over a result branch.
 * The provider seam itself never throws this (it returns `llmError('PAUSED')`);
 * it exists so a handler boundary can `throw new LlmPausedError()` and
 * pattern-match the catch, and so structured logs carry a stable
 * `error_name`.
 */
export class LlmPausedError extends Error {
  readonly code = 'PAUSED' as const;
  constructor(message = 'Anthropic API key is the paused sentinel; the call was refused before any network request.') {
    super(message);
    this.name = 'LlmPausedError';
  }
}

/**
 * A provider that makes NO network call. Returned by `getLlmProvider()`
 * when the configured key is the sentinel. Honors the no-throw adapter
 * contract: `complete()` resolves to `llmError('PAUSED', …)`.
 */
export class PausedLlmProvider implements LlmProvider {
  readonly name = 'paused' as const;

  async complete(
    _request: LlmCompletionRequest,
  ): Promise<LlmResult<LlmCompletion>> {
    return llmError(
      'PAUSED',
      'Anthropic spend is paused (ANTHROPIC_API_KEY is the sentinel). The call was refused before any network request.',
    );
  }
}

/**
 * Sentinel wrapper — the paused-spend short-circuit as a composable layer.
 *
 * Wraps the inner provider (the caching→model chain) and, when the
 * configured `ANTHROPIC_API_KEY` is the `sk-ant-PAUSED-…` sentinel, returns
 * `PAUSED` BEFORE delegating — so the cache layer never wraps, and the model
 * never sees, a credential guaranteed to 401. This is the wrapper form of the
 * check; `getLlmProvider()` composes it (innermost first) as
 *
 *     Logging( Budget( Sentinel( Caching( inner ) ) ) )
 *
 * Sentinel sits OUTSIDE caching (the cache only matters if the call would
 * actually happen) and INSIDE budget (an over-budget workspace is blocked
 * before we even look at the key).
 *
 * Per the no-throw adapter contract it delegates the paused response to a
 * `PausedLlmProvider` (one source of truth for the message + code) rather than
 * throwing — the ~dozen `getLlmProvider()` callers already branch on
 * `!result.ok`, so they degrade gracefully. The typed `LlmPausedError` stays
 * available for callers that prefer throw/catch at their own boundary.
 *
 * The key is read from `process.env` on every `complete()` so a key rotation
 * (pause → resume) takes effect without rebuilding the provider, mirroring the
 * cold-start-safe posture (`feedback_cold_start_safe_agents`).
 *
 * Kill-switch: construct with `{ enabled: false }` (wired to
 * `LLM_SENTINEL_BYPASS` in `lib/llm/index.ts`) to pass every call straight
 * through to the inner chain — for a dev pointing a real key through the full
 * stack. Mirrors `LLM_PROMPT_CACHE` / `LLM_BUDGET_ENFORCEMENT`.
 */
export class SentinelLlmProvider implements LlmProvider {
  private readonly inner: LlmProvider;
  private readonly enabled: boolean;
  private readonly paused = new PausedLlmProvider();

  constructor(inner: LlmProvider, opts: { enabled?: boolean } = {}) {
    this.inner = inner;
    this.enabled = opts.enabled ?? true;
  }

  /** Delegate identity to the wrapped provider so name-based branching is
   *  unaffected in the common (live-key) case. */
  get name(): LlmProvider['name'] {
    return this.inner.name;
  }

  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmResult<LlmCompletion>> {
    if (this.enabled && isPausedApiKey(process.env.ANTHROPIC_API_KEY)) {
      return this.paused.complete(request);
    }
    return this.inner.complete(request);
  }
}
