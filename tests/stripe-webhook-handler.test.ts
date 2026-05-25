/**
 * tests/stripe-webhook-handler.test.ts
 *
 * Stripe-webhook test parity. Complements two existing suites:
 *
 *   - `tests/stripe-webhook-route.test.ts` already covers `dispatchEvent`
 *     in isolation (subscription created/updated/trial_will_end/deleted +
 *     invoice.paid + invoice.payment_failed + unhandled-event audit row).
 *   - `tests/billing-stripe-provider.test.ts` covers the Stripe-shape
 *     translation behind the BillingProvider abstraction.
 *
 * This suite plugs the gap at the route + provider seam:
 *
 *   1. The route handler `POST /api/stripe/webhook` short-circuits with
 *      400 when the `stripe-signature` header is missing OR when the
 *      signature does not match the raw body.
 *   2. The BillingProvider verification uses the RAW body, NOT a JSON
 *      re-serialization. A refactor that replaces `await req.text()`
 *      with `JSON.stringify(await req.json())` will break the signature
 *      because Stripe signs whitespace + key-order verbatim.
 *   3. The full subscription/billing lifecycle event types each verify +
 *      parse cleanly through `verifyWebhook` and emerge with the right
 *      eventId + eventType — the contract `dispatchEvent` depends on.
 *
 * Per `feedback_no_silent_vendor_lock.md`: we use `TestBillingProvider`,
 * never the live Stripe SDK. The signature scheme matches Stripe's
 * (t=..,v1=hmacSha256(t.payload, secret)) so a regression that swapped
 * the test provider's verify for a JSON-roundtrip would also break Stripe.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  __setBillingProviderForTests,
  TestBillingProvider,
} from "@/lib/billing";

// ---------------------------------------------------------------------
// Route-level: missing + tampered signature paths.
// These 400 BEFORE withSystemContext is invoked, so no DB shim is needed.
// ---------------------------------------------------------------------

describe("POST /api/stripe/webhook — signature verification (route)", () => {
  let testProvider: TestBillingProvider;

  beforeEach(() => {
    testProvider = new TestBillingProvider({
      webhookSecret: "whsec_test_route_handler",
    });
    __setBillingProviderForTests(testProvider);
  });

  afterEach(() => {
    __setBillingProviderForTests(null);
  });

  it("400s when the stripe-signature header is missing", async () => {
    const route = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: '{"id":"evt_x","type":"customer.subscription.created","data":{}}',
      headers: { "content-type": "application/json" },
    });
    const res = await route.POST(req as never);
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "Invalid signature");
  });

  it("400s when the signature does not match the raw body", async () => {
    const route = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: '{"id":"evt_x","type":"customer.subscription.created","data":{}}',
      headers: {
        "content-type": "application/json",
        "stripe-signature":
          "t=1,v1=deadbeef00000000000000000000000000000000000000000000000000000000",
      },
    });
    const res = await route.POST(req as never);
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "Invalid signature");
  });
});

// ---------------------------------------------------------------------
// Provider-level: raw-body signing + full lifecycle event coverage.
// These exercise the contract between BillingProvider.verifyWebhook and
// the route, so a regression in either layer trips a test here.
// ---------------------------------------------------------------------

describe("BillingProvider.verifyWebhook — raw body + lifecycle parity", () => {
  let provider: TestBillingProvider;

  beforeEach(() => {
    provider = new TestBillingProvider({ webhookSecret: "whsec_raw_body" });
  });

  it("signature is computed over the RAW body, not a re-serialization", async () => {
    // Body whose JSON representation is NOT canonical (extra whitespace
    // + key order Stripe's payloads use). A refactor that round-trips
    // through JSON.parse + JSON.stringify before verifying will damage
    // these bytes and the HMAC will diverge.
    const rawPayload =
      '{ "id":"evt_raw_check", "type":"customer.subscription.created", "data":{}}';
    const signature = provider.signPayloadForTest(rawPayload);

    const verified = await provider.verifyWebhook({
      rawPayload,
      signatureHeader: signature,
    });
    assert.equal(verified.eventId, "evt_raw_check");
    assert.equal(verified.eventType, "customer.subscription.created");
  });

  it("rejects a payload that has been re-serialized after signing (catches the regression)", async () => {
    const rawPayload =
      '{ "id":"evt_raw_check", "type":"customer.subscription.created", "data":{}}';
    const signature = provider.signPayloadForTest(rawPayload);

    // Round-trip — strips whitespace, may reorder keys. HMAC must reject.
    const reserialized = JSON.stringify(JSON.parse(rawPayload));
    assert.notEqual(reserialized, rawPayload); // sanity: the bytes differ

    await assert.rejects(
      provider.verifyWebhook({
        rawPayload: reserialized,
        signatureHeader: signature,
      }),
      /Signature verification failed/,
    );
  });

  it("rejects a payload signed with a different secret", async () => {
    const rawPayload = JSON.stringify({
      id: "evt_x",
      type: "customer.subscription.created",
      data: {},
    });
    const otherProvider = new TestBillingProvider({
      webhookSecret: "whsec_wrong",
    });
    const forgedSignature = otherProvider.signPayloadForTest(rawPayload);
    await assert.rejects(
      provider.verifyWebhook({
        rawPayload,
        signatureHeader: forgedSignature,
      }),
      /Signature verification failed/,
    );
  });

  it("rejects a malformed signature header", async () => {
    const rawPayload = JSON.stringify({
      id: "evt_x",
      type: "customer.subscription.created",
      data: {},
    });
    await assert.rejects(
      provider.verifyWebhook({
        rawPayload,
        signatureHeader: "not-a-valid-stripe-sig",
      }),
      /Malformed signature header|Signature verification failed/,
    );
  });

  it("verifies + parses each lifecycle event type the dispatcher expects", async () => {
    const lifecycleTypes = [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.trial_will_end",
      "customer.subscription.deleted",
      "invoice.created",
      "invoice.finalized",
      "invoice.paid",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
      "invoice.voided",
      // An unhandled type the dispatcher should still survive — pinning
      // this here ensures the verify layer doesn't filter by allow-list.
      "setup_intent.succeeded",
    ];

    for (const type of lifecycleTypes) {
      const rawPayload = JSON.stringify({
        id: `evt_${type.replace(/\./g, "_")}`,
        type,
        data: { object: { id: "sub_or_inv_x", customer: "cus_x" } },
      });
      const signature = provider.signPayloadForTest(rawPayload);
      const verified = await provider.verifyWebhook({
        rawPayload,
        signatureHeader: signature,
      });
      assert.equal(verified.eventType, type, `eventType for ${type}`);
      assert.equal(
        verified.eventId,
        `evt_${type.replace(/\./g, "_")}`,
        `eventId for ${type}`,
      );
    }
  });
});
