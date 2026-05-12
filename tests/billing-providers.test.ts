import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TestBillingProvider } from "@/lib/billing";
import { lookupKeyFor } from "@/lib/pricing/tiers";

describe("TestBillingProvider — customer + manual invoice", () => {
  it("creates customers with metadata", async () => {
    const p = new TestBillingProvider();
    const r = await p.createCustomer({
      workspaceId: "ws_1",
      workspaceName: "Acme Realty",
      email: "owner@acme.test",
    });
    assert.match(r.providerCustomerId, /^cus_test_\d+$/);
    assert.equal(p.customers[0].workspaceId, "ws_1");
  });

  it("creates manual invoices (Phase 1 retained)", async () => {
    const p = new TestBillingProvider();
    const r = await p.createManualInvoice({
      providerCustomerId: "cus_test_1",
      amountUsdCents: 150000,
      description: "Pilot tier 1 — 30 days",
    });
    assert.match(r.providerInvoiceId, /^in_test_\d+$/);
    assert.equal(r.status, "open");
    assert.equal(p.invoices[0].amountUsdCents, 150000);
  });

  it("resolves price ids via lookup_key", async () => {
    const p = new TestBillingProvider();
    assert.equal(
      await p.priceIdFor("regular", "SEATS_1"),
      `price_test_${lookupKeyFor("regular", "SEATS_1")}`,
    );
    assert.equal(
      await p.priceIdFor("max", "SEATS_50_99"),
      `price_test_${lookupKeyFor("max", "SEATS_50_99")}`,
    );
  });
});

describe("TestBillingProvider — subscription lifecycle", () => {
  it("creates a trialing subscription when trialPeriodDays > 0", async () => {
    const p = new TestBillingProvider();
    const cus = await p.createCustomer({
      workspaceId: "ws_1",
      workspaceName: "Acme",
      email: "a@x.test",
    });
    const sub = await p.createSubscription({
      providerCustomerId: cus.providerCustomerId,
      tier: "regular",
      seatBand: "SEATS_1",
      seats: 1,
      trialPeriodDays: 30,
    });
    assert.equal(sub.status, "trialing");
    assert.ok(sub.trialEndsAt instanceof Date, "trialEndsAt must be set");
    assert.ok(
      sub.trialEndsAt!.getTime() > Date.now() + 29 * 24 * 60 * 60 * 1000,
      "trial should end ~30 days out",
    );
    assert.equal(sub.cancelAtPeriodEnd, false);
  });

  it("creates an active subscription when trialPeriodDays is 0/undefined", async () => {
    const p = new TestBillingProvider();
    const sub = await p.createSubscription({
      providerCustomerId: "cus_test_1",
      tier: "plus",
      seatBand: "SEATS_2_9",
      seats: 5,
    });
    assert.equal(sub.status, "active");
    assert.equal(sub.trialEndsAt, null);
  });

  it("retrieves the subscription it just created", async () => {
    const p = new TestBillingProvider();
    const sub = await p.createSubscription({
      providerCustomerId: "cus_test_1",
      tier: "max",
      seatBand: "SEATS_25_49",
      seats: 30,
      trialPeriodDays: 30,
    });
    const retrieved = await p.retrieveSubscription(sub.providerSubscriptionId);
    assert.equal(retrieved.providerSubscriptionId, sub.providerSubscriptionId);
    assert.equal(retrieved.seats, 30);
    assert.equal(retrieved.primaryPriceLookupKey, lookupKeyFor("max", "SEATS_25_49"));
  });

  it("updates tier + seats via updateSubscription", async () => {
    const p = new TestBillingProvider();
    const sub = await p.createSubscription({
      providerCustomerId: "cus_test_1",
      tier: "regular",
      seatBand: "SEATS_1",
      seats: 1,
      trialPeriodDays: 30,
    });
    const updated = await p.updateSubscription({
      providerSubscriptionId: sub.providerSubscriptionId,
      tier: "plus",
      seatBand: "SEATS_10_24",
      seats: 12,
    });
    assert.equal(updated.seats, 12);
    assert.equal(updated.primaryPriceLookupKey, lookupKeyFor("plus", "SEATS_10_24"));
  });

  it("schedules cancellation at period end when atPeriodEnd is true", async () => {
    const p = new TestBillingProvider();
    const sub = await p.createSubscription({
      providerCustomerId: "cus_test_1",
      tier: "regular",
      seatBand: "SEATS_1",
      seats: 1,
      trialPeriodDays: 30,
    });
    const cancelled = await p.cancelSubscription({
      providerSubscriptionId: sub.providerSubscriptionId,
      atPeriodEnd: true,
    });
    assert.equal(cancelled.cancelAtPeriodEnd, true);
    assert.notEqual(cancelled.status, "canceled");
  });

  it("cancels immediately when atPeriodEnd is false", async () => {
    const p = new TestBillingProvider();
    const sub = await p.createSubscription({
      providerCustomerId: "cus_test_1",
      tier: "regular",
      seatBand: "SEATS_1",
      seats: 1,
    });
    const cancelled = await p.cancelSubscription({
      providerSubscriptionId: sub.providerSubscriptionId,
      atPeriodEnd: false,
    });
    assert.equal(cancelled.status, "canceled");
  });
});

