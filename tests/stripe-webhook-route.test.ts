import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dispatchEvent,
  mirrorInvoice,
  type StripeWebhookEvent,
} from "@/lib/billing/webhook-dispatch";
import type { DbTransactionClient } from "@/lib/db";

// Minimal in-memory tx double — covers only the methods the dispatch path
// touches. Cast to DbTransactionClient at the call site because Prisma's
// real TransactionClient surface is huge and dispatch only consumes a tiny
// subset; recording-fake parity is all the test needs.
interface RecordedAuditLog {
  action: string;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  workspaceId?: string | null;
}

interface RecordedInvoiceUpsert {
  stripeInvoiceId: string;
  workspaceId: string;
  status: string;
}

interface FakeTx {
  workspace: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  auditLog: { create: (args: { data: RecordedAuditLog }) => Promise<void> };
  workspaceInvoice: {
    upsert: (args: {
      where: { stripeInvoiceId: string };
      create: { workspaceId: string; stripeInvoiceId: string; status: string };
    }) => Promise<void>;
  };
  audits: RecordedAuditLog[];
  invoices: RecordedInvoiceUpsert[];
}

const buildFakeTx = (workspaceMatch: { id: string } | null): FakeTx => {
  const audits: RecordedAuditLog[] = [];
  const invoices: RecordedInvoiceUpsert[] = [];
  return {
    audits,
    invoices,
    workspace: {
      findFirst: async () => workspaceMatch,
    },
    auditLog: {
      create: async ({ data }) => {
        audits.push(data);
      },
    },
    workspaceInvoice: {
      upsert: async ({ where, create }) => {
        invoices.push({
          stripeInvoiceId: where.stripeInvoiceId,
          workspaceId: create.workspaceId,
          status: create.status,
        });
      },
    },
  };
};

const buildInvoiceEvent = (
  customer: string,
  invoiceId = "in_test_1",
): StripeWebhookEvent => ({
  eventId: "evt_unmatched_42",
  eventType: "invoice.payment_failed",
  data: {
    object: {
      id: invoiceId,
      customer,
      amount_due: 49900,
      status: "open",
    },
  },
});

describe("stripe webhook dispatch", () => {
  it("writes a billing.event.received dedupe row when the customer is not tracked", async () => {
    // B4 regression: without the dedupe marker, Stripe's 72h retry loop
    // re-enters the unmatched-customer branch on every retry and writes
    // another billing.event.unmatched_customer audit row.
    const fake = buildFakeTx(null);
    const event = buildInvoiceEvent("cus_orphan_1");

    await mirrorInvoice(event, fake as unknown as DbTransactionClient);

    assert.equal(fake.invoices.length, 0, "no invoice should be mirrored");
    assert.equal(fake.audits.length, 2, "expected unmatched + dedupe rows");

    const unmatched = fake.audits.find(
      (a) => a.action === "billing.event.unmatched_customer",
    );
    assert.ok(unmatched, "unmatched_customer audit row must be written");
    assert.equal(unmatched.targetId, event.eventId);

    const dedupe = fake.audits.find(
      (a) => a.action === "billing.event.received",
    );
    assert.ok(dedupe, "dedupe billing.event.received row must be written");
    assert.equal(
      dedupe.targetId,
      event.eventId,
      "dedupe row must be keyed by Stripe event id so retries short-circuit",
    );
    assert.equal(
      (dedupe.payload as { outcome?: string }).outcome,
      "unmatched_customer",
    );
  });

  it("mirrors the invoice and writes a dedupe row when the customer is tracked", async () => {
    const fake = buildFakeTx({ id: "ws_1" });
    const event = buildInvoiceEvent("cus_known_1");

    await mirrorInvoice(event, fake as unknown as DbTransactionClient);

    assert.equal(fake.invoices.length, 1);
    assert.equal(fake.invoices[0].workspaceId, "ws_1");
    assert.equal(fake.invoices[0].stripeInvoiceId, "in_test_1");

    const dedupe = fake.audits.find(
      (a) => a.action === "billing.event.received",
    );
    assert.ok(dedupe, "matched-customer path also writes the dedupe row");
    assert.equal(dedupe.targetId, event.eventId);
    assert.equal(dedupe.workspaceId, "ws_1");

    const unmatched = fake.audits.find(
      (a) => a.action === "billing.event.unmatched_customer",
    );
    assert.equal(
      unmatched,
      undefined,
      "matched path must not write unmatched_customer",
    );
  });

  it("dispatchEvent writes a dedupe row for unhandled event types", async () => {
    const fake = buildFakeTx({ id: "ws_1" });
    const event: StripeWebhookEvent = {
      eventId: "evt_subscription_99",
      eventType: "customer.subscription.updated",
      data: { object: {} },
    };

    await dispatchEvent(event, fake as unknown as DbTransactionClient);

    assert.equal(fake.audits.length, 1);
    assert.equal(fake.audits[0].action, "billing.event.received");
    assert.equal(fake.audits[0].targetId, event.eventId);
  });

  it("ignores invoice events with no id or customer", async () => {
    const fake = buildFakeTx(null);
    const event: StripeWebhookEvent = {
      eventId: "evt_malformed_1",
      eventType: "invoice.created",
      data: { object: {} },
    };

    await mirrorInvoice(event, fake as unknown as DbTransactionClient);

    assert.equal(fake.audits.length, 0);
    assert.equal(fake.invoices.length, 0);
  });
});
