"use server";

// Server actions for the billing surface. Wraps:
//   * Add payment method (Checkout mode=setup)
//   * Change plan (Checkout mode=subscription, allow_promotion_codes)
//   * Open customer portal (invoices, update card, cancel)
//   * Cancel subscription at period end
//
// Every action enforces the broker-owner check + RLS context before
// touching the Stripe SDK. Per feedback_no_silent_vendor_lock all
// vendor calls go through `getBillingProvider()`.

import { redirect } from "next/navigation";
import type { Prisma, SeatBand } from "@prisma/client";
import { withWorkspace } from "@/lib/auth";
import { getBillingProvider } from "@/lib/billing";
import { withRls, withSystemContext } from "@/lib/db";
import { env } from "@/lib/env";
import {
  TIER_ORDER,
  seatBandForSeats,
  type TierName,
} from "@/lib/pricing/tiers";

const buildAbsoluteUrl = (path: string): string => {
  const origin = env.appPublicOrigin().replace(/\/$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
};

async function loadSubscriptionForOwner(workspaceId: string) {
  const { rls } = await withWorkspace(workspaceId, ["BROKER_OWNER"]);
  const sub = await withRls(rls, (tx) =>
    tx.subscription.findUnique({ where: { workspaceId } }),
  );
  if (!sub) {
    throw new Error(
      "No subscription on file yet. Wait a moment and refresh — provisioning may still be in progress.",
    );
  }
  return { rls, sub };
}

export async function addPaymentMethodAction(workspaceId: string): Promise<void> {
  const { sub } = await loadSubscriptionForOwner(workspaceId);
  const provider = getBillingProvider();
  const session = await provider.createCheckoutSession({
    mode: "setup",
    providerCustomerId: sub.stripeCustomerId,
    successUrl: buildAbsoluteUrl(
      `/app/workspace/${workspaceId}/settings/billing?setup=ok`,
    ),
    cancelUrl: buildAbsoluteUrl(
      `/app/workspace/${workspaceId}/settings/billing?setup=cancelled`,
    ),
    metadata: { agentplain_workspace_id: workspaceId },
  });
  redirect(session.url);
}

export async function changePlanAction(
  workspaceId: string,
  formData: FormData,
): Promise<void> {
  const { sub } = await loadSubscriptionForOwner(workspaceId);
  const rawTier = String(formData.get("tier") ?? "").toLowerCase() as TierName;
  const rawSeats = Number(formData.get("seats") ?? 0);
  if (!TIER_ORDER.includes(rawTier)) {
    throw new Error(`Unknown tier "${rawTier}"`);
  }
  if (!Number.isFinite(rawSeats) || rawSeats < 1 || rawSeats >= 100) {
    throw new Error(
      "Pick between 1 and 99 seats. 100+ is custom — reach out to schedule a build engagement.",
    );
  }
  const band: SeatBand = seatBandForSeats(rawSeats);
  const provider = getBillingProvider();
  const session = await provider.createCheckoutSession({
    mode: "subscription",
    providerCustomerId: sub.stripeCustomerId,
    tier: rawTier,
    seatBand: band,
    seats: rawSeats,
    successUrl: buildAbsoluteUrl(
      `/app/workspace/${workspaceId}/settings/billing?plan=ok`,
    ),
    cancelUrl: buildAbsoluteUrl(
      `/app/workspace/${workspaceId}/settings/billing?plan=cancelled`,
    ),
    allowPromotionCodes: true,
    metadata: { agentplain_workspace_id: workspaceId },
  });
  redirect(session.url);
}

export async function openPortalAction(workspaceId: string): Promise<void> {
  const { sub } = await loadSubscriptionForOwner(workspaceId);
  const provider = getBillingProvider();
  const session = await provider.createPortalSession({
    providerCustomerId: sub.stripeCustomerId,
    returnUrl: buildAbsoluteUrl(
      `/app/workspace/${workspaceId}/settings/billing`,
    ),
  });
  redirect(session.url);
}

export async function cancelSubscriptionAction(
  workspaceId: string,
): Promise<void> {
  const { member } = await withWorkspace(workspaceId, ["BROKER_OWNER"]);
  const provider = getBillingProvider();

  // Load under system context — the Stripe call needs the stripe sub id
  // regardless of the actor's RLS context, and we'll write back under
  // the same system context.
  const subBefore = await withSystemContext((tx) =>
    tx.subscription.findUnique({ where: { workspaceId } }),
  );
  if (!subBefore) {
    throw new Error("No subscription on file");
  }
  if (subBefore.cancelAtPeriodEnd) {
    redirect(
      `/app/workspace/${workspaceId}/settings/billing?cancel=already-scheduled`,
    );
  }
  const updated = await provider.cancelSubscription({
    providerSubscriptionId: subBefore.stripeSubscriptionId,
    atPeriodEnd: true,
  });
  await withSystemContext(async (tx) => {
    await tx.subscription.update({
      where: { workspaceId },
      data: {
        cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
        currentPeriodEnd: updated.currentPeriodEnd,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "billing.subscription.cancel_scheduled",
        targetTable: "Subscription",
        targetId: subBefore.stripeSubscriptionId,
        payload: {
          currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });
  redirect(`/app/workspace/${workspaceId}/settings/billing?cancel=ok`);
}

