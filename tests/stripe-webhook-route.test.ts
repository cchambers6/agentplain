import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dispatchEvent,
  mirrorInvoice,
  type StripeWebhookEvent,
} from "@/lib/billing/webhook-dispatch";
import type { DbTransactionClient } from "@/lib/db";

// ---------------------------------------------------------------------
// Recording fake tx — only the methods dispatch touches. Cast to
// DbTransactionClient at the call site because Prisma's surface is huge
// and dispatch only consumes a tiny subset.
// ---------------------------------------------------------------------

interface RecordedAuditLog {
  action: string;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  workspaceId?: string | null;
}

interface RecordedSubscription {
  workspaceId: string;
  stripeSubscriptionId: string;
  status: string;
  tier: string;
  seatBand: string;
  seats: number;
}

interface RecordedBillingEvent {
  stripeEventId: string;
  type: string;
  workspaceId: string | null;
  subscriptionId: string | null;
}

interface FakeTx {
  audits: RecordedAuditLog[];
  subscriptions: RecordedSubscription[];
  workspaceInvoices: { stripeInvoiceId: string; workspaceId: string }[];
  billingEvents: RecordedBillingEvent[];
  workspaceUpdates: { id: string; data: Record<string, unknown> }[];
  workspace: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      verticalTier?: string;
    } | null>;
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
    } | null>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<void>;
  };
  subscription: {
    findUnique: (args: unknown) => Promise<{
      id: string;
      workspaceId?: string;
      status?: string;
    } | null>;
    upsert: (args: {
      where: { stripeSubscriptionId: string };
      create: RecordedSubscription;
      update: Partial<RecordedSubscription>;
    }) => Promise<{ id: string }>;
    update: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<void>;
  };
  workspaceInvoice: {
    upsert: (args: {
      where: { stripeInvoiceId: string };
      create: { workspaceId: string; stripeInvoiceId: string };
    }) => Promise<void>;
  };
  billingEvent: {
    upsert: (args: {
      where: { stripeEventId: string };
      create: Omit<RecordedBillingEvent, "id"> & { payload: unknown };
      update: Record<string, unknown>;
    }) => Promise<void>;
  };
  auditLog: { create: (args: { data: RecordedAuditLog }) => Promise<void> };
}

const buildFakeTx = (opts: {
  workspaceMatch?: {
    id: string;
    verticalTier?: string;
  } | null;
  workspaceById?: { id: string } | null;
  existingSubscription?: {
    id: string;
    workspaceId?: string;
    status?: string;
  } | null;
} = {}): FakeTx => {
  const fake: FakeTx = {
    audits: [],
    subscriptions: [],
    workspaceInvoices: [],
    billingEvents: [],
    workspaceUpdates: [],
    workspace: {
      findFirst: async () => opts.workspaceMatch ?? null,
      findUnique: async () => opts.workspaceById ?? null,
      update: async ({ where, data }) => {
        fake.workspaceUpdates.push({ id: where.id, data });
      },
    },
    subscription: {
      findUnique: async () => opts.existingSubscription ?? null,
      upsert: async ({ create }) => {
        fake.subscriptions.push(create);
        return { id: `sub-row-${fake.subscriptions.length}` };
      },
      update: async () => {},
    },
    workspaceInvoice: {
      upsert: async ({ where, create }) => {
        fake.workspaceInvoices.push({
          stripeInvoiceId: where.stripeInvoiceId,
          workspaceId: create.workspaceId,
        });
      },
    },
    billingEvent: {
      upsert: async ({ create }) => {
        fake.billingEvents.push({
          stripeEventId: create.stripeEventId,
          type: create.type,
          workspaceId: create.workspaceId,
          subscriptionId: create.subscriptionId,
        });
      },
    },
    auditLog: {
      create: async ({ data }) => {
        fake.audits.push(data);
      },
    },
  };
  return fake;
};

// ---------------------------------------------------------------------
// Subscription events
// ---------------------------------------------------------------------

