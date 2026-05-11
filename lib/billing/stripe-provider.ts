// Stripe-backed BillingProvider. All Stripe SDK access lives in this file
// per feedback_no_silent_vendor_lock.
//
// Pricing is resolved by Stripe `lookup_key` (see `lib/pricing/tiers.ts`
// `lookupKeyFor`). Provisioning the underlying Products + Prices is the
// job of `scripts/stripe/setup-products.ts`. This provider's first read
// of each lookup key warms an in-memory cache; subsequent reads are
// constant-time. Cache lifetime is the process lifetime — fine for
// Vercel serverless where each invocation is fresh and Stripe's price
// catalog is amend-only.

import Stripe from "stripe";
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
  RetrieveSubscriptionResult,
  UpdateSubscriptionInput,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./types";

// Stripe API version pin. Bump deliberately when reviewing changelogs.
// Per feedback_no_silent_vendor_lock: vendor SDK pin lives behind the
// adapter, not on individual call sites.
export const STRIPE_API_VERSION = "2026-04-22.dahlia";

type StripeClientSurface = Pick<
  Stripe,
  | "customers"
  | "subscriptions"
  | "invoices"
  | "invoiceItems"
  | "checkout"
  | "billingPortal"
  | "prices"
  | "webhooks"
>;

export interface StripeProviderOptions {
  secretKey: string;
  webhookSecret: string;
  /** Override for tests; provide a Stripe-shaped test double. */
  client?: StripeClientSurface;
}

export class StripeBillingProvider implements BillingProvider {
  readonly providerName = "stripe";
  private readonly client: StripeClientSurface;
  private readonly webhookSecret: string;
  private readonly priceIdCache = new Map<string, string>();

  constructor(opts: StripeProviderOptions) {
    this.client =
      opts.client ??
      new Stripe(opts.secretKey, {
        apiVersion: STRIPE_API_VERSION,
      });
    this.webhookSecret = opts.webhookSecret;
  }

  // -------------------------------------------------------------------
  // Customer
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Pricing — lookup_key resolution
  // -------------------------------------------------------------------

  async priceIdFor(tier: TierName, band: SeatBand): Promise<string> {
    const key = lookupKeyFor(tier, band);
    const cached = this.priceIdCache.get(key);
    if (cached) return cached;
    const list = await this.client.prices.list({
      lookup_keys: [key],
      active: true,
      limit: 1,
    });
    const price = list.data[0];
    if (!price) {
      throw new Error(
        `Stripe Price with lookup_key="${key}" not found. Run scripts/stripe/setup-products.ts to provision the agentplain Products + Prices.`,
      );
    }
    this.priceIdCache.set(key, price.id);
    return price.id;
  }

  // -------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult> {
    const priceId = await this.priceIdFor(input.tier, input.seatBand);
    const sub = await this.client.subscriptions.create({
      customer: input.providerCustomerId,
      items: [{ price: priceId, quantity: input.seats }],
      ...(input.trialPeriodDays && input.trialPeriodDays > 0
        ? {
            trial_period_days: input.trialPeriodDays,
            // Without payment_behavior=default_incomplete + trial_settings,
            // Stripe still allows trial-without-card. Explicitly setting
            // trial_settings prevents Stripe from cancelling the trial
            // when no payment method is supplied (the agentplain default).
            trial_settings: {
              end_behavior: { missing_payment_method: "pause" },
            },
            // payment_settings.save_default_payment_method `on_subscription`
            // keeps the eventual portal-attached PM as the subscription
            // default. No effect at trial start.
            payment_settings: {
              save_default_payment_method: "on_subscription",
            },
          }
        : {}),
      metadata: {
        agentplain_tier: input.tier,
        agentplain_seat_band: input.seatBand,
        ...(input.metadata ?? {}),
      },
    });
    return {
      providerSubscriptionId: sub.id,
      status: sub.status as ProviderSubscriptionStatus,
      trialEndsAt: epochToDate(sub.trial_end),
      // 2026-04-22.dahlia moved current_period_end onto each subscription
      // item — read it off the primary line.
      currentPeriodEnd: epochToDate(sub.items.data[0]?.current_period_end),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  }

