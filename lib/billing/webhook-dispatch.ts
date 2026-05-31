// Stripe webhook dispatch logic. Lives outside the route file because
// Next.js App Router rejects non-standard exports from `route.ts`. Keeping
// it here also gives tests a clean import target without binding to a
// route module.
//
// Idempotency strategy (per the brief): every inbound Stripe event id
// is inserted into `BillingEvent` with `stripeEventId @unique`. The
// route handler short-circuits if `findUnique({stripeEventId})` returns
// a hit, AND every dispatch path runs the insert inside the same DB
// transaction so a partial failure leaves no half-state. AuditLog
// continues to carry a cross-cutting summary for the operator audit
// (engineering_plan §5.2), but BillingEvent is the typed, per-
// subscription timeline.
//
// Per project_stripe_both_surfaces: never persist card data. Stripe
// holds payment-method ids; we hold only ids + amounts + status.

import type {
  Prisma,
  SeatBand as PrismaSeatBand,
  SubscriptionStatus as PrismaSubscriptionStatus,
  WorkspaceVerticalTier,
} from "@prisma/client";
import {
  lookupKeyFor,
  seatBandForSeats,
  type TierName,
  TIER_ORDER,
} from "@/lib/pricing/tiers";
import type { DbTransactionClient } from "@/lib/db";
import { subscriptionStatusFromProvider } from "./provisioning";
import type { ProviderSubscriptionStatus } from "./types";

export interface StripeWebhookEvent {
  eventId: string;
  eventType: string;
  data: unknown;
}

// =====================================================================
// Dispatch entry point
// =====================================================================

export async function dispatchEvent(
  event: StripeWebhookEvent,
  tx: DbTransactionClient,
): Promise<void> {
  switch (event.eventType) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.trial_will_end":
    // Stripe emits `customer.subscription.paused` when a trial ends
    // without a payment method on a subscription configured with
    // trial_settings.end_behavior.missing_payment_method="pause". Pre-
    // wave-2 this killed the dispatcher because the enum lacked PAUSED;
    // now the upsert succeeds and the row reflects the pause cleanly.
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event, tx);
      break;
    case "customer.subscription.deleted":
      await markSubscriptionDeleted(event, tx);
      break;
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "invoice.voided":
      await mirrorInvoice(event, tx);
      break;
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await recordCheckoutSession(event, tx);
      break;
    default:
      // Audit-only for events we don't yet handle. Future handlers
      // (e.g. setup_intent.succeeded for the add-payment-method flow)
      // join here.
      await recordBillingEvent(event, tx, {
        workspaceId: null,
        subscriptionId: null,
      });
      await tx.auditLog.create({
        data: {
          action: "billing.event.received",
          targetTable: "stripe_event",
          targetId: event.eventId,
          payload: { eventType: event.eventType },
        },
      });
  }
}

// =====================================================================
// Subscription events
// =====================================================================

interface SubscriptionPayload {
  id?: string;
  customer?: string | { id?: string };
  status?: string;
  trial_end?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  default_payment_method?: string | { id?: string } | null;
  items?: {
    data?: Array<{
      quantity?: number;
      price?: {
        id?: string;
        lookup_key?: string | null;
      };
    }>;
  };
  metadata?: Record<string, string>;
}

const asSubscription = (data: unknown): SubscriptionPayload => {
  if (!data || typeof data !== "object" || !("object" in data)) return {};
  return ((data as { object?: SubscriptionPayload }).object ?? {}) as SubscriptionPayload;
};