describe("dispatchEvent — customer.subscription.created", () => {
  it("upserts a Subscription row when the customer is tracked", async () => {
    const fake = buildFakeTx({
      workspaceMatch: { id: "ws_1", verticalTier: "REGULAR" },
    });
    const event: StripeWebhookEvent = {
      eventId: "evt_sub_created_1",
      eventType: "customer.subscription.created",
      data: {
        object: {
          id: "sub_test_1",
          customer: "cus_test_1",
          status: "trialing",
          trial_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          cancel_at_period_end: false,
          items: {
            data: [
              {
                quantity: 1,
                price: {
                  id: "price_abc",
                  lookup_key: "agentplain_regular_seats_1_monthly",
                },
              },
            ],
          },
        },
      },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);

    assert.equal(fake.subscriptions.length, 1);
    assert.equal(fake.subscriptions[0].status, "TRIALING");
    assert.equal(fake.subscriptions[0].tier, "REGULAR");
    assert.equal(fake.subscriptions[0].seatBand, "SEATS_1");
    assert.equal(fake.billingEvents.length, 1);
    assert.equal(fake.billingEvents[0].stripeEventId, "evt_sub_created_1");
    assert.equal(
      fake.workspaceUpdates[0]?.data.billingMode,
      "STRIPE_SUBSCRIPTION",
    );
    assert.equal(
      fake.audits.find((a) => a.action === "billing.subscription.created")
        ?.workspaceId,
      "ws_1",
    );
  });

  it("logs unmatched-customer event without crashing", async () => {
    const fake = buildFakeTx({ workspaceMatch: null });
    const event: StripeWebhookEvent = {
      eventId: "evt_orphan",
      eventType: "customer.subscription.created",
      data: {
        object: {
          id: "sub_test_1",
          customer: "cus_orphan",
          status: "trialing",
          items: { data: [{ quantity: 1, price: { id: "p" } }] },
        },
      },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.subscriptions.length, 0);
    assert.equal(
      fake.audits.find((a) => a.action === "billing.event.unmatched_customer")
        ?.targetId,
      "evt_orphan",
    );
    assert.equal(fake.billingEvents.length, 1);
  });
});

describe("dispatchEvent — customer.subscription.trial_will_end", () => {
  it("treats trial_will_end as a sync (no special handler)", async () => {
    const fake = buildFakeTx({
      workspaceMatch: { id: "ws_1", verticalTier: "PLUS" },
    });
    const event: StripeWebhookEvent = {
      eventId: "evt_trial_will_end_1",
      eventType: "customer.subscription.trial_will_end",
      data: {
        object: {
          id: "sub_test_2",
          customer: "cus_test_1",
          status: "trialing",
          trial_end: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60,
          items: {
            data: [
              {
                quantity: 5,
                price: { lookup_key: "agentplain_plus_seats_2_9_monthly" },
              },
            ],
          },
        },
      },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.billingEvents[0].type, "customer.subscription.trial_will_end");
    assert.equal(fake.subscriptions[0].seatBand, "SEATS_2_9");
  });
});

