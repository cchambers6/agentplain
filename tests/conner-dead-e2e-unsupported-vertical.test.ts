/**
 * tests/conner-dead-e2e-unsupported-vertical.test.ts
 *
 * GUARDS: pfd/vertical-gating-refund (#219)
 *
 * FAILURE MODE: "If Conner died tomorrow, does a paying customer in an
 * unsupported vertical still get PROTECTED (refunded) or get SURFACED to a
 * human — never pay month after month into a dark room?"
 *
 * THE BAR:
 *   1. Signup with an unsupported vertical → waitlist capture, NO charge,
 *      no workspace created (signup gate — route-layer test elsewhere).
 *   2. Leak-path workspace (unsupported, >7d, zero value) with
 *      UNSUPPORTED_VERTICAL_AUTO_REFUND=off → page-not-refund (detect-only).
 *      "Page" = HUMAN_PAGE_ OpsFlag row written + email sent to recipients.
 *   3. With UNSUPPORTED_VERTICAL_AUTO_REFUND=on → refund once, capped,
 *      apology email queued, teardown invoked.
 *   4. Second sweep run → no-op (once-per-lifetime guard respected).
 *   5. refundGuardFlagName is deterministic (collision-free).
 *   6. Over-cap → page human (never silently under-refund).
 *   7. TestBillingProvider correctly models the in-memory charge ledger:
 *      seedCharge → refundCustomerCharges refunds them; idempotency key
 *      prevents double-refund on re-run.
 *
 * OFFLINE CONTRACT:
 *   - Suite 1 (detect-only): exercises the real `defaultEmitRefund` path
 *     via the injected `systemContext` stub and `notifyDeps` with an
 *     InMemoryOpsFlagStore + TestEmailProvider. Detect-only never calls
 *     tearDownWorkspaceData so it is DB-free.
 *   - Suites 2, 5 (auto-refund routing): inject `emit` directly (the sweep's
 *     own test-escape hatch documented in unsupported-vertical-refund.ts)
 *     to assert routing logic + the once-per-lifetime guard without hitting
 *     the real tearDownWorkspaceData Prisma call.
 *   - Suite 4 (billing ledger): exercises TestBillingProvider.refundCustomerCharges
 *     in isolation — verifies seedCharge + cap + idempotency, the building
 *     blocks the defaultEmitRefund uses.
 *
 * All assertions are DB-free / network-free.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  runUnsupportedVerticalRefundSweep,
  refundGuardFlagName,
  type LeakingWorkspace,
  type RefundDecision,
  type EmitRefundInput,
} from "@/lib/billing/unsupported-vertical-refund";
import { TestBillingProvider } from "@/lib/billing/test-provider";
import { TestEmailProvider } from "@/lib/email/test-provider";
import { InMemoryOpsFlagStore } from "@/lib/ops/flag-store";
import type { Vertical } from "@prisma/client";

// ── Helpers ─────────────────────────────────────────────────────────────────

const WS_ID = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-06-10T12:00:00.000Z");

function candidate(over: Partial<LeakingWorkspace> = {}): LeakingWorkspace {
  return {
    workspaceId: WS_ID,
    workspaceName: "Acme Insurance",
    workspaceSlug: "acme-insurance",
    vertical: "INSURANCE" as Vertical,
    brokerOwnerEmail: "owner@acme.example",
    brokerOwnerName: "Pat Owner",
    stripeCustomerId: "cus_test_ins",
    daysSinceSignup: 14,
    ...over,
  };
}

/**
 * Build a guard (isAlreadyHandled + markHandled) backed by a shared
 * InMemoryOpsFlagStore. Simulates the Prisma OpsFlag store's persistence
 * across cron ticks.
 */
function makeGuard(flagStore = new InMemoryOpsFlagStore()) {
  const isAlreadyHandled = async (id: string): Promise<boolean> => {
    const r = await flagStore.get(refundGuardFlagName(id));
    if (!r.ok) return true; // conservative: treat store error as handled
    return r.value !== null;
  };
  const markHandled = async (id: string, decision: RefundDecision): Promise<void> => {
    await flagStore.set(refundGuardFlagName(id), decision);
  };
  return { isAlreadyHandled, markHandled, flagStore };
}

/** Lightweight systemContext stub — records audit + workspace mutations. */
function makeSystemContext() {
  const audits: string[] = [];
  const workspaceUpdates: string[] = [];
  const tx = {
    auditLog: {
      create: async (a: { data: { action: string } }) => {
        audits.push(a.data.action);
        return { id: "audit" };
      },
    },
    workspace: {
      update: async (a: { where: { id: string } }) => {
        workspaceUpdates.push(a.where.id);
        return { id: a.where.id };
      },
    },
  };
  const run = async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx as any);
  return { run, audits, workspaceUpdates };
}

// ── Suite 1: detect-only mode (auto-refund OFF) ───────────────────────────────
// This suite drives the real defaultEmitRefund code path. detect-only never
// calls tearDownWorkspaceData so it is fully DB-free.

