// Stripe-backed BillingProvider. All Stripe SDK access lives here.
//
// Webhook signature verification uses STRIPE_WEBHOOK_SECRET, which is a
// production-tier secret (per feedback_no_prod_secrets_in_dev). Preview
// + Development use a separate test-mode signing secret.

import Stripe from "stripe";
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

export interface StripeProviderOptions {
  secretKey: string;
  webhookSecret: string;
  prices: {
    tier_1_monthly: string;
    tier_2_monthly: string;
    tier_3_monthly: string;
    tier_1_annual?: string;
    tier_2_annual?: string;
    tier_3_annual?: string;
  };
  /** Override for tests; provide a Stripe-shaped test double. */
  client?: Pick<Stripe, "customers" | "invoices" | "invoiceItems" | "webhooks">;
  /** Override the API version pin if needed. */
  apiVersion?: ConstructorParameters<typeof Stripe>[1] extends infer C
    ? C extends { apiVersion?: infer A }
      ? A
      : never
    : never;
}

export class StripeBillingProvider implements BillingProvider {
  readonly providerName = "stripe";
  private readonly client: Pick<
    Stripe,
    "customers" | "invoices" | "invoiceItems" | "webhooks"
  >;
  private readonly webhookSecret: string;
  private readonly prices: StripeProviderOptions["prices"];

  constructor(opts: StripeProviderOptions) {
    this.client =
      opts.client ??
      new Stripe(opts.secretKey, {
        // Pinned per feedback_no_silent_vendor_lock — bump deliberately when reviewing changelogs.
        apiVersion: opts.apiVersion ?? "2026-04-22.dahlia",
      });
    this.webhookSecret = opts.webhookSecret;
    this.prices = opts.prices;
  }

  priceIdFor(tier: BillingTier, cadence: BillingCadence): string {
    const key = `${tier}_${cadence}` as const;
    const v = this.prices[key];
    if (!v) {
      throw new Error(`Stripe price not configured for ${key}`);
    }
    return v;
  }

  async createCustomer(
    input: CreateCustomerInput,
  ): Promise<CreateCustomerResult> {
    const customer = await this.client.customers.create({
      email: input.email,
      name: input.workspaceName,
      metadata: {
        agentplain_workspace_id: input.workspaceId,
        ...(input.metadata ?? {}),
      },
    });
    return { providerCustomerId: customer.id };
  }

  async createManualInvoice(
    input: CreateInvoiceInput,
  ): Promise<CreateInvoiceResult> {
    const invoice = await this.client.invoices.create({
      customer: input.providerCustomerId,
      collection_method: "send_invoice",
      days_until_due: 30,
      auto_advance: false,
      description: input.description,
      metadata: input.metadata ?? {},
    });
    if (!invoice.id) {
      throw new Error("Stripe did not return an invoice id");
    }

    if (input.priceId) {
      await this.client.invoiceItems.create({
        customer: input.providerCustomerId,
        invoice: invoice.id,
        pricing: { price: input.priceId },
      });
    } else {
      await this.client.invoiceItems.create({
        customer: input.providerCustomerId,
        invoice: invoice.id,
        amount: input.amountUsdCents,
        currency: "usd",
        description: input.description,
      });
    }

    const finalized = await this.client.invoices.finalizeInvoice(invoice.id);
    return {
      providerInvoiceId: finalized.id ?? invoice.id,
      hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
      pdfUrl: finalized.invoice_pdf ?? null,
      status: finalized.status ?? "draft",
    };
  }

  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifyWebhookResult> {
    if (!input.signatureHeader) {
      throw new Error("Missing Stripe-Signature header");
    }
    const event = await this.client.webhooks.constructEventAsync(
      input.rawPayload,
      input.signatureHeader,
      this.webhookSecret,
    );
    return {
      eventId: event.id,
      eventType: event.type,
      data: event.data,
    };
  }
}
