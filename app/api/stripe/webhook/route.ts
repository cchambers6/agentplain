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
import { PrismaOpsFlagStore } from "@/lib/ops/prisma-flag-store";
import { stampWebhookOk, stampWebhookError } from "@/lib/billing/sync-freshness";

export const runtime = "nodejs"; // Stripe SDK requires Node runtime
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const billing = getBillingProvider();
  const logger = getLogger().child({ boundary: "webhook", provider: "stripe" });
  // Sync-freshness heartbeat store (mode #5). Stamping is best-effort — it
  // must never make the webhook itself fail. The hourly fleet-freshness-sweep
  // reads these stamps to detect a stale/broken Stripe sync and freeze
  // billing-dependent auto-exec before customers run hours on stale state.
  const flagStore = new PrismaOpsFlagStore();
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
    // FAIL_LOUD (mode #5): record a sync-failure heartbeat. A VERIFIED Stripe
    // event we could not dispatch means our billing state is now drifting from
    // Stripe's. The hourly freshness sweep reads this; if errors persist past
    // the grace window with no success since, it freezes billing-dependent
    // auto-exec + pages an admin. We do NOT stamp signature-verify failures
    // (those are often forged probes — stamping them would let an attacker
    // freeze billing by spamming bad signatures).
    await stampWebhookError(
      flagStore,
      new Date(),
      `${event.eventType} (${event.eventId}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    ).catch(() => {
      /* heartbeat is observability — never fail the webhook on it */
    });
    // Return 500 so Stripe retries.
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }

  // Success heartbeat — proves the Stripe→us sync pipe is alive.
  await stampWebhookOk(flagStore, new Date()).catch(() => {
    /* best-effort */
  });

  eventLogger.info("stripe webhook dispatched");
  return NextResponse.json({ received: true });
}
