// Billing provisioning helpers. Called by the signup flow after the
// workspace transaction commits, and by the trial-expiration cron when
// a workspace is missing its subscription (best-effort retry path).
//
// Per feedback_max_friction_reduction_for_trials rules #1 + #5: signup
// must never block on Stripe being down. If provisioning fails, the
// workspace still exists; the cron + the next billing-page render
// surface the missing-subscription state and we retry. Per the brief's
// `trial_period_days: 30` directive, no card is collected at signup —
// the trial-end flow drives card-on-file capture later.

import type {
  Prisma,
  Workspace,
  WorkspaceVerticalTier,
} from "@prisma/client";
import {
  TRIAL_PERIOD_DAYS,
  tierFromVerticalTier,
  type TierName,
} from "@/lib/pricing/tiers";
import { withSystemContext as defaultWithSystemContext } from "@/lib/db";
import type { DbTransactionClient } from "@/lib/db";
import { getBillingProvider } from "./index";
import type {
  BillingProvider,
  ProviderSubscriptionStatus,
} from "./types";

/** Function that runs a callback against the system/operator RLS context.
 *  Production callers pass nothing and pick up the real implementation;
 *  tests inject a fake-tx runner so the unit doesn't need Postgres. */
export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

export interface ProvisionTrialSubscriptionInput {
  workspaceId: string;
  workspaceName: string;
  email: string;
  verticalTier: WorkspaceVerticalTier;
  /** Initial seat count; defaults to 1 (solo onboarding). Per
   *  feedback_max_friction_reduction_for_trials rule #6 there is no
   *  minimum-seats requirement. */
  seats?: number;
  /** Override for tests; the live caller uses `getBillingProvider()`. */
  provider?: BillingProvider;
  /** Override for tests; the live caller uses `withSystemContext`. */
  systemContext?: SystemContextRunner;
}

export interface ProvisionTrialSubscriptionResult {
  providerCustomerId: string;
  providerSubscriptionId: string;
  tier: TierName;
  trialEndsAt: Date | null;
}

/**
 * Creates a Stripe Customer + a `trialing`-status Subscription with
 * 30-day `trial_period_days`, persists the Subscription row, and
 * updates Workspace.stripeCustomerId / .stripeSubscriptionId. Caller
 * should run this AFTER the workspace-creation transaction commits —
 * the Stripe API calls are network IO and don't belong in a DB tx.
 */
export async function provisionTrialSubscription(
  input: ProvisionTrialSubscriptionInput,
): Promise<ProvisionTrialSubscriptionResult> {
  const provider = input.provider ?? getBillingProvider();
  const withSystemContext: SystemContextRunner =
    input.systemContext ?? defaultWithSystemContext;
  const seats = input.seats ?? 1;
  const tier = tierFromVerticalTier(input.verticalTier);

  // 1. Customer.
  const customer = await provider.createCustomer({
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    email: input.email,
  });

  // 2. Subscription with 30-day trial. Per the brief, no payment
  //    method is collected here.
  const sub = await provider.createSubscription({
    providerCustomerId: customer.providerCustomerId,
    tier,
    seatBand: "SEATS_1",
    seats,
    trialPeriodDays: TRIAL_PERIOD_DAYS,
    metadata: {
      agentplain_workspace_id: input.workspaceId,
      agentplain_signup_flow: "self_serve",
    },
  });

  // 3. Persist. Use the operator/system RLS context — the signup path
  //    has no user session yet, and a Subscription is workspace-scoped.
  await withSystemContext(async (tx) => {
    await tx.subscription.create({
      data: {
        workspaceId: input.workspaceId,
        stripeCustomerId: customer.providerCustomerId,
        stripeSubscriptionId: sub.providerSubscriptionId,
        tier: input.verticalTier,
        seatBand: "SEATS_1",
        seats,
        status: subscriptionStatusFromProvider(sub.status),
        trialEndsAt: sub.trialEndsAt,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      },
    });
    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: {
        stripeCustomerId: customer.providerCustomerId,
        stripeSubscriptionId: sub.providerSubscriptionId,
        billingMode: "STRIPE_SUBSCRIPTION",
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        action: "billing.trial_subscription_provisioned",
        targetTable: "Subscription",
        targetId: sub.providerSubscriptionId,
        payload: {
          tier,
          seats,
          trialPeriodDays: TRIAL_PERIOD_DAYS,
          providerCustomerId: customer.providerCustomerId,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  return {
    providerCustomerId: customer.providerCustomerId,
    providerSubscriptionId: sub.providerSubscriptionId,
    tier,
    trialEndsAt: sub.trialEndsAt,
  };
}

/** Tries provisioning and records the failure into AuditLog if it
 *  errors — used by signup so a Stripe outage does not block the
 *  workspace from existing. Returns the result on success, null on
 *  recorded failure. */
export async function provisionTrialSubscriptionSafe(
  input: ProvisionTrialSubscriptionInput,
  workspace: Pick<Workspace, "id">,
): Promise<ProvisionTrialSubscriptionResult | null> {
  const withSystemContext: SystemContextRunner =
    input.systemContext ?? defaultWithSystemContext;
  try {
    return await provisionTrialSubscription(input);
  } catch (err) {
    await withSystemContext(async (tx) => {
      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id,
          action: "billing.signup_provisioning_failed",
          payload: {
            reason: err instanceof Error ? err.message : String(err),
          } satisfies Prisma.InputJsonValue,
        },
      });
    });
    return null;
  }
}

const STATUS_MAP: Record<
  ProviderSubscriptionStatus,
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "CANCELED"
  | "UNPAID"
> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE_EXPIRED",
  canceled: "CANCELED",
  unpaid: "UNPAID",
};

export function subscriptionStatusFromProvider(
  status: ProviderSubscriptionStatus,
):
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "CANCELED"
  | "UNPAID" {
  return STATUS_MAP[status];
}
