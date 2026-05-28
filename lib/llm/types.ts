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
 * A single text block inside a structured message or system payload.
 * Setting `cacheable: true` marks this block as a prompt-cache breakpoint
 * (Anthropic prompt caching). The Anthropic adapter translates this into
 * `cache_control: { type: 'ephemeral' }` on the matching SDK block.
 * Other providers ignore the flag — it is purely opt-in performance
 * metadata, never correctness.
 *
 * Per `feedback_no_silent_vendor_lock`: this is the provider-neutral
 * shape. The Anthropic SDK's `cache_control` field never leaks past
 * `lib/llm/anthropic-provider.ts`.
 */
export interface LlmContentBlock {
  type: 'text';
  text: string;
  /** Mark as a prompt-cache breakpoint. Opt-in. */
  cacheable?: boolean;
}

/** Content payload — either a plain string (current callers) or a list
 *  of typed blocks (new callers that need cache breakpoints). */
export type LlmContent = string | LlmContentBlock[];

/**
 * One step in a multi-turn conversation. Mirrors the Anthropic message
 * shape (`role: 'user' | 'assistant'` + content). Kept narrow so an
 * OpenAI-shaped provider can map without lossy translation.
 */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: LlmContent;
}

/**
 * The completion request. `system` is the high-level system prompt
 * (vertical-aware categorization rules, draft-tone guidance, etc.).
 * `messages` is the conversation. `responseFormat='json'` requests
 * strict JSON output (the provider is expected to honor this either
 * via native JSON mode or via prompt-engineering on the system message).
 */
export interface LlmCompletionRequest {
  /** System prompt. Kept as `string` (not `LlmContent`) so the many
   *  callers + tests that introspect via `system.includes(MARKER)` stay
   *  working unchanged. To opt into prompt-cache breakpoints on the
   *  system prompt, set `cacheSystem: true` — the adapter promotes the
   *  string to a single ephemeral-cacheable block. To mark CONTENT
   *  blocks inside the user message as cacheable, pass
   *  `LlmContentBlock[]` for that message's `content`. */
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
  /** Convenience: when true AND `system` is a plain string, the adapter
   *  promotes it to a single cacheable block. Ignored when `system` is
   *  already an array (the caller marked blocks explicitly). */
  cacheSystem?: boolean;
  /** Opaque telemetry metadata. The Anthropic adapter does NOT send
   *  this to Anthropic — it is read by `LoggingLlmProvider` for
   *  per-call observability (skill name, workspace id, etc.). */
  meta?: LlmRequestMeta;
}

export interface LlmRequestMeta {
  /** Skill / call-site name (e.g. `categorize`, `draft`, `office-admin-classify`). */
  skill?: string;
  /** Workspace identifier so we can slice cache-hit rate by workspace. */
  workspaceId?: string;
  /** Vertical slug (`real-estate`, `cpa`, ...) for per-vertical rollups. */
  verticalSlug?: string;
  /** Free-form correlation id — e.g. webhook event id. */
  correlationId?: string;
  /** Source surface (matches the `LlmSourceSurface` Prisma enum) for
   *  per-agent breakdowns on the billing usage pane. When omitted the
   *  recorder falls back to `OTHER`. Adding a new value here means
   *  widening both this string union AND the Prisma enum — see
   *  `lib/billing/usage/recorder.ts` for the resolver. */
  sourceSurface?: LlmSourceSurfaceTag;
}

/** Mirrors `LlmSourceSurface` Prisma enum. Strings, not the enum import,
 *  so `lib/llm` stays free of a Prisma dependency. */
export type LlmSourceSurfaceTag =
  | 'PLAINO_CHAT'
  | 'OFFICE_ADMIN'
  | 'CATEGORIZE'
  | 'COORDINATE'
  | 'SCHEDULE'
  | 'DRAFT'
  | 'SUPPORT_HANDLER'
  | 'INBOX_TRIAGE'
  | 'FOLLOW_UP_CHASER'
  | 'PROCESS_DOC_DRAFTER'
  | 'SCHEDULER_SWEEP'
  | 'MEMORY_EXTRACT'
  | 'OTHER';

export interface LlmCompletion {
  text: string;
  /** Provider's stop reason (`end_turn`, `max_tokens`, etc.) — null when
   *  the provider does not report one. */
  stopReason: string | null;
  /** Best-effort usage report. NULL when the provider does not return one. */
  usage: LlmUsage | null;
  /** Model id the provider actually served. */
  model: string;
}

export interface LlmUsage {
  /** Standard (uncached) input tokens billed at full rate. */
  inputTokens: number;
  outputTokens: number;
  /** Tokens written to the cache on this call. Charged at ~1.25× input
   *  rate; amortized across subsequent cache reads. 0 when nothing was
   *  marked cacheable; absent when the provider does not report it. */
  cacheCreationInputTokens?: number;
  /** Tokens read FROM the cache on this call. Charged at ~0.1× input
   *  rate. The savings number. */
  cacheReadInputTokens?: number;
}

// ── The interface ───────────────────────────────────────────────────────

export interface LlmProvider {
  readonly name: 'anthropic' | 'test' | 'logging';
  complete(request: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>>;
}

// ── Content helpers ─────────────────────────────────────────────────────

/** Coerce LlmContent to a single text string. Provider-neutral — used
 *  by the test provider for digesting + by callers that need to inspect
 *  the rendered prompt. */
export function flattenContent(content: LlmContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/** True when any block in the content is flagged cacheable, OR when the
 *  request used the `cacheSystem` shortcut. Adapter-side check. */
export function hasCacheableBlock(content: LlmContent): boolean {
  if (typeof content === 'string') return false;
  return content.some((b) => b.cacheable === true);
}
