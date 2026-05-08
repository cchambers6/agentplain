// BillingProvider abstraction.
//
// Phase 1 is pipes-ready, manual-invoicing for first ~5 brokerages per
// project_stripe_both_surfaces and engineering_plan §7.2. Phase 2 wires
// self-serve checkout to the same interface.
//
// The interface stays intentionally narrow. Self-serve checkout flows,
// subscription portals, and dunning land as new methods (additive) when
// Phase 2 / 3 needs them.

export type BillingTier = "tier_1" | "tier_2" | "tier_3";
export type BillingCadence = "monthly" | "annual";

export interface CreateCustomerInput {
  workspaceId: string;
  workspaceName: string;
  email: string;
  /** Free-form metadata stored on the provider customer object. */
  metadata?: Record<string, string>;
}

export interface CreateCustomerResult {
  /** Provider-side customer id (Stripe `cus_*`). */
  providerCustomerId: string;
}

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

export interface VerifyWebhookInput {
  rawPayload: string | Buffer;
  signatureHeader: string | null;
}

export interface VerifyWebhookResult {
  /** Provider event id (Stripe `evt_*`). */
  eventId: string;
  eventType: string;
  /** The signature-verified parsed body. Shape is provider-specific. */
  data: unknown;
}

export interface BillingProvider {
  readonly providerName: string;

  /** Resolve a Stripe Price id for a tier+cadence combo. */
  priceIdFor(tier: BillingTier, cadence: BillingCadence): string;

  /** Create the provider-side customer (Stripe customers.create). */
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;

  /** Create a manual invoice (Phase 1 high-touch tier). */
  createManualInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult>;

  /**
   * Verify an inbound webhook's signature. Throws on mismatch. Returns the
   * parsed event for handler dispatch.
   */
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult>;
}