describe("dispatchEvent — customer.subscription.deleted", () => {
  it("flips the Subscription to CANCELED when known", async () => {
    let updateCalled = false;
    const fake = buildFakeTx({
      existingSubscription: { id: "sub-row-1", workspaceId: "ws_1" },
    });
    fake.subscription.update = async ({ data }) => {
      updateCalled = true;
      assert.equal(data.status, "CANCELED");
    };
    const event: StripeWebhookEvent = {
      eventId: "evt_sub_deleted_1",
      eventType: "customer.subscription.deleted",
      data: { object: { id: "sub_test_1" } },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(updateCalled, true);
    assert.equal(
      fake.audits.find((a) => a.action === "billing.subscription.deleted")
        ?.workspaceId,
      "ws_1",
    );
  });

  it("records the event but doesn't update when subscription is unknown", async () => {
    const fake = buildFakeTx({ existingSubscription: null });
    const event: StripeWebhookEvent = {
      eventId: "evt_sub_deleted_2",
      eventType: "customer.subscription.deleted",
      data: { object: { id: "sub_unknown" } },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.billingEvents.length, 1);
    assert.equal(
      fake.audits.find((a) => a.action === "billing.subscription.deleted"),
      undefined,
    );
  });
});

// ---------------------------------------------------------------------
// Invoice events (retained Phase 1 path)
// ---------------------------------------------------------------------

describe("dispatchEvent — invoice events", () => {
  it("mirrors a paid invoice when the customer is tracked", async () => {
    const fake = buildFakeTx({ workspaceMatch: { id: "ws_1" } });
    const event: StripeWebhookEvent = {
      eventId: "evt_inv_paid_1",
      eventType: "invoice.paid",
      data: {
        object: {
          id: "in_test_1",
          customer: "cus_known_1",
          amount_paid: 19900,
          status: "paid",
          paid: true,
        },
      },
    };
    await mirrorInvoice(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.workspaceInvoices.length, 1);
    assert.equal(fake.workspaceInvoices[0].workspaceId, "ws_1");
    assert.equal(fake.billingEvents.length, 1);
  });

  it("writes the unmatched audit + billing event when customer is unknown", async () => {
    const fake = buildFakeTx({ workspaceMatch: null });
    const event: StripeWebhookEvent = {
      eventId: "evt_unmatched_42",
      eventType: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test_1",
          customer: "cus_orphan_1",
          amount_due: 49900,
          status: "open",
        },
      },
    };
    await mirrorInvoice(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.workspaceInvoices.length, 0);
    assert.equal(
      fake.audits.find((a) => a.action === "billing.event.unmatched_customer")
        ?.targetId,
      event.eventId,
    );
    assert.equal(fake.billingEvents[0]?.stripeEventId, event.eventId);
  });

  it("no-ops on invoice with no id or customer", async () => {
    const fake = buildFakeTx({ workspaceMatch: null });
    const event: StripeWebhookEvent = {
      eventId: "evt_malformed_1",
      eventType: "invoice.created",
      data: { object: {} },
    };
    await mirrorInvoice(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.audits.length, 0);
    assert.equal(fake.workspaceInvoices.length, 0);
    assert.equal(fake.billingEvents.length, 0);
  });
});

// ---------------------------------------------------------------------
// Unhandled events
// ---------------------------------------------------------------------

describe("dispatchEvent — unhandled events", () => {
  it("records a BillingEvent + audit dedupe row", async () => {
    const fake = buildFakeTx();
    const event: StripeWebhookEvent = {
      eventId: "evt_unknown",
      eventType: "setup_intent.succeeded",
      data: { object: {} },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.billingEvents.length, 1);
    assert.equal(fake.billingEvents[0].type, "setup_intent.succeeded");
    assert.equal(fake.audits.length, 1);
    assert.equal(fake.audits[0].action, "billing.event.received");
  });
});

// ---------------------------------------------------------------------
// Wave-2 CC-at-trial — paused subscription + checkout.session lifecycle
// ---------------------------------------------------------------------

describe("dispatchEvent — customer.subscription.paused (wave-2 enum fix)", () => {
  it("upserts the row as PAUSED without throwing", async () => {
    const fake = buildFakeTx({
      workspaceMatch: { id: "ws_p", verticalTier: "REGULAR" },
    });
    const event: StripeWebhookEvent = {
      eventId: "evt_paused_1",
      eventType: "customer.subscription.paused",
      data: {
        object: {
          id: "sub_p_1",
          customer: "cus_p_1",
          status: "paused",
          items: {
            data: [
              {
                quantity: 1,
                price: { lookup_key: "agentplain_regular_seats_1_monthly" },
              },
            ],
          },
        },
      },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.subscriptions.length, 1);
    assert.equal(fake.subscriptions[0].status, "PAUSED");
    assert.equal(fake.billingEvents[0].type, "customer.subscription.paused");
    assert.equal(
      fake.audits.find((a) => a.action.startsWith("billing.subscription."))
        ?.workspaceId,
      "ws_p",
    );
  });
});

