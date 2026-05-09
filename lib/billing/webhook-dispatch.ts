// Stripe webhook dispatch logic. Lives outside the route file because
// Next.js App Router rejects non-standard exports from `route.ts` — keeping
// the dispatch here also gives tests a clean import target without binding
// to a route module.
//
// Per project_stripe_both_surfaces: every billing event mirrors to AuditLog
// with payload-redacted-for-PII metadata. We only persist provider-side ids
// + amounts + status — no card data.

import type { DbTransactionClient } from "@/lib/db";

interface InvoicePayload {
  id?: string;
  customer?: string;
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

export interface StripeWebhookEvent {
  eventId: string;
  eventType: string;
  data: unknown;
}

const asInvoice = (data: unknown): InvoicePayload => {
  if (!data || typeof data !== "object" || !("object" in data)) return {};
  const obj = (data as { object?: InvoicePayload }).object ?? {};
  return obj as InvoicePayload;
};

export async function dispatchEvent(
  event: StripeWebhookEvent,
  tx: DbTransactionClient,
): Promise<void> {
  switch (event.eventType) {
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided":
      await mirrorInvoice(event, tx);
      break;
    default:
      // Audit-only for events we don't yet handle. Phase 2 adds subscription.*.
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

export async function mirrorInvoice(
  event: StripeWebhookEvent,
  tx: DbTransactionClient,
): Promise<void> {
  const inv = asInvoice(event.data);
  if (!inv.id || !inv.customer) return;

  const workspace = await tx.workspace.findFirst({
    where: { stripeCustomerId: inv.customer },
    select: { id: true },
  });

  if (!workspace) {
    // Invoice for a customer we don't track yet. Audit it AND record the
    // dedupe marker keyed by event id — without the marker, every Stripe
    // retry (up to 72h) writes another `unmatched_customer` row instead of
    // short-circuiting at the POST-handler dedupe check.
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
    await tx.auditLog.create({
      data: {
        action: "billing.event.received",
        targetTable: "stripe_event",
        targetId: event.eventId,
        payload: {
          eventType: event.eventType,
          outcome: "unmatched_customer",
        },
      },
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
