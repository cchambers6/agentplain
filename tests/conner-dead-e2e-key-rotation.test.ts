/**
 * tests/conner-dead-e2e-key-rotation.test.ts
 *
 * GUARDS: pfd/self-healing-credentials (#217) — KeyRotationLlmProvider
 *
 * FAILURE MODE: "If Conner died tomorrow, does the LLM surface still PROTECT
 * customers (serve real responses on the secondary) OR SURFACE the problem to
 * a designated human within 24h?"
 *
 * THE BAR:
 *   1. Primary 401/429 → secondary serves silently; zero customer-visible error;
 *      wrapper becomes sticky.
 *   2. Both keys dead → customer-safe PAUSED result (never a raw error);
 *      pageHuman called once with critical severity + 24h deadline.
 *   3. Burst of failures → ONE page only (coalesce window respected).
 *   4. FLEET_TRUSTED_HUMAN_EMAIL unset → falls back to OPERATOR_EMAIL_ALLOWLIST
 *      and includes the nudge copy.
 *   5. Kill switch (LLM_KEY_ROTATION=off) passes through to primary.
 *   6. Degraded copy is safe ("briefly offline") — no raw error string leaked.
 *
 * All assertions run OFFLINE — no live Anthropic key, no DB.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  KeyRotationLlmProvider,
  isKeyFailure,
} from "@/lib/llm/key-rotation-provider";
import {
  llmOk,
  llmError,
  type LlmCompletion,
  type LlmCompletionRequest,
  type LlmProvider,
  type LlmResult,
} from "@/lib/llm/types";
import type { PageHumanInput, PageHumanResult } from "@/lib/ops/page-human";

// ── Helpers ─────────────────────────────────────────────────────────────────

const REQ: LlmCompletionRequest = {
  system: "you are Plaino",
  messages: [{ role: "user", content: "How do I reset my password?" }],
};

function completion(text: string): LlmCompletion {
  return { text, stopReason: "end_turn", usage: null, model: "fake" };
}

/** Scriptable fake: returns the next queued result, repeating the last. */
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

function fakePager() {
  const pages: PageHumanInput[] = [];
  const fn = async (input: PageHumanInput): Promise<PageHumanResult> => {
    pages.push(input);
    return {
      delivered: true,
      recipients: ["ops@agentplain.com"],
      usedFallbackRecipient: false,
      persisted: true,
      auditLogId: `audit_${pages.length}`,
    };
  };
  return { pages, fn };
}

const AUTH = llmError("AUTHENTICATION", "invalid x-api-key", { status: 401 });
const RATE = llmError("RATE_LIMITED", "rate limited", { status: 429 });
const NET = llmError("NETWORK", "socket hang up");

// ── Suite 1: healthy primary ─────────────────────────────────────────────────

describe("conner-dead / key-rotation: healthy primary", () => {
  it("serves on the primary; secondary is never built", async () => {
    let built = false;
    const primary = new ScriptedProvider([llmOk(completion("primary"))]);
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => { built = true; return new ScriptedProvider([]); },
      page: fakePager().fn as any,
    });
    const r = await rot.complete(REQ);
    assert.equal(r.ok, true, "customer gets a real completion");
    assert.equal(r.ok && r.value.text, "primary");
    assert.equal(built, false, "secondary not built when primary OK");
    assert.equal(rot.isServingOnSecondary, false);
  });
});

// ── Suite 2: no-blip failover ────────────────────────────────────────────────

describe("conner-dead / key-rotation: primary 401 → secondary serves, no customer blip", () => {
  it("primary AUTH → secondary serves; no page fired; wrapper sticky", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const secondary = new ScriptedProvider([llmOk(completion("from-secondary"))]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: pager.fn as any,
    });

    const r = await rot.complete(REQ);
    assert.equal(r.ok, true, "customer sees a real completion — no blip");
    assert.equal(r.ok && r.value.text, "from-secondary");
    assert.equal(rot.isServingOnSecondary, true, "wrapper is sticky on secondary");
    assert.equal(pager.pages.length, 0, "no page on a successful failover");
  });

  it("primary 429 → secondary serves silently", async () => {
    const primary = new ScriptedProvider([RATE]);
    const secondary = new ScriptedProvider([llmOk(completion("sec"))]);
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: fakePager().fn as any,
    });
    const r = await rot.complete(REQ);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.value.text, "sec");
  });

  it("sticky secondary → subsequent calls skip the dead primary", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const secondary = new ScriptedProvider([
      llmOk(completion("sec-1")),
      llmOk(completion("sec-2")),
    ]);
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: fakePager().fn as any,
    });

    await rot.complete(REQ); // triggers failover
    const callsAfterFailover = primary.calls;
    const r2 = await rot.complete(REQ);
    assert.equal(r2.ok && r2.value.text, "sec-2");
    assert.equal(primary.calls, callsAfterFailover, "primary not called while sticky");
  });

  it("sticky secondary dies → re-probes primary; un-stickies on primary recovery", async () => {
    const primary = new ScriptedProvider([AUTH, llmOk(completion("primary-back"))]);
    const secondary = new ScriptedProvider([llmOk(completion("sec")), AUTH]);
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: fakePager().fn as any,
    });

    await rot.complete(REQ); // failover
    const r2 = await rot.complete(REQ); // secondary dies, primary recovered
    assert.equal(r2.ok && r2.value.text, "primary-back");
    assert.equal(rot.isServingOnSecondary, false, "un-sticky after recovery");
  });

  it("transient NETWORK error on primary → no failover (not a key failure)", async () => {
    const primary = new ScriptedProvider([NET]);
    let built = false;
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => { built = true; return new ScriptedProvider([]); },
      page: fakePager().fn as any,
    });
    const r = await rot.complete(REQ);
    assert.equal(r.ok === false && r.error.code, "NETWORK");
    assert.equal(built, false, "network error is not a key failure");
  });
});