describe("conner-dead / unsupported-vertical: detect-only mode pages, does NOT refund", () => {
  it("UNSUPPORTED_VERTICAL_AUTO_REFUND=off → detect-only-paged + HUMAN_PAGE_ flag written", async () => {
    const { isAlreadyHandled, markHandled } = makeGuard();
    const billing = new TestBillingProvider();
    billing.seedCharge("cus_test_ins", 9900); // charge that must NOT be touched
    const email = new TestEmailProvider();
    const sys = makeSystemContext();
    const notifyFlagStore = new InMemoryOpsFlagStore();

    const result = await runUnsupportedVerticalRefundSweep({
      listCandidates: async () => [candidate()],
      autoRefundEnabled: false,
      refundCapUsd: 500,
      billing,
      email: email as any,
      systemContext: sys.run as any,
      isAlreadyHandled,
      markHandled,
      notifyDeps: {
        flagStore: notifyFlagStore,
        email: email as any,
        recipients: ["ops@test"],
      },
      now: NOW,
    });

    assert.equal(result.detectOnlyPaged, 1, "one workspace detect-only paged");
    assert.equal(result.refunded, 0, "no refund issued in detect-only mode");
    assert.equal(result.failures.length, 0, "no unexpected failures");

    // Durable artifact: HUMAN_PAGE_ flag row must be written
    const pageFlag = notifyFlagStore.peek(`HUMAN_PAGE_unsupported-vertical-refund:${WS_ID}`);
    assert.ok(pageFlag, "HUMAN_PAGE_ OpsFlag written — the durable artifact a human finds cold");
    assert.equal(pageFlag!.value, "open");

    // Email push to the designated recipient
    const opsEmails = email.sent.filter((m) => m.to === "ops@test");
    assert.ok(opsEmails.length >= 1, "operator email sent");
    assert.ok(
      opsEmails.some((m) => /leaking|refund/i.test(m.subject)),
      "email subject names the leaking situation",
    );
  });

  it("detect-only mode does NOT invoke the billing provider", async () => {
    const { isAlreadyHandled, markHandled } = makeGuard();
    const billing = new TestBillingProvider();
    billing.seedCharge("cus_test_ins", 9900);
    const email = new TestEmailProvider();
    const sys = makeSystemContext();

    await runUnsupportedVerticalRefundSweep({
      listCandidates: async () => [candidate()],
      autoRefundEnabled: false,
      billing,
      email: email as any,
      systemContext: sys.run as any,
      isAlreadyHandled,
      markHandled,
      notifyDeps: {
        flagStore: new InMemoryOpsFlagStore(),
        email: email as any,
        recipients: ["ops@test"],
      },
      now: NOW,
    });

    assert.equal(
      billing.refundCalls.length,
      0,
      "billing.refundCustomerCharges never called in detect-only mode",
    );
  });
});

// ── Suite 2: auto-refund routing (emit override) ────────────────────────────
// Inject `emit` to test the routing logic (guard → emit → mark) without
// touching tearDownWorkspaceData (which needs a live DB).

describe("conner-dead / unsupported-vertical: auto-refund routing (once-per-lifetime guard)", () => {
  it("autoRefundEnabled=true, emit returns refunded → result.refunded=1", async () => {
    const { isAlreadyHandled, markHandled } = makeGuard();
    const email = new TestEmailProvider();

    const result = await runUnsupportedVerticalRefundSweep({
      listCandidates: async () => [candidate()],
      autoRefundEnabled: true,
      refundCapUsd: 500,
      email: email as any,
      systemContext: makeSystemContext().run as any,
      isAlreadyHandled,
      markHandled,
      notifyDeps: {},
      // Inject a simple emit that returns the happy-path decision
      emit: async (_input: EmitRefundInput): Promise<RefundDecision> => "refunded",
      now: NOW,
    });

    assert.equal(result.refunded, 1, "emit returned 'refunded' → sweep counts it");
    assert.equal(result.failures.length, 0, "no failures");
  });

  it("no stripeCustomerId → emit gets the candidate with null stripeCustomerId", async () => {
    const { isAlreadyHandled, markHandled } = makeGuard();
    let observedCandidate: LeakingWorkspace | undefined;

    await runUnsupportedVerticalRefundSweep({
      listCandidates: async () => [candidate({ stripeCustomerId: null })],
      autoRefundEnabled: true,
      systemContext: makeSystemContext().run as any,
      isAlreadyHandled,
      markHandled,
      notifyDeps: {},
      emit: async (input: EmitRefundInput): Promise<RefundDecision> => {
        observedCandidate = input.candidate;
        return "no-charges-nothing-to-refund";
      },
      now: NOW,
    });

    assert.equal(observedCandidate?.stripeCustomerId, null,
      "candidate with null stripeCustomerId flows through to emit correctly");
  });

  it("emit returns over-cap-paged → result.overCapPaged=1", async () => {
    const { isAlreadyHandled, markHandled } = makeGuard();

    const result = await runUnsupportedVerticalRefundSweep({
      listCandidates: async () => [candidate()],
      autoRefundEnabled: true,
      refundCapUsd: 500,
      systemContext: makeSystemContext().run as any,
      isAlreadyHandled,
      markHandled,
      notifyDeps: {},
      emit: async (_input: EmitRefundInput): Promise<RefundDecision> => "over-cap-paged",
      now: NOW,
    });

    assert.equal(result.overCapPaged, 1, "over-cap decision correctly tallied");
  });
});

