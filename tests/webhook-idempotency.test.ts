// IMPORTANT: install the fake prisma BEFORE any import that transitively
// loads `lib/db/prisma`. The fake registers on `globalThis.__agentplainPrisma`
// so the lazy-init singleton picks it up instead of constructing a real
// PrismaClient. Imports run in source order, so this side-effect import
// MUST precede the webhook-idempotency import below.
import {
  fakeWebhookPrismaState,
  resetFakeWebhookPrismaState,
} from "./fixtures/_install-fake-webhook-prisma";

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  decideRetry,
  readyForProcessingFilter,
  upsertWebhookEvent,
} from "@/lib/integrations/webhook-idempotency";

// upsertWebhookEvent's race-safe dupe path is unit-tested below against a
// scripted fake prisma. The pure policy code (decideRetry,
// readyForProcessingFilter) is also pinned here.

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

// =====================================================================
// upsertWebhookEvent — structural + behavioral regression for the
// race-safe dupe path.
//
// REGRESSION GUARDED HERE: a previous revision wrapped BOTH the
// `webhookEvent.create` AND the post-P2002 `webhookEvent.findUnique`
// inside a SINGLE `withSystemContext(...)` (i.e. inside one Postgres
// transaction). When the `create` throws P2002 inside a Postgres tx,
// the tx flips to the aborted state (SQLSTATE 25P02) and rejects every
// subsequent statement — so the `findUnique` no longer comes back as
// P2002; it surfaces a different error, `isPrismaUniqueViolation`
// doesn't catch it, the function throws, and the route returns 500 on
// EVERY at-least-once redelivery. Provider then retries → DLQ.
//
// HONEST LIMITATION: the fake prisma in
// tests/fixtures/_install-fake-webhook-prisma.ts has NO 25P02 semantics
// — it cannot reproduce the aborted-tx behavior, because that's purely
// a Postgres-runtime property. So the value of these tests is:
//   1. STRUCTURAL: count `$transaction` invocations on the dupe path
//      and assert there are TWO of them (not one). A nested re-fold
//      into a single transaction would fail this test.
//   2. BEHAVIORAL: assert the function still resolves to
//      {inserted:false, id:<existing>} when create simulates P2002.
//
// A real concurrent live-DB test (two parallel inserts racing on the
// (subscriptionId, dedupeKey) unique index against a real Postgres) is
// the ideal follow-up and is OUT OF SCOPE here — recommended in the
// fleet review report.
// =====================================================================

describe("upsertWebhookEvent — dedupe runs in TWO separate transactions", () => {
  const SUB_ID = 'sub_fixture';
  const WS_ID = 'ws_fixture';
  const DEDUPE = 'dedupe_fixture';

  beforeEach(() => {
    resetFakeWebhookPrismaState();
  });

  it("happy path: single $transaction, inserted=true", async () => {
    fakeWebhookPrismaState.nextCreateBehavior = 'success';
    const result = await upsertWebhookEvent({
      subscriptionId: SUB_ID,
      workspaceId: WS_ID,
      rawPayload: { hello: 'world' },
      dedupeKey: DEDUPE,
    });
    assert.equal(result.inserted, true);
    assert.equal(result.id, fakeWebhookPrismaState.createdId);
    // One create → one $transaction.
    assert.equal(fakeWebhookPrismaState.txInvocations.length, 1);
    assert.deepEqual(fakeWebhookPrismaState.txInvocations[0]!.ops, [
      'set_config',
      'create',
    ]);
  });

  it("dupe path (P2002): create + findUnique run in TWO separate $transaction calls", async () => {
    fakeWebhookPrismaState.nextCreateBehavior = 'p2002';
    const result = await upsertWebhookEvent({
      subscriptionId: SUB_ID,
      workspaceId: WS_ID,
      rawPayload: { hello: 'world' },
      dedupeKey: DEDUPE,
    });
    assert.equal(result.inserted, false);
    assert.equal(result.id, fakeWebhookPrismaState.existingId);

    // STRUCTURAL ASSERTION (the load-bearing one).
    // The dupe path must NOT nest create+findUnique inside one tx — see
    // the regression note above the describe block.
    assert.equal(
      fakeWebhookPrismaState.txInvocations.length,
      2,
      'expected the dupe path to use two separate $transaction invocations (one for create, one for findUnique); a single nested transaction triggers the 25P02 aborted-tx regression in production',
    );
    // First tx: the create attempt, which threw. set_config was the first
    // statement (RLS GUC seed), then create raised P2002.
    assert.deepEqual(fakeWebhookPrismaState.txInvocations[0]!.ops, [
      'set_config',
      'create',
    ]);
    assert.equal(fakeWebhookPrismaState.txInvocations[0]!.threw, true);
    // Second tx: a FRESH operator transaction that resolves the existing
    // row. set_config seeds the GUC again before findUnique runs.
    assert.deepEqual(fakeWebhookPrismaState.txInvocations[1]!.ops, [
      'set_config',
      'findUnique',
    ]);
    assert.equal(fakeWebhookPrismaState.txInvocations[1]!.threw, false);
  });

  it("forwards (subscriptionId, workspaceId, dedupeKey) to the underlying create", async () => {
    fakeWebhookPrismaState.nextCreateBehavior = 'success';
    await upsertWebhookEvent({
      subscriptionId: SUB_ID,
      workspaceId: WS_ID,
      rawPayload: { ping: 1 },
      dedupeKey: DEDUPE,
    });
    const args = fakeWebhookPrismaState.lastCreateArgs!;
    assert.equal(args.data.subscriptionId, SUB_ID);
    assert.equal(args.data.workspaceId, WS_ID);
    assert.equal(args.data.dedupeKey, DEDUPE);
    assert.equal(args.data.processed, false);
  });

  it("null dedupeKey path stays single-tx (no dedupe lookup needed)", async () => {
    fakeWebhookPrismaState.nextCreateBehavior = 'success';
    const result = await upsertWebhookEvent({
      subscriptionId: SUB_ID,
      workspaceId: WS_ID,
      rawPayload: { ping: 1 },
      dedupeKey: null,
    });
    assert.equal(result.inserted, true);
    assert.equal(fakeWebhookPrismaState.txInvocations.length, 1);
    // dedupeKey was not provided on the null path.
    assert.equal(
      fakeWebhookPrismaState.lastCreateArgs!.data.dedupeKey,
      undefined,
    );
  });

  it("dupe path where findUnique returns null surfaces a transient error", async () => {
    fakeWebhookPrismaState.nextCreateBehavior = 'p2002';
    fakeWebhookPrismaState.findReturnsNull = true;
    await assert.rejects(
      () =>
        upsertWebhookEvent({
          subscriptionId: SUB_ID,
          workspaceId: WS_ID,
          rawPayload: { ping: 1 },
          dedupeKey: DEDUPE,
        }),
      /unique violation but no row found/,
    );
    // Still goes through two separate $transaction calls before throwing.
    assert.equal(fakeWebhookPrismaState.txInvocations.length, 2);
  });
});
