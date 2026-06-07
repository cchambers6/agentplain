/**
 * lib/llm/paused.test.ts
 *
 * The sentinel-aware short-circuit. When `ANTHROPIC_API_KEY` is the paused
 * sentinel (`sk-ant-PAUSED-…`), `getLlmProvider()` must refuse the call
 * BEFORE any network request — the prod symptom this fixes (PR #154) was a
 * dead marketing chat burning a 401 round-trip on every turn.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getLlmProvider,
  resetLlmProviderForTests,
  PausedLlmProvider,
  LlmPausedError,
  isPausedApiKey,
  PAUSED_API_KEY_PREFIX,
} from "./index";

const SENTINEL = "sk-ant-PAUSED-2026-06-02-conner-restore-when-back";

const REQUEST = {
  system: "you are Plaino",
  messages: [{ role: "user" as const, content: "what do you do" }],
  model: "claude-sonnet-4-5",
  maxTokens: 100,
};

describe("isPausedApiKey", () => {
  it("matches the sentinel prefix regardless of trailing note", () => {
    assert.equal(isPausedApiKey(SENTINEL), true);
    assert.equal(isPausedApiKey(PAUSED_API_KEY_PREFIX), true);
    assert.equal(isPausedApiKey(PAUSED_API_KEY_PREFIX + "anything"), true);
  });

  it("does not match a live key, empty, null, or undefined", () => {
    assert.equal(isPausedApiKey("sk-ant-api03-livekey"), false);
    assert.equal(isPausedApiKey(""), false);
    assert.equal(isPausedApiKey(null), false);
    assert.equal(isPausedApiKey(undefined), false);
  });
});

describe("LlmPausedError", () => {
  it("is a typed error with a stable name + PAUSED code", () => {
    const err = new LlmPausedError();
    assert.equal(err.name, "LlmPausedError");
    assert.equal(err.code, "PAUSED");
    assert.ok(err instanceof Error);
  });
});

describe("PausedLlmProvider", () => {
  it("returns a PAUSED error without making any network call", async () => {
    const calls = installFetchTripwire();
    try {
      const provider = new PausedLlmProvider();
      const result = await provider.complete(REQUEST);
      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.error.code, "PAUSED");
      assert.equal(calls.count(), 0, "no fetch should be attempted");
    } finally {
      calls.restore();
    }
  });
});

describe("getLlmProvider() with the paused sentinel", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    saved.LLM_PROVIDER = process.env.LLM_PROVIDER;
    // Force the real selection path (not the test provider) with the sentinel.
    delete process.env.LLM_PROVIDER;
    process.env.ANTHROPIC_API_KEY = SENTINEL;
    resetLlmProviderForTests();
  });

  afterEach(() => {
    restoreEnv("ANTHROPIC_API_KEY", saved.ANTHROPIC_API_KEY);
    restoreEnv("LLM_PROVIDER", saved.LLM_PROVIDER);
    resetLlmProviderForTests();
  });

  it("short-circuits to PAUSED with no network round-trip", async () => {
    const calls = installFetchTripwire();
    try {
      const result = await getLlmProvider().complete(REQUEST);
      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.error.code, "PAUSED");
      assert.equal(
        calls.count(),
        0,
        "the doomed 401 round-trip must never be attempted",
      );
    } finally {
      calls.restore();
    }
  });
});

// ── helpers ──────────────────────────────────────────────────────────────

/** Replace global.fetch with a throwing spy so any attempted network call
 *  both fails loudly AND is counted. Returns a count() + restore(). */
function installFetchTripwire(): { count(): number; restore(): void } {
  const original = globalThis.fetch;
  let n = 0;
  globalThis.fetch = ((...args: unknown[]) => {
    n += 1;
    throw new Error(
      `unexpected network call during paused short-circuit: ${String(args[0])}`,
    );
  }) as unknown as typeof fetch;
  return {
    count: () => n,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
