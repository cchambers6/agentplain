import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  decideRetry,
  readyForProcessingFilter,
} from "@/lib/integrations/webhook-idempotency";

// upsertWebhookEvent itself talks to the live DB via prisma; its happy
// path is exercised in the route-level test (stripe-webhook-route.test.ts
// pattern). The PURE policy code is what matters most for production
// correctness and is what we pin down here.

describe("decideRetry — exponential backoff schedule", () => {
  const NOW = new Date("2026-05-24T12:00:00.000Z");

  it("attempt 1 (just failed) waits 1 minute", () => {
    const d = decideRetry({ attemptCount: 1, now: NOW });
    assert.equal(d.retryable, true);
    assert.equal(d.deadletter, false);
    assert.ok(d.nextAttemptAt);
    assert.equal(
      d.nextAttemptAt!.getTime() - NOW.getTime(),
      1 * 60 * 1000,
    );
  });

  it("attempt 2 waits 5 minutes", () => {
    const d = decideRetry({ attemptCount: 2, now: NOW });
    assert.equal(d.nextAttemptAt!.getTime() - NOW.getTime(), 5 * 60 * 1000);
  });

  it("attempt 3 waits 30 minutes", () => {
    const d = decideRetry({ attemptCount: 3, now: NOW });
    assert.equal(d.nextAttemptAt!.getTime() - NOW.getTime(), 30 * 60 * 1000);
  });

  it("attempt 4 waits 2 hours", () => {
    const d = decideRetry({ attemptCount: 4, now: NOW });
    assert.equal(
      d.nextAttemptAt!.getTime() - NOW.getTime(),
      120 * 60 * 1000,
    );
  });

  it("attempt 5 waits 6 hours", () => {
    const d = decideRetry({ attemptCount: 5, now: NOW });
    assert.equal(
      d.nextAttemptAt!.getTime() - NOW.getTime(),
      360 * 60 * 1000,
    );
  });

  it("attempt 6 deadletters — no further retries", () => {
    const d = decideRetry({ attemptCount: 6, now: NOW });
    assert.equal(d.retryable, false);
    assert.equal(d.deadletter, true);
    assert.equal(d.nextAttemptAt, null);
  });

  it("very high attemptCount stays deadlettered (no negative-index drift)", () => {
    const d = decideRetry({ attemptCount: 100, now: NOW });
    assert.equal(d.retryable, false);
    assert.equal(d.deadletter, true);
  });

  it("attempt 0 (defensive) maps to the first wait window", () => {
    const d = decideRetry({ attemptCount: 0, now: NOW });
    // We clamp idx to 0, so attempt 0 behaves like attempt 1 — 1 minute
    // wait. The drain consumer never passes 0 in production, but the
    // clamp prevents an unhandled error if it ever does.
    assert.equal(d.retryable, true);
    assert.equal(d.deadletter, false);
    assert.equal(
      d.nextAttemptAt!.getTime() - NOW.getTime(),
      1 * 60 * 1000,
    );
  });
});

describe("readyForProcessingFilter", () => {
  it("excludes processed + deadlettered rows", () => {
    const now = new Date("2026-05-24T12:00:00.000Z");
    const filter = readyForProcessingFilter(now);
    assert.equal(filter.processed, false);
    assert.equal(filter.deadlettered, false);
  });

  it("admits rows with no nextAttemptAt OR nextAttemptAt in the past", () => {
    const now = new Date("2026-05-24T12:00:00.000Z");
    const filter = readyForProcessingFilter(now);
    assert.ok(Array.isArray(filter.OR));
    assert.equal((filter.OR as { nextAttemptAt: unknown }[]).length, 2);
    const [a, b] = filter.OR as Array<Record<string, unknown>>;
    assert.equal(a!.nextAttemptAt, null);
    assert.deepEqual(b!.nextAttemptAt, { lt: now });
  });

  it("now defaults to current time when omitted", () => {
    const filter = readyForProcessingFilter();
    const arr = filter.OR as Array<Record<string, unknown>>;
    const lt = (arr[1]!.nextAttemptAt as { lt: Date }).lt;
    // Sanity: within the last 10s.
    assert.ok(Date.now() - lt.getTime() < 10_000);
  });
});
