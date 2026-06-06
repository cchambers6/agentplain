/**
 * lib/llm/cache-wrapper.ts
 *
 * CachingLlmProvider — a transparent wrapper that AUTOMATICALLY applies a
 * prompt-cache breakpoint on the largest stable prefix (the system prompt,
 * which carries each skill's stable instructions) of every completion.
 *
 * Why a wrapper. Prompt caching in this codebase is opt-in: a caller marks
 * the system prompt cacheable via `cacheSystem: true`, which
 * `lib/llm/anthropic-provider.ts` translates into the Anthropic SDK's
 * `cache_control: { type: 'ephemeral' }` breakpoint. The hot skills already
 * do this by hand (categorize / draft / coordinate / Plaino dispatcher /
 * briefing / the refine seams — see `grep cacheSystem lib/skills`), but
 * every NEW skill or call site has to remember to. This wrapper closes the
 * gap: when the caller has not expressed an opinion AND the system prompt is
 * large enough to be worth a breakpoint, the wrapper flips `cacheSystem` on
 * by default. Caching becomes the default posture, not a thing each skill
 * re-derives. Per the production+growth plan §5 (cost governor): at the
 * post-wave-8 model mix a heavy workspace's Anthropic spend approaches the
 * subscription price, so making cache-by-default the floor is margin-relevant.
 *
 * Invariants (grounded in shared/prompt-caching.md — read via the
 * `claude-api` skill):
 *   - The breakpoint goes on the LARGEST STABLE PREFIX. Render order is
 *     tools -> system -> messages; in this codebase the stable prefix is the
 *     system prompt (skill instructions + brand/voice/policy preamble), and
 *     the per-turn customer message is the volatile suffix. The wrapper marks
 *     the system prompt and NEVER a message block.
 *   - The wrapper does not change a single prompt BYTE. It flips a request
 *     flag; the rendered system text is byte-identical with or without it, so
 *     the cache prefix stays stable across calls — the one property the whole
 *     mechanism depends on.
 *
 * Respect for explicit intent — the wrapper only fills a vacuum:
 *   - `cacheSystem === true`  -> already cached; pass through untouched.
 *   - `cacheSystem === false` -> explicit opt-out; pass through untouched.
 *   - `cacheSystem` undefined -> auto-enable IFF `system.length >=
 *     minSystemChars`. Below that we leave it alone: Anthropic's minimum
 *     cacheable prefix (2048 tokens on Sonnet, 4096 on Opus/Haiku — see
 *     shared/prompt-caching.md) means a tiny prompt silently would not cache
 *     anyway, so a breakpoint there is pure noise. The wrapper marks
 *     optimistically; the API is the real gate, and a sub-minimum marker is a
 *     harmless no-op (no cache write, hence no write premium).
 *   - Caller already supplied structured cacheable CONTENT blocks on a
 *     message -> manual placement mode; pass through untouched.
 *
 * Per feedback_no_silent_vendor_lock: no `@anthropic-ai/sdk` import. The
 * wrapper speaks only the provider-neutral `LlmProvider` contract; the
 * `cache_control` SDK shape stays sealed inside anthropic-provider.ts.
 *
 * Per feedback_runner_portability: the wrapper composes over ANY provider
 * (anthropic, test, a future OpenAI/self-hosted adapter) without
 * modification — it manipulates the neutral request, not a vendor object.
 *
 * Per feedback_cold_start_safe_agents: stateless. Each call decides from the
 * request alone; the wrapper caches nothing between calls.
 */

import { hasCacheableBlock } from './types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from './types';

/**
 * Default minimum system-prompt length (characters) before the wrapper will
 * auto-enable system caching. Deliberately low — marking a prompt that turns
 * out to be below the model's token minimum is a harmless no-op, while a real
 * skill instruction block clears this easily. Override per-construction if a
 * deployment wants a tighter floor.
 */
export const DEFAULT_MIN_SYSTEM_CHARS = 500;

export interface CachingLlmProviderOptions {
  /** Master switch. When false the wrapper is a pure pass-through (it still
   *  forwards every call, it just never touches the request). Wired to the
   *  `LLM_PROMPT_CACHE` env var in `lib/llm/index.ts`. Default true. */
  enabled?: boolean;
  /** Minimum `system.length` before auto-enabling. Default
   *  `DEFAULT_MIN_SYSTEM_CHARS`. */
  minSystemChars?: number;
}

/**
 * Pure decision function — returns the request to forward. Exported so tests
 * can pin the exact transform (and the byte-stability invariant) without
 * standing up a provider. Returns the SAME object reference when nothing
 * changes, so callers can cheaply detect a no-op.
 */
export function autoCacheRequest(
  request: LlmCompletionRequest,
  minSystemChars: number = DEFAULT_MIN_SYSTEM_CHARS,
): LlmCompletionRequest {
  // Explicit intent (true OR false) is always respected.
  if (request.cacheSystem !== undefined) return request;
  // Manual placement mode: the caller marked content blocks cacheable, so
  // they own the breakpoint budget (max 4) — don't add another.
  if (request.messages.some((m) => hasCacheableBlock(m.content))) return request;
  // Only cache a non-trivial stable prefix.
  if (request.system.length < minSystemChars) return request;
  // Flip the flag. Note: `system` is copied by reference — same bytes — so the
  // rendered prefix is identical to an un-wrapped call. Stability preserved.
  return { ...request, cacheSystem: true };
}

export class CachingLlmProvider implements LlmProvider {
  /** Mirror the inner provider's name so downstream telemetry
   *  (`LoggingLlmProvider` reads `inner.name`) still reports the real
   *  provider — 'anthropic' / 'test' — not a synthetic wrapper name. The
   *  wrapper is transparent by design. */
  readonly name: LlmProvider['name'];
  private readonly inner: LlmProvider;
  private readonly enabled: boolean;
  private readonly minSystemChars: number;

  constructor(inner: LlmProvider, opts: CachingLlmProviderOptions = {}) {
    this.inner = inner;
    this.name = inner.name;
    this.enabled = opts.enabled !== false;
    this.minSystemChars = opts.minSystemChars ?? DEFAULT_MIN_SYSTEM_CHARS;
  }

  /** The wrapped provider — for assertions in tests and for code that needs
   *  to see past the wrapper. */
  innerProvider(): LlmProvider {
    return this.inner;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    if (!this.enabled) return this.inner.complete(request);
    return this.inner.complete(autoCacheRequest(request, this.minSystemChars));
  }
}
