// In-memory BillingProvider for tests + preview without Stripe credentials.
//
// Mirrors the Stripe provider's behavior on the happy path: webhook
// signature verification uses HMAC-SHA256 against `t.payload` (same
// shape Stripe uses) so tests can exercise the verification logic
// without hitting the real Stripe SDK. Subscription state is held in
// a Map so the same provider instance can satisfy a multi-step test
// (create → retrieve → update → cancel).
//
// Per feedback_runner_portability: this is the "second implementation"
// behind the BillingProvider interface — the existence of two real
// implementations is what makes the abstraction real, not theater.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SeatBand } from "@prisma/client";
import {
  lookupKeyFor,
  type TierName,
} from "@/lib/pricing/tiers";
import type {
  BillingProvider,
  CancelSubscriptionInput,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
  CreatePortalSessionInput,
  CreatePortalSessionResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  ProviderSubscriptionStatus,
  ReportMeterEventInput,
  ReportMeterEventResult,
  RetrieveSubscriptionResult,
  UpdateSubscriptionInput,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./types";

export interface TestBillingProviderOptions {
  webhookSecret?: string;
}

interface InMemorySubscription {
  providerSubscriptionId: string;
  providerCustomerId: string;
  tier: TierName;
  seatBand: SeatBand;
  seats: number;
  status: ProviderSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  defaultPaymentMethodId: string | null;
}

export class TestBillingProvider implements BillingProvider {
  readonly providerName = "test";
  private nextCustomerId = 1;
  private nextSubscriptionId = 1;
  private nextInvoiceId = 1;
  private nextSessionId = 1;
  private readonly webhookSecret: string;

  readonly customers: CreateCustomerInput[] = [];
  readonly invoices: CreateInvoiceInput[] = [];
  readonly subscriptions = new Map<string, InMemorySubscription>();
  readonly checkoutSessions: (CreateCheckoutSessionInput & { id: string })[] = [];
  readonly portalSessions: CreatePortalSessionInput[] = [];

  constructor(opts: TestBillingProviderOptions = {}) {
    this.webhookSecret = opts.webhookSecret ?? "test_whsec";
  }

  // -------------------------------------------------------------------
  // Customer
  // -------------------------------------------------------------------

  async createCustomer(
    input: CreateCustomerInput,
  ): Promise<CreateCustomerResult> {
    this.customers.push(input);
    return { providerCustomerId: `cus_test_${this.nextCustomerId++}` };
  }

  // -------------------------------------------------------------------
  // Pricing
  // -------------------------------------------------------------------

  async priceIdFor(tier: TierName, band: SeatBand): Promise<string> {
    return `price_test_${lookupKeyFor(tier, band)}`;
  }

  // -------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    const id = `sub_test_${this.nextSubscriptionId++}`;
    const now = Date.now();
    const trialEndsAt =
      input.trialPeriodDays && input.trialPeriodDays > 0
        ? new Date(now + input.trialPeriodDays * 24 * 60 * 60 * 1000)
        : null;
    const status: ProviderSubscriptionStatus = trialEndsAt
      ? "trialing"
      : "active";
    // 30-day period from "now" — matches Stripe's default subscription cycle.
    const currentPeriodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000);
    const sub: InMemorySubscription = {
      providerSubscriptionId: id,
      providerCustomerId: input.providerCustomerId,
      tier: input.tier,
      seatBand: input.seatBand,
      seats: input.seats,
      status,
      trialEndsAt,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      defaultPaymentMethodId: null,
    };
    this.subscriptions.set(id, sub);
    return {
      providerSubscriptionId: id,
      status,
      trialEndsAt,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    };
  }

  async updateSubscription(
    input: UpdateSubscriptionInput,
  ): Promise<RetrieveSubscriptionResult> {
    const sub = this.mustGetSubscription(input.providerSubscriptionId);
    if (input.tier) sub.tier = input.tier;
    if (input.seatBand) sub.seatBand = input.seatBand;
    if (typeof input.seats === "number") sub.seats = input.seats;
    return this.toRetrieveResult(sub);
  }

  async cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<RetrieveSubscriptionResult> {
    const sub = this.mustGetSubscription(input.providerSubscriptionId);
    if (input.atPeriodEnd) {
      sub.cancelAtPeriodEnd = true;
    } else {
      sub.status = "canceled";
      sub.cancelAtPeriodEnd = false;
    }
    return this.toRetrieveResult(sub);
  }

  async retrieveSubscription(
    providerSubscriptionId: string,
  ): Promise<RetrieveSubscriptionResult> {
    const sub = this.mustGetSubscription(providerSubscriptionId);
    return this.toRetrieveResult(sub);
  }

  // -------------------------------------------------------------------
  // Checkout + portal
  // -------------------------------------------------------------------

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const id = `cs_test_${this.nextSessionId++}`;
    // Mirror the Stripe provider's default — `payment_method_collection`
    // unset becomes `"always"` for the wave-2 CC-at-trial signup flow.
    // Tests assert on the recorded shape so the default has to live in
    // both providers, not just the real one.
    const recorded: CreateCheckoutSessionInput & { id: string } = {
      ...input,
      id,
      paymentMethodCollection: input.paymentMethodCollection ?? "always",
    };
    this.checkoutSessions.push(recorded);
    const url = `https://checkout.example/test/${id}`;
    return { id, url };
  }

  async createPortalSession(
    input: CreatePortalSessionInput,
  ): Promise<CreatePortalSessionResult> {
    this.portalSessions.push(input);
    return { url: `https://portal.example/test/${input.providerCustomerId}` };
  }

  // -------------------------------------------------------------------
  // Manual invoicing
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Metered billing — captures every reported event in-memory so tests
  // can assert on the cron's emission shape without a Stripe round-trip.
  // -------------------------------------------------------------------

  readonly reportedMeterEvents: ReportMeterEventInput[] = [];

  async reportMeterEvent(
    input: ReportMeterEventInput,
  ): Promise<ReportMeterEventResult> {
    this.reportedMeterEvents.push(input);
    return { identifier: input.identifier };
  }

  // -------------------------------------------------------------------
  // Webhook
  // -------------------------------------------------------------------

  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifyWebhookResult> {
    if (!input.signatureHeader) {
      throw new Error("Missing signature header");
    }
    const parts = Object.fromEntries(
      input.signatureHeader
        .split(",")
        .map((p) => p.split("=").map((x) => x.trim())),
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
  signPayloadForTest(
    payload: string,
    atSeconds: number = Math.floor(Date.now() / 1000),
  ): string {
    const sig = createHmac("sha256", this.webhookSecret)
      .update(`${atSeconds}.${payload}`)
      .digest("hex");
    return `t=${atSeconds},v1=${sig}`;
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private mustGetSubscription(id: string): InMemorySubscription {
    const sub = this.subscriptions.get(id);
    if (!sub) {
      throw new Error(`Subscription ${id} not found in TestBillingProvider`);
    }
    return sub;
  }

  private toRetrieveResult(
    sub: InMemorySubscription,
  ): RetrieveSubscriptionResult {
    return {
      providerSubscriptionId: sub.providerSubscriptionId,
      providerCustomerId: sub.providerCustomerId,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      defaultPaymentMethodId: sub.defaultPaymentMethodId,
      primaryPriceLookupKey: lookupKeyFor(sub.tier, sub.seatBand),
      seats: sub.seats,
    };
  }
}
