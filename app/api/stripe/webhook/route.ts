// Stripe webhook receiver. Phase 1 mirrors the events we care about into
// WorkspaceInvoice; full self-serve subscription wiring is Phase 2.
//
// Per project_stripe_both_surfaces: every billing event mirrors to AuditLog
// with payload-redacted-for-PII metadata. We only persist provider-side ids
// + amounts + status — no card data.

import { type NextRequest, NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/billing";
import { withSystemContext } from "@/lib/db";

export const runtime = "nodejs"; // Stripe SDK requires Node runtime
export const dynamic = "force-dynamic";

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

const asInvoice = (data: unknown): InvoicePayload => {
  if (!data || typeof data !== "object" || !("object" in data)) return {};
  const obj = (data as { object?: InvoicePayload }).object ?? {};
  return obj as InvoicePayload;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const billing = getBillingProvider();
  const rawPayload = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Awaited<ReturnType<typeof billing.verifyWebhook>>;
  try {
    event = await billing.verifyWebhook({
      rawPayload,
      signatureHeader: signature,
    });
  } catch (err) {
    console.warn("stripe webhook verification failed", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  // Idempotency: short-circuit on duplicate event ids — Stripe retries.
  const seen = await withSystemContext((tx) =>
    tx.auditLog.findFirst({
      where: { action: "billing.event.received", targetId: event.eventId },
    }),
  );
  if (seen) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await dispatchEvent(event);
  } catch (err) {
    console.error("stripe webhook dispatch failed", err);
    // Return 500 so Stripe retries.
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function dispatchEvent(event: {
  eventId: string;
  eventType: string;
  data: unknown;
}): Promise<void> {
  switch (event.eventType) {
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided":
      await mirrorInvoice(event);
      break;
    default:
      // Audit-only for events we don't yet handle. Phase 2 adds subscription.*.
      await withSystemContext((tx) =>
        tx.auditLog.create({
          data: {
            action: "billing.event.received",
            targetTable: "stripe_event",
            targetId: event.eventId,
            payload: { eventType: event.eventType },
          },
        }),
      );
  }
}

async function mirrorInvoice(event: {
  eventId: string;
  eventType: string;
  data: unknown;
}): Promise<void> {
  const inv = asInvoice(event.data);
  if (!inv.id || !inv.customer) return;

  await withSystemContext(async (tx) => {
    const workspace = await tx.workspace.findFirst({
      where: { stripeCustomerId: inv.customer },
      select: { id: true },
    });

    if (!workspace) {
      // We received an invoice for a customer we don't track yet — log and bail.
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
  });
}
