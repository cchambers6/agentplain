/**
 * lib/llm/cache-wrapper.test.ts
 *
 * Contract pins for the auto-caching wrapper (lib/llm/cache-wrapper.ts):
 *
 *   - auto-enables `cacheSystem` on a substantial system prompt the caller
 *     left undecided (the gap-filling default);
 *   - the cached prefix is BYTE-IDENTICAL across calls (the stability
 *     invariant the whole cache mechanism rests on);
 *   - explicit intent (true / false) and manual content-block placement are
 *     respected untouched — the miss / opt-out path still works;
 *   - tiny prompts are left alone (below the model's cacheable minimum a
 *     breakpoint is noise);
 *   - end-to-end: wrapper flag -> AnthropicProvider emits
 *     `cache_control: { type: 'ephemeral' }` on the system block.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CachingLlmProvider,
  autoCacheRequest,
  DEFAULT_MIN_SYSTEM_CHARS,
} from './cache-wrapper';
import { AnthropicProvider } from './anthropic-provider';
import { llmOk } from './types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from './types';

// ── Test doubles ──────────────────────────────────────────────────────────

/** Records every forwarded request so we can assert on what the inner
 *  provider actually received. */
class RecordingLlm implements LlmProvider {
  readonly name = 'test' as const;
  readonly calls: LlmCompletionRequest[] = [];
  constructor(private readonly text: string = '{}') {}
  async complete(req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    this.calls.push(req);
    return llmOk({
      text: this.text,
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
      model: req.model ?? 'test-stub',
    });
  }
}

/** A system prompt comfortably over the auto-cache threshold. */
const BIG_SYSTEM = 'SKILL_PREFIX\n' + 'stable instruction line. '.repeat(60);

function req(overrides: Partial<LlmCompletionRequest> = {}): LlmCompletionRequest {
  return {
    system: BIG_SYSTEM,
    messages: [{ role: 'user', content: 'the volatile per-turn message' }],
    ...overrides,
  };
}

// ── autoCacheRequest (pure transform) ──────────────────────────────────────

describe('autoCacheRequest', () => {
  it('enables cacheSystem on a large undecided system prompt', () => {
    assert.ok(BIG_SYSTEM.length >= DEFAULT_MIN_SYSTEM_CHARS);
    const out = autoCacheRequest(req());
    assert.equal(out.cacheSystem, true);
  });

  it('does not mutate the original request object', () => {
    const original = req();
    const out = autoCacheRequest(original);
    assert.equal(original.cacheSystem, undefined, 'input left untouched');
    assert.notEqual(out, original, 'returns a new object when it changes the flag');
  });

  it('does not change the system prompt bytes (stability invariant)', () => {
    const original = req();
    const out = autoCacheRequest(original);
    assert.equal(out.system, original.system);
  });

  it('respects an explicit cacheSystem:false (opt-out)', () => {
    const original = req({ cacheSystem: false });
    const out = autoCacheRequest(original);
    assert.equal(out, original, 'same reference — untouched');
    assert.equal(out.cacheSystem, false);
  });

  it('leaves an explicit cacheSystem:true untouched', () => {
    const original = req({ cacheSystem: true });
    const out = autoCacheRequest(original);
    assert.equal(out, original);
    assert.equal(out.cacheSystem, true);
  });

  it('does not cache a sub-threshold system prompt', () => {
    const original = req({ system: 'tiny' });
    const out = autoCacheRequest(original);
    assert.equal(out, original);
    assert.equal(out.cacheSystem, undefined);
  });

  it('honors a custom minSystemChars floor', () => {
    const original = req();
    const out = autoCacheRequest(original, BIG_SYSTEM.length + 1);
    assert.equal(out.cacheSystem, undefined, 'system just below the custom floor');
  });

  it('skips auto-cache when the caller marked content blocks cacheable', () => {
    const original = req({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'manual stable prefix', cacheable: true },
            { type: 'text', text: 'volatile suffix' },
          ],
        },
      ],
    });
    const out = autoCacheRequest(original);
    assert.equal(out, original, 'manual placement mode — left to the caller');
    assert.equal(out.cacheSystem, undefined);
  });
});

// ── CachingLlmProvider (wrapper behavior) ───────────────────────────────────

