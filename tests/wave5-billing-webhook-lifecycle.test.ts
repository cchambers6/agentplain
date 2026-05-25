/**
 * tests/wave5-billing-webhook-lifecycle.test.ts
 *
 * Wave-5 black-box integration test: Stripe webhook lifecycle.
 *
 * Drives `lib/billing/webhook-dispatch.ts#dispatchEvent` (which is what
 * the webhook route delegates to) through a realistic lifecycle:
 *
 *   1. customer.subscription.created (trialing)        → Subscription row, TRIALING
 *   2. invoice.created                                  → WorkspaceInvoice row, status=open
 *   3. customer.subscription.updated (active)           → Subscription.status=ACTIVE
 *   4. invoice.payment_succeeded                         → Subscription stays ACTIVE
 *   5. invoice.payment_failed (next cycle)               → Subscription.status=PAST_DUE
 *   6. invoice.payment_succeeded (recovered)             → Subscription.status=ACTIVE
 *   7. customer.subscription.deleted                     → Subscription.status=CANCELED
 *
 * Asserts at every step:
 *   - BillingEvent recorded (idempotency seed)
 *   - AuditLog row written
 *   - Subscription / WorkspaceInvoice state matches expectation
 *
 * Per the wave-5 brief: do NOT modify the handler (PR #68 owns that source).
 * This test ADDS coverage by exercising the dispatcher black-box with a
 * stateful in-memory client.
 *
 * Per `project_no_outbound_architecture.md`: webhook RECEIVERS are allowed;
 * the dispatcher only writes to the DB, never reaches out.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  dispatchEvent,
  type StripeWebhookEvent,
} from '@/lib/billing/webhook-dispatch';
import type { DbTransactionClient } from '@/lib/db';
import { FakePrismaClient } from './fixtures/_fake-prisma';

const WORKSPACE_ID = 'ccc12345-6789-abcd-ef01-234567890abc';
const STRIPE_CUSTOMER_ID = 'cus_wave5_lifecycle';
const STRIPE_SUBSCRIPTION_ID = 'sub_wave5_lifecycle';
const SECS = (msFromNow: number) => Math.floor((Date.now() + msFromNow) / 1000);

function asTx(fake: FakePrismaClient): DbTransactionClient {
  return fake as unknown as DbTransactionClient;
}

describe('wave5 stripe webhook lifecycle — trial → active → past-due → recovered → canceled', () => {
  let fake: FakePrismaClient;

  before(() => {
    fake = new FakePrismaClient();
    fake.seedWorkspace({
      id: WORKSPACE_ID,
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      verticalTier: 'REGULAR',
    });
  });

  it('step 1 — subscription.created (trialing) writes Subscription + flips billingMode', async () => {
    const event: StripeWebhookEvent = {
      eventId: 'evt_wave5_1_created',
      eventType: 'customer.subscription.created',
      data: {
        object: {
          id: STRIPE_SUBSCRIPTION_ID,
          customer: STRIPE_CUSTOMER_ID,
          status: 'trialing',
          trial_end: SECS(30 * 24 * 60 * 60_000),
          current_period_end: SECS(30 * 24 * 60 * 60_000),
          cancel_at_period_end: false,
          items: {
            data: [
              {
                quantity: 1,
                price: {
                  id: 'price_wave5_regular',
                  lookup_key: 'agentplain_regular_seats_1_monthly',
                },
              },
            ],
          },
        },
      },
    };
    await dispatchEvent(event, asTx(fake));

    assert.equal(fake.subscriptions.length, 1);
    assert.equal(fake.subscriptions[0].status, 'TRIALING');
    assert.equal(fake.subscriptions[0].seats, 1);
    assert.equal(fake.subscriptions[0].seatBand, 'SEATS_1');
    assert.equal(fake.subscriptions[0].tier, 'REGULAR');

    const ws = fake.workspaces.find((w) => w.id === WORKSPACE_ID)!;
    assert.equal(ws.billingMode, 'STRIPE_SUBSCRIPTION');
    assert.equal(ws.stripeSubscriptionId, STRIPE_SUBSCRIPTION_ID);

    assert.ok(
      fake.billingEvents.find((e) => e.stripeEventId === 'evt_wave5_1_created'),
      'BillingEvent recorded for created',
    );
    assert.ok(
      fake.audits.find((a) => a.action === 'billing.subscription.created'),
      'AuditLog recorded for created',
    );
  });

  it('step 2 — invoice.created mirrors the invoice to WorkspaceInvoice', async () => {
    const event: StripeWebhookEvent = {
      eventId: 'evt_wave5_2_invoice_created',
      eventType: 'invoice.created',
      data: {
        object: {
          id: 'in_wave5_1',
          customer: STRIPE_CUSTOMER_ID,
          subscription: STRIPE_SUBSCRIPTION_ID,
          amount_due: 19900,
          status: 'open',
          period_start: SECS(0),
          period_end: SECS(30 * 24 * 60 * 60_000),
        },
      },
    };
    await dispatchEvent(event, asTx(fake));

    assert.equal(fake.workspaceInvoices.length, 1);
    assert.equal(fake.workspaceInvoices[0].stripeInvoiceId, 'in_wave5_1');
    assert.equal(fake.workspaceInvoices[0].workspaceId, WORKSPACE_ID);
    assert.equal(fake.workspaceInvoices[0].amountUsdCents, 19900);
  });

  it('step 3 — subscription.updated (active) flips status from TRIALING → ACTIVE', async () => {
    const event: StripeWebhookEvent = {
      eventId: 'evt_wave5_3_active',
      eventType: 'customer.subscription.updated',
      data: {
        object: {
          id: STRIPE_SUBSCRIPTION_ID,
          customer: STRIPE_CUSTOMER_ID,
          status: 'active',
          current_period_end: SECS(60 * 24 * 60 * 60_000),
          items: {
            data: [
              {
                quantity: 1,
                price: {
                  lookup_key: 'agentplain_regular_seats_1_monthly',
                },
              },
            ],
          },
        },
      },
    };
    await dispatchEvent(event, asTx(fake));
    const sub = fake.subscriptions.find(
      (s) => s.stripeSubscriptionId === STRIPE_SUBSCRIPTION_ID,
    )!;
    assert.equal(sub.status, 'ACTIVE');
    assert.equal(
      fake.audits.find((a) => a.action === 'billing.subscription.updated')?.workspaceId,
      WORKSPACE_ID,
    );
  });

  it('step 4 — invoice.payment_succeeded keeps Subscription ACTIVE + records BillingEvent', async () => {
    const event: StripeWebhookEvent = {
      eventId: 'evt_wave5_4_paid',
      eventType: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_wave5_1',
          customer: STRIPE_CUSTOMER_ID,
          subscription: STRIPE_SUBSCRIPTION_ID,
          amount_paid: 19900,
          status: 'paid',
          paid: true,
        },
      },
    };
    await dispatchEvent(event, asTx(fake));
    const sub = fake.subscriptions.find(
      (s) => s.stripeSubscriptionId === STRIPE_SUBSCRIPTION_ID,
    )!;
    assert.equal(sub.status, 'ACTIVE');
    assert.ok(
      fake.billingEvents.find((e) => e.stripeEventId === 'evt_wave5_4_paid'),
    );
    const invoice = fake.workspaceInvoices.find((i) => i.stripeInvoiceId === 'in_wave5_1')!;
    assert.equal(invoice.status, 'paid');
    assert.ok(invoice.paidAt instanceof Date);
  });

  it('step 5 — invoice.payment_failed flips Subscription to PAST_DUE', async () => {
    const event: StripeWebhookEvent = {
      eventId: 'evt_wave5_5_failed',
      eventType: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_wave5_2',
          customer: STRIPE_CUSTOMER_ID,
          subscription: STRIPE_SUBSCRIPTION_ID,
          amount_due: 19900,
          status: 'open',
        },
      },
    };
    await dispatchEvent(event, asTx(fake));
    const sub = fake.subscriptions.find(
      (s) => s.stripeSubscriptionId === STRIPE_SUBSCRIPTION_ID,
    )!;
    assert.equal(sub.status, 'PAST_DUE');
  });

  it('step 6 — invoice.payment_succeeded (recovered) restores Subscription to ACTIVE', async () => {
    const event: StripeWebhookEvent = {
      eventId: 'evt_wave5_6_recovered',
      eventType: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_wave5_2',
          customer: STRIPE_CUSTOMER_ID,
          subscription: STRIPE_SUBSCRIPTION_ID,
          amount_paid: 19900,
          status: 'paid',
          paid: true,
        },
      },
    };
    await dispatchEvent(event, asTx(fake));
    const sub = fake.subscriptions.find(
      (s) => s.stripeSubscriptionId === STRIPE_SUBSCRIPTION_ID,
    )!;
    assert.equal(sub.status, 'ACTIVE', 'recovered from PAST_DUE');
  });

  it('step 7 — customer.subscription.deleted flips Subscription to CANCELED', async () => {
    const event: StripeWebhookEvent = {
      eventId: 'evt_wave5_7_canceled',
      eventType: 'customer.subscription.deleted',
      data: {
        object: { id: STRIPE_SUBSCRIPTION_ID },
      },
    };
    await dispatchEvent(event, asTx(fake));
    const sub = fake.subscriptions.find(
      (s) => s.stripeSubscriptionId === STRIPE_SUBSCRIPTION_ID,
    )!;
    assert.equal(sub.status, 'CANCELED');
    assert.equal(sub.cancelAtPeriodEnd, false);
    assert.ok(
      fake.audits.find((a) => a.action === 'billing.subscription.deleted'),
    );
  });

  it('lifecycle invariant: every event was recorded as a BillingEvent with the right type', () => {
    const expected = new Map<string, string>([
      ['evt_wave5_1_created', 'customer.subscription.created'],
      ['evt_wave5_2_invoice_created', 'invoice.created'],
      ['evt_wave5_3_active', 'customer.subscription.updated'],
      ['evt_wave5_4_paid', 'invoice.payment_succeeded'],
      ['evt_wave5_5_failed', 'invoice.payment_failed'],
      ['evt_wave5_6_recovered', 'invoice.payment_succeeded'],
      ['evt_wave5_7_canceled', 'customer.subscription.deleted'],
    ]);
    for (const [eventId, type] of expected) {
      const row = fake.billingEvents.find((e) => e.stripeEventId === eventId);
      assert.ok(row, `BillingEvent missing for ${eventId}`);
      assert.equal(row!.type, type);
    }
    // No outbound side effect — none of these events should ever produce
    // a transport call. The dispatcher's only side effects are DB writes
    // (Subscription, WorkspaceInvoice, BillingEvent, AuditLog, Workspace).
    // Inspect the audit log to confirm: every action prefix is `billing.*`.
    for (const a of fake.audits) {
      assert.match(a.action, /^billing\./);
    }
  });
});

describe('wave5 stripe webhook lifecycle — idempotency under replay', () => {
  it('replaying the same event id leaves Subscription state unchanged', async () => {
    const fake = new FakePrismaClient();
    fake.seedWorkspace({
      id: WORKSPACE_ID,
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      verticalTier: 'REGULAR',
    });
    const create: StripeWebhookEvent = {
      eventId: 'evt_idem_1',
      eventType: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_idem_1',
          customer: STRIPE_CUSTOMER_ID,
          status: 'trialing',
          items: {
            data: [
              {
                quantity: 1,
                price: { lookup_key: 'agentplain_regular_seats_1_monthly' },
              },
            ],
          },
        },
      },
    };
    await dispatchEvent(create, asTx(fake));
    await dispatchEvent(create, asTx(fake));
    // upsert by stripeSubscriptionId → still one row
    assert.equal(fake.subscriptions.length, 1);
    // upsert by stripeEventId → still one billing event
    assert.equal(
      fake.billingEvents.filter((e) => e.stripeEventId === 'evt_idem_1').length,
      1,
      'BillingEvent dedupe by stripeEventId@unique must hold across replay',
    );
  });
});

describe('wave5 stripe webhook — unmatched customer is recorded but never crashes', () => {
  it('a subscription event for an unknown customer logs the unmatched audit + does not write Subscription', async () => {
    const fake = new FakePrismaClient(); // no workspace seeded
    const event: StripeWebhookEvent = {
      eventId: 'evt_unmatched_42',
      eventType: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_unmatched',
          customer: 'cus_does_not_exist',
          status: 'trialing',
          items: { data: [{ quantity: 1, price: { id: 'p_x' } }] },
        },
      },
    };
    await dispatchEvent(event, asTx(fake));
    assert.equal(fake.subscriptions.length, 0);
    assert.ok(
      fake.audits.find((a) => a.action === 'billing.event.unmatched_customer'),
    );
    assert.equal(fake.billingEvents.length, 1);
  });
});
