// Wave-2 CC-at-trial signup-time checkout helper.
//
// Pre-pivot the signup flow called `provisionTrialSubscriptionSafe` which
// quietly created a Stripe Customer + a `trialing` Subscription with NO
// payment method — the trial-warning email then promised "your card on
// file will be charged" which was false for every customer who signed up
// (audit §6, 2026-05-28).
//
// Post-pivot the signup flow calls `createTrialCheckoutForSignup`. The
// helper creates the Stripe Customer, persists `Workspace.stripeCustomerId`
// (RLS-scoped via the system context — the signup flow has no user
// session yet), then opens a subscription-mode Stripe Checkout Session
// with `subscription_data.trial_period_days` (env.stripeTrialPeriodDays,
// 14 by default) and
// `payment_method_collection="always"`. The customer enters their card
// in Stripe-hosted UI; the underlying subscription is created by
// Checkout (Stripe fires `customer.subscription.created`) and the
// existing `syncSubscription` dispatch upserts the Subscription row by
// `stripeCustomerId` — which is already set on the workspace because
// this helper persisted it before redirecting.
//
// Per `feedback_no_silent_vendor_lock`: every Stripe SDK call lives in
// the `BillingProvider` adapter. This helper composes adapter methods.
//
// Per `feedback_cold_start_safe_agents.md`: no in-memory cache here —
// every call re-reads the active billing provider. Idempotent on retry
// because Stripe's Customer create is idempotent against email when we
// re-use the workspace metadata, and the workspace persist is a column
// write (overwrites the same value).

import type { Prisma } from "@prisma/client";
import { withSystemContext as defaultWithSystemContext } from "@/lib/db";
import { type TierName } from "@/lib/pricing/tiers";
import { env } from "@/lib/env";
import { getBillingProvider } from "./index";
import type { BillingProvider } from "./types";
import type { SystemContextRunner } from "./provisioning";

export interface CreateTrialCheckoutForSignupInput {
  workspaceId: string;
  workspaceName: string;
  email: string;
  tier: TierName;
  /** Initial seat count. Defaults to 1 (solo onboarding); the upgrade
   *  flow (Stripe billing portal) handles seat growth post-signup. */
  seats?: number;
  /** Absolute origin used to build success/cancel return URLs. The
   *  signup flow passes `env.appPublicOrigin()` so the URL matches the
   *  host the customer is actually on. */
  appOrigin: string;
  /** Override for tests; live caller uses `getBillingProvider()`. */
  provider?: BillingProvider;
  /** Override for tests; live caller uses `withSystemContext`. */
  systemContext?: SystemContextRunner;
}

export interface CreateTrialCheckoutForSignupResult {
  /** URL to redirect the browser to — Stripe-hosted Checkout. */
  checkoutUrl: string;
  /** The Stripe Customer id we provisioned + persisted on the workspace.
   *  Returned for tests/audit; the live caller does not consume it. */
  providerCustomerId: string;
  /** The Checkout Session id — handy for audit logs + debugging. */
  sessionId: string;
}

/**
 * Creates a Stripe Customer for the freshly-signed-up workspace, persists
 * `Workspace.stripeCustomerId`, and returns a Stripe-hosted Checkout
 * Session URL configured with `trial_period_days` (14 by default) +
 * `payment_method_collection="always"`. The caller redirects the browser
 * to that URL.
 *
 * Throws on any provider/persist failure. The signup action wraps this
 * call in a try/catch and surfaces a fallback path (manual provisioning
 * + magic-link verify) so a Stripe outage does not strand the customer
 * mid-signup.
 */
export async function createTrialCheckoutForSignup(
  input: CreateTrialCheckoutForSignupInput,
): Promise<CreateTrialCheckoutForSignupResult> {
  const provider = input.provider ?? getBillingProvider();
  const withSystemContext: SystemContextRunner =
    input.systemContext ?? defaultWithSystemContext;
  const seats = input.seats ?? 1;

  const customer = await provider.createCustomer({
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    email: input.email,
    metadata: {
      agentplain_signup_flow: "checkout_at_signup",
    },
  });

  // Persist BEFORE creating the Checkout session so that the subsequent
  // `customer.subscription.created` webhook (which may arrive before
  // `checkout.session.completed`) can resolve the workspace by
  // `stripeCustomerId`. Race-safe.
  await withSystemContext(async (tx) => {
    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: {
        stripeCustomerId: customer.providerCustomerId,
        billingMode: "STRIPE_SUBSCRIPTION",
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        action: "billing.signup_customer_created",
        targetTable: "Workspace",
        targetId: input.workspaceId,
        payload: {
          providerCustomerId: customer.providerCustomerId,
          tier: input.tier,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  const baseOrigin = input.appOrigin.replace(/\/$/, "");
  const successUrl =
    `${baseOrigin}/app/sign-up/checkout-success` +
    `?session_id={CHECKOUT_SESSION_ID}&workspace=${encodeURIComponent(input.workspaceId)}`;
  const cancelUrl =
    `${baseOrigin}/app/sign-up?cancelled=1&workspace=${encodeURIComponent(input.workspaceId)}`;

  const session = await provider.createCheckoutSession({
    mode: "subscription",
    providerCustomerId: customer.providerCustomerId,
    tier: input.tier,
    seatBand: "SEATS_1",
    seats,
    successUrl,
    cancelUrl,
    trialPeriodDays: env.stripeTrialPeriodDays(),
    paymentMethodCollection: "always",
    clientReferenceId: input.workspaceId,
    metadata: {
      agentplain_workspace_id: input.workspaceId,
      agentplain_signup_flow: "checkout_at_signup",
    },
  });

  await withSystemContext(async (tx) => {
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        action: "billing.signup_checkout_session_created",
        targetTable: "stripe_checkout_session",
        targetId: session.id,
        payload: {
          providerCustomerId: customer.providerCustomerId,
          tier: input.tier,
          seats,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  return {
    checkoutUrl: session.url,
    providerCustomerId: customer.providerCustomerId,
    sessionId: session.id,
  };
}
