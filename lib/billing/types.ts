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
  | "unpaid"
  | "paused";

// =====================================================================
// Checkout + portal (the customer-action surface)
// =====================================================================

export interface CreateCheckoutSessionInput {
  /** `setup` collects + attaches a payment method to an existing customer
   *  (used by the "Add payment method" button mid-trial). `subscription`
   *  starts a brand-new subscription (used by upgrade-tier flow + the
   *  wave-2 CC-at-trial signup flow). */
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
  /** Days of trial to attach to the underlying subscription when
   *  mode === "subscription". Forwarded to Stripe as
   *  `subscription_data.trial_period_days`. When omitted, no trial. */
  trialPeriodDays?: number;
  /** When true (mode === "subscription"), Stripe forces card capture
   *  even during the trial. We default this to `"always"` for the
   *  signup flow — that's the whole point of the wave-2 CC-at-trial
   *  pivot. Passed through verbatim as
   *  `payment_method_collection`. */
  paymentMethodCollection?: "always" | "if_required";
  /** Application-side reference threaded onto the Checkout Session and
   *  echoed on `checkout.session.completed`. We use this to link the
   *  workspace at signup so the webhook can resolve it even if the
   *  subscription event arrives first. */
  clientReferenceId?: string;
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
// Refunds — leak-path auto-refund (pfd-4)
// =====================================================================

export interface RefundCustomerChargesInput {
  /** The workspace's Stripe customer id. We refund this customer's most
   *  recent paid, non-refunded charges up to `maxRefundUsdCents`. */
  providerCustomerId: string;
  /** Hard cap on the total refunded across all charges, in USD cents.
   *  The provider stops once the running total would exceed this — it
   *  NEVER refunds a partial charge to hit the cap exactly; it stops at
   *  the last whole charge that fits. */
  maxRefundUsdCents: number;
  /** Idempotency key — the provider passes this to Stripe so a retried
   *  refund of the same workspace is a no-op on Stripe's side. Compose it
   *  from the workspace id (once-per-lifetime), NOT a timestamp. */
  idempotencyKey: string;
  /** Free-form reason recorded on each refund's metadata for the audit
   *  trail (e.g. "unsupported-vertical-auto-refund"). */
  reason: string;
}

export interface RefundedCharge {
  /** Stripe charge id (`ch_*`) that was refunded. */
  chargeId: string;
  /** Stripe refund id (`re_*`). */
  refundId: string;
  /** Amount refunded for this charge, in USD cents. */
  amountUsdCents: number;
}

export interface RefundCustomerChargesResult {
  /** Per-charge refund records (empty when the customer had no eligible
   *  charges — that is a SUCCESS, not an error: nothing to refund). */
  refunds: RefundedCharge[];
  /** Sum of `amountUsdCents` across `refunds`. */
  totalRefundedUsdCents: number;
  /** True when at least one eligible charge was skipped because refunding
   *  it would exceed `maxRefundUsdCents`. The caller pages a human when
   *  this is set (the customer paid more than the cap — needs eyes). */
  hitCap: boolean;
}

// =====================================================================
// Metered billing — token-usage emission
// =====================================================================

export interface ReportMeterEventInput {
  /** The Stripe meter's `event_name` — set during meter creation in the
   *  Stripe Dashboard. Stored in env (`STRIPE_USAGE_METER_EVENT_NAME`)
   *  so the cron, the dashboard, and the provider all share one string. */
  eventName: string;
  /** The workspace's Stripe customer id. The meter's `customer_mapping`
   *  is configured against `stripe_customer_id` in the payload (the
   *  Stripe default). */
  providerCustomerId: string;
  /** Quantity reported on this event. Integer (Stripe meter events
   *  accept integer-or-decimal strings; we round to the nearest unit at
   *  the call site). Per the cron, this is per-workspace summed
   *  micro-cents so the meter's price-per-unit is "1 micro-cent". */
  quantity: number;
  /** Idempotency key — Stripe enforces uniqueness within a 24h rolling
   *  window. We compose this from the workspace id + a UTC date stamp
   *  so retrying the cron the same day no-ops. */
  identifier: string;
  /** Optional UNIX-seconds timestamp. Defaults to "now" at Stripe. We
   *  pass an explicit timestamp so the event sits inside the billing
   *  period the rows belonged to (rather than the cron's wall clock). */
  timestampSeconds?: number;
}

export interface ReportMeterEventResult {
  /** Stripe's returned event identifier — same as `input.identifier`
   *  unless the request omitted it. */
  identifier: string;
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

  // --- Refunds (pfd-4 leak-path auto-refund) ---
  /** Refund a customer's most recent paid charges up to a USD-cents cap.
   *  Idempotent via `idempotencyKey` (Stripe-enforced). The Stripe SDK
   *  call lives inside the provider per feedback_no_silent_vendor_lock —
   *  the refund cron NEVER imports `stripe`. */
  refundCustomerCharges(
    input: RefundCustomerChargesInput,
  ): Promise<RefundCustomerChargesResult>;

  // --- Metered billing — token-usage meter events ---
  /** Report one meter event. Implementations forward to Stripe Billing
   *  Meter Events. The `identifier` is the idempotency key — the same
   *  call within a 24h Stripe window is a no-op on Stripe's side. Per
   *  feedback_no_silent_vendor_lock: the Stripe SDK call lives inside
   *  the provider, not at the cron. */
  reportMeterEvent(
    input: ReportMeterEventInput,
  ): Promise<ReportMeterEventResult>;

  // --- Pricing ---
  /** Resolve the provider-side Price id for (tier, band). Implementations
   *  back this by Stripe `lookup_key`s set up via `scripts/stripe/setup-products.ts`
   *  so the agentplain repo has no hardcoded Price ids. */
  priceIdFor(tier: TierName, band: SeatBand): Promise<string>;

  // --- Webhook ---
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult>;
}
