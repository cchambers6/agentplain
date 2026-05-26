/**
 * POST /api/webhooks/microsoft
 *
 * Microsoft Graph push notification receiver for Outlook. Symmetric peer
 * of `app/api/webhooks/google/route.ts`.
 *
 * Two distinct request shapes share this endpoint:
 *
 *   1. **Validation handshake** (`?validationToken=…`) — Microsoft POSTs
 *      this once at subscription create time. The body is empty; the
 *      query carries the token; the response MUST be `text/plain` 200
 *      echoing the token within 10 seconds. No persistence, no audit
 *      write — handshake is a reachability proof, not a domain event.
 *
 *   2. **Notification delivery** — body is JSON of the shape
 *      `{ value: [{ subscriptionId, clientState, resource, resourceData, ...}] }`.
 *      We verify `clientState` matches our shared secret, locate the
 *      matching WebhookSubscription, insert a WebhookEvent row, and
 *      respond 202. Graph treats any 2xx within 30s as ACK.
 *
 * Per https://learn.microsoft.com/en-us/graph/webhooks (read 2026-05-17):
 *   - Validation: respond 200 with the token, text/plain, within 10s.
 *   - Notifications: respond 2xx within 30s or Graph retries with
 *     exponential backoff up to 4 hours, then drops + emits a `missed`
 *     lifecycle event.
 *
 * Per `feedback_verify_after_create.md`: we WRITE the WebhookEvent before
 * responding. The 202 is the trigger for the Inngest drain.
 *
 * Per `project_no_outbound_architecture.md`: this route only RECEIVES.
 * It never sends mail. Drafts happen later in the skill chain.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this route imports the
 * IntegrationProvider interface only. Direct Graph HTTP calls live in
 * `lib/integrations/microsoft/` + `lib/integrations/outlook-mcp/`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withSystemContext } from '@/lib/db/rls';
import { getProvider } from '@/lib/integrations';
import { upsertWebhookEvent } from '@/lib/integrations/webhook-idempotency';
import { M365Provider } from '@/lib/integrations/microsoft/m365-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  // 1. Validation handshake — short-circuit BEFORE invoking the provider.
  //    The validation request carries no body, no clientState, no
  //    authority. We echo the token back as text/plain 200; anything else
  //    breaks the subscription create call upstream.
  const validation = M365Provider.detectValidation(req);
  if (validation) {
    // Microsoft requires the response body to be the validation token
    // verbatim, with Content-Type text/plain and status 200.
    return new Response(validation.validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // 2. Real notification — provider-mediated verification + parsing.
  let provider;
  try {
    provider = getProvider('M365');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Misconfigured env. Return 500 so Graph retries while operator fixes.
    return NextResponse.json(
      { error: 'm365_provider_not_configured', message },
      { status: 500 },
    );
  }

  // The handler verify + parse both consume the body — clone once and
  // hand both calls the same parsed payload via the cached body path
  // built into MicrosoftWebhookHandler. Simpler: read once here, pass
  // through. We use req.clone().json() so consecutive reads work.
  const verify = await provider.verifyWebhookSignature(req);
  if (!verify.ok) {
    // 401 — Graph treats 4xx as a non-retryable error and will not back
    // off; the operator should look at the audit row to diagnose. We
    // still write an audit row so a forged-notification probe is
    // observable. withSystemContext seeds the GUC so the
    // `audit_operator_write` WITH CHECK clause passes without an
    // actorUserId (the request is unauthenticated by definition).
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          action: 'webhook.microsoft.signature_invalid',
          targetTable: 'WebhookEvent',
          payload: {
            code: verify.error.code,
            message: verify.error.message,
          },
        },
      }),
    );
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

  const parsed = await provider.parseWebhookPayload(req);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error.code, message: parsed.error.message },
      { status: 400 },
    );
  }
  const { accountEmail, raw, cursor } = parsed.value;

  // 3. Locate the active subscription. Graph notifications carry both
  //    `subscriptionId` (the Graph subscription GUID) and `resource` (the
  //    /users/{id}/messages/{…} path). Either side identifies the
  //    subscribed account; we prefer subscriptionId because it's an
  //    exact-equality match against `WebhookSubscription.subscriptionId`.
  const envelope = raw as
    | { value?: Array<{ subscriptionId?: string }> }
    | null;
  const graphSubscriptionId =
    envelope?.value?.[0]?.subscriptionId ?? null;

  // WebhookSubscription is workspace-scoped RLS — this read runs under the
  // unauthenticated Graph push receiver, so withSystemContext seeds the
  // operator GUC for the lookup.
  const subscription = await withSystemContext((tx) =>
    graphSubscriptionId
      ? tx.webhookSubscription.findFirst({
          where: {
            provider: 'M365',
            subscriptionId: graphSubscriptionId,
            status: { in: ['ACTIVE', 'EXPIRING'] },
          },
          include: { credential: true },
        })
      : accountEmail
      ? tx.webhookSubscription.findFirst({
          where: {
            provider: 'M365',
            status: { in: ['ACTIVE', 'EXPIRING'] },
            credential: {
              // Microsoft surfaces `oid` (accountId) in some notification
              // shapes via the resource path; UPN (accountEmail) elsewhere.
              // Match either to be tolerant of both.
              OR: [
                { accountId: accountEmail },
                { accountEmail },
              ],
            },
          },
          include: { credential: true },
        })
      : Promise.resolve(null),
  );

  if (!subscription) {
    // Unknown subscription. Most often: a subscription we created earlier
    // is still alive at Microsoft after we deleted the row locally. ACK
    // with 200 so Graph stops retrying and we can clean it up server-side
    // on the next renewal sweep.
    await withSystemContext((tx) =>
      tx.auditLog.create({
        data: {
          action: 'webhook.microsoft.unknown_subscription',
          targetTable: 'WebhookEvent',
          payload: {
            graphSubscriptionId,
            accountEmail: accountEmail ?? null,
            cursor: cursor ?? null,
          },
        },
      }),
    );
    return NextResponse.json({ ok: true, ignored: 'unknown_subscription' });
  }

  // 4. Insert WebhookEvent row — idempotently. Graph notifications carry
  //    `subscriptionId` + `changeType` + `resource`; combined into a
  //    stable dedupe key. Graph's retry policy can re-deliver the same
  //    notification on transient 5xx, so the upsert path is necessary.
  const dedupeKey = extractM365DedupeKey(raw);
  const upsert = await upsertWebhookEvent({
    subscriptionId: subscription.id,
    workspaceId: subscription.workspaceId,
    rawPayload: raw as object,
    dedupeKey,
  });

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

  // 5. ACK Graph. The Inngest drain (cron every 5min) picks up the row
  //    on its next fire and runs the skill chain.
  return NextResponse.json(
    {
      ok: true,
      eventId: upsert.id,
      subscriptionId: subscription.id,
      cursor: cursor ?? null,
      duplicate: !upsert.inserted,
    },
    { status: 202 },
  );
}

/**
 * Build a stable dedupe key from a Microsoft Graph notification. Graph
 * does NOT supply a single messageId — the closest stable identifier is
 * the tuple (subscriptionId, resource, changeType). For Outlook message
 * notifications `resource` already includes the message id path
 * (`Users/{id}/Messages/{id}`), so the combined string is the strongest
 * non-cryptographic dedupe we have without storing a payload hash.
 *
 * Returns null when the envelope shape is unexpected — the upsert helper
 * degrades to an unprotected insert so we don't lose events while
 * debugging a malformed delivery.
 */
function extractM365DedupeKey(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const env = raw as {
    value?: Array<{
      subscriptionId?: unknown;
      changeType?: unknown;
      resource?: unknown;
    }>;
  };
  const first = env.value?.[0];
  if (!first) return null;
  const subId = typeof first.subscriptionId === 'string' ? first.subscriptionId : '';
  const change = typeof first.changeType === 'string' ? first.changeType : '';
  const resource = typeof first.resource === 'string' ? first.resource : '';
  if (!subId && !change && !resource) return null;
  return `${subId}|${change}|${resource}`;
}
