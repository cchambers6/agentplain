/**
 * lib/llm/key-rotation-provider.test.ts
 *
 * Self-healing Anthropic key rotation. Bar: when the primary key dies the
 * customer does NOT see the blip (we fail over to the secondary and stay
 * there); when BOTH keys are dead we degrade to the calm PAUSED copy AND page
 * a human with a 24h deadline naming which keys failed.
 *
 * Tests run against FAKE providers + a fake pager — the live primary key is
 * sentinel-paused in prod, so the mechanism is exercised on fakes by design.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { KeyRotationLlmProvider, isKeyFailure } from "./key-rotation-provider";
import {
  llmOk,
  llmError,
  type LlmCompletion,
  type LlmCompletionRequest,
  type LlmProvider,
  type LlmResult,
} from "./types";
import type { PageHumanInput } from "../ops/page-human";

const REQUEST: LlmCompletionRequest = {
  system: "you are Plaino",
  messages: [{ role: "user", content: "hi" }],
};

function completion(text: string): LlmCompletion {
  return { text, stopReason: "end_turn", usage: null, model: "fake" };
}

/** A scriptable fake provider: each `complete()` returns the next queued
 *  result, or repeats the last one. Records call count. */
class ScriptedProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  calls = 0;
  constructor(private readonly script: Array<LlmResult<LlmCompletion>>) {}
  async complete(): Promise<LlmResult<LlmCompletion>> {
    const idx = Math.min(this.calls, this.script.length - 1);
    this.calls += 1;
    return this.script[idx];
  }
}

/** Records every page so tests can assert severity/summary/deadline. */
function fakePager() {
  const pages: PageHumanInput[] = [];
  const fn = async (input: PageHumanInput) => {
    pages.push(input);
    return {
      delivered: true,
      recipients: ["ops@agentplain.com"],
      usedFallbackRecipient: false,
      persisted: true,
      auditLogId: "audit_1",
    };
  };
  return { pages, fn };
}

const AUTH = llmError("AUTHENTICATION", "invalid x-api-key", { status: 401 });
const RATE = llmError("RATE_LIMITED", "rate limited", { status: 429 });
const NET = llmError("NETWORK", "socket hang up");

describe("isKeyFailure", () => {
  it("treats 401/403 and 429 as key failures", () => {
    assert.equal(isKeyFailure(AUTH.error), true);
    assert.equal(isKeyFailure(RATE.error), true);
  });
  it("treats a quota/credit INVALID_ARGUMENT as a key failure", () => {
    assert.equal(
      isKeyFailure(llmError("INVALID_ARGUMENT", "credit balance too low").error),
      true,
    );
  });
  it("does NOT fail over on a transient network error", () => {
    assert.equal(isKeyFailure(NET.error), false);
  });
});

describe("KeyRotationLlmProvider — primary healthy", () => {
  it("serves on the primary and never builds the secondary", async () => {
    let secondaryBuilt = false;
    const primary = new ScriptedProvider([llmOk(completion("primary"))]);
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => {
        secondaryBuilt = true;
        return new ScriptedProvider([llmOk(completion("secondary"))]);
      },
    });
    const r = await rot.complete(REQUEST);
    assert.equal(r.ok && r.value.text, "primary");
    assert.equal(secondaryBuilt, false, "secondary not built when primary OK");
    assert.equal(rot.isServingOnSecondary, false);
  });
});

describe("KeyRotationLlmProvider — failover (the no-blip path)", () => {
  it("primary 401 → secondary serves, customer sees no error, becomes sticky", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const secondary = new ScriptedProvider([llmOk(completion("secondary"))]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: pager.fn as any,
    });

    const r1 = await rot.complete(REQUEST);
    assert.equal(r1.ok, true, "customer gets a real completion, not an error");
    assert.equal(r1.ok && r1.value.text, "secondary");
    assert.equal(rot.isServingOnSecondary, true, "sticky on secondary");
    assert.equal(pager.pages.length, 0, "no page on a successful failover");

    // Next call goes straight to the secondary (sticky) — primary not re-hit.
    const callsBefore = primary.calls;
    const r2 = await rot.complete(REQUEST);
    assert.equal(r2.ok && r2.value.text, "secondary");
    assert.equal(primary.calls, callsBefore, "primary not re-called while sticky");
  });

  it("primary 429 also fails over to the secondary", async () => {
    const primary = new ScriptedProvider([RATE]);
    const secondary = new ScriptedProvider([llmOk(completion("secondary"))]);
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: fakePager().fn as any,
    });
    const r = await rot.complete(REQUEST);
    assert.equal(r.ok && r.value.text, "secondary");
  });

  it("recovers to the primary when the sticky secondary later fails but primary is healthy", async () => {
    // Primary: 401 first (forces failover), then healthy on the re-probe.
    const primary = new ScriptedProvider([AUTH, llmOk(completion("primary-back"))]);
    // Secondary: serves once, then dies.
    const secondary = new ScriptedProvider([llmOk(completion("sec")), AUTH]);
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: fakePager().fn as any,
    });

    await rot.complete(REQUEST); // fails over → sticky on secondary
    assert.equal(rot.isServingOnSecondary, true);

    const r2 = await rot.complete(REQUEST); // secondary dies, primary recovered
    assert.equal(r2.ok && r2.value.text, "primary-back");
    assert.equal(rot.isServingOnSecondary, false, "un-sticky after recovery");
  });
});

