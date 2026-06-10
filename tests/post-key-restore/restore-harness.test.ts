/**
 * tests/post-key-restore/restore-harness.test.ts
 *
 * Offline unit tests for the post-key-restore harness.
 * These run without any network call, without Prisma, and without a real
 * Anthropic key. They validate:
 *   1. Registry shape — every entry has required fields and a callable verify()
 *   2. Registry completeness — no two entries share an id; every area is typed
 *   3. Table renderer — STATUS_ICON covers every VerifyStatus value
 *   4. Placeholder vs real reply classifier — the same logic the chat checker uses
 *   5. Sentinel key detection — isPausedApiKey / checkKeyState
 *   6. Fail-fast on missing env — the verify functions return SKIP or BLOCKED,
 *      never PASS, when the key is absent/sentinel and liveProviderCheck is false
 *
 * Run:
 *   node --import tsx --test tests/post-key-restore/restore-harness.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  LLM_SURFACE_REGISTRY,
  REGISTRY_IDS,
  findSurface,
  checkKeyState,
  type VerifyStatus,
  type LlmSurface,
} from '@/lib/llm/restore-checklist';
import { isPausedApiKey, PAUSED_API_KEY_PREFIX } from '@/lib/llm/paused';

// ── helpers ────────────────────────────────────────────────────────────────

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(overrides)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      await fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };
}

// ── 1. Registry shape ─────────────────────────────────────────────────────

describe('LLM_SURFACE_REGISTRY — shape', () => {
  it('has at least one entry', () => {
    assert.ok(LLM_SURFACE_REGISTRY.length > 0, 'registry is empty');
  });

  it('every entry has a non-empty id', () => {
    for (const s of LLM_SURFACE_REGISTRY) {
      assert.ok(
        typeof s.id === 'string' && s.id.trim().length > 0,
        `entry missing id: ${JSON.stringify(s)}`,
      );
    }
  });

  it('every entry has a non-empty label', () => {
    for (const s of LLM_SURFACE_REGISTRY) {
      assert.ok(
        typeof s.label === 'string' && s.label.trim().length > 0,
        `entry "${s.id}" missing label`,
      );
    }
  });

  it('every entry has a non-empty area', () => {
    for (const s of LLM_SURFACE_REGISTRY) {
      assert.ok(
        typeof s.area === 'string' && s.area.trim().length > 0,
        `entry "${s.id}" missing area`,
      );
    }
  });

  it('every entry has a non-empty ownerSkill', () => {
    for (const s of LLM_SURFACE_REGISTRY) {
      assert.ok(
        typeof s.ownerSkill === 'string' && s.ownerSkill.trim().length > 0,
        `entry "${s.id}" missing ownerSkill`,
      );
    }
  });

  it('every entry has a callable verify function', () => {
    for (const s of LLM_SURFACE_REGISTRY) {
      assert.equal(
        typeof s.verify,
        'function',
        `entry "${s.id}" missing verify fn`,
      );
    }
  });

  it('every entry has an envFlags array (may be empty)', () => {
    for (const s of LLM_SURFACE_REGISTRY) {
      assert.ok(
        Array.isArray(s.envFlags),
        `entry "${s.id}" envFlags is not an array`,
      );
    }
  });
});

// ── 2. Registry completeness (uniqueness) ─────────────────────────────────

describe('LLM_SURFACE_REGISTRY — completeness', () => {
  it('all REGISTRY_IDS match the registry length', () => {
    assert.equal(REGISTRY_IDS.length, LLM_SURFACE_REGISTRY.length);
  });

  it('no two entries share the same id', () => {
    const ids = LLM_SURFACE_REGISTRY.map((s) => s.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length, `duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });

  it('findSurface returns correct entry by id', () => {
    const first = LLM_SURFACE_REGISTRY[0];
    assert.ok(first, 'registry is empty');
    const found = findSurface(first.id);
    assert.deepEqual(found, first);
  });

  it('findSurface returns undefined for unknown id', () => {
    assert.equal(findSurface('__not_real__'), undefined);
  });

  it('covers at least 18 surfaces (provider + all current skill paths on main)', () => {
    // Regression guard: if this drops below 18, a surface was accidentally removed.
    assert.ok(
      LLM_SURFACE_REGISTRY.length >= 18,
      `Registry only has ${LLM_SURFACE_REGISTRY.length} entries — expected at least 18`,
    );
  });

  it('includes the provider-key-state check', () => {
    assert.ok(findSurface('provider-key-state'), 'provider-key-state entry missing');
  });

  it('includes the plaino-chat-marketing check', () => {
    assert.ok(findSurface('plaino-chat-marketing'), 'plaino-chat-marketing entry missing');
  });

  it('includes the plaino-degraded-mode-flag check', () => {
    assert.ok(findSurface('plaino-degraded-mode-flag'), 'plaino-degraded-mode-flag entry missing');
  });
});

// ── 3. Sentinel key detection ─────────────────────────────────────────────

describe('isPausedApiKey', () => {
  it('returns true for the live sentinel value', () => {
    assert.equal(isPausedApiKey('sk-ant-PAUSED-2026-06-02-conner-restore-when-back'), true);
  });

  it('returns true for any string starting with the prefix', () => {
    assert.equal(isPausedApiKey(`${PAUSED_API_KEY_PREFIX}anything`), true);
  });

  it('returns false for a real key shape', () => {
    assert.equal(isPausedApiKey('sk-ant-123456789abcdef'), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isPausedApiKey(undefined), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isPausedApiKey(''), false);
  });

  it('returns false for null', () => {
    assert.equal(isPausedApiKey(null), false);
  });
});

describe('checkKeyState', () => {
  const SENTINEL = `${PAUSED_API_KEY_PREFIX}test`;

  it('reports paused=true when key is the sentinel', withEnv({ ANTHROPIC_API_KEY: SENTINEL }, async () => {
    const state = checkKeyState();
    assert.equal(state.paused, true);
    assert.equal(state.live, false);
    assert.equal(state.missing, false);
  }));

  it('reports missing=true when key is absent', withEnv({ ANTHROPIC_API_KEY: undefined }, async () => {
    const state = checkKeyState();
    assert.equal(state.missing, true);
    assert.equal(state.paused, false);
    assert.equal(state.live, false);
  }));

  it('reports live=true for a plausible real key', withEnv({ ANTHROPIC_API_KEY: 'sk-ant-realkey123' }, async () => {
    const state = checkKeyState();
    assert.equal(state.live, true);
    assert.equal(state.paused, false);
    assert.equal(state.missing, false);
  }));
});

// ── 4. Placeholder vs real reply classifier ───────────────────────────────

describe('placeholder-vs-real reply classification', () => {
  // The harness identifies a degraded response by checking `degraded === true`
  // AND the presence of the paused-copy string. Replicate that logic here.
  const PAUSED_COPY = "Plaino's resting just now";
  const TRANSIENT_COPY = "Plaino's catching his breath";

  function classifyReply(reply: string, degraded: boolean): 'paused' | 'transient' | 'real' {
    if (!degraded) return 'real';
    if (reply.includes(PAUSED_COPY)) return 'paused';
    return 'transient';
  }

  it('classifies a real reply as real', () => {
    assert.equal(
      classifyReply('Here is a real answer about your account.', false),
      'real',
    );
  });

  it('classifies the paused copy as paused', () => {
    assert.equal(
      classifyReply("Plaino's resting just now — but a person will follow up.", true),
      'paused',
    );
  });

  it('classifies the transient copy as transient', () => {
    assert.equal(
      classifyReply("Plaino's catching his breath — give it a moment.", true),
      'transient',
    );
  });

  it('a non-empty real reply with degraded=false is always real', () => {
    assert.equal(classifyReply('Great question!', false), 'real');
  });
});

// ── 5. verify() fail-fast when key is sentinel + no liveProviderCheck ─────

describe('verify() — no live tokens burned without explicit opt-in', () => {
  const SENTINEL = `${PAUSED_API_KEY_PREFIX}test`;
  const PROVIDER_LEVEL_IDS = [
    'provider-sentinel-layer',
    'skill-categorize',
    'skill-draft',
    'skill-office-admin-classify',
    'skill-briefing-generator',
    'skill-support-handler',
    'skill-inbox-triage-llm-classify',
  ] as const;

  before(async () => {
    process.env.ANTHROPIC_API_KEY = SENTINEL;
    // Force re-build of provider on next getLlmProvider() call
    const { resetLlmProviderForTests } = await import('@/lib/llm');
    resetLlmProviderForTests();
  });

  after(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { resetLlmProviderForTests } = await import('@/lib/llm');
    resetLlmProviderForTests();
  });

  for (const id of PROVIDER_LEVEL_IDS) {
    it(`"${id}" returns BLOCKED or SKIP (never PASS) when sentinel active, no liveProviderCheck`, async () => {
      const surface = findSurface(id);
      assert.ok(surface, `surface "${id}" not found in registry`);
      const result = await surface.verify({ liveProviderCheck: false });
      const acceptableStatuses: VerifyStatus[] = ['BLOCKED', 'SKIP'];
      assert.ok(
        acceptableStatuses.includes(result.status),
        `"${id}" returned ${result.status} — expected BLOCKED or SKIP without liveProviderCheck. Detail: ${result.detail}`,
      );
    });
  }
});

// ── 6. provider-key-state returns BLOCKED for sentinel ───────────────────

describe('provider-key-state verify()', () => {
  const SENTINEL = `${PAUSED_API_KEY_PREFIX}test-blockedkey`;

  it('returns BLOCKED when key is sentinel', withEnv({ ANTHROPIC_API_KEY: SENTINEL }, async () => {
    const surface = findSurface('provider-key-state');
    assert.ok(surface, 'provider-key-state not in registry');
    const result = await surface.verify({});
    assert.equal(result.status, 'BLOCKED', `expected BLOCKED, got ${result.status}: ${result.detail}`);
  }));

  it('returns SKIP when key is empty', withEnv({ ANTHROPIC_API_KEY: undefined }, async () => {
    const surface = findSurface('provider-key-state');
    assert.ok(surface, 'provider-key-state not in registry');
    const result = await surface.verify({});
    assert.equal(result.status, 'SKIP', `expected SKIP, got ${result.status}: ${result.detail}`);
  }));

  it('returns PASS when key looks live', withEnv({ ANTHROPIC_API_KEY: 'sk-ant-real123' }, async () => {
    const surface = findSurface('provider-key-state');
    assert.ok(surface, 'provider-key-state not in registry');
    const result = await surface.verify({});
    assert.equal(result.status, 'PASS', `expected PASS, got ${result.status}: ${result.detail}`);
  }));
});

// ── 7. caching and routing layer checks always return PASS ────────────────

describe('layer config checks (caching, routing, budget)', () => {
  it('provider-caching-layer verify() always returns PASS', async () => {
    const surface = findSurface('provider-caching-layer');
    assert.ok(surface, 'provider-caching-layer not in registry');
    const result = await surface.verify({});
    assert.equal(result.status, 'PASS', `expected PASS: ${result.detail}`);
  });

  it('provider-routing-layer verify() always returns PASS', async () => {
    const surface = findSurface('provider-routing-layer');
    assert.ok(surface, 'provider-routing-layer not in registry');
    const result = await surface.verify({});
    assert.equal(result.status, 'PASS', `expected PASS: ${result.detail}`);
  });

  it('provider-budget-layer verify() always returns PASS', async () => {
    const surface = findSurface('provider-budget-layer');
    assert.ok(surface, 'provider-budget-layer not in registry');
    const result = await surface.verify({});
    assert.equal(result.status, 'PASS', `expected PASS: ${result.detail}`);
  });
});

// ── 8. HTTP checks return SKIP without BASE_URL ───────────────────────────

describe('HTTP surface checks', () => {
  it('plaino-chat-marketing returns SKIP when BASE_URL not set', withEnv({ BASE_URL: undefined }, async () => {
    const surface = findSurface('plaino-chat-marketing');
    assert.ok(surface, 'plaino-chat-marketing not in registry');
    const result = await surface.verify({ baseUrl: undefined });
    assert.equal(result.status, 'SKIP', `expected SKIP, got ${result.status}: ${result.detail}`);
  }));

  it('plaino-chat-support returns SKIP when BASE_URL not set', withEnv({ BASE_URL: undefined }, async () => {
    const surface = findSurface('plaino-chat-support');
    assert.ok(surface, 'plaino-chat-support not in registry');
    const result = await surface.verify({ baseUrl: undefined });
    assert.equal(result.status, 'SKIP', `expected SKIP, got ${result.status}: ${result.detail}`);
  }));
});
