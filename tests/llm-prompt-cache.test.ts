/**
 * tests/llm-prompt-cache.test.ts
 *
 * Unit + integration tests for the prompt-cache wrapper.
 *
 * Covers:
 *   - The Anthropic adapter translates `cacheSystem: true` into the SDK's
 *     `cache_control: { type: 'ephemeral' }` on the system block.
 *   - The Anthropic adapter translates per-message `cacheable` flags on
 *     `LlmContentBlock`s into `cache_control` on the matching SDK block.
 *   - Usage parsing reads `cache_creation_input_tokens` +
 *     `cache_read_input_tokens` from the response.
 *   - `LoggingLlmProvider` emits a structured `llm.usage` log line per
 *     call carrying cache-token counts + hit rate + skill context.
 *   - A skill chain invoked twice with the SAME stable system prompt
 *     produces a cache-write on call 1 and a cache-read on call 2 (the
 *     "this is what the prod cache hit looks like" integration assertion).
 *   - Backwards compatibility: existing callers that omit the cache flag
 *     get unchanged behavior (no `cache_control` in the SDK payload, no
 *     cache-token fields in the parsed usage).
 *   - The TestLlmProvider treats the cache flag as a no-op and surfaces
 *     zero cache counts so downstream metrics still parse cleanly.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { AnthropicProvider } from '@/lib/llm/anthropic-provider';
import { LoggingLlmProvider } from '@/lib/llm/logging-provider';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from '@/lib/llm/types';
import { llmOk } from '@/lib/llm/types';
import { __setLoggerWriterForTests } from '@/lib/observability';

// ── Anthropic SDK fake ───────────────────────────────────────────────────
//
// We stub the SDK at the messages.create boundary so we can assert on the
// exact payload the adapter sends — including the `cache_control` field
// for the prompt-cache breakpoint translation.

interface CapturedCall {
  payload: unknown;
}

function buildFakeAnthropicClient(
  responder: () => {
    content: Array<{ type: string; text: string }>;
    stop_reason: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number | null;
      cache_read_input_tokens?: number | null;
    };
    model: string;
  },
  captured: CapturedCall[],
): { messages: { create: (payload: unknown) => Promise<unknown> } } {
  return {
    messages: {
      create: async (payload: unknown) => {
        captured.push({ payload });
        return responder();
      },
    },
  };
}

// ── AnthropicProvider — cache_control translation ────────────────────────

describe('AnthropicProvider — cache_control breakpoint translation', () => {
  it('promotes a string system + cacheSystem: true to a single ephemeral block', async () => {
    const captured: CapturedCall[] = [];
    const fakeClient = buildFakeAnthropicClient(
      () => ({
        content: [{ type: 'text', text: '{}' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 10,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 0,
        },
        model: 'claude-sonnet-4-5',
      }),
      captured,
    );
    const provider = new AnthropicProvider({
      apiKey: 'sk-test',
      client: fakeClient as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client'],
    });
    const res = await provider.complete({
      system: 'YOU ARE A CATEGORIZER',
      cacheSystem: true,
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.equal(res.ok, true);
    assert.equal(captured.length, 1);
    const sent = captured[0]!.payload as { system: unknown };
    assert.ok(Array.isArray(sent.system), 'system must be promoted to a block array');
    const sys = sent.system as Array<{ type: string; text: string; cache_control?: unknown }>;
    assert.equal(sys.length, 1);
    assert.equal(sys[0]!.type, 'text');
    assert.equal(sys[0]!.text, 'YOU ARE A CATEGORIZER');
    assert.deepEqual(sys[0]!.cache_control, { type: 'ephemeral' });
  });

  it('without cacheSystem: leaves system as a plain string (no cache_control)', async () => {
    const captured: CapturedCall[] = [];
    const fakeClient = buildFakeAnthropicClient(
      () => ({
        content: [{ type: 'text', text: '{}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 10 },
        model: 'claude-sonnet-4-5',
      }),
      captured,
    );
    const provider = new AnthropicProvider({
      apiKey: 'sk-test',
      client: fakeClient as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client'],
    });
    await provider.complete({
      system: 'YOU ARE A CATEGORIZER',
      messages: [{ role: 'user', content: 'hi' }],
    });
    const sent = captured[0]!.payload as { system: unknown };
    assert.equal(
      typeof sent.system,
      'string',
      'system stays a plain string when cacheSystem is omitted (backwards-compat)',
    );
    assert.equal(sent.system, 'YOU ARE A CATEGORIZER');
  });

  it('appends the JSON suffix to the cached system block when responseFormat=json', async () => {
    const captured: CapturedCall[] = [];
    const fakeClient = buildFakeAnthropicClient(
      () => ({
        content: [{ type: 'text', text: '{}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 10 },
        model: 'claude-sonnet-4-5',
      }),
      captured,
    );
    const provider = new AnthropicProvider({
      apiKey: 'sk-test',
      client: fakeClient as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client'],
    });
    await provider.complete({
      system: 'YOU ARE A CATEGORIZER',
      cacheSystem: true,
      responseFormat: 'json',
      messages: [{ role: 'user', content: 'hi' }],
    });
    const sent = captured[0]!.payload as { system: unknown };
    const sys = sent.system as Array<{ text: string }>;
    assert.ok(sys[0]!.text.startsWith('YOU ARE A CATEGORIZER'));
    assert.ok(
      sys[0]!.text.includes('Respond with strict JSON only'),
      'JSON suffix must travel with the cached system block so the model reads it',
    );
  });

  it('translates per-message LlmContentBlock cacheable into cache_control on that block', async () => {
    const captured: CapturedCall[] = [];
    const fakeClient = buildFakeAnthropicClient(
      () => ({
        content: [{ type: 'text', text: '{}' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 10 },
        model: 'claude-sonnet-4-5',
      }),
      captured,
    );
    const provider = new AnthropicProvider({
      apiKey: 'sk-test',
      client: fakeClient as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client'],
    });
    await provider.complete({
      system: 'sys',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'STABLE CUSTOMER CONTEXT', cacheable: true },
            { type: 'text', text: 'DYNAMIC PER-FIRE BODY' },
          ],
        },
      ],
    });
    const sent = captured[0]!.payload as { messages: Array<{ content: unknown }> };
    const content = sent.messages[0]!.content as Array<{
      type: string;
      text: string;
      cache_control?: unknown;
    }>;
    assert.equal(content.length, 2);
    assert.deepEqual(content[0]!.cache_control, { type: 'ephemeral' });
    assert.equal(content[1]!.cache_control, undefined);
  });

  it('parses cache_creation_input_tokens + cache_read_input_tokens from usage', async () => {
    const captured: CapturedCall[] = [];
    const fakeClient = buildFakeAnthropicClient(
      () => ({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 50,
          output_tokens: 20,
          cache_creation_input_tokens: 800,
          cache_read_input_tokens: 200,
        },
        model: 'claude-sonnet-4-5',
      }),
      captured,
    );
    const provider = new AnthropicProvider({
      apiKey: 'sk-test',
      client: fakeClient as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client'],
    });
    const res = await provider.complete({
      system: 'sys',
      cacheSystem: true,
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const usage = res.value.usage;
    assert.ok(usage, 'usage must be reported');
    assert.equal(usage!.inputTokens, 50);
    assert.equal(usage!.outputTokens, 20);
    assert.equal(usage!.cacheCreationInputTokens, 800);
    assert.equal(usage!.cacheReadInputTokens, 200);
  });

  it('omits cache-token fields when the response did not include them (back-compat)', async () => {
    const captured: CapturedCall[] = [];
    const fakeClient = buildFakeAnthropicClient(
      () => ({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 50, output_tokens: 20 },
        model: 'claude-sonnet-4-5',
      }),
      captured,
    );
    const provider = new AnthropicProvider({
      apiKey: 'sk-test',
      client: fakeClient as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client'],
    });
    const res = await provider.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.usage!.cacheCreationInputTokens, undefined);
    assert.equal(res.value.usage!.cacheReadInputTokens, undefined);
  });
});

// ── TestLlmProvider — cache flag is a no-op ──────────────────────────────

describe('TestLlmProvider — cache flag is a no-op', () => {
  it('reports zero cache-token counts and the call still succeeds', async () => {
    const provider = new TestLlmProvider();
    const res = await provider.complete({
      system: '[[agentplain.skill.categorize.v1]]\nVERTICAL_SLUG: real-estate\n',
      cacheSystem: true,
      messages: [{ role: 'user', content: 'inquiry about a property listing' }],
      responseFormat: 'json',
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.usage!.cacheCreationInputTokens, 0);
    assert.equal(res.value.usage!.cacheReadInputTokens, 0);
    assert.ok(res.value.usage!.inputTokens > 0);
  });
});

// ── LoggingLlmProvider — emits llm.usage line per call ───────────────────

interface RecordedLog {
  level: string;
  payload: Record<string, unknown>;
}

describe('LoggingLlmProvider — emits llm.usage per call', () => {
  let recorded: RecordedLog[];
  beforeEach(() => {
    recorded = [];
    __setLoggerWriterForTests((level, payload) => {
      recorded.push({ level, payload: payload as Record<string, unknown> });
    });
  });
  afterEach(() => {
    __setLoggerWriterForTests(null);
  });

  it('emits a structured llm.usage record with cache-token counts + hit rate', async () => {
    const inner: LlmProvider = {
      name: 'test',
      async complete(): Promise<LlmResult<LlmCompletion>> {
        return llmOk({
          text: '{}',
          stopReason: 'end_turn',
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 900,
          },
          model: 'claude-sonnet-4-5',
        });
      },
    };
    const wrapped = new LoggingLlmProvider(inner);
    const res = await wrapped.complete({
      system: 'stable prompt',
      cacheSystem: true,
      messages: [{ role: 'user', content: 'hi' }],
      meta: { skill: 'categorize', workspaceId: 'ws-1', verticalSlug: 'real-estate' },
    });
    assert.equal(res.ok, true);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]!.payload.msg, 'llm.usage');
    const ctx = recorded[0]!.payload.ctx as Record<string, unknown>;
    assert.equal(ctx.skill, 'categorize');
    assert.equal(ctx.workspace_id, 'ws-1');
    assert.equal(ctx.vertical_slug, 'real-estate');
    assert.equal(ctx.tokens_input, 100);
    assert.equal(ctx.tokens_output, 20);
    assert.equal(ctx.tokens_cache_write, 0);
    assert.equal(ctx.tokens_cache_read, 900);
    // hit rate = read / (input + write + read) = 900 / 1000 = 0.9
    assert.equal(ctx.cache_hit_rate, 0.9);
    assert.equal(ctx.ok, true);
  });

  it('emits a warn record with error_code on LLM failure', async () => {
    const inner: LlmProvider = {
      name: 'test',
      async complete(): Promise<LlmResult<LlmCompletion>> {
        return { ok: false, error: { code: 'RATE_LIMITED', message: 'slow down', status: 429 } };
      },
    };
    const wrapped = new LoggingLlmProvider(inner);
    const res = await wrapped.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      meta: { skill: 'draft' },
    });
    assert.equal(res.ok, false);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]!.level, 'warn');
    const ctx = recorded[0]!.payload.ctx as Record<string, unknown>;
    assert.equal(ctx.skill, 'draft');
    assert.equal(ctx.error_code, 'RATE_LIMITED');
    assert.equal(ctx.error_status, 429);
  });

  it('exposes innerProvider() for tests that need the underlying provider', () => {
    const inner = new TestLlmProvider();
    const wrapped = new LoggingLlmProvider(inner, { enabled: false });
    assert.strictEqual(wrapped.innerProvider(), inner);
  });
});

// ── Integration: two-call simulated cache write + read ───────────────────

describe('Prompt cache — simulated write-then-read across two calls', () => {
  it('the SDK fake returns cache_creation on call 1, cache_read on call 2', async () => {
    // Simulate the Anthropic billing surface across two back-to-back
    // calls with the SAME stable system prompt: first call writes the
    // cache, second call reads it. Anthropic's API exposes exactly this
    // shape — write=N+read=0 on the first hit, write=0+read=N on the
    // next within the 5-min TTL. The assertion proves the adapter
    // surfaces both axes through to LlmUsage so the metrics path can
    // distinguish a freshly-cached fire from one that paid the write.
    const captured: CapturedCall[] = [];
    let call = 0;
    const fakeClient = {
      messages: {
        create: async (payload: unknown) => {
          captured.push({ payload });
          call += 1;
          if (call === 1) {
            return {
              content: [{ type: 'text', text: '{}' }],
              stop_reason: 'end_turn',
              usage: {
                input_tokens: 50,
                output_tokens: 10,
                cache_creation_input_tokens: 1000,
                cache_read_input_tokens: 0,
              },
              model: 'claude-sonnet-4-5',
            };
          }
          return {
            content: [{ type: 'text', text: '{}' }],
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 50,
              output_tokens: 10,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 1000,
            },
            model: 'claude-sonnet-4-5',
          };
        },
      },
    };
    const provider = new AnthropicProvider({
      apiKey: 'sk-test',
      client: fakeClient as unknown as ConstructorParameters<typeof AnthropicProvider>[0]['client'],
    });
    const request: LlmCompletionRequest = {
      system: 'STABLE SYSTEM PROMPT (vertical rules)',
      cacheSystem: true,
      messages: [{ role: 'user', content: 'fresh dynamic content per fire' }],
    };
    const a = await provider.complete(request);
    const b = await provider.complete(request);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.equal(a.value.usage!.cacheCreationInputTokens, 1000);
    assert.equal(a.value.usage!.cacheReadInputTokens, 0);
    assert.equal(b.value.usage!.cacheCreationInputTokens, 0);
    assert.equal(b.value.usage!.cacheReadInputTokens, 1000);
    // Same payload + same cache_control breakpoint on both calls — that
    // identity is what Anthropic uses to key the cache.
    const sysA = (captured[0]!.payload as { system: unknown }).system as Array<unknown>;
    const sysB = (captured[1]!.payload as { system: unknown }).system as Array<unknown>;
    assert.deepEqual(sysA, sysB);
  });
});

// ── Skill call sites flag system as cacheable ────────────────────────────

describe('Skills pass cacheSystem: true on every LLM call', () => {
  it('CategorizeSkill flags cacheSystem and passes meta.skill', async () => {
    // Use a recording LLM that captures the request shape but returns a
    // valid categorization JSON so the skill's parser is satisfied.
    const captured: LlmCompletionRequest[] = [];
    const recordingLlm: LlmProvider = {
      name: 'test',
      async complete(req): Promise<LlmResult<LlmCompletion>> {
        captured.push(req);
        return llmOk({
          text: JSON.stringify({ intent: 'noise', confidence: 0.9, reason: 'r' }),
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 5 },
          model: 'test-stub',
        });
      },
    };
    const { CategorizeSkill } = await import('@/lib/skills/categorize');
    const { getPromptBundleBySlug } = await import('@/lib/skills/prompts/index');
    const prompts = getPromptBundleBySlug('real-estate')!;
    const skill = new CategorizeSkill(recordingLlm);
    const res = await skill.run({
      message: {
        id: 'm1',
        threadId: 't1',
        rfcMessageId: null,
        fromEmail: 'x@y.com',
        fromName: null,
        toEmails: [],
        ccEmails: [],
        subject: 's',
        bodyText: 'b',
        snippet: 'snip',
        references: [],
        inReplyTo: null,
        attachments: [],
        receivedAt: new Date(),
        labels: [],
      },
      prompts,
      workspaceId: 'ws-42',
    });
    assert.equal(res.ok, true);
    assert.equal(captured.length, 1);
    assert.equal(captured[0]!.cacheSystem, true);
    assert.equal(captured[0]!.meta?.skill, 'categorize');
    assert.equal(captured[0]!.meta?.workspaceId, 'ws-42');
    assert.equal(captured[0]!.meta?.verticalSlug, 'real-estate');
  });
});