async function syncSubscription(
  event: StripeWebhookEvent,
  tx: DbTransactionClient,
): Promise<void> {
  const sub = asSubscription(event.data);
  const stripeSubscriptionId = sub.id;
  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!stripeSubscriptionId || !stripeCustomerId) {
    // Malformed payload — log to BillingEvent so we can debug, but no
    // sub upsert is possible.
    await recordBillingEvent(event, tx, {
      workspaceId: null,
      subscriptionId: null,
    });
    return;
  }

  const workspace = await tx.workspace.findFirst({
    where: { stripeCustomerId },
    select: { id: true, verticalTier: true },
  });
  if (!workspace) {
    await recordBillingEvent(event, tx, {
      workspaceId: null,
      subscriptionId: null,
    });
    await tx.auditLog.create({
      data: {
        action: "billing.event.unmatched_customer",
        targetTable: "stripe_event",
        targetId: event.eventId,
        payload: {
          eventType: event.eventType,
          stripeCustomerId,
        },
      },
    });
    return;
  }

  const item = sub.items?.data?.[0];
  const seats = item?.quantity ?? 1;
  const lookupKey = item?.price?.lookup_key ?? null;
  const tierFromKey = tierFromLookupKey(lookupKey);
  const seatBandFromKey = seatBandFromLookupKey(lookupKey);

  const verticalTier: WorkspaceVerticalTier = tierFromKey
    ? verticalTierEnumFromTier(tierFromKey)
    : workspace.verticalTier;
  const seatBand: PrismaSeatBand = seatBandFromKey
    ? seatBandFromKey
    : seatBandForSeats(seats);

  const status: PrismaSubscriptionStatus = subscriptionStatusFromProvider(
    (sub.status as ProviderSubscriptionStatus) ?? "active",
  );

  const trialEndsAt = epochToDate(sub.trial_end);
  const currentPeriodEnd = epochToDate(sub.current_period_end);
  const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
  const defaultPaymentMethodId =
    typeof sub.default_payment_method === "string"
      ? sub.default_payment_method
      : sub.default_payment_method?.id ?? null;

  const existing = await tx.subscription.findUnique({
    where: { stripeSubscriptionId },
    select: { id: true },
  });

  const upserted = await tx.subscription.upsert({
    where: { stripeSubscriptionId },
    create: {
      workspaceId: workspace.id,
      stripeSubscriptionId,
      stripeCustomerId,
      tier: verticalTier,
      seatBand,
      seats,
      status,
      trialEndsAt,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      defaultPaymentMethodId,
    },
    update: {
      tier: verticalTier,
      seatBand,
      seats,
      status,
      trialEndsAt,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      defaultPaymentMethodId,
    },
  });

  // Update Workspace pointers + flip billingMode the first time we see
  // a subscription, so the Phase 1 high-touch rows transition cleanly.
  // Wave-4 — also stamp signupSetupCompletedAt (the abandoned-signup
  // sweep gates on this column) and clear setupDeactivatedAt if the
  // workspace was previously deactivated. The dedicated SETUP_RESUMED
  // lifecycle event is written by `markSignupCompleted` post-commit so
  // the gate-lift is observable in the lifecycle log.
  const workspaceBeforeUpdate = await tx.workspace.findUnique({
    where: { id: workspace.id },
    select: {
      signupSetupCompletedAt: true,
      setupDeactivatedAt: true,
    },
  });
  await tx.workspace.update({
    where: { id: workspace.id },
    data: {
      stripeSubscriptionId,
      billingMode: "STRIPE_SUBSCRIPTION",
      signupSetupCompletedAt:
        workspaceBeforeUpdate?.signupSetupCompletedAt ?? new Date(),
      // Clear the abandoned-signup gate when checkout finally completes.
      setupDeactivatedAt: null,
    },
  });
  if (workspaceBeforeUpdate?.setupDeactivatedAt) {
    // The customer completed checkout AFTER the gate flipped on. Log
    // SETUP_RESUMED so the lifecycle log carries the full picture.
    await tx.workspaceLifecycleEvent.create({
      data: {
        workspaceId: workspace.id,
        kind: "SETUP_RESUMED",
        payload: {
          stripeSubscriptionId,
          via: "subscription.created webhook",
        } satisfies Prisma.InputJsonValue,
      },
    });
  }

  await recordBillingEvent(event, tx, {
    workspaceId: workspace.id,
    subscriptionId: upserted.id,
  });

  await tx.auditLog.create({
    data: {
      workspaceId: workspace.id,
      action: existing
        ? "billing.subscription.updated"
        : "billing.subscription.created",
      targetTable: "Subscription",
      targetId: stripeSubscriptionId,
      payload: {
        eventType: event.eventType,
        status,
        seats,
        tier: verticalTier,
        seatBand,
      } satisfies Prisma.InputJsonValue,
    },
  });
}

// =====================================================================
// Checkout-session events (wave-2 CC-at-trial)
// =====================================================================
//
// The wave-2 signup flow routes the customer through Stripe Checkout
// AFTER the workspace transaction commits. The workspace row already
// carries `stripeCustomerId` by the time Stripe sends webhooks (the
// `createTrialCheckoutForSignup` helper persists it before opening the
// session), so the actual Subscription upsert is driven by the
// `customer.subscription.created` handler above. This handler exists
// to:
//   1. Record the Checkout-session lifecycle in BillingEvent for audit
//   2. Emit an AuditLog row when a session completes (signal that
//      card-at-trial captured successfully) or expires (signal that the
//      customer abandoned — surfaces in operator triage)
//   3. Make sure the dispatcher does NOT throw on these event types —
//      the pre-wave-2 default branch handled the recording, but adding
//      an explicit case lets us reach into the session payload for the
//      workspace id (via `client_reference_id`) without parsing the
//      generic envelope.

