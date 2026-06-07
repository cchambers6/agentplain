/**
 * tests/plaino-chat-paused.test.ts
 *
 * Route-level coverage for the paused-spend state on the Plaino front door.
 * With `ANTHROPIC_API_KEY` set to the `sk-ant-PAUSED-…` sentinel, the
 * marketing widget's POST must come back:
 *   - 200 (never a 500 — the customer must not see a stack trace),
 *   - reply === the on-brand paused copy (a same-day human follow-up),
 *   - expandLeadCapture === true (auto-open the email hand-off),
 *   - degraded === true.
 *
 * This is the regression guard for the PR #154 prod bug: the dead chat that
 * showed "something went wrong reaching the line."
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resetLlmProviderForTests } from "@/lib/llm";
import { PLAINO_PAUSED_REPLY } from "@/lib/plaino/degraded-copy";

const SENTINEL = "sk-ant-PAUSED-2026-06-02-conner-restore-when-back";

function marketingRequest(body: string): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "marketing",
      messages: [{ role: "user", body }],
      sessionId: "test-session",
      sourcePage: "/",
    }),
  });
}

describe("POST /api/chat (marketing) — paused sentinel", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    saved.LLM_PROVIDER = process.env.LLM_PROVIDER;
    delete process.env.LLM_PROVIDER; // force the real selection path
    process.env.ANTHROPIC_API_KEY = SENTINEL;
    resetLlmProviderForTests();
  });

  afterEach(() => {
    restoreEnv("ANTHROPIC_API_KEY", saved.ANTHROPIC_API_KEY);
    restoreEnv("LLM_PROVIDER", saved.LLM_PROVIDER);
    resetLlmProviderForTests();
  });

  it("returns 200 with the on-brand paused reply + lead-capture expand", async () => {
    const route = await import("@/app/api/chat/route");
    const res = await route.POST(marketingRequest("What do you do"));

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      reply: string;
      degraded: boolean;
      expandLeadCapture: boolean;
    };
    assert.equal(body.ok, true);
    assert.equal(body.reply, PLAINO_PAUSED_REPLY);
    assert.equal(body.degraded, true);
    assert.equal(body.expandLeadCapture, true);
    // The leaked dev-jargon string must be gone.
    assert.doesNotMatch(body.reply, /reaching the line|something went wrong/i);
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
