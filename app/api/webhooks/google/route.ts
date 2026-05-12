/**
 * POST /api/webhooks/google
 *
 * Cloud Pub/Sub push notification receiver for Gmail.
 *
 * Pub/Sub has a strict ACK timeout (default 10s; configurable up to 600s
 * per https://cloud.google.com/pubsub/docs/push#ack_deadline). We do the
 * minimum here:
 *   1. Verify the OIDC JWT signature.
 *   2. Parse the message body.
 *   3. Locate the WebhookSubscription by accountEmail (with INTEGRATION
 *      credential workspace scope).
 *   4. Insert a WebhookEvent row.
 *   5. Return 200.
 *
 * Processing happens asynchronously. PR-C wires a downstream consumer
 * (Inngest event or DB poll) that drains rows where `processed=false`.
 *
 * Per `feedback_verify_after_create`: we WRITE the WebhookEvent before
 * acking; the Pub/Sub ACK is the trigger for downstream consumers. No
 * "write-after-respond" race.
 *
 * Per `project_no_outbound_architecture.md`: this route only RECEIVES.
 * It never sends mail. It writes the inbound notification to the audit
 * table; consumers in PR-C decide whether to draft a reply.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getProvider } from '@/lib/integrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const provider = getProvider('GOOGLE');

  // 1. Signature verify. The request body must be read AFTER verify so we
  //    can also parse it — but verify() reads only headers. parse() clones
  //    the body via req.json() once.
  const verify = await provider.verifyWebhookSignature(req);
  if (!verify.ok) {
    // 401 → Pub/Sub retries per https://cloud.google.com/pubsub/docs/push#receive_push.
    // Surface code + reason so operator can diagnose without grepping logs.
    return NextResponse.json(
      { error: verify.error.code, message: verify.error.message },
      { status: 401 },
    );
  }
  if (!verify.value.valid) {
    return NextResponse.json(
      { error: 'invalid_signature', reason: verify.value.reason },
      { status: 401 },
    );
  }

  // 2. Parse payload.
  const parsed = await provider.parseWebhookPayload(req);
  if (!parsed.ok) {
    // 400 → Pub/Sub will dead-letter or back off. Better than 500 which
    // triggers exponential retries indefinitely.
    return NextResponse.json(
      { error: parsed.error.code, message: parsed.error.message },
      { status: 400 },
    );
  }
  const { accountEmail, raw, cursor } = parsed.value;

  if (!accountEmail) {
    return NextResponse.json({ error: 'no_account_email_on_payload' }, { status: 400 });
  }

  // 3. Find the active subscription by account email. Gmail Pub/Sub
  //    deliveries identify the mailbox; we match against IntegrationCredential.accountEmail.
  //    With multiple workspaces sharing an inbox (unsupported in Phase 1),
  //    we'd disambiguate via the credential.accountId — but Phase 1 is
  //    1:1 broker-owner per workspace.
  const credential = await prisma.integrationCredential.findFirst({
    where: {
      provider: 'GOOGLE',
      accountEmail,
      status: 'ACTIVE',
    },
    include: {
      webhookSubscriptions: {
        where: { status: { in: ['ACTIVE', 'EXPIRING'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!credential || credential.webhookSubscriptions.length === 0) {
    // Unknown sender. Likely a stale subscription that wasn't cleaned up
    // on the Google side. Return 200 to stop Pub/Sub retries — we have
    // nowhere to land the event. Audit it.
    await prisma.auditLog.create({
      data: {
        action: 'webhook.google.unknown_sender',
        targetTable: 'WebhookEvent',
        payload: {
          accountEmail,
          cursor,
        },
      },
    });
    return NextResponse.json({ ok: true, ignored: 'unknown_sender' });
  }
  const subscription = credential.webhookSubscriptions[0];

  // 4. Insert WebhookEvent row.
  const event = await prisma.webhookEvent.create({
    data: {
      subscriptionId: subscription.id,
      rawPayload: raw as object,
      processed: false,
    },
  });

  // Verify-after-create: re-read to assert persistence.
  const verifyEvent = await prisma.webhookEvent.findUnique({
    where: { id: event.id },
    select: { id: true },
  });
  if (!verifyEvent) {
    return NextResponse.json(
      { error: 'event_persist_verify_failed' },
      { status: 500 },
    );
  }

  // 5. ACK Pub/Sub. PR-C will add downstream consumer wakeup (Inngest event
  //    emit) here; for now the renewal cron + ad-hoc validators read the
  //    table directly.
  return NextResponse.json({
    ok: true,
    eventId: event.id,
    subscriptionId: subscription.id,
    cursor,
  });
}