interface CheckoutSessionPayload {
  id?: string;
  status?: string;
  customer?: string | { id?: string };
  subscription?: string | { id?: string };
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
}

const asCheckoutSession = (data: unknown): CheckoutSessionPayload => {
  if (!data || typeof data !== "object" || !("object" in data)) return {};
  return (
    (data as { object?: CheckoutSessionPayload }).object ?? {}
  ) as CheckoutSessionPayload;
};

async function recordCheckoutSession(
  event: StripeWebhookEvent,
  tx: DbTransactionClient,
): Promise<void> {
  const session = asCheckoutSession(event.data);
  const workspaceIdFromRef =
    typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : null;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  // Resolve workspace via the client_reference_id we set at checkout
  // creation. Fall back to stripeCustomerId for safety (a manual
  // checkout created outside the signup flow won't have a ref but still
  // carries a customer). Both resolution paths can come up empty when
  // the session belongs to a Stripe Customer we never persisted — in
  // that case we still record the BillingEvent so the audit trail
  // exists, but skip the AuditLog row.
  let workspaceId: string | null = null;
  if (workspaceIdFromRef) {
    const ws = await tx.workspace.findUnique({
      where: { id: workspaceIdFromRef },
      select: { id: true },
    });
    workspaceId = ws?.id ?? null;
  }
  if (!workspaceId && stripeCustomerId) {
    const ws = await tx.workspace.findFirst({
      where: { stripeCustomerId },
      select: { id: true },
    });
    workspaceId = ws?.id ?? null;
  }

  let subscriptionRowId: string | null = null;
  if (stripeSubscriptionId) {
    const sub = await tx.subscription.findUnique({
      where: { stripeSubscriptionId },
      select: { id: true },
    });
    subscriptionRowId = sub?.id ?? null;
  }

  await recordBillingEvent(event, tx, {
    workspaceId,
    subscriptionId: subscriptionRowId,
  });

  if (workspaceId) {
    await tx.auditLog.create({
      data: {
        workspaceId,
        action:
          event.eventType === "checkout.session.completed"
            ? "billing.signup_checkout_completed"
            : event.eventType === "checkout.session.expired"
              ? "billing.signup_checkout_expired"
              : "billing.checkout_session_event",
        targetTable: "stripe_checkout_session",
        targetId: session.id ?? event.eventId,
        payload: {
          eventType: event.eventType,
          status: session.status ?? null,
          stripeCustomerId: stripeCustomerId ?? null,
          stripeSubscriptionId: stripeSubscriptionId ?? null,
        } satisfies Prisma.InputJsonValue,
      },
    });
  }
}

async function markSubscriptionDeleted(
  event: StripeWebhookEvent,
  tx: DbTransactionClient,
): Promise<void> {
  const sub = asSubscription(event.data);
  const stripeSubscriptionId = sub.id;
  if (!stripeSubscriptionId) {
    await recordBillingEvent(event, tx, {
      workspaceId: null,
      subscriptionId: null,
    });
    return;
  }

  const existing = await tx.subscription.findUnique({
    where: { stripeSubscriptionId },
    select: { id: true, workspaceId: true },
  });
  if (!existing) {
    await recordBillingEvent(event, tx, {
      workspaceId: null,
      subscriptionId: null,
    });
    return;
  }

  await tx.subscription.update({
    where: { stripeSubscriptionId },
    data: { status: "CANCELED", cancelAtPeriodEnd: false },
  });
  await recordBillingEvent(event, tx, {
    workspaceId: existing.workspaceId,
    subscriptionId: existing.id,
  });
  await tx.auditLog.create({
    data: {
      workspaceId: existing.workspaceId,
      action: "billing.subscription.deleted",
      targetTable: "Subscription",
      targetId: stripeSubscriptionId,
      payload: { eventType: event.eventType },
    },
  });
}

// =====================================================================
// Invoice events (Phase 1 path, retained + extended)
// =====================================================================

interface InvoicePayload {
  id?: string;
  customer?: string;
  subscription?: string;
  amount_due?: number;
  amount_paid?: number;
  status?: string;
  hosted_invoice_url?: string;
  invoice_pdf?: string;
  period_start?: number;
  period_end?: number;
  paid?: boolean;
  metadata?: Record<string, string>;
}

const asInvoice = (data: unknown): InvoicePayload => {
  if (!data || typeof data !== "object" || !("object" in data)) return {};
  return ((data as { object?: InvoicePayload }).object ?? {}) as InvoicePayload;
};

