// Unit tests for StripeBillingProvider against a Stripe-shaped mock.
// The point is to verify the adapter's translation between agentplain's
// generic surface (tier/band/seats/trialPeriodDays) and Stripe's exact
// API shape (line items, trial_period_days, lookup_key resolution).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StripeBillingProvider } from "@/lib/billing/stripe-provider";
import { lookupKeyFor } from "@/lib/pricing/tiers";

interface PriceListCall {
  lookup_keys?: string[];
}
interface SubCreateCall {
  customer: string;
  items: Array<{ price: string; quantity: number }>;
  trial_period_days?: number;
  trial_settings?: unknown;
  payment_settings?: unknown;
  metadata?: Record<string, string>;
}
interface CheckoutCall {
  mode: "setup" | "subscription";
  customer: string;
  line_items?: Array<{ price: string; quantity: number }>;
  success_url: string;
  cancel_url: string;
  allow_promotion_codes?: boolean;
}

const fakeStripe = () => {
  const calls: {
    priceList: PriceListCall[];
    subCreate: SubCreateCall[];
    checkout: CheckoutCall[];
    portal: { customer: string; return_url: string }[];
  } = { priceList: [], subCreate: [], checkout: [], portal: [] };
  const client = {
    customers: {
      create: async () => ({ id: "cus_mock_1" }),
    },
    prices: {
      list: async (args: PriceListCall) => {
        calls.priceList.push(args);
        return {
          data: [
            {
              id: `price_mock_${args.lookup_keys?.[0] ?? "unknown"}`,
              lookup_key: args.lookup_keys?.[0],
            },
          ],
        };
      },
    },
    subscriptions: {
      create: async (args: SubCreateCall) => {
        calls.subCreate.push(args);
        const now = Math.floor(Date.now() / 1000);
        return {
          id: "sub_mock_1",
          status: args.trial_period_days ? "trialing" : "active",
          trial_end: args.trial_period_days
            ? now + args.trial_period_days * 86400
            : null,
          current_period_end: now + 30 * 86400,
          cancel_at_period_end: false,
          items: { data: [{ id: "si_1", price: { id: args.items[0].price }, quantity: args.items[0].quantity }] },
        };
      },
      retrieve: async (id: string) => ({
        id,
        status: "trialing",
        trial_end: null,
        current_period_end: null,
        cancel_at_period_end: false,
        customer: "cus_mock_1",
        default_payment_method: null,
        items: {
          data: [
            {
              id: "si_1",
              price: { id: "price_x", lookup_key: lookupKeyFor("regular", "SEATS_1") },
              quantity: 1,
            },
          ],
        },
      }),
      update: async (id: string, args: { cancel_at_period_end?: boolean }) => ({
        id,
        status: "trialing",
        trial_end: null,
        current_period_end: null,
        cancel_at_period_end: args.cancel_at_period_end ?? false,
        customer: "cus_mock_1",
        default_payment_method: null,
        items: {
          data: [
            {
              id: "si_1",
              price: { id: "price_x", lookup_key: lookupKeyFor("regular", "SEATS_1") },
              quantity: 1,
            },
          ],
        },
      }),
      cancel: async (id: string) => ({
        id,
        status: "canceled",
        trial_end: null,
        current_period_end: null,
        cancel_at_period_end: false,
        customer: "cus_mock_1",
        default_payment_method: null,
        items: {
          data: [
            {
              id: "si_1",
              price: { id: "price_x", lookup_key: lookupKeyFor("regular", "SEATS_1") },
              quantity: 1,
            },
          ],
        },
      }),
    },
    checkout: {
      sessions: {
        create: async (args: CheckoutCall) => {
          calls.checkout.push(args);
          return {
            id: "cs_mock_1",
            url: "https://checkout.stripe.com/c/cs_mock_1",
          };
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async (args: { customer: string; return_url: string }) => {
          calls.portal.push(args);
          return { url: `https://billing.stripe.com/p/${args.customer}` };
        },
      },
    },
    invoices: {
      create: async () => ({ id: "in_mock_1" }),
      finalizeInvoice: async (id: string) => ({
        id,
        status: "open",
        hosted_invoice_url: "https://invoice.example/" + id,
        invoice_pdf: "https://invoice.example/" + id + ".pdf",
      }),
    },
    invoiceItems: {
      create: async () => ({ id: "ii_mock_1" }),
    },
    webhooks: {
      constructEventAsync: async (payload: string) => ({
        id: "evt_mock_1",
        type: "test.event",
        data: { object: JSON.parse(payload) },
      }),
    },
  };
  return { client, calls };
};

describe("StripeBillingProvider — Stripe-shape translation", () => {
  it("resolves prices by lookup_key and caches the result", async () => {
    const { client, calls } = fakeStripe();
    const p = new StripeBillingProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      client: client as never,
    });
    const id1 = await p.priceIdFor("regular", "SEATS_1");
    const id2 = await p.priceIdFor("regular", "SEATS_1");
    assert.equal(id1, id2);
    assert.equal(calls.priceList.length, 1, "second call must hit cache");
    assert.deepEqual(calls.priceList[0].lookup_keys, [
      lookupKeyFor("regular", "SEATS_1"),
    ]);
  });

  it("passes trial_period_days + trial_settings to subscriptions.create", async () => {
    const { client, calls } = fakeStripe();
    const p = new StripeBillingProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      client: client as never,
    });
    const sub = await p.createSubscription({
      providerCustomerId: "cus_x",
      tier: "regular",
      seatBand: "SEATS_1",
      seats: 1,
      trialPeriodDays: 30,
    });
    assert.equal(sub.status, "trialing");
    assert.ok(sub.trialEndsAt instanceof Date);
    const call = calls.subCreate[0];
    assert.equal(call.trial_period_days, 30);
    assert.equal(call.items[0].quantity, 1);
    assert.equal(call.metadata?.agentplain_tier, "regular");
    assert.equal(call.metadata?.agentplain_seat_band, "SEATS_1");
    assert.ok(call.trial_settings, "trial_settings must be set for no-card trial");
    assert.ok(call.payment_settings, "payment_settings must be set");
  });

  it("omits trial fields when trialPeriodDays is 0", async () => {
    const { client, calls } = fakeStripe();
    const p = new StripeBillingProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      client: client as never,
    });
    await p.createSubscription({
      providerCustomerId: "cus_x",
      tier: "plus",
      seatBand: "SEATS_2_9",
      seats: 5,
      trialPeriodDays: 0,
    });
    const call = calls.subCreate[0];
    assert.equal(call.trial_period_days, undefined);
    assert.equal(call.trial_settings, undefined);
  });

  it("createCheckoutSession(mode=setup) sets the right Stripe fields", async () => {
    const { client, calls } = fakeStripe();
    const p = new StripeBillingProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      client: client as never,
    });
    const r = await p.createCheckoutSession({
      mode: "setup",
      providerCustomerId: "cus_x",
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/x",
    });
    assert.ok(r.url.startsWith("https://"));
    const call = calls.checkout[0];
    assert.equal(call.mode, "setup");
    assert.equal(call.customer, "cus_x");
  });

  it("createCheckoutSession(mode=subscription) attaches a Price line + promotion codes", async () => {
    const { client, calls } = fakeStripe();
    const p = new StripeBillingProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      client: client as never,
    });
    await p.createCheckoutSession({
      mode: "subscription",
      providerCustomerId: "cus_x",
      tier: "max",
      seatBand: "SEATS_25_49",
      seats: 30,
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/x",
    });
    const call = calls.checkout[0];
    assert.equal(call.mode, "subscription");
    assert.equal(call.line_items?.[0].quantity, 30);
    assert.equal(call.allow_promotion_codes, true);
  });

  it("cancelSubscription({atPeriodEnd:true}) uses update, not cancel", async () => {
    const { client } = fakeStripe();
    const p = new StripeBillingProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      client: client as never,
    });
    const r = await p.cancelSubscription({
      providerSubscriptionId: "sub_mock_1",
      atPeriodEnd: true,
    });
    assert.equal(r.cancelAtPeriodEnd, true);
    assert.notEqual(r.status, "canceled");
  });

  it("cancelSubscription({atPeriodEnd:false}) cancels immediately", async () => {
    const { client } = fakeStripe();
    const p = new StripeBillingProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      client: client as never,
    });
    const r = await p.cancelSubscription({
      providerSubscriptionId: "sub_mock_1",
      atPeriodEnd: false,
    });
    assert.equal(r.status, "canceled");
  });
});
