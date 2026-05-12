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

export const runtime = "nodejs"; // Stripe SDK requires Node runtime
export const dynamic = "force-dynamic";

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
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await withSystemContext((tx) => dispatchEvent(event, tx));
  } catch (err) {
    console.error("stripe webhook dispatch failed", err);
    // Return 500 so Stripe retries.
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