export async function mirrorInvoice(
  event: StripeWebhookEvent,
  tx: DbTransactionClient,
): Promise<void> {
  const inv = asInvoice(event.data);
  if (!inv.id || !inv.customer) {
    return;
  }

  const workspace = await tx.workspace.findFirst({
    where: { stripeCustomerId: inv.customer },
    select: { id: true },
  });

  if (!workspace) {
    await tx.auditLog.create({
      data: {
        action: "billing.event.unmatched_customer",
        targetTable: "stripe_event",
        targetId: event.eventId,
        payload: {
          eventType: event.eventType,
          stripeCustomerId: inv.customer,
        },
      },
    });
    await recordBillingEvent(event, tx, {
      workspaceId: null,
      subscriptionId: null,
    });
    return;
  }

  await tx.workspaceInvoice.upsert({
    where: { stripeInvoiceId: inv.id },
    create: {
      workspaceId: workspace.id,
      stripeInvoiceId: inv.id,
      amountUsdCents: inv.amount_due ?? inv.amount_paid ?? 0,
      status: inv.status ?? "draft",
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
      paidAt: inv.paid ? new Date() : null,
    },
    update: {
      amountUsdCents: inv.amount_due ?? inv.amount_paid ?? 0,
      status: inv.status ?? "draft",
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
      paidAt: inv.paid ? new Date() : null,
    },
  });

  // Side-effect on Subscription state for the dunning-relevant events.
  if (inv.subscription) {
    const sub = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: inv.subscription },
      select: { id: true, status: true },
    });
    if (sub) {
      let nextStatus: PrismaSubscriptionStatus | null = null;
      if (event.eventType === "invoice.payment_succeeded") {
        nextStatus = sub.status === "TRIALING" ? sub.status : "ACTIVE";
      } else if (event.eventType === "invoice.payment_failed") {
        nextStatus = "PAST_DUE";
      }
      if (nextStatus && nextStatus !== sub.status) {
        await tx.subscription.update({
          where: { stripeSubscriptionId: inv.subscription },
          data: { status: nextStatus },
        });
      }
    }
  }

  await recordBillingEvent(event, tx, {
    workspaceId: workspace.id,
    subscriptionId: await subscriptionIdForStripeId(tx, inv.subscription),
  });

  await tx.auditLog.create({
    data: {
      workspaceId: workspace.id,
      action: "billing.event.received",
      targetTable: "stripe_event",
      targetId: event.eventId,
      payload: {
        eventType: event.eventType,
        stripeInvoiceId: inv.id,
        status: inv.status ?? null,
      },
    },
  });
}

// =====================================================================
// Helpers
// =====================================================================

async function recordBillingEvent(
  event: StripeWebhookEvent,
  tx: DbTransactionClient,
  link: { workspaceId: string | null; subscriptionId: string | null },
): Promise<void> {
  // stripeEventId @unique on the column gives us idempotency at the DB
  // level. The route handler short-circuits before we get here on most
  // duplicates; this `upsert` defends against the race where two
  // webhook deliveries arrive simultaneously.
  await tx.billingEvent.upsert({
    where: { stripeEventId: event.eventId },
    create: {
      stripeEventId: event.eventId,
      type: event.eventType,
      workspaceId: link.workspaceId,
      subscriptionId: link.subscriptionId,
      payload: (event.data ?? {}) as Prisma.InputJsonValue,
    },
    update: {},
  });
}

async function subscriptionIdForStripeId(
  tx: DbTransactionClient,
  stripeSubscriptionId: string | undefined,
): Promise<string | null> {
  if (!stripeSubscriptionId) return null;
  const sub = await tx.subscription.findUnique({
    where: { stripeSubscriptionId },
    select: { id: true },
  });
  return sub?.id ?? null;
}

function epochToDate(seconds: number | null | undefined): Date | null {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

function tierFromLookupKey(key: string | null | undefined): TierName | null {
  if (!key) return null;
  for (const tier of TIER_ORDER) {
    if (key.startsWith(`agentplain_${tier}_seats_`)) return tier;
  }
  return null;
}

function seatBandFromLookupKey(
  key: string | null | undefined,
): PrismaSeatBand | null {
  if (!key) return null;
  // Match every (tier, band) shape we issue via lookupKeyFor().
  for (const tier of TIER_ORDER) {
    for (const band of [
      "SEATS_1",
      "SEATS_2_9",
      "SEATS_10_24",
      "SEATS_25_49",
      "SEATS_50_99",
    ] as const) {
      if (key === lookupKeyFor(tier, band)) return band;
    }
  }
  return null;
}

function verticalTierEnumFromTier(t: TierName): WorkspaceVerticalTier {
  return t === "regular" ? "REGULAR" : t === "plus" ? "PLUS" : "MAX";
}
