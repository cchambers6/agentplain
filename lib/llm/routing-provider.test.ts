/**
 * lib/llm/routing-provider.test.ts
 *
 * Contract pins for RoutingLlmProvider — cost-aware per-task-class model
 * selection behind the `LLM_MODEL_ROUTING` flag.
 *
 * The single most important invariant in this suite:
 *   FLAG OFF → the wrapper is a transparent no-op — the SAME request object
 *   reference is forwarded to the inner provider; no model field is added
 *   or changed.
 *
 * Secondary invariants (flag ON):
 *   - Known surfaces are mapped to the documented model tier.
 *   - An explicit caller model is never overridden.
 *   - An unknown / absent surface leaves the model unchanged.
 *   - The pure `applyRouting` transform is tested independently of the
 *     wrapper so the policy table can be audited without a running provider.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  RoutingLlmProvider,
  applyRouting,
  resolveRoutedModel,
  DEFAULT_ROUTING_POLICY,
} from './routing-provider';
import { llmOk } from './types';
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmResult,
} from './types';

// ── Test double ───────────────────────────────────────────────────────────────

/** Records every forwarded request for inspection. */
class RecordingLlm implements LlmProvider {
  readonly name = 'test' as const;
  readonly calls: LlmCompletionRequest[] = [];
  constructor(private readonly text: string = '{}') {}
  async complete(req: LlmCompletionRequest): Promise<LlmResult<LlmCompletion>> {
    this.calls.push(req);
    return llmOk({
      text: this.text,
      stopReason: 'end_turn',
      usage: { inputTokens: 5, outputTokens: 2 },
      model: req.model ?? 'inner-default',
    });
  }
}

// ── Env helpers ───────────────────────────────────────────────────────────────

function withEnv(key: string, value: string | undefined, fn: () => void): void {
  const saved = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env[key];
    else process.env[key] = saved;
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<LlmCompletionRequest> = {}): LlmCompletionRequest {
  return {
    system: 'system prompt',
    messages: [{ role: 'user', content: 'hello' }],
    ...overrides,
  };
}

// ── resolveRoutedModel (pure lookup) ─────────────────────────────────────────

describe('resolveRoutedModel', () => {
  it('returns the model id for a known surface', () => {
    assert.equal(resolveRoutedModel('CATEGORIZE'), 'claude-haiku-4-5-20251001');
    assert.equal(resolveRoutedModel('DRAFT'), 'claude-opus-4-7');
    assert.equal(resolveRoutedModel('COORDINATE'), 'claude-sonnet-4-6');
  });

  it('returns undefined for an absent surface', () => {
    assert.equal(resolveRoutedModel(undefined), undefined);
  });

  it('respects a custom policy override', () => {
    const custom = { ...DEFAULT_ROUTING_POLICY, CATEGORIZE: 'claude-custom-1' };
    assert.equal(resolveRoutedModel('CATEGORIZE', custom), 'claude-custom-1');
  });
});

// ── applyRouting (pure transform) ────────────────────────────────────────────