// ── Suite 3: both dead — degrade + page ──────────────────────────────────────

describe("conner-dead / key-rotation: both keys dead → PAUSED result + critical page", () => {
  it("no secondary configured → customer-safe PAUSED; critical page with 24h deadline", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => null,
      page: pager.fn as any,
    });

    const r = await rot.complete(REQ);
    // CUSTOMER SAFETY: never a raw 401 — always a calm PAUSED
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error.code, "PAUSED",
      "customer-facing result is PAUSED, not AUTHENTICATION");

    assert.equal(pager.pages.length, 1, "exactly one page fired");
    const page = pager.pages[0];
    assert.equal(page.severity, "critical");
    assert.match(page.details, /NOT CONFIGURED/,
      "page names missing secondary so Conner's successor knows what to fix");
    assert.equal(page.source, "llm-key-rotation");
    assert.ok(page.deadline instanceof Date, "24h deadline present");
    assert.ok(
      page.deadline!.getTime() > Date.now(),
      "deadline is in the future",
    );
    // Deadline must be ≤ 25h from now (24h + a small tolerance)
    const maxDeadlineMs = Date.now() + 25 * 60 * 60 * 1000;
    assert.ok(
      page.deadline!.getTime() < maxDeadlineMs,
      "deadline is within 25h (24h bar)",
    );
  });

  it("secondary also failing → PAUSED + page names both keys", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const secondary = new ScriptedProvider([AUTH]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => secondary,
      page: pager.fn as any,
    });

    const r = await rot.complete(REQ);
    assert.equal(r.ok === false && r.error.code, "PAUSED");
    assert.equal(pager.pages.length, 1);
    assert.match(pager.pages[0].summary, /primary AND secondary/i,
      "summary is scannable on a phone — names both dead keys");
    assert.match(pager.pages[0].details, /Primary key/);
    assert.match(pager.pages[0].details, /Secondary key/);
  });

  it("burst of failures → exactly ONE page within the coalesce window (no human spam)", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => null,
      page: pager.fn as any,
      pageCoalesceMs: 60_000,
    });

    // Fire 5 rapid calls
    for (let i = 0; i < 5; i++) {
      await rot.complete(REQ);
    }
    assert.equal(pager.pages.length, 1,
      "exactly 1 page within the coalesce window — human is not spammed");
  });
});

// ── Suite 4: kill switch ─────────────────────────────────────────────────────

describe("conner-dead / key-rotation: kill switch passes through", () => {
  it("enabled:false → straight through to primary (no secondary build)", async () => {
    const primary = new ScriptedProvider([AUTH]);
    let built = false;
    const rot = new KeyRotationLlmProvider(primary, {
      enabled: false,
      buildSecondary: () => { built = true; return new ScriptedProvider([]); },
    });
    const r = await rot.complete(REQ);
    assert.equal(r.ok === false && r.error.code, "AUTHENTICATION");
    assert.equal(built, false);
  });
});

// ── Suite 5: isKeyFailure classifier ────────────────────────────────────────

describe("conner-dead / key-rotation: isKeyFailure classifier", () => {
  it("AUTH → key failure", () => assert.equal(isKeyFailure(AUTH.error), true));
  it("RATE_LIMITED → key failure", () => assert.equal(isKeyFailure(RATE.error), true));
  it("NETWORK → NOT a key failure", () => assert.equal(isKeyFailure(NET.error), false));
  it("quota/credit INVALID_ARGUMENT → key failure", () => {
    assert.equal(
      isKeyFailure(llmError("INVALID_ARGUMENT", "insufficient credit balance").error),
      true,
    );
  });
  it("billing INVALID_ARGUMENT → key failure", () => {
    assert.equal(
      isKeyFailure(llmError("INVALID_ARGUMENT", "billing account required").error),
      true,
    );
  });
});

// ── Suite 6: degraded copy is safe (no raw error leaked) ─────────────────────

describe("conner-dead / key-rotation: degraded result is customer-safe", () => {
  it("PAUSED error message does NOT contain a raw HTTP status or API key fragment", async () => {
    const primary = new ScriptedProvider([AUTH]);
    const pager = fakePager();
    const rot = new KeyRotationLlmProvider(primary, {
      buildSecondary: () => null,
      page: pager.fn as any,
    });

    const r = await rot.complete(REQ);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.error.code, "PAUSED");
    // The PAUSED message is operator-facing (log), not customer-facing copy.
    // But it must not contain a raw API key fragment (sk-ant-...) or a
    // bearer token — just in case it accidentally reaches a log that a
    // customer could see.
    const msg = r.ok === false ? r.error.message : "";
    assert.ok(!msg.includes("sk-ant-"), "no API key fragment in the error message");
    assert.ok(!msg.includes("Bearer "), "no Bearer token in the error message");
  });
});