describe("dispatchEvent — checkout.session.completed (wave-2 signup)", () => {
  it("records BillingEvent + AuditLog when workspace resolves via client_reference_id", async () => {
    const fake = buildFakeTx({
      workspaceById: { id: "ws_signup_1" },
    });
    const event: StripeWebhookEvent = {
      eventId: "evt_cs_completed_1",
      eventType: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_xyz",
          status: "complete",
          customer: "cus_signup_1",
          subscription: "sub_signup_1",
          client_reference_id: "ws_signup_1",
        },
      },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.billingEvents.length, 1);
    assert.equal(fake.billingEvents[0].workspaceId, "ws_signup_1");
    const audit = fake.audits.find(
      (a) => a.action === "billing.signup_checkout_completed",
    );
    assert.ok(audit, "checkout-completed audit row must be written");
    assert.equal(audit?.workspaceId, "ws_signup_1");
  });

  it("records BillingEvent without audit when workspace cannot be resolved", async () => {
    const fake = buildFakeTx({
      workspaceById: null,
      workspaceMatch: null,
    });
    const event: StripeWebhookEvent = {
      eventId: "evt_cs_orphan",
      eventType: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_orphan",
          status: "complete",
          customer: "cus_orphan_1",
          client_reference_id: "ws_does_not_exist",
        },
      },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(fake.billingEvents.length, 1);
    assert.equal(
      fake.audits.find((a) =>
        a.action.startsWith("billing.signup_checkout"),
      ),
      undefined,
    );
  });

  it("checkout.session.expired audits the abandoned-signup signal", async () => {
    const fake = buildFakeTx({
      workspaceById: { id: "ws_aban_1" },
    });
    const event: StripeWebhookEvent = {
      eventId: "evt_cs_expired",
      eventType: "checkout.session.expired",
      data: {
        object: {
          id: "cs_test_expired",
          status: "expired",
          client_reference_id: "ws_aban_1",
        },
      },
    };
    await dispatchEvent(event, fake as unknown as DbTransactionClient);
    assert.equal(
      fake.audits.find((a) => a.action === "billing.signup_checkout_expired")
        ?.workspaceId,
      "ws_aban_1",
    );
  });
});

// ---------------------------------------------------------------------
// Wave-2 dispatcher-doesn't-throw regression guard.
//
// The audit's headline finding: the trial-end webhook used to throw 500
// because `paused` wasn't in the enum, Stripe retried for 72h, customer
// kept using the fleet for free. This test pins the dispatcher's contract
// — every event type the audit names must complete without throwing
// against a stock fake tx. Add new types here as new handlers ship.
// ---------------------------------------------------------------------

describe("dispatchEvent — wave-2 contract: every audit-named event type is non-throwing", () => {
  const types = [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.trial_will_end",
    "customer.subscription.paused",
    "customer.subscription.resumed",
    "customer.subscription.deleted",
    "invoice.created",
    "invoice.finalized",
    "invoice.paid",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "invoice.voided",
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "setup_intent.succeeded",
  ];

  for (const type of types) {
    it(`${type} → completes without throw`, async () => {
      const fake = buildFakeTx({
        workspaceMatch: { id: "ws_ok", verticalTier: "REGULAR" },
        workspaceById: { id: "ws_ok" },
      });
      const event: StripeWebhookEvent = {
        eventId: `evt_${type.replace(/\./g, "_")}`,
        eventType: type,
        data: {
          object: {
            id: type.startsWith("invoice.")
              ? "in_test_x"
              : type.startsWith("checkout.")
                ? "cs_test_x"
                : "sub_test_x",
            customer: "cus_test_x",
            client_reference_id: type.startsWith("checkout.")
              ? "ws_ok"
              : undefined,
            status: type === "customer.subscription.paused" ? "paused" : "trialing",
            items: {
              data: [
                {
                  quantity: 1,
                  price: {
                    lookup_key: "agentplain_regular_seats_1_monthly",
                  },
                },
              ],
            },
          },
        },
      };
      await dispatchEvent(event, fake as unknown as DbTransactionClient);
      assert.equal(
        fake.billingEvents.length,
        1,
        `${type} must record a BillingEvent`,
      );
    });
  }
});