describe('applyRouting', () => {
  it('assigns model from policy when model is absent and surface is known', () => {
    const req = makeReq({ meta: { sourceSurface: 'DRAFT' } });
    const out = applyRouting(req);
    assert.equal(out.model, 'claude-opus-4-7');
    // Returns a NEW object (spread) when it adds a model.
    assert.notStrictEqual(out, req);
  });

  it('does NOT mutate the original request object', () => {
    const req = makeReq({ meta: { sourceSurface: 'DRAFT' } });
    assert.equal(req.model, undefined);
    applyRouting(req);
    assert.equal(req.model, undefined, 'original untouched');
  });

  it('returns the SAME reference when model is already set (explicit pin respected)', () => {
    const req = makeReq({ model: 'claude-opus-4-7', meta: { sourceSurface: 'CATEGORIZE' } });
    const out = applyRouting(req);
    assert.strictEqual(out, req, 'same reference — explicit model not overridden');
    assert.equal(out.model, 'claude-opus-4-7');
  });

  it('returns the SAME reference when surface is absent', () => {
    const req = makeReq();
    const out = applyRouting(req);
    assert.strictEqual(out, req);
    assert.equal(out.model, undefined);
  });

  it('HAIKU surfaces are correctly mapped', () => {
    for (const surface of ['CATEGORIZE', 'OFFICE_ADMIN', 'INBOX_TRIAGE'] as const) {
      const out = applyRouting(makeReq({ meta: { sourceSurface: surface } }));
      assert.equal(out.model, 'claude-haiku-4-5-20251001', `${surface} should map to Haiku`);
    }
  });

  it('SONNET surfaces are correctly mapped', () => {
    for (const surface of ['COORDINATE', 'SCHEDULE', 'SCHEDULER_SWEEP', 'MEMORY_EXTRACT', 'FOLLOW_UP_CHASER', 'OTHER'] as const) {
      const out = applyRouting(makeReq({ meta: { sourceSurface: surface } }));
      assert.equal(out.model, 'claude-sonnet-4-6', `${surface} should map to Sonnet`);
    }
  });

  it('OPUS surfaces are correctly mapped', () => {
    for (const surface of ['DRAFT', 'SUPPORT_HANDLER', 'PLAINO_CHAT', 'PROCESS_DOC_DRAFTER'] as const) {
      const out = applyRouting(makeReq({ meta: { sourceSurface: surface } }));
      assert.equal(out.model, 'claude-opus-4-7', `${surface} should map to Opus`);
    }
  });
});

// ── RoutingLlmProvider — flag OFF (the identity invariant) ───────────────────

describe('RoutingLlmProvider — flag OFF (default)', () => {
  it('forwards the EXACT SAME request reference when env flag is unset', async () => {
    withEnv('LLM_MODEL_ROUTING', undefined, async () => {
      const inner = new RecordingLlm();
      // enabled:false is the safe default
      const provider = new RoutingLlmProvider(inner, { enabled: false });
      const req = makeReq({ meta: { sourceSurface: 'DRAFT' } });
      await provider.complete(req);
      assert.strictEqual(inner.calls[0], req, 'same object reference — pure pass-through');
    });
  });

  it('forwards the EXACT SAME reference when env is explicitly "off"', async () => {
    withEnv('LLM_MODEL_ROUTING', 'off', async () => {
      const inner = new RecordingLlm();
      const provider = new RoutingLlmProvider(inner, { enabled: true }); // constructor says on, env overrides
      const req = makeReq({ meta: { sourceSurface: 'CATEGORIZE' } });
      await provider.complete(req);
      assert.strictEqual(inner.calls[0], req, 'env=off overrides constructor enabled:true');
      assert.equal(inner.calls[0].model, undefined, 'no model was added');
    });
  });

  it('does not assign a model for any surface when flag is off', async () => {
    withEnv('LLM_MODEL_ROUTING', undefined, async () => {
      const surfaces = ['CATEGORIZE', 'DRAFT', 'COORDINATE', 'SUPPORT_HANDLER'] as const;
      for (const surface of surfaces) {
        const inner = new RecordingLlm();
        const provider = new RoutingLlmProvider(inner);
        const req = makeReq({ meta: { sourceSurface: surface } });
        await provider.complete(req);
        assert.equal(inner.calls[0].model, undefined, `${surface}: no model assigned when flag off`);
        assert.strictEqual(inner.calls[0], req, `${surface}: same reference`);
      }
    });
  });
});

// ── RoutingLlmProvider — flag ON ─────────────────────────────────────────────

