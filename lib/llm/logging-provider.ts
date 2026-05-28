/**
 * lib/llm/logging-provider.ts
 *
 * Transparent telemetry wrapper around an inner `LlmProvider`. Emits one
 * structured log line per `complete()` call carrying:
 *
 *   - skill / workspace / vertical / correlation id (from request.meta)
 *   - input / output / cache-write / cache-read token counts (from usage)
 *   - duration + ok/error + model + provider name
 *
 * Why a wrapper instead of logging inside the Anthropic provider:
 *   1. Telemetry is a cross-cutting concern that must apply equally to
 *      the test provider during dev so cache-hit-rate assertions work
 *      against the test provider's zero values. Wrapping at this layer
 *      keeps the inner providers focused on translation only.
 *   2. Per `feedback_no_silent_vendor_lock`: the wrapper does not import
 *      `@anthropic-ai/sdk`. Anthropic stays sealed inside its provider.
 *   3. Per `feedback_runner_portability.md`: the wrapper composes with
 *      any future provider (OpenAI, self-hosted) without modification.
 *
 * The wrapper is the default provider returned by `getLlmProvider()` —
 * see `lib/llm/index.ts`. Tests that want to assert exact LLM-call
 * sequences can pass an unwrapped provider directly to the consumer.
 */

import { getLogger, type Logger } from '../observability/logger';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
  LlmUsage,
} from './types';

export interface LoggingLlmProviderOptions {
  /** Override the logger seam — useful in tests that recorded a writer
   *  via `__setLoggerWriterForTests`. */
  logger?: Logger;
  /** When false, the wrapper still forwards but does not emit log lines.
   *  Useful for unit tests that want quiet output. Default true. */
  enabled?: boolean;
}

export class LoggingLlmProvider implements LlmProvider {
  readonly name = 'logging' as const;
  private readonly inner: LlmProvider;
  private readonly logger: Logger | null;
  private readonly enabled: boolean;

  constructor(inner: LlmProvider, opts: LoggingLlmProviderOptions = {}) {
    this.inner = inner;
    this.enabled = opts.enabled !== false;
    // Lazy: only resolve the logger when we actually need to emit, so
    // env-dependent code in `getLogger()` does not run at construction.
    this.logger = opts.logger ?? null;
  }

  /** The underlying provider — useful for assertions in tests and for
   *  code that needs to know whether the real Anthropic provider is
   *  active (e.g. log lines on startup). */
  innerProvider(): LlmProvider {
    return this.inner;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    const startedAt = Date.now();
    const res = await this.inner.complete(request);
    if (!this.enabled) return res;
    const logger = this.logger ?? getLogger();
    const durationMs = Date.now() - startedAt;
    const meta = request.meta ?? {};
    const base = {
      provider: this.inner.name,
      skill: meta.skill ?? 'unknown',
      workspace_id: meta.workspaceId ?? null,
      vertical_slug: meta.verticalSlug ?? null,
      correlation_id: meta.correlationId ?? null,
      duration_ms: durationMs,
    };
    if (res.ok) {
      const usage = res.value.usage;
      logger.info('llm.usage', {
        ...base,
        ok: true,
        model: res.value.model,
        stop_reason: res.value.stopReason,
        ...summarizeUsage(usage),
      });
    } else {
      logger.warn('llm.usage', {
        ...base,
        ok: false,
        error_code: res.error.code,
        error_status: res.error.status ?? null,
      });
    }
    return res;
  }
}

/** Per-call usage summary projected for the log line. The shape is
 *  what an ops dashboard expects:
 *
 *    - tokens_input          — uncached input tokens billed full rate
 *    - tokens_output         — output tokens
 *    - tokens_cache_write    — `cache_creation_input_tokens` (~1.25× input rate)
 *    - tokens_cache_read     — `cache_read_input_tokens` (~0.10× input rate)
 *    - cache_hit_rate        — read / (read + input + write); 0 when no usage
 */
function summarizeUsage(usage: LlmUsage | null): Record<string, number | null> {
  if (!usage) {
    return {
      tokens_input: null,
      tokens_output: null,
      tokens_cache_write: null,
      tokens_cache_read: null,
      cache_hit_rate: null,
    };
  }
  const input = usage.inputTokens;
  const output = usage.outputTokens;
  const write = usage.cacheCreationInputTokens ?? 0;
  const read = usage.cacheReadInputTokens ?? 0;
  const totalInputLike = input + write + read;
  const hitRate = totalInputLike === 0 ? 0 : Math.round((read / totalInputLike) * 1000) / 1000;
  return {
    tokens_input: input,
    tokens_output: output,
    tokens_cache_write: write,
    tokens_cache_read: read,
    cache_hit_rate: hitRate,
  };
}
