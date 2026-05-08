// In-memory BillingProvider for tests + dev without Stripe credentials.
// Webhook verification is a noop that JSON-parses the body — wire your tests
// up to call this directly with a known-shaped payload.

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  BillingCadence,
  BillingProvider,
  BillingTier,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./types";

export interface TestBillingProviderOptions {
  webhookSecret?: string;
}

export class TestBillingProvider implements BillingProvider {
  readonly providerName = "test";
  private nextCustomerId = 1;
  private nextInvoiceId = 1;
  private readonly webhookSecret: string;

  readonly customers: CreateCustomerInput[] = [];
  readonly invoices: CreateInvoiceInput[] = [];

  constructor(opts: TestBillingProviderOptions = {}) {
    this.webhookSecret = opts.webhookSecret ?? "test_whsec";
  }

  priceIdFor(tier: BillingTier, cadence: BillingCadence): string {
    return `price_test_${tier}_${cadence}`;
  }

  async createCustomer(
    input: CreateCustomerInput,
  ): Promise<CreateCustomerResult> {
    this.customers.push(input);
    return { providerCustomerId: `cus_test_${this.nextCustomerId++}` };
  }

  async createManualInvoice(
    input: CreateInvoiceInput,
  ): Promise<CreateInvoiceResult> {
    this.invoices.push(input);
    const id = `in_test_${this.nextInvoiceId++}`;
    return {
      providerInvoiceId: id,
      hostedInvoiceUrl: `https://invoice.example/${id}`,
      pdfUrl: `https://invoice.example/${id}.pdf`,
      status: "open",
    };
  }

  /**
   * Test webhook verification: signature header is "t=...,v1=hmac_sha256(payload, secret)".
   * Mirrors the shape Stripe uses so we can exercise verification logic without the SDK.
   */
  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifyWebhookResult> {
    if (!input.signatureHeader) {
      throw new Error("Missing signature header");
    }
    const parts = Object.fromEntries(
      input.signatureHeader.split(",").map((p) => p.split("=").map((x) => x.trim())),
    );
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) throw new Error("Malformed signature header");
    const payload =
      typeof input.rawPayload === "string"
        ? input.rawPayload
        : input.rawPayload.toString("utf8");
    const expected = createHmac("sha256", this.webhookSecret)
      .update(`${t}.${payload}`)
      .digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Signature verification failed");
    }
    const parsed = JSON.parse(payload);
    return {
      eventId: parsed.id ?? "evt_test",
      eventType: parsed.type ?? "test.event",
      data: parsed.data ?? {},
    };
  }

  /** Helper for tests: produce a valid signature header for a payload. */
  signPayloadForTest(payload: string, atSeconds: number = Math.floor(Date.now() / 1000)): string {
    const sig = createHmac("sha256", this.webhookSecret)
      .update(`${atSeconds}.${payload}`)
      .digest("hex");
    return `t=${atSeconds},v1=${sig}`;
  }
}