describe("KeyRotationLlmProvider — both dead (degrade + page)", () => {
  it("no secondary configured → PAUSED + critical page naming the missing secondary", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => null,
      page: pager.fn as any,
    });

    const r = await rot.complete(REQUEST);
    // Degrades EXACTLY like the paused path — calm PAUSED, never a raw 401.
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error.code, "PAUSED");

    assert.equal(pager.pages.length, 1);
    assert.equal(pager.pages[0].severity, "critical");
    assert.match(pager.pages[0].summary, /no secondary configured/i);
    assert.match(pager.pages[0].details, /NOT CONFIGURED/);
    assert.equal(pager.pages[0].source, "llm-key-rotation");
    // 24h deadline present.
    assert.ok(pager.pages[0].deadline instanceof Date);
  });

  it("secondary also failing → PAUSED + critical page naming both keys", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const secondary = new ScriptedProvider([AUTH]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: pager.fn as any,
    });

    const r = await rot.complete(REQUEST);
    assert.equal(r.ok === false && r.error.code, "PAUSED");
    assert.equal(pager.pages.length, 1);
    assert.match(pager.pages[0].summary, /primary AND secondary/i);
    assert.match(pager.pages[0].details, /Primary key/);
    assert.match(pager.pages[0].details, /Secondary key/);
  });

  it("coalesces pages so a burst of failures does not spam the human", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => null,
      page: pager.fn as any,
      pageCoalesceMs: 60_000,
    });
    await rot.complete(REQUEST);
    await rot.complete(REQUEST);
    await rot.complete(REQUEST);
    assert.equal(pager.pages.length, 1, "only one page within the coalesce window");
  });
});

describe("KeyRotationLlmProvider — pass-through cases", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved;
  });

  it("kill switch (enabled:false) passes straight through to the primary", async () => {
    const primary = new ScriptedProvider([AUTH]);
    let secondaryBuilt = false;
    const rot = new KeyRotationLlmProvider(primary, {
      enabled: false,
      buildSecondary: () => {
        secondaryBuilt = true;
        return new ScriptedProvider([llmOk(completion("sec"))]);
      },
    });
    const r = await rot.complete(REQUEST);
    assert.equal(r.ok === false && r.error.code, "AUTHENTICATION");
    assert.equal(secondaryBuilt, false);
  });

  it("a paused-sentinel primary short-circuits to the primary (Sentinel owns it)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-PAUSED-2026-06-02-restore";
    const primary = new ScriptedProvider([llmError("PAUSED", "paused")]);
    let secondaryBuilt = false;
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => {
        secondaryBuilt = true;
        return new ScriptedProvider([llmOk(completion("sec"))]);
      },
    });
    const r = await rot.complete(REQUEST);
    assert.equal(r.ok === false && r.error.code, "PAUSED");
    assert.equal(secondaryBuilt, false, "do not fail over a deliberately paused key");
  });

  it("a transient NETWORK error on the primary surfaces (no failover)", async () => {
    const primary = new ScriptedProvider([NET]);
    let secondaryBuilt = false;
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => {
        secondaryBuilt = true;
        return new ScriptedProvider([llmOk(completion("sec"))]);
      },
    });
    const r = await rot.complete(REQUEST);
    assert.equal(r.ok === false && r.error.code, "NETWORK");
    assert.equal(secondaryBuilt, false, "transient outage is not a key failure");
  });
});
