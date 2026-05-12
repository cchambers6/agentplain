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
 */

import Anthropic, { APIError } from '@anthropic-ai/sdk';
import {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
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
    const system =
      request.responseFormat === 'json'
        ? `${request.system}\n\nRespond with strict JSON only. Do not include explanatory prose, markdown fences, or surrounding text — only the JSON object.`
        : request.system;
    try {
      const res = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const text = extractText(res);
      const usage = res.usage
        ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
        : null;
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
