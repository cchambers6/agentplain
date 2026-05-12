// BillingProvider abstraction.
//
// Phase 1 (manual-invoice for the first ~5 high-touch customers) and
// Phase 2 (self-serve per-seat subscription with 30-day trial) both
// flow through this interface. Per `feedback_no_silent_vendor_lock` +
// `feedback_runner_portability`, every Stripe SDK call lives behind
// these methods; routes/pages NEVER import the `stripe` package
// directly.
//
// Two implementations satisfy the two-implementation rule:
//   * `StripeBillingProvider` — production
//   * `TestBillingProvider`   — tests / preview without Stripe creds
//
// Adding a method here = adding it to BOTH implementations. The
// `node --test` suite enforces that via the provider contract tests.

import type { SeatBand } from "@prisma/client";
import type { TierName } from "@/lib/pricing/tiers";

// =====================================================================
// Customer
// =====================================================================

export interface CreateCustomerInput {
  workspaceId: string;
  workspaceName: string;
  email: string;
  metadata?: Record<string, string>;
}

export interface CreateCustomerResult {
  /** Provider-side customer id (Stripe `cus_*`). */
  providerCustomerId: string;
}

// =====================================================================
// Subscription
// =====================================================================

export interface CreateSubscriptionInput {
  providerCustomerId: string;
  tier: TierName;
  seatBand: SeatBand;
  seats: number;
  /** When set, Stripe creates the subscription in `trialing` status with
   *  no payment-method requirement (the agentplain default at signup). */
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionResult {
  providerSubscriptionId: string;
  status: ProviderSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface UpdateSubscriptionInput {
  providerSubscriptionId: string;
  tier?: TierName;
  seatBand?: SeatBand;
  seats?: number;
  /** Stripe proration_behavior. Defaults to `create_prorations`. */
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
}

export interface CancelSubscriptionInput {
  providerSubscriptionId: string;
  /** When true, schedules cancel at period end (customer keeps access
   *  through the paid window). When false, cancels immediately. */
  atPeriodEnd: boolean;
}

export interface RetrieveSubscriptionResult {
  providerSubscriptionId: string;
  providerCustomerId: string;
  status: ProviderSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  defaultPaymentMethodId: string | null;
  /** Active price's lookup_key. Used to read back tier/seatBand at sync time. */
  primaryPriceLookupKey: string | null;
  /** Subscription quantity (seat count) on the primary line item. */
  seats: number;
}

export type ProviderSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "canceled"
  | "unpaid";

// =====================================================================
// Checkout + portal (the customer-action surface)
// =====================================================================

export interface CreateCheckoutSessionInput {
  /** `setup` collects + attaches a payment method to an existing customer
   *  (used by the "Add payment method" button mid-trial). `subscription`
   *  starts a brand-new subscription (used by upgrade-tier flow). */
  mode: "setup" | "subscription";
  providerCustomerId: string;
  /** Required when mode === "subscription". */
  tier?: TierName;
  seatBand?: SeatBand;
  seats?: number;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes?: boolean;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionResult {
  /** Absolute URL to redirect the browser to. */
  url: string;
  id: string;
}

export interface CreatePortalSessionInput {
  providerCustomerId: string;
  returnUrl: string;
}

export interface CreatePortalSessionResult {
  url: string;
}

// =====================================================================
// Manual invoicing (Phase 1, retained)
// =====================================================================

export interface CreateInvoiceInput {
  providerCustomerId: string;
  amountUsdCents: number;
  description: string;
  /** Optional Stripe Price id; omit for ad-hoc invoice line items. */
  priceId?: string;
  metadata?: Record<string, string>;
}

export interface CreateInvoiceResult {
  providerInvoiceId: string;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  status: string;
}

// =====================================================================
// Webhook
// =====================================================================

export interface VerifyWebhookInput {
  rawPayload: string | Buffer;
  signatureHeader: string | null;
}

export interface VerifyWebhookResult {
  /** Provider event id (Stripe `evt_*`). */
  eventId: string;
  eventType: string;
  /** The signature-verified parsed event body. Shape is provider-specific. */
  data: unknown;
}

// =====================================================================
// Provider contract
// =====================================================================

export interface BillingProvider {
  readonly providerName: string;

  // --- Customer ---
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;

  // --- Subscription ---
  createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<CreateSubscriptionResult>;
  updateSubscription(
    input: UpdateSubscriptionInput,
  ): Promise<RetrieveSubscriptionResult>;
  cancelSubscription(
    input: CancelSubscriptionInput,
  ): Promise<RetrieveSubscriptionResult>;
  retrieveSubscription(
    providerSubscriptionId: string,
  ): Promise<RetrieveSubscriptionResult>;

  // --- Checkout + portal ---
  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult>;
  createPortalSession(
    input: CreatePortalSessionInput,
  ): Promise<CreatePortalSessionResult>;

  // --- Manual invoicing (Phase 1 high-touch) ---
  createManualInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult>;

  // --- Pricing ---
  /** Resolve the provider-side Price id for (tier, band). Implementations
   *  back this by Stripe `lookup_key`s set up via `scripts/stripe/setup-products.ts`
   *  so the agentplain repo has no hardcoded Price ids. */
  priceIdFor(tier: TierName, band: SeatBand): Promise<string>;

  // --- Webhook ---
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult>;
}
