/**
 * lib/llm/types.ts
 *
 * Provider-neutral interface every LLM adapter implements. Mirrors the
 * shape of `lib/integrations/types.ts` (discriminated-union result, no
 * thrown exceptions across the adapter seam) so callers handle the
 * failure path at the type level.
 *
 * Per `feedback_no_silent_vendor_lock`: every Anthropic SDK call lives
 * inside `lib/llm/anthropic-provider.ts`. Skills, prompts, runner — none
 * of them import `@anthropic-ai/sdk` directly. Adding a new provider
 * (OpenAI, Gemini, a self-hosted endpoint) means dropping a new
 * implementation here, not rewriting skill code.
 *
 * Per `feedback_runner_portability.md` + `project_living_portable_architecture`:
 * the two-implementation rule is satisfied by
 * `lib/llm/anthropic-provider.ts` (prod) +
 * `lib/llm/test-provider.ts` (canned). Tests parameterize both through
 * the same contract.
 *
 * Per `project_no_outbound_architecture.md`: the LLM provider does NOT
 * place outbound calls on the customer's behalf. It only produces
 * text — the customer's system decides what to do with it.
 */

// ── Result shape ─────────────────────────────────────────────────────────

export type LlmResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: LlmError };

export type LlmErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTHENTICATION'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_ARGUMENT'
  | 'UPSTREAM_ERROR'
  | 'CONTENT_FILTERED'
  | 'NOT_IMPLEMENTED';

export interface LlmError {
  code: LlmErrorCode;
  message: string;
  /** HTTP status, when the failure was a remote response. */
  status?: number;
  /** Vendor-specific identifier (e.g. Anthropic error.type). */
  reference?: string;
  /** Retry hint in milliseconds — populated for RATE_LIMITED. */
  retryAfterMs?: number;
}

export function llmOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function llmError(
  code: LlmErrorCode,
  message: string,
  extra?: Omit<LlmError, 'code' | 'message'>,
): { ok: false; error: LlmError } {
  return { ok: false, error: { code, message, ...extra } };
}

// ── DTOs ─────────────────────────────────────────────────────────────────

/**
 * One step in a multi-turn conversation. Mirrors the Anthropic message
 * shape (`role: 'user' | 'assistant'` + content). Kept narrow so an
 * OpenAI-shaped provider can map without lossy translation.
 */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The completion request. `system` is the high-level system prompt
 * (vertical-aware categorization rules, draft-tone guidance, etc.).
 * `messages` is the conversation. `responseFormat='json'` requests
 * strict JSON output (the provider is expected to honor this either
 * via native JSON mode or via prompt-engineering on the system message).
 */
export interface LlmCompletionRequest {
  system: string;
  messages: LlmMessage[];
  /** Model identifier (per-provider). Adapters may map this to a default. */
  model?: string;
  /** Cap on output tokens. Adapter applies a sensible default if unset. */
  maxTokens?: number;
  /** 0–1. Adapter clamps + defaults. */
  temperature?: number;
  /** Hint that the caller needs JSON back. Strict-JSON adapters use this. */
  responseFormat?: 'json' | 'text';
}

export interface LlmCompletion {
  text: string;
  /** Provider's stop reason (`end_turn`, `max_tokens`, etc.) — null when
   *  the provider does not report one. */
  stopReason: string | null;
  /** Best-effort usage report. NULL when the provider does not return one. */
  usage: {
    inputTokens: number;
    outputTokens: number;
  } | null;
  /** Model id the provider actually served. */
  model: string;
}

// ── The interface ───────────────────────────────────────────────────────

export interface LlmProvider {
  readonly name: 'anthropic' | 'test';
  complete(request: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>>;
}
