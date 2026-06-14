/**
 * tests/e2e/helpers/webhook.ts
 *
 * Constructs + delivers Stripe webhook events to the running app without
 * hitting real Stripe. Uses the same HMAC-SHA256 signing that
 * TestBillingProvider.verifyWebhook() validates, so the signature check
 * inside the route passes.
 *
 * The default webhook secret ("test_whsec") matches the TestBillingProvider
 * default AND the STRIPE_WEBHOOK_SECRET injected by playwright.config.ts.
 */

import { createHmac } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

const DEFAULT_SECRET = "test_whsec";

function signPayload(
  payload: string,
  secret: string = DEFAULT_SECRET,
  atSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const sig = createHmac("sha256", secret)
    .update(`${atSeconds}.${payload}`)
    .digest("hex");
  return `t=${atSeconds},v1=${sig}`;
}

export interface SendWebhookOptions {
  /** Defaults to "test_whsec". */
  secret?: string;
  /** Defaults to the running app at http://localhost:3000. */
  baseUrl?: string;
}

/**
 * POST a signed webhook event to the app's Stripe webhook endpoint.
 * Returns the raw Response so callers can assert status codes.
 */
export async function sendWebhookEvent(
  request: APIRequestContext,
  event: object,
  opts: SendWebhookOptions = {},
): Promise<{ status: number; body: string }> {
  const payload = JSON.stringify(event);
  const secret = opts.secret ?? DEFAULT_SECRET;
  const signature = signPayload(payload, secret);

  const res = await request.post("/api/stripe/webhook", {
    data: payload,
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
    },
  });

  return { status: res.status(), body: await res.text() };
}

let _evtCounter = 1;
const nextEvtId = () => `evt_test_e2e_${_evtCounter++}`;

// ── Event builders ────────────────────────────────────────────────────────────
//
// Each builder returns a well-formed Stripe event envelope. The `object` field
// mirrors what Stripe actually sends so the dispatch function (webhook-dispatch.ts)
// can parse it correctly.

export function buildSubscriptionCreatedEvent(opts: {
  subscriptionId: string;
  customerId: string;
  status?: string;
  trialEndEpoch?: number;
  periodEndEpoch?: number;
  lookupKey?: string;
}): object {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: nextEvtId(),
    type: "customer.subscription.created",
    data: {
      object: {
        id: opts.subscriptionId,
        object: "subscription",
        customer: opts.customerId,
        status: opts.status ?? "trialing",
        trial_end: opts.trialEndEpoch ?? now + 30 * 24 * 3600,
        current_period_end: opts.periodEndEpoch ?? now + 30 * 24 * 3600,
        cancel_at_period_end: false,
        default_payment_method: null,
        items: {
          data: [
            {
              quantity: 1,
              price: {
                id: `price_test_${opts.lookupKey ?? "agentplain_regular_seats_1"}`,
                lookup_key: opts.lookupKey ?? "agentplain_regular_seats_1",
              },
            },
          ],
        },
        metadata: {},
      },
    },
  };
}

export function buildSubscriptionUpdatedEvent(opts: {
  subscriptionId: string;
  customerId: string;
  status: string;
  trialEndEpoch?: number;
  periodEndEpoch?: number;
  cancelAtPeriodEnd?: boolean;
}): object {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: nextEvtId(),
    type: "customer.subscription.updated",
    data: {
      object: {
        id: opts.subscriptionId,
        object: "subscription",
        customer: opts.customerId,
        status: opts.status,
        trial_end: opts.trialEndEpoch ?? null,
        current_period_end: opts.periodEndEpoch ?? now + 30 * 24 * 3600,
        cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
        default_payment_method: "pm_test_e2e_card",
        items: {
          data: [
            {
              quantity: 1,
              price: {
                id: "price_test_agentplain_regular_seats_1",
                lookup_key: "agentplain_regular_seats_1",
              },
            },
          ],
        },
        metadata: {},
      },
    },
  };
}

export function buildSubscriptionDeletedEvent(opts: {
  subscriptionId: string;
  customerId: string;
}): object {
  return {
    id: nextEvtId(),
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: opts.subscriptionId,
        object: "subscription",
        customer: opts.customerId,
        status: "canceled",
        cancel_at_period_end: false,
        items: { data: [] },
        metadata: {},
      },
    },
  };
}

export function buildInvoicePaymentFailedEvent(opts: {
  subscriptionId: string;
  customerId: string;
  invoiceId?: string;
}): object {
  return {
    id: nextEvtId(),
    type: "invoice.payment_failed",
    data: {
      object: {
        id: opts.invoiceId ?? `in_test_e2e_${nextEvtId()}`,
        object: "invoice",
        customer: opts.customerId,
        subscription: opts.subscriptionId,
        amount_due: 9900,
        amount_paid: 0,
        status: "open",
        paid: false,
        hosted_invoice_url: "https://invoice.stripe.com/test",
        invoice_pdf: "https://invoice.stripe.com/test.pdf",
        period_start: Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
        period_end: Math.floor(Date.now() / 1000),
        metadata: {},
      },
    },
  };
}

export function buildCheckoutSessionCompletedEvent(opts: {
  sessionId: string;
  customerId: string;
  subscriptionId: string;
  workspaceId: string;
}): object {
  return {
    id: nextEvtId(),
    type: "checkout.session.completed",
    data: {
      object: {
        id: opts.sessionId,
        object: "checkout.session",
        status: "complete",
        customer: opts.customerId,
        subscription: opts.subscriptionId,
        client_reference_id: opts.workspaceId,
        metadata: {
          agentplain_workspace_id: opts.workspaceId,
          agentplain_signup_flow: "checkout_at_signup",
        },
      },
    },
  };
}
