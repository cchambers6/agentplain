/**
 * POST /api/integrations/docusign/connect
 *
 * DocuSign Connect notification receiver. Peer of the Gmail/Graph webhook
 * receivers. Per https://developers.docusign.com/platform/webhooks/connect/
 * (read 2026-05-20):
 *   1. Verify the `X-DocuSign-Signature-1` HMAC header — base64(HMAC-SHA256(
 *      key, rawBody)) — against DOCUSIGN_CONNECT_HMAC_KEY (timing-safe). If
 *      no key is configured we accept but flag the event as unverified.
 *   2. Locate the workspace's DOCUSIGN WebhookSubscription by accountId.
 *   3. Write a WebhookEvent row (raw payload retained verbatim) and ACK 200.
 *
 * Per `project_no_outbound_architecture.md`: this route only RECEIVES.
 * Per `feedback_verify_after_create.md`: the WebhookEvent is written before
 * the ACK so the row is the source of truth, not the in-memory body.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { withSystemContext } from '@/lib/db/rls';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNATURE_HEADER = 'x-docusign-signature-1';

function verifyHmac(rawBody: string, headerValue: string | null, key: string): boolean {
  if (!headerValue) return false;
  const expected = createHmac('sha256', key).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(headerValue);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface ConnectPayload {
  event?: string;
  data?: { accountId?: string; envelopeId?: string; envelopeSummary?: { status?: string } };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const hmacKey = env.docusignConnectHmacKey();
  let verified = false;
  if (hmacKey) {
    verified = verifyHmac(rawBody, req.headers.get(SIGNATURE_HEADER), hmacKey);
    if (!verified) {
      await withSystemContext((tx) =>
        tx.auditLog.create({
          data: {
            action: 'webhook.docusign.signature_invalid',
            targetTable: 'WebhookEvent',
            payload: { reason: 'HMAC mismatch or missing X-DocuSign-Signature-1 header' },
          },
        }),
      );
      // 401 is non-retryable; a forged probe is now observable in the audit log.
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }
  }

  let payload: ConnectPayload;
  try {
    payload = JSON.parse(rawBody) as ConnectPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const accountId = payload.data?.accountId;
  if (!accountId) {
    return NextResponse.json({ error: 'missing_account_id' }, { status: 400 });
  }

  // WebhookSubscription is workspace-scoped RLS; the Connect receiver runs
  // unauthenticated, so withSystemContext seeds the operator GUC.
  const subscription = await withSystemContext((tx) =>
    tx.webhookSubscription.findFirst({
      where: { provider: 'DOCUSIGN', subscriptionId: accountId, status: { in: ['ACTIVE', 'EXPIRING'] } },
      select: { id: true, workspaceId: true },
    }),
  );
  if (!subscription) {
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          action: 'webhook.docusign.unknown_subscription',
          targetTable: 'WebhookEvent',
          payload: { accountId, event: payload.event ?? null },
        },
      }),
    );
    // ACK so DocuSign stops retrying; nothing maps to a connected workspace.
    return NextResponse.json({ ok: true, ignored: 'unknown_subscription' });
  }

  // WebhookEvent now carries a NOT NULL workspaceId (denormalized for RLS);
  // pull it off the subscription we just resolved.
  const event = await withSystemContext((tx) =>
    tx.webhookEvent.create({
      data: {
        subscriptionId: subscription.id,
        workspaceId: subscription.workspaceId,
        rawPayload: { ...(JSON.parse(rawBody) as object), _meta: { verified } },
        processed: false,
      },
    }),
  );

  const verifyEvent = await withSystemContext((tx) =>
    tx.webhookEvent.findUnique({ where: { id: event.id }, select: { id: true } }),
  );
  if (!verifyEvent) {
    return NextResponse.json({ error: 'event_persist_verify_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId: event.id }, { status: 200 });
}
