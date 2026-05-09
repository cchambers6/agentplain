// Stripe webhook receiver. Phase 1 mirrors the events we care about into
// WorkspaceInvoice; full self-serve subscription wiring is Phase 2.
//
// Dispatch logic lives in `lib/billing/webhook-dispatch.ts` — the route here
// only handles signature verification, idempotency short-circuit, and the
// HTTP response shape.

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
    await withSystemContext((tx) => dispatchEvent(event, tx));
  } catch (err) {
    console.error("stripe webhook dispatch failed", err);
    // Return 500 so Stripe retries.
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
