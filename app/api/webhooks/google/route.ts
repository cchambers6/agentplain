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
import { withSystemContext } from '@/lib/db/rls';
import { getProvider } from '@/lib/integrations';
import { upsertWebhookEvent } from '@/lib/integrations/webhook-idempotency';

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
  //
  //    IntegrationCredential + WebhookSubscription are workspace-scoped RLS
  //    tables (20260526000000_add_integration_rls). The Pub/Sub receiver
  //    runs in a system context, so withSystemContext seeds
  //    app.is_operator='true' for the read.
  const credential = await withSystemContext((tx) =>
    tx.integrationCredential.findFirst({
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
    }),
  );
  if (!credential || credential.webhookSubscriptions.length === 0) {
    // Unknown sender. Likely a stale subscription that wasn't cleaned up
    // on the Google side. Return 200 to stop Pub/Sub retries — we have
    // nowhere to land the event. Audit it under system context so the
    // `audit_operator_write` policy resolves to TRUE without an
    // actorUserId.
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          action: 'webhook.google.unknown_sender',
          targetTable: 'WebhookEvent',
          payload: {
            accountEmail,
            cursor,
          },
        },
      }),
    );
    return NextResponse.json({ ok: true, ignored: 'unknown_sender' });
  }
  const subscription = credential.webhookSubscriptions[0];

  // 4. Insert WebhookEvent row — idempotently. The Pub/Sub envelope's
  //    `message.messageId` is the provider-stable id; pairing it with the
  //    subscription id gives us the (subscriptionId, dedupeKey) unique
  //    constraint that catches duplicate deliveries. Pub/Sub's at-least-
  //    once contract means the same message can arrive multiple times.
  const dedupeKey = extractPubsubMessageId(raw);
  const upsert = await upsertWebhookEvent({
    subscriptionId: subscription.id,
    workspaceId: subscription.workspaceId,
    rawPayload: raw as object,
    dedupeKey,
  });

  // Verify-after-create: re-read to assert persistence. The upsert helper
  // already does an INSERT-or-FIND, but the explicit verify mirrors the
  // pattern every other write path follows in this repo.
  const verifyEvent = await withSystemContext((tx) =>
    tx.webhookEvent.findUnique({
      where: { id: upsert.id },
      select: { id: true },
    }),
  );
  if (!verifyEvent) {
    return NextResponse.json(
      { error: 'event_persist_verify_failed' },
      { status: 500 },
    );
  }

  // 5. ACK Pub/Sub. The drain consumer (cron every 5 min) picks up the
  //    row on its next fire. Duplicates ACK identically so Pub/Sub stops
  //    retrying.
  return NextResponse.json({
    ok: true,
    eventId: upsert.id,
    subscriptionId: subscription.id,
    cursor,
    duplicate: !upsert.inserted,
  });
}

/**
 * Pull the Pub/Sub envelope's `message.messageId` for use as the
 * idempotency key. Returns null when the envelope shape is unexpected —
 * the upsert helper degrades to an unprotected insert in that case so
 * we don't lose events while debugging a malformed delivery.
 */
function extractPubsubMessageId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const env = raw as { message?: { messageId?: unknown } };
  const id = env.message?.messageId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
