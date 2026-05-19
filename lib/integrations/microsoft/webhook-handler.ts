/**
 * lib/integrations/microsoft/webhook-handler.ts
 *
 * Microsoft Graph push notification handling for Outlook. Symmetric peer of
 * `lib/integrations/google/webhook-handler.ts`.
 *
 * Graph subscriptions per
 * https://learn.microsoft.com/en-us/graph/api/resources/webhooks (read
 * 2026-05-17):
 *
 *   1. **Validation handshake** — when a subscription is first created,
 *      Graph POSTs to the `notificationUrl` with a `validationToken` query
 *      param. The endpoint MUST echo the token back as `text/plain` with a
 *      200 status within 10 seconds, or the subscription creation fails.
 *      The validation handshake has NO body, NO Authorization header, NO
 *      cryptographic verification — it proves the URL is reachable, full
 *      stop. The route handler intercepts this case BEFORE calling verify().
 *
 *   2. **Notification delivery** — Graph POSTs JSON payloads of the shape
 *      `{ value: [{ subscriptionId, clientState, resource, resourceData, ... }] }`.
 *      The `clientState` field echoes back the value we set at subscription
 *      create time; we verify it against the stored ciphertext-of-record so
 *      a notification with an unknown / mismatched clientState is rejected.
 *
 *   3. **No signed JWT on the request itself.** Graph's authenticity
 *      guarantee is the `clientState` round-trip — operator must keep it
 *      secret (env: `MICROSOFT_WEBHOOK_CLIENT_STATE`, set to a 32-byte
 *      random hex string in Vercel Production). If a sniffer reads the
 *      clientState off our subscription, they can forge notifications, so
 *      it stays in env-only and is never logged.
 *
 *   4. **Lifecycle notifications** — Graph also sends events of type
 *      `subscriptionRemoved`, `missed`, and `reauthorizationRequired`. We
 *      parse them through as ordinary notifications with a `lifecycleEvent`
 *      hint on the cursor; the renewal cron + Inngest drain handle the
 *      operational consequences.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the SOLE seam in
 * agentplain that decodes Microsoft Graph notification envelopes. The MCP
 * server is a separate seam for read-side Graph calls.
 *
 * Per `project_no_outbound_architecture.md`: this module is pure receive +
 * verify. It writes nothing on its own; the route handler persists the
 * WebhookEvent row.
 */

import {
  intError,
  intOk,
  type IntegrationResult,
  type SignatureVerification,
  type WebhookPayload,
} from '../types';

export interface MicrosoftWebhookHandlerConfig {
  /**
   * The shared secret we set on every subscription's `clientState`. Graph
   * echoes it back on every notification; we string-compare for equality.
   * Operator-supplied via `MICROSOFT_WEBHOOK_CLIENT_STATE`. Length must be
   * ≥16 chars to deter brute-force.
   */
  clientState: string;
}

export interface MicrosoftValidationRequest {
  isValidation: true;
  validationToken: string;
}

interface GraphNotificationItem {
  subscriptionId?: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
  resourceData?: { id?: string; '@odata.id'?: string; '@odata.type'?: string };
  tenantId?: string;
  subscriptionExpirationDateTime?: string;
  lifecycleEvent?: string;
}

interface GraphNotificationBody {
  value?: GraphNotificationItem[];
  validationTokens?: string[];
}

export class MicrosoftWebhookHandler {
  private readonly clientState: string;

  constructor(config: MicrosoftWebhookHandlerConfig) {
    if (!config.clientState) {
      throw new Error('MicrosoftWebhookHandler: clientState is required');
    }
    if (config.clientState.length < 16) {
      throw new Error(
        'MicrosoftWebhookHandler: clientState must be at least 16 chars (use a 32-byte hex secret)',
      );
    }
    this.clientState = config.clientState;
  }

  /**
   * Detect the validation handshake. Graph POSTs with `?validationToken=…`
   * and an empty body; the endpoint replies with the token as text/plain
   * 200. Returns the token when present, null otherwise.
   *
   * The route handler MUST short-circuit on this before calling `verify`
   * or `parse` — there's nothing to verify on a validation request.
   */
  static detectValidation(request: Request): MicrosoftValidationRequest | null {
    const url = new URL(request.url);
    const token = url.searchParams.get('validationToken');
    if (token === null) return null;
    return { isValidation: true, validationToken: token };
  }