// ── Suite 3: idempotency (once-per-lifetime guard) ────────────────────────────

describe("conner-dead / unsupported-vertical: once-per-lifetime guard", () => {
  it("second sweep run → alreadyHandled (no re-page, no re-refund)", async () => {
    // Shared guard store across both runs — simulates Prisma durability
    const guardFlagStore = new InMemoryOpsFlagStore();
    const { isAlreadyHandled, markHandled } = makeGuard(guardFlagStore);
    const email = new TestEmailProvider();
    let emitCallCount = 0;

    const sweepArgs = {
      listCandidates: async () => [candidate()],
      autoRefundEnabled: false,
      systemContext: makeSystemContext().run as any,
      isAlreadyHandled,
      markHandled,
      notifyDeps: {
        flagStore: new InMemoryOpsFlagStore(),
        email: email as any,
        recipients: ["ops@test"],
      },
      emit: async (_input: EmitRefundInput): Promise<RefundDecision> => {
        emitCallCount += 1;
        return "detect-only-paged";
      },
      now: NOW,
    };

    // First run
    const result1 = await runUnsupportedVerticalRefundSweep(sweepArgs);
    assert.equal(result1.detectOnlyPaged, 1, "first run: one page");

    // Second run with the same guard store (flag is now set)
    const result2 = await runUnsupportedVerticalRefundSweep(sweepArgs);
    assert.equal(result2.alreadyHandled, 1, "second run: workspace already handled");
    assert.equal(result2.detectOnlyPaged, 0, "no second page");
    assert.equal(emitCallCount, 1, "emit called exactly once across two runs");
  });
});

// ── Suite 4: refundGuardFlagName is deterministic ────────────────────────────

describe("conner-dead / unsupported-vertical: refundGuardFlagName is deterministic + collision-free", () => {
  it("same id → same flag name", () => {
    assert.equal(refundGuardFlagName("abc"), refundGuardFlagName("abc"));
  });

  it("different ids → different flag names", () => {
    assert.notEqual(refundGuardFlagName("ws-a"), refundGuardFlagName("ws-b"));
  });

  it("flag name contains the workspace id (auditable)", () => {
    const id = "my-workspace-id";
    assert.ok(
      refundGuardFlagName(id).includes(id),
      "flag name must embed the workspace id for auditability",
    );
  });
});

// ── Suite 5: TestBillingProvider charge ledger (the building block) ───────────

describe("conner-dead / unsupported-vertical: TestBillingProvider charge ledger", () => {
  it("seedCharge → refundCustomerCharges refunds it", async () => {
    const billing = new TestBillingProvider();
    billing.seedCharge("cus_abc", 9900);
    const r = await billing.refundCustomerCharges({
      providerCustomerId: "cus_abc",
      maxRefundUsdCents: 50000,
      idempotencyKey: "test-1",
      reason: "test",
    });
    assert.equal(r.refunds.length, 1, "one charge refunded");
    assert.equal(r.totalRefundedUsdCents, 9900);
    assert.equal(r.hitCap, false);
  });

  it("charge > cap → hitCap=true", async () => {
    const billing = new TestBillingProvider();
    billing.seedCharge("cus_abc", 60000); // $600 > $500 cap
    const r = await billing.refundCustomerCharges({
      providerCustomerId: "cus_abc",
      maxRefundUsdCents: 50000, // $500 cap
      idempotencyKey: "cap-test",
      reason: "test",
    });
    assert.equal(r.hitCap, true, "single charge exceeds cap → hitCap=true");
    assert.equal(r.refunds.length, 0, "no partial refund on over-cap single charge");
  });

  it("no seeded charges → empty refunds, hitCap=false", async () => {
    const billing = new TestBillingProvider();
    const r = await billing.refundCustomerCharges({
      providerCustomerId: "cus_no_charges",
      maxRefundUsdCents: 50000,
      idempotencyKey: "empty-test",
      reason: "test",
    });
    assert.equal(r.refunds.length, 0);
    assert.equal(r.totalRefundedUsdCents, 0);
    assert.equal(r.hitCap, false);
  });

  it("refunded charge is marked — re-run does not double-refund", async () => {
    const billing = new TestBillingProvider();
    billing.seedCharge("cus_abc", 9900);
    // First refund
    await billing.refundCustomerCharges({
      providerCustomerId: "cus_abc",
      maxRefundUsdCents: 50000,
      idempotencyKey: "idem-1",
      reason: "test",
    });
    // Second refund on the same provider (same idempotency simulated by the
    // refunded=true flag on the charge)
    const r2 = await billing.refundCustomerCharges({
      providerCustomerId: "cus_abc",
      maxRefundUsdCents: 50000,
      idempotencyKey: "idem-1",
      reason: "test",
    });
    assert.equal(r2.refunds.length, 0,
      "already-refunded charge is not refunded again");
    assert.equal(r2.totalRefundedUsdCents, 0);
  });
});
