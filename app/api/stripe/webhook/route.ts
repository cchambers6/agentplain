// Stripe webhook receiver.
//
// Idempotency strategy: every inbound event id is inserted into
// `BillingEvent` (stripeEventId @unique). The route short-circuits with
// 200 if the row already exists — Stripe retries non-2xx for up to 72h
// and duplicates are expected. Dispatch runs inside a $transaction so
// the BillingEvent insert + the domain-state mutation are atomic.
//
// Dispatch logic lives in `lib/billing/webhook-dispatch.ts`. The route
// here only handles signature verification, idempotency short-circuit,
// and the HTTP response shape. Per feedback_no_silent_vendor_lock this
// file never imports `stripe` directly — the verify call goes through
// the BillingProvider abstraction.

import { type NextRequest, NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/billing";
import { dispatchEvent } from "@/lib/billing/webhook-dispatch";
import { withSystemContext } from "@/lib/db";
import { getLogger, reportError } from "@/lib/observability";

export const runtime = "nodejs"; // Stripe SDK requires Node runtime
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const billing = getBillingProvider();
  const logger = getLogger().child({ boundary: "webhook", provider: "stripe" });
  const rawPayload = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Awaited<ReturnType<typeof billing.verifyWebhook>>;
  try {
    event = await billing.verifyWebhook({
      rawPayload,
      signatureHeader: signature,
    });
  } catch (err) {
    // Signature mismatch is the most common 400 reason. It's also a forged-
    // probe signal, so log at warn (not error) and don't capture to Sentry
    // — a flapping integration could flood the issue tracker otherwise.
    logger.warn("stripe webhook verification failed", {
      error_message: err instanceof Error ? err.message : String(err),
      has_signature: signature !== null,
    });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 },
    );
  }

  const eventLogger = logger.child({
    stripe_event_id: event.eventId,
    stripe_event_type: event.eventType,
  });

  // Idempotency short-circuit. The actual record-and-dispatch happens
  // inside the transaction below; this check just avoids re-running
  // the handler when a duplicate arrives.
  const seen = await withSystemContext((tx) =>
    tx.billingEvent.findUnique({
      where: { stripeEventId: event.eventId },
      select: { id: true },
    }),
  );
  if (seen) {
    eventLogger.info("stripe webhook duplicate — short-circuit");
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await withSystemContext((tx) => dispatchEvent(event, tx));
  } catch (err) {
    eventLogger.error("stripe webhook dispatch failed", err);
    // Report through the adapter so it lands in Sentry with the same tag
    // shape as the cron-side reports (boundary=webhook, provider=stripe).
    reportError(err, {
      level: "error",
      tags: {
        boundary: "webhook",
        provider: "stripe",
        stripe_event_type: event.eventType,
      },
      extra: { stripeEventId: event.eventId },
    });
    // Return 500 so Stripe retries.
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }

  eventLogger.info("stripe webhook dispatched");
  return NextResponse.json({ received: true });
}
