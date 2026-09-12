// FLAT-PRICE QUANTITY GUARD
//
// agentplain is ONE FLAT PRICE ($99/mo, `MONTHLY_PRICE_USD_CENTS` in
// `lib/billing/facts.ts`) for every customer, any team size, every
// vertical. Stripe computes a charge as `unit_amount * quantity`.
//
// Therefore the ONLY safe quantity on a subscription line item is 1.
// Any other value silently bills a MULTIPLE of the price that every
// customer-facing surface promises.
//
// This suite exists because there was previously NO test asserting on
// the price or quantity reaching Stripe at checkout. The gap let a
// trial-expiry email render "30 seats at $99/seat/mo ... will be
// charged $99", and left `changePlanAction` free to forward a form
// value of 1-99 straight into `line_items[].quantity`.
//
// The assertion is deliberately made at the PROVIDER boundary — the
// last hop before the Stripe SDK — so that a new caller cannot
// reintroduce the multiplication by threading `seats` through.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StripeBillingProvider } from "@/lib/billing/stripe-provider";
import type { SeatBand } from "@prisma/client";
import type { TierName } from "@/lib/pricing/tiers";

interface LineItem {
  price: string;
  quantity: number;
}
interface CheckoutCall {
  mode: string;
  line_items?: LineItem[];
  subscription_data?: { metadata?: Record<string, string> };
}
interface SubCreateCall {
  items: LineItem[];
  metadata?: Record<string, string>;
}
interface SubUpdateCall {
  items: Array<{ id: string; price: string; quantity: number }>;
}

// A Stripe-shaped double that records every write. `LEGACY_QUANTITY` on
// the retrieved subscription models a pre-flat-price per-seat record:
// `updateSubscription` must NOT inherit it.
const LEGACY_QUANTITY = 30;

