import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TestBillingProvider } from "@/lib/billing";

describe("TestBillingProvider", () => {
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

  it("creates manual invoices", async () => {
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

  it("resolves price ids for tiers", () => {
    const p = new TestBillingProvider();
    assert.equal(
      p.priceIdFor("tier_1", "monthly"),
      "price_test_tier_1_monthly",
    );
    assert.equal(
      p.priceIdFor("tier_3", "annual"),
      "price_test_tier_3_annual",
    );
  });

  it("verifies a correctly-signed webhook", async () => {
    const p = new TestBillingProvider({ webhookSecret: "whsec_test" });
    const payload = JSON.stringify({
      id: "evt_1",
      type: "invoice.paid",
      data: { object: { id: "in_1" } },
    });
    const sig = p.signPayloadForTest(payload);
    const r = await p.verifyWebhook({
      rawPayload: payload,
      signatureHeader: sig,
    });
    assert.equal(r.eventId, "evt_1");
    assert.equal(r.eventType, "invoice.paid");
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
