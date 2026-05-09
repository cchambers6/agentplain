// Billing boundary entry point. One swap point.

import { env } from "../env";
import { StripeBillingProvider } from "./stripe-provider";
import { TestBillingProvider } from "./test-provider";
import type { BillingProvider } from "./types";

let cached: BillingProvider | null = null;

export function getBillingProvider(): BillingProvider {
  if (cached) return cached;
  switch (env.billingProvider()) {
    case "test":
      cached = new TestBillingProvider();
      break;
    case "stripe":
    default:
      cached = new StripeBillingProvider({
        secretKey: env.stripeSecretKey(),
        webhookSecret: env.stripeWebhookSecret(),
        prices: {
          tier_1_monthly: env.stripePriceTier1(),
          tier_2_monthly: env.stripePriceTier2(),
          tier_3_monthly: env.stripePriceTier3(),
          tier_1_annual: env.stripePriceTier1Annual(),
          tier_2_annual: env.stripePriceTier2Annual(),
          tier_3_annual: env.stripePriceTier3Annual(),
        },
      });
      break;
  }
  return cached;
}

export function __setBillingProviderForTests(p: BillingProvider | null): void {
  cached = p;
}

export type {
  BillingProvider,
  BillingTier,
  BillingCadence,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./types";
export { TestBillingProvider } from "./test-provider";
export { StripeBillingProvider } from "./stripe-provider";