  async updateSubscription(
    input: UpdateSubscriptionInput,
  ): Promise<RetrieveSubscriptionResult> {
    // Fetch the existing subscription to find the line-item id to update.
    const existing = await this.client.subscriptions.retrieve(
      input.providerSubscriptionId,
    );
    const primary = existing.items.data[0];
    if (!primary) {
      throw new Error(
        `Subscription ${input.providerSubscriptionId} has no items — cannot update tier/seats.`,
      );
    }

    const newPriceId =
      input.tier && input.seatBand
        ? await this.priceIdFor(input.tier, input.seatBand)
        : primary.price.id;

    const updated = await this.client.subscriptions.update(
      input.providerSubscriptionId,
      {
        items: [
          {
            id: primary.id,
            price: newPriceId,
            quantity: input.seats ?? primary.quantity ?? 1,
          },
        ],
        proration_behavior: input.prorationBehavior ?? "create_prorations",
      },
    );
    return mapStripeSubscriptionToResult(updated);
  }

  async cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<RetrieveSubscriptionResult> {
    if (input.atPeriodEnd) {
      const updated = await this.client.subscriptions.update(
        input.providerSubscriptionId,
        { cancel_at_period_end: true },
      );
      return mapStripeSubscriptionToResult(updated);
    }
    const canceled = await this.client.subscriptions.cancel(
      input.providerSubscriptionId,
    );
    return mapStripeSubscriptionToResult(canceled);
  }

  async retrieveSubscription(
    providerSubscriptionId: string,
  ): Promise<RetrieveSubscriptionResult> {
    const sub = await this.client.subscriptions.retrieve(providerSubscriptionId);
    return mapStripeSubscriptionToResult(sub);
  }

  // -------------------------------------------------------------------
  // Checkout + portal
  // -------------------------------------------------------------------

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    if (input.mode === "setup") {
      const session = await this.client.checkout.sessions.create({
        mode: "setup",
        customer: input.providerCustomerId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        payment_method_types: ["card"],
        metadata: input.metadata ?? {},
      });
      return ensureCheckoutUrl(session);
    }

    if (!input.tier || !input.seatBand || !input.seats) {
      throw new Error(
        "createCheckoutSession(mode: subscription) requires tier, seatBand, seats",
      );
    }
    const priceId = await this.priceIdFor(input.tier, input.seatBand);
    const session = await this.client.checkout.sessions.create({
      mode: "subscription",
      customer: input.providerCustomerId,
      line_items: [{ price: priceId, quantity: input.seats }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: input.allowPromotionCodes ?? true,
      metadata: input.metadata ?? {},
    });
    return ensureCheckoutUrl(session);
  }

  async createPortalSession(
    input: CreatePortalSessionInput,
  ): Promise<CreatePortalSessionResult> {
    const session = await this.client.billingPortal.sessions.create({
      customer: input.providerCustomerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  // -------------------------------------------------------------------
  // Manual invoicing (Phase 1, retained)
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Webhook
  // -------------------------------------------------------------------

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

// =====================================================================
// Helpers
// =====================================================================

function ensureCheckoutUrl(
  session: Stripe.Checkout.Session,
): CreateCheckoutSessionResult {
  if (!session.url) {
    throw new Error(
      `Stripe checkout.sessions.create returned no url (session ${session.id})`,
    );
  }
  return { url: session.url, id: session.id };
}

function epochToDate(epochSeconds: number | null | undefined): Date | null {
  if (!epochSeconds) return null;
  return new Date(epochSeconds * 1000);
}

function mapStripeSubscriptionToResult(
  sub: Stripe.Subscription,
): RetrieveSubscriptionResult {
  const primary = sub.items.data[0];
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const defaultPm =
    typeof sub.default_payment_method === "string"
      ? sub.default_payment_method
      : sub.default_payment_method?.id ?? null;
  return {
    providerSubscriptionId: sub.id,
    providerCustomerId: customerId,
    status: sub.status as ProviderSubscriptionStatus,
    trialEndsAt: epochToDate(sub.trial_end),
    // current_period_end lives on the subscription item in 2026-04-22.dahlia.
    currentPeriodEnd: epochToDate(primary?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    defaultPaymentMethodId: defaultPm,
    primaryPriceLookupKey: primary?.price.lookup_key ?? null,
    seats: primary?.quantity ?? 1,
  };
}