describe('CachingLlmProvider', () => {
  it('forwards the auto-cached request to the inner provider', async () => {
    const inner = new RecordingLlm('hello');
    const provider = new CachingLlmProvider(inner);
    const res = await provider.complete(req());
    assert.ok(res.ok);
    assert.equal(inner.calls.length, 1);
    assert.equal(inner.calls[0].cacheSystem, true);
  });

  it('returns the inner result unchanged', async () => {
    const inner = new RecordingLlm('payload');
    const provider = new CachingLlmProvider(inner);
    const res = await provider.complete(req());
    assert.ok(res.ok);
    assert.equal(res.value.text, 'payload');
    assert.equal(res.value.usage?.inputTokens, 10);
  });

  it('sends a byte-identical cached prefix across repeated calls', async () => {
    const inner = new RecordingLlm();
    const provider = new CachingLlmProvider(inner);
    // Same logical request fired twice (e.g. two inbound items, same skill).
    await provider.complete(req());
    await provider.complete(req());
    assert.equal(inner.calls.length, 2);
    const [a, b] = inner.calls;
    assert.equal(a.cacheSystem, true);
    assert.equal(b.cacheSystem, true);
    // The cache key derives from the rendered prefix bytes — they must match
    // exactly or every call writes a fresh entry and nothing is ever read.
    assert.equal(a.system, b.system);
  });

  it('miss path: tiny prompt still completes, just uncached', async () => {
    const inner = new RecordingLlm('ok');
    const provider = new CachingLlmProvider(inner);
    const res = await provider.complete(req({ system: 'short' }));
    assert.ok(res.ok);
    assert.equal(inner.calls[0].cacheSystem, undefined);
  });

  it('disabled wrapper is a pure pass-through', async () => {
    const inner = new RecordingLlm();
    const provider = new CachingLlmProvider(inner, { enabled: false });
    await provider.complete(req());
    assert.equal(inner.calls[0].cacheSystem, undefined, 'no flag flipped');
  });

  it('mirrors the inner provider name for transparent telemetry', () => {
    const inner = new RecordingLlm();
    const provider = new CachingLlmProvider(inner);
    assert.equal(provider.name, 'test');
    assert.equal(provider.innerProvider(), inner);
  });
});

// ── End-to-end: ephemeral cache_control reaches the SDK ─────────────────────

describe('CachingLlmProvider over AnthropicProvider', () => {
  /** Minimal fake Anthropic SDK client — captures the create() params so we
   *  can assert the ephemeral breakpoint without a network call. */
  function makeFakeClient() {
    const captured: { params?: any } = {};
    const client = {
      messages: {
        create: async (params: any) => {
          captured.params = params;
          return {
            content: [{ type: 'text', text: 'done' }],
            stop_reason: 'end_turn',
            model: params.model,
            usage: {
              input_tokens: 4,
              output_tokens: 2,
              cache_creation_input_tokens: 120,
              cache_read_input_tokens: 0,
            },
          };
        },
      },
    };
    return { client, captured };
  }

  it('applies cache_control:{type:ephemeral} on the system block', async () => {
    const { client, captured } = makeFakeClient();
    const anthropic = new AnthropicProvider({
      apiKey: 'unused',
      client: client as never,
    });
    const provider = new CachingLlmProvider(anthropic);

    const res = await provider.complete(req({ model: 'claude-sonnet-4-6' }));
    assert.ok(res.ok);

    // System was promoted to a single cacheable text block by the adapter.
    const system = captured.params?.system;
    assert.ok(Array.isArray(system), 'system rendered as structured blocks');
    assert.equal(system[0].type, 'text');
    assert.deepEqual(system[0].cache_control, { type: 'ephemeral' });
    assert.equal(system[0].text, BIG_SYSTEM, 'system bytes preserved verbatim');
  });

  it('reports cache usage straight through from the SDK response', async () => {
    const { client } = makeFakeClient();
    const anthropic = new AnthropicProvider({
      apiKey: 'unused',
      client: client as never,
    });
    const provider = new CachingLlmProvider(anthropic);
    const res = await provider.complete(req({ model: 'claude-sonnet-4-6' }));
    assert.ok(res.ok);
    assert.equal(res.value.usage?.cacheCreationInputTokens, 120);
    assert.equal(res.value.usage?.cacheReadInputTokens, 0);
  });

  it('miss path: tiny prompt sends a plain-string system (no breakpoint)', async () => {
    const { client, captured } = makeFakeClient();
    const anthropic = new AnthropicProvider({
      apiKey: 'unused',
      client: client as never,
    });
    const provider = new CachingLlmProvider(anthropic);
    const res = await provider.complete(req({ system: 'short', model: 'claude-sonnet-4-6' }));
    assert.ok(res.ok);
    assert.equal(
      typeof captured.params?.system,
      'string',
      'sub-threshold system stays an un-cached plain string',
    );
  });
});