describe("TestBillingProvider — checkout + portal", () => {
  it("returns a checkout URL for setup mode", async () => {
    const p = new TestBillingProvider();
    const r = await p.createCheckoutSession({
      mode: "setup",
      providerCustomerId: "cus_test_1",
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/x",
    });
    assert.match(r.id, /^cs_test_\d+$/);
    assert.ok(r.url.startsWith("https://"));
    assert.equal(p.checkoutSessions[0].mode, "setup");
  });

  it("returns a checkout URL for subscription mode", async () => {
    const p = new TestBillingProvider();
    const r = await p.createCheckoutSession({
      mode: "subscription",
      providerCustomerId: "cus_test_1",
      tier: "plus",
      seatBand: "SEATS_2_9",
      seats: 5,
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/x",
      allowPromotionCodes: true,
    });
    assert.ok(r.url.startsWith("https://"));
    assert.equal(p.checkoutSessions[0].mode, "subscription");
    assert.equal(p.checkoutSessions[0].seats, 5);
  });

  it("returns a portal URL", async () => {
    const p = new TestBillingProvider();
    const r = await p.createPortalSession({
      providerCustomerId: "cus_test_1",
      returnUrl: "https://app.test/billing",
    });
    assert.ok(r.url.includes("cus_test_1"));
    assert.equal(p.portalSessions.length, 1);
  });
});

describe("TestBillingProvider — webhook signature verification", () => {
  it("verifies a correctly-signed webhook", async () => {
    const p = new TestBillingProvider({ webhookSecret: "whsec_test" });
    const payload = JSON.stringify({
      id: "evt_1",
      type: "customer.subscription.created",
      data: { object: { id: "sub_1" } },
    });
    const sig = p.signPayloadForTest(payload);
    const r = await p.verifyWebhook({
      rawPayload: payload,
      signatureHeader: sig,
    });
    assert.equal(r.eventId, "evt_1");
    assert.equal(r.eventType, "customer.subscription.created");
  });

  it("rejects a tampered webhook", async () => {
    const p = new TestBillingProvider({ webhookSecret: "whsec_test" });
    const payload = JSON.stringify({ id: "evt_1", type: "x" });
    const sig = p.signPayloadForTest(payload);
    await assert.rejects(
      () =>
        p.verifyWebhook({
          rawPayload: payload + "tampered",
          signatureHeader: sig,
        }),
      /signature/i,
    );
  });

  it("rejects a missing signature", async () => {
    const p = new TestBillingProvider({ webhookSecret: "whsec_test" });
    await assert.rejects(
      () => p.verifyWebhook({ rawPayload: "{}", signatureHeader: null }),
      /signature/i,
    );
  });

  it("rejects a malformed signature header", async () => {
    const p = new TestBillingProvider({ webhookSecret: "whsec_test" });
    await assert.rejects(
      () => p.verifyWebhook({ rawPayload: "{}", signatureHeader: "garbage" }),
      /signature/i,
    );
  });
});
