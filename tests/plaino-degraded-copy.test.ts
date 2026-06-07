/**
 * tests/plaino-degraded-copy.test.ts
 *
 * The no-jargon snapshot. Plaino's failure copy is customer-facing on the
 * public marketing site — it must never read like an HTTP stack trace
 * (the PR #154 bug: "something went wrong reaching the line"). This pins
 * two invariants so a future edit can't quietly regress:
 *   1. Zero engineering-internal phrasing in any degraded string.
 *   2. Every degraded string leads into the email hand-off — a bot failure
 *      is a lead-capture opportunity, not a dead end.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLAINO_DEGRADED_STRINGS,
  PLAINO_PAUSED_REPLY,
  PLAINO_TRANSIENT_REPLY,
  PLAINO_NETWORK_REPLY,
} from "@/lib/plaino/degraded-copy";

// Substrings that signal we leaked the machine layer to the customer.
const BANNED = [
  "line",
  "reaching",
  "endpoint",
  "api",
  "stack",
  "http",
  "500",
  "request",
  "fetch",
  "server",
  "token",
  "anthropic",
];

describe("Plaino degraded copy — no dev jargon", () => {
  for (const text of PLAINO_DEGRADED_STRINGS) {
    it(`contains no engineering-internal phrasing: "${text.slice(0, 32)}…"`, () => {
      const lower = text.toLowerCase();
      for (const term of BANNED) {
        assert.ok(
          !lower.includes(term),
          `degraded copy leaked dev jargon "${term}": ${text}`,
        );
      }
    });

    it(`leads into the email hand-off: "${text.slice(0, 32)}…"`, () => {
      assert.match(text, /email/i);
    });
  }

  it("exposes the three expected states", () => {
    assert.equal(PLAINO_DEGRADED_STRINGS.length, 3);
    assert.ok(PLAINO_DEGRADED_STRINGS.includes(PLAINO_PAUSED_REPLY));
    assert.ok(PLAINO_DEGRADED_STRINGS.includes(PLAINO_TRANSIENT_REPLY));
    assert.ok(PLAINO_DEGRADED_STRINGS.includes(PLAINO_NETWORK_REPLY));
  });

  it("paused copy promises a same-day human follow-up (not a retry)", () => {
    assert.match(PLAINO_PAUSED_REPLY, /same day/i);
    assert.match(PLAINO_PAUSED_REPLY, /person will follow up/i);
  });
});
