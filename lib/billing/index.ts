// Billing boundary entry point. One swap point.
//
// Stripe Prices are resolved by `lookup_key` via the setup script — see
// `scripts/stripe/setup-products.ts` + `docs/billing/SETUP.md`. The
// agentplain repo holds zero hardcoded Price ids (per
// feedback_no_quick_fixes — the right fix is lookup_key resolution, not
// 15 brittle env vars).

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
export { TestBillingProvider } from "./test-provider";
export { StripeBillingProvider } from "./stripe-provider";
