/**
 * lib/llm/anthropic-provider.ts
 *
 * Production implementation of `LlmProvider`. Uses the official
 * `@anthropic-ai/sdk` package. Every Anthropic API call in the
 * codebase enters through this file; skills speak only the
 * `LlmProvider` interface.
 *
 * Per `feedback_no_silent_vendor_lock`: no other file imports
 * `@anthropic-ai/sdk` directly. The package's API surface (model
 * names, request shape, error classes) is contained here.
 *
 * Per `feedback_no_guesses_no_estimates`: the default model identifier
 * is taken from the runtime config (`ANTHROPIC_MODEL` env var) rather
 * than hard-coded — the loop is dogfood-driven and the model choice
 * is a knob, not a buried constant. Defaults to `claude-sonnet-4-5`
 * (the cost/quality midpoint at 2026-05-12 per the global Claude API
 * pricing page) so an unset env var still gets a sensible default.
 *
 * Per `project_no_outbound_architecture.md`: this provider produces
 * text. It does not send, post, or otherwise execute. Whatever the
 * skill does with the text is the skill's concern.
 *
 * Prompt caching: callers mark `LlmContentBlock`s as `cacheable` (or
 * pass `cacheSystem: true` on the request); the adapter translates that
 * into the Anthropic SDK's `cache_control: { type: 'ephemeral' }`
 * breakpoint and reads `cache_creation_input_tokens` +
 * `cache_read_input_tokens` from the response usage. The
 * `cache_control` SDK shape never leaks past this file.
 *
 * No-training commitment (the privacy promise made on /privacy + /terms):
 *   - We do NOT fine-tune any model on customer data, and we do not feed
 *     customer chat or connector data into a training feedback loop.
 *   - agentplain runs on Anthropic's commercial API, which does not train
 *     models on API inputs or outputs by default.
 *   - The only identifier we attach to a request is `metadata.user_id`, set
 *     to a PRIVACY-PRESERVING, one-way hash of the workspace id (see
 *     `privacyPreservingUserId`). It is NOT the customer's name, email,
 *     business name, or workspace id in the clear. Anthropic uses
 *     `metadata.user_id` solely for abuse/misuse detection on their side; it
 *     is never used for training. We send it so a single compromised
 *     workspace can be isolated upstream without exposing who the customer is.
 *   - No other request field carries customer-identifying metadata to the
 *     provider. The `LlmRequestMeta.skill`/`verticalSlug`/`correlationId`
 *     telemetry stays local (read by `LoggingLlmProvider`) and is never sent.
 */

import { createHash } from 'node:crypto';
import Anthropic, { APIError } from '@anthropic-ai/sdk';
import {
  LlmCompletion,
  LlmCompletionRequest,
  LlmContent,
  LlmProvider,
  LlmResult,
  LlmUsage,
  llmError,
  llmOk,
} from './types';

export interface AnthropicProviderConfig {
  /** API key. When absent, `complete()` returns NOT_CONFIGURED at call
   *  time so a misconfigured prod environment fails loudly rather than
   *  silently producing empty drafts. */
  apiKey: string;
  /** Default model identifier. */
  defaultModel?: string;
  /** Optional override (tests inject a fake client). */
  client?: Anthropic;
}

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_MAX_TOKENS = 2048;

/**
 * Fixed, non-secret namespace so the emitted `user_id` is unmistakably a
 * derived hash and not a raw identifier. Changing it only rotates the opaque
 * id space; it carries no security weight (the hash is one-way regardless).
 */
const USER_ID_NAMESPACE = 'agentplain.workspace.v1';

/**
 * Derive the privacy-preserving `metadata.user_id` from a workspace id. Returns
 * a stable, one-way SHA-256 hex digest — stable so Anthropic can correlate
 * abuse within one workspace, one-way so it never reveals which customer it is.
 * Returns null when there is no workspace context (no id to attach).
 */
export function privacyPreservingUserId(
  workspaceId: string | undefined | null,
): string | null {
  if (!workspaceId) return null;
  return createHash('sha256')
    .update(`${USER_ID_NAMESPACE}:${workspaceId}`)
    .digest('hex');
}

type SdkSystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
type SdkMessageBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic' as const;
  private readonly client: Anthropic | null;
  private readonly defaultModel: string;

  constructor(config: AnthropicProviderConfig) {
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
    if (config.client) {
      this.client = config.client;
      return;
    }
    if (!config.apiKey || config.apiKey.length === 0) {
      this.client = null;
      return;
    }
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    if (!this.client) {
      return llmError(
        'NOT_CONFIGURED',
        'AnthropicProvider has no API key configured. Set ANTHROPIC_API_KEY.',
      );
    }
    const model = request.model ?? this.defaultModel;
    const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
    const temperature =
      typeof request.temperature === 'number'
        ? Math.max(0, Math.min(1, request.temperature))
        : undefined;
    // Concatenate the JSON-output instruction onto the system prompt when
    // requested. Anthropic does not have a server-side JSON mode at this
    // SDK version; the universal pattern is to ask for JSON in the
    // system message and parse the text response. The skill code does the
    // parsing.
    const jsonSuffix =
      request.responseFormat === 'json'
        ? '\n\nRespond with strict JSON only. Do not include explanatory prose, markdown fences, or surrounding text — only the JSON object.'
        : '';
    const system = toSdkSystem(request.system, request.cacheSystem === true, jsonSuffix);
    const messages = request.messages.map((m) => ({
      role: m.role,
      content: toSdkMessageContent(m.content),
    }));
    try {
      // `meta` is a LOCAL telemetry passthrough (skill name, vertical,
      // correlation id) — it is read by `LoggingLlmProvider` and never sent to
      // Anthropic. The single exception is a privacy-preserving `user_id`
      // derived from the workspace id: a one-way hash, never customer PII,
      // attached only for Anthropic-side abuse detection (not training). See
      // the no-training commitment in this file's header.
      const userId = privacyPreservingUserId(request.meta?.workspaceId);
      const res = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
        ...(userId ? { metadata: { user_id: userId } } : {}),
      });
      const text = extractText(res);
      const usage = res.usage ? toLlmUsage(res.usage) : null;
      return llmOk({
        text,
        stopReason: res.stop_reason ?? null,
        usage,
        model: res.model,
      });
    } catch (err) {
      return mapAnthropicError(err);
    }
  }
}

/** Convert the system string + optional JSON suffix to the SDK's
 *  system shape. When `cacheSystem` is set we promote to a single
 *  ephemeral-cacheable text block; otherwise we emit the plain string
 *  the SDK also accepts. The JSON suffix attaches to the trailing block
 *  / string so the model reads it last. */
function toSdkSystem(
  system: string,
  cacheSystemShortcut: boolean,
  jsonSuffix: string,
): string | SdkSystemBlock[] {
  const text = system + jsonSuffix;
  if (!cacheSystemShortcut) return text;
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

/** Same translation for per-message content. Strings stay strings (the
 *  SDK accepts both shapes for messages.content). */
function toSdkMessageContent(content: LlmContent): string | SdkMessageBlock[] {
  if (typeof content === 'string') return content;
  return content.map((b) => {
    const out: SdkMessageBlock = { type: 'text', text: b.text };
    if (b.cacheable) out.cache_control = { type: 'ephemeral' };
    return out;
  });
}

function toLlmUsage(u: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): LlmUsage {
  const out: LlmUsage = {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
  };
  if (typeof u.cache_creation_input_tokens === 'number') {
    out.cacheCreationInputTokens = u.cache_creation_input_tokens;
  }
  if (typeof u.cache_read_input_tokens === 'number') {
    out.cacheReadInputTokens = u.cache_read_input_tokens;
  }
  return out;
}

function extractText(res: {
  content?: Array<{ type: string; text?: string }>;
}): string {
  if (!Array.isArray(res.content)) return '';
  return res.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('');
}

function mapAnthropicError(err: unknown): { ok: false; error: import('./types').LlmError } {
  if (err instanceof APIError) {
    const status = err.status ?? undefined;
    const reference = err.error ? JSON.stringify(err.error).slice(0, 200) : undefined;
    if (status === 401 || status === 403) {
      return llmError('AUTHENTICATION', err.message, { status, reference });
    }
    if (status === 429) {
      return llmError('RATE_LIMITED', err.message, { status, reference });
    }
    if (status && status >= 500) {
      return llmError('UPSTREAM_ERROR', err.message, { status, reference });
    }
    if (status === 400) {
      return llmError('INVALID_ARGUMENT', err.message, { status, reference });
    }
    return llmError('UPSTREAM_ERROR', err.message, { status, reference });
  }
  if (err instanceof Error) {
    return llmError('NETWORK', err.message);
  }
  return llmError('UPSTREAM_ERROR', String(err));
}