describe('RoutingLlmProvider — flag ON', () => {
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env.LLM_MODEL_ROUTING;
    process.env.LLM_MODEL_ROUTING = 'on';
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.LLM_MODEL_ROUTING;
    else process.env.LLM_MODEL_ROUTING = savedEnv;
  });

  it('routes CATEGORIZE → Haiku', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    await provider.complete(makeReq({ meta: { sourceSurface: 'CATEGORIZE' } }));
    assert.equal(inner.calls[0].model, 'claude-haiku-4-5-20251001');
  });

  it('routes DRAFT → Opus', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    await provider.complete(makeReq({ meta: { sourceSurface: 'DRAFT' } }));
    assert.equal(inner.calls[0].model, 'claude-opus-4-7');
  });

  it('routes COORDINATE → Sonnet', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    await provider.complete(makeReq({ meta: { sourceSurface: 'COORDINATE' } }));
    assert.equal(inner.calls[0].model, 'claude-sonnet-4-6');
  });

  it('routes PLAINO_CHAT → Opus', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    await provider.complete(makeReq({ meta: { sourceSurface: 'PLAINO_CHAT' } }));
    assert.equal(inner.calls[0].model, 'claude-opus-4-7');
  });

  it('routes SUPPORT_HANDLER → Opus', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    await provider.complete(makeReq({ meta: { sourceSurface: 'SUPPORT_HANDLER' } }));
    assert.equal(inner.calls[0].model, 'claude-opus-4-7');
  });

  it('routes FOLLOW_UP_CHASER → Sonnet', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    await provider.complete(makeReq({ meta: { sourceSurface: 'FOLLOW_UP_CHASER' } }));
    assert.equal(inner.calls[0].model, 'claude-sonnet-4-6');
  });

  it('routes MEMORY_EXTRACT → Sonnet', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    await provider.complete(makeReq({ meta: { sourceSurface: 'MEMORY_EXTRACT' } }));
    assert.equal(inner.calls[0].model, 'claude-sonnet-4-6');
  });

  it('routes OTHER → Sonnet (safe default surface)', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    await provider.complete(makeReq({ meta: { sourceSurface: 'OTHER' } }));
    assert.equal(inner.calls[0].model, 'claude-sonnet-4-6');
  });

  it('leaves model unchanged when no surface tag is present (unknown class → do not guess)', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    const req = makeReq(); // no meta at all
    await provider.complete(req);
    assert.equal(inner.calls[0].model, undefined, 'no meta → no routing decision');
  });

  it('does NOT override an explicit model pin — even for a known surface', async () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    // Caller explicitly pinned Opus on a CATEGORIZE surface (unusual but valid).
    const req = makeReq({
      model: 'claude-opus-4-7',
      meta: { sourceSurface: 'CATEGORIZE' },
    });
    await provider.complete(req);
    assert.equal(inner.calls[0].model, 'claude-opus-4-7', 'explicit model respected');
    assert.strictEqual(inner.calls[0], req, 'same reference — no copy made');
  });

  it('returns the inner result unchanged', async () => {
    const inner = new RecordingLlm('routed-text');
    const provider = new RoutingLlmProvider(inner);
    const res = await provider.complete(makeReq({ meta: { sourceSurface: 'DRAFT' } }));
    assert.ok(res.ok);
    assert.equal(res.value.text, 'routed-text');
  });
});

// ── RoutingLlmProvider — transparent identity properties ─────────────────────

describe('RoutingLlmProvider — provider identity', () => {
  it('mirrors the inner provider name (transparent telemetry)', () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    assert.equal(provider.name, 'test');
  });

  it('innerProvider() returns the wrapped provider', () => {
    const inner = new RecordingLlm();
    const provider = new RoutingLlmProvider(inner);
    assert.strictEqual(provider.innerProvider(), inner);
  });
});

// ── Policy table completeness ─────────────────────────────────────────────────

describe('DEFAULT_ROUTING_POLICY — completeness', () => {
  // Every LlmSourceSurfaceTag value that could show up in production should
  // have an explicit entry.  This pins the table so a future surface addition
  // to `LlmSourceSurfaceTag` breaks this test, reminding the author to
  // add a routing decision.
  const knownSurfaces = [
    'PLAINO_CHAT',
    'OFFICE_ADMIN',
    'CATEGORIZE',
    'COORDINATE',
    'SCHEDULE',
    'DRAFT',
    'SUPPORT_HANDLER',
    'INBOX_TRIAGE',
    'FOLLOW_UP_CHASER',
    'PROCESS_DOC_DRAFTER',
    'SCHEDULER_SWEEP',
    'MEMORY_EXTRACT',
    'OTHER',
  ] as const;

  for (const surface of knownSurfaces) {
    it(`DEFAULT_ROUTING_POLICY has an entry for ${surface}`, () => {
      assert.ok(
        surface in DEFAULT_ROUTING_POLICY,
        `Missing routing policy for surface: ${surface}`,
      );
      assert.ok(
        typeof DEFAULT_ROUTING_POLICY[surface] === 'string' &&
        DEFAULT_ROUTING_POLICY[surface].length > 0,
        `Empty routing model for surface: ${surface}`,
      );
    });
  }
});
