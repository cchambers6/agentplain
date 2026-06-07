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
 * Resolution: detect the sentinel by prefix BEFORE constructing the
 * Anthropic client, so the doomed auth round-trip is never even attempted.
 *
 * Two seams cooperate, on purpose:
 *   1. `PausedLlmProvider` — a no-network provider returned by
 *      `getLlmProvider()` when the key is the sentinel. Its `complete()`
 *      returns `llmError('PAUSED', …)` immediately. This keeps the
 *      no-throw adapter contract (`lib/llm/types.ts`) intact, so the
 *      ~dozen existing `getLlmProvider()` callers keep degrading
 *      gracefully — they already branch on `!result.ok`. Making the
 *      factory throw instead would convert every one of those callers
 *      into a hard 500 the moment prod runs the sentinel key, which is
 *      the opposite of graceful degradation.
 *   2. `LlmPausedError` — a typed error a caller MAY throw/catch at its
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