const fakeStripe = () => {
  const calls = {
    checkout: [] as CheckoutCall[],
    subCreate: [] as SubCreateCall[],
    subUpdate: [] as SubUpdateCall[],
  };
  const legacyItem = {
    id: "si_legacy",
    price: { id: "price_legacy" },
    quantity: LEGACY_QUANTITY,
    current_period_end: Math.floor(Date.now() / 1000) + 86400,
  };
  const subShape = (quantity: number) => ({
    id: "sub_1",
    status: "active",
    trial_end: null,
    current_period_end: Math.floor(Date.now() / 1000) + 86400,
    cancel_at_period_end: false,
    customer: "cus_1",
    default_payment_method: null,
    items: {
      data: [
        {
          id: "si_1",
          price: { id: "price_flat" },
          quantity,
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
    },
  });
  const client = {
    customers: { create: async () => ({ id: "cus_1" }) },
    prices: {
      list: async () => ({
        data: [{ id: "price_flat", lookup_key: "agentplain_flat_monthly" }],
      }),
    },
    subscriptions: {
      create: async (args: SubCreateCall) => {
        calls.subCreate.push(args);
        return subShape(args.items[0].quantity);
      },
      retrieve: async () => ({
        ...subShape(LEGACY_QUANTITY),
        items: { data: [legacyItem] },
      }),
      update: async (_id: string, args: SubUpdateCall) => {
        calls.subUpdate.push(args);
        return subShape(args.items?.[0]?.quantity ?? 1);
      },
      cancel: async () => subShape(1),
    },
    checkout: {
      sessions: {
        create: async (args: CheckoutCall) => {
          calls.checkout.push(args);
          return { id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" };
        },
      },
    },
  };
  return { client, calls };
};

const provider = (client: unknown) =>
  new StripeBillingProvider({
    secretKey: "sk_test_x",
    webhookSecret: "whsec_x",
    client: client as never,
  });

// The full range the billing form accepted (1-99), plus the band
// boundaries, plus the value from the known-bad trial email.
const SEAT_INPUTS = [1, 2, 5, 9, 10, 24, 25, 30, 49, 50, 98, 99];

const bandFor = (seats: number): SeatBand => {
  if (seats === 1) return "SEATS_1";
  if (seats <= 9) return "SEATS_2_9";
  if (seats <= 24) return "SEATS_10_24";
  if (seats <= 49) return "SEATS_25_49";
  return "SEATS_50_99";
};

const TIERS: TierName[] = ["regular", "plus"];

describe("flat pricing: quantity reaching Stripe is always 1", () => {
  let examinedCheckout = 0;
  let examinedSubscription = 0;

  it("createCheckoutSession pins quantity=1 for every seat input", async () => {
    for (const seats of SEAT_INPUTS) {
      for (const tier of TIERS) {
        const { client, calls } = fakeStripe();
        await provider(client).createCheckoutSession({
          mode: "subscription",
          providerCustomerId: "cus_1",
          tier,
          seatBand: bandFor(seats),
          seats,
          successUrl: "https://app.test/ok",
          cancelUrl: "https://app.test/no",
        });
        const line = calls.checkout[0]?.line_items?.[0];
        assert.ok(line, `no line item recorded for seats=${seats}`);
        assert.equal(
          line.quantity,
          1,
          `seats=${seats} tier=${tier} produced quantity=${line.quantity}; ` +
            `Stripe would bill ${line.quantity}x the flat price`,
        );
        assert.equal(
          calls.checkout[0]?.subscription_data?.metadata
            ?.agentplain_requested_seats,
          String(seats),
          "requested seats must be recorded in metadata, not billed",
        );
        examinedCheckout++;
      }
    }
    assert.equal(
      examinedCheckout,
      SEAT_INPUTS.length * TIERS.length,
      "examined count must match the full input matrix",
    );
    assert.ok(examinedCheckout > 0, "examined 0 cases — vacuous pass");
    console.log(
      `examined ${examinedCheckout} of ${SEAT_INPUTS.length * TIERS.length} checkout cases`,
    );
  });

  it("createSubscription pins quantity=1 for every seat input", async () => {
    for (const seats of SEAT_INPUTS) {
      const { client, calls } = fakeStripe();
      await provider(client).createSubscription({
        providerCustomerId: "cus_1",
        tier: "regular",
        seatBand: bandFor(seats),
        seats,
        trialPeriodDays: 14,
      });
      const item = calls.subCreate[0]?.items?.[0];
      assert.ok(item, `no item recorded for seats=${seats}`);
      assert.equal(
        item.quantity,
        1,
        `seats=${seats} produced quantity=${item.quantity}`,
      );
      assert.equal(
        calls.subCreate[0]?.metadata?.agentplain_requested_seats,
        String(seats),
      );
      examinedSubscription++;
    }
    assert.equal(examinedSubscription, SEAT_INPUTS.length);
    assert.ok(examinedSubscription > 0, "examined 0 cases — vacuous pass");
    console.log(
      `examined ${examinedSubscription} of ${SEAT_INPUTS.length} subscription cases`,
    );
  });

  it("updateSubscription does not inherit a legacy per-seat quantity", async () => {
    // A subscription created before the flat-price collapse carries
    // quantity=30. The previous code read `input.seats ?? primary.quantity
    // ?? 1`, so ANY update — including a tier change with no seat
    // argument at all — silently preserved the 30x multiplier.
    const { client, calls } = fakeStripe();
    await provider(client).updateSubscription({
      providerSubscriptionId: "sub_1",
      tier: "plus",
      seatBand: "SEATS_1",
    });
    assert.equal(
      calls.subUpdate[0]?.items?.[0]?.quantity,
      1,
      "legacy per-seat quantity must be collapsed to 1 on update",
    );
  });

  it("updateSubscription ignores an explicitly passed seat count", async () => {
    const { client, calls } = fakeStripe();
    await provider(client).updateSubscription({
      providerSubscriptionId: "sub_1",
      tier: "plus",
      seatBand: "SEATS_50_99",
      seats: 99,
    });
    assert.equal(
      calls.subUpdate[0]?.items?.[0]?.quantity,
      1,
      "an explicit seats=99 must not reach Stripe as a quantity",
    );
  });
});