  /**
   * Verify a notification by inspecting the body's clientState. Returns
   * `SIGNATURE_INVALID` on any mismatch so the route handler writes an
   * audit row.
   *
   * Unlike Pub/Sub, Graph's verify CONSUMES the body — we re-emit a parsed
   * shape via parse() that takes a request-derived body argument. The
   * route handler clones the body once and feeds both verify and parse.
   */
  async verify(
    request: Request,
    parsedBody?: GraphNotificationBody,
  ): Promise<IntegrationResult<SignatureVerification>> {
    let body: GraphNotificationBody;
    if (parsedBody !== undefined) {
      body = parsedBody;
    } else {
      try {
        body = (await request.clone().json()) as GraphNotificationBody;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return intError('SIGNATURE_INVALID', `body not JSON: ${message}`);
      }
    }
    if (!body || !Array.isArray(body.value) || body.value.length === 0) {
      return intError('SIGNATURE_INVALID', 'notification has no value[] array');
    }
    // Every notification in a batch must carry our clientState. Microsoft
    // batches notifications when convenient; we never accept a mixed batch.
    for (const item of body.value) {
      if (typeof item.clientState !== 'string') {
        return intError(
          'SIGNATURE_INVALID',
          'notification missing clientState — likely a stale subscription or a forged payload',
        );
      }
      if (item.clientState !== this.clientState) {
        return intError(
          'SIGNATURE_INVALID',
          'notification clientState does not match the configured shared secret',
        );
      }
    }
    return intOk({
      valid: true,
      accountIdentifier: extractAccountIdentifier(body.value),
    });
  }

  /**
   * Decode the Graph notification body. Caller MUST have verified
   * clientState first; we don't repeat that work here.
   *
   * The parsed `WebhookPayload`:
   *   - `raw`        = the original envelope (for audit replay)
   *   - `accountEmail` = the `/users('…')` segment of `resource`, when
   *      present. Some lifecycle events resolve to a tenant-level resource
   *      without a user, in which case this is left undefined.
   *   - `cursor`     = the resourceData.id of the first item (the new
   *      message id), which the Outlook adapter uses to fetch the message
   *      via `outlook.get_message`.
   */
  async parse(
    request: Request,
    parsedBody?: GraphNotificationBody,
  ): Promise<IntegrationResult<WebhookPayload>> {
    let body: GraphNotificationBody;
    if (parsedBody !== undefined) {
      body = parsedBody;
    } else {
      try {
        body = (await request.clone().json()) as GraphNotificationBody;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return intError('MALFORMED_RESPONSE', `body not JSON: ${message}`);
      }
    }
    if (!body || !Array.isArray(body.value) || body.value.length === 0) {
      return intError('MALFORMED_RESPONSE', 'notification has no value[] array');
    }
    const first = body.value[0];
    const accountEmail = extractAccountIdentifier(body.value);
    const cursor = first.resourceData?.id ?? null;
    return intOk({
      raw: body,
      accountEmail,
      cursor: cursor ?? undefined,
    });
  }
}

/**
 * Microsoft Graph `resource` strings on inbox-message notifications look
 * like `Users/{userId}/Messages/{messageId}` or `users/{upn}/messages/{…}`.
 * We extract the user identifier so the route handler can match it against
 * `IntegrationCredential.accountId` (the Graph `oid`) — falling back to
 * `accountEmail` if the resource carries the UPN instead.
 */
function extractAccountIdentifier(
  items: GraphNotificationItem[],
): string | undefined {
  for (const item of items) {
    if (typeof item.resource !== 'string') continue;
    // Match `users/{id}` whether followed by `/messages/...` or at end of
    // string (lifecycle events resolve to the user resource directly).
    const match = /^(?:users|Users)\/([^/]+)(?:\/|$)/.exec(item.resource);
    if (match) return match[1];
  }
  return undefined;
}
