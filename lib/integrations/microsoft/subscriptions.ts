/**
 * lib/integrations/microsoft/subscriptions.ts
 *
 * Microsoft Graph subscription lifecycle helpers — create, renew, delete.
 * Used by `lib/integrations/microsoft/m365-provider.ts` to satisfy the
 * `IntegrationProvider` `createSubscription` / `renewSubscription` /
 * `deleteSubscription` methods.
 *
 * Per Graph docs https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions
 * (read 2026-05-17):
 *
 *   - Inbox-message subscriptions max out at ~71 hours (Microsoft's
 *     "messages" subscription type cap; Microsoft documents 4230 minutes
 *     for messages). We choose 2880 minutes (48 hours) to leave headroom
 *     for the 2-hour renewal cron.
 *
 *   - `changeType` accepts a comma-separated combination of `created`,
 *     `updated`, `deleted`. Phase B subscribes to `created` only — the
 *     value loop fires when new mail arrives.
 *
 *   - `resource` for the workspace's inbox is `me/mailFolders('Inbox')/messages`.
 *     We use the user-scoped form because the OAuth grant is delegated
 *     (per-user), not application-level.
 *
 *   - The endpoint returns the created Subscription resource. `id` is
 *     a GUID — we persist it on `WebhookSubscription.subscriptionId`.
 *
 *   - Renewal = PATCH `/subscriptions/{id}` with a new
 *     `expirationDateTime`. The server clamps it to the resource type's
 *     max, so we set the requested 48h and read back the actual expiry.
 *
 *   - Delete = DELETE `/subscriptions/{id}`. Idempotent on already-gone
 *     subscriptions (Microsoft returns 404, which we treat as success).
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is one of the seams that
 * touches `https://graph.microsoft.com/v1.0/subscriptions`. The MCP server
 * is the only other Graph-touching seam (different resource, different
 * concern).
 */

import {
  intError,
  intOk,
  type IntegrationError,
  type IntegrationResult,
  type ProviderSubscription,
} from '../types';

const GRAPH_SUBSCRIPTIONS_URL = 'https://graph.microsoft.com/v1.0/subscriptions';

/**
 * Default subscription lifetime. Microsoft caps inbox-messages
 * subscriptions at 4230 minutes (~70 hours); we choose 48h to leave a
 * comfortable buffer for the 2-hour renewal cron to retry on transient
 * failures.
 */
export const DEFAULT_SUBSCRIPTION_MINUTES = 48 * 60;

/**
 * Microsoft Graph clamps "messages" subscriptions to 4230 minutes.
 * Caller-supplied lifetimes above this clamp are silently shortened by
 * Microsoft; we surface the clamp here so logs reflect reality.
 */
export const MAX_SUBSCRIPTION_MINUTES = 4230;

export interface MicrosoftSubscriptionConfig {
  /**
   * Shared secret echoed back on every notification. See
   * `webhook-handler.ts` for verification. Required.
   */
  clientState: string;
  /**
   * Optional `fetch` override for tests.
   */
  fetchImpl?: typeof fetch;
}

interface GraphSubscriptionResource {
  id?: string;
  resource?: string;
  applicationId?: string;
  changeType?: string;
  clientState?: string;
  notificationUrl?: string;
  expirationDateTime?: string;
  creatorId?: string;
}

interface GraphErrorBody {
  error?: {
    code?: string;
    message?: string;
    innerError?: { code?: string; 'request-id'?: string };
  };
}

export class MicrosoftSubscriptionClient {
  private readonly clientState: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: MicrosoftSubscriptionConfig) {
    if (!config.clientState) {
      throw new Error('MicrosoftSubscriptionClient: clientState is required');
    }
    this.clientState = config.clientState;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * POST /subscriptions — create a new push subscription for the
   * authenticated user's Inbox. Idempotent at the application layer only
   * by virtue of the WebhookSubscription row's unique key (Microsoft does
   * allow multiple subscriptions per (resource, app); the database row is
   * what guarantees we don't double-create).
   */
  async create(args: {
    accessToken: string;
    notificationUrl: string;
    accountEmail: string;
    minutes?: number;
  }): Promise<IntegrationResult<ProviderSubscription>> {
    const expirationDateTime = computeExpirationIso(args.minutes);
    const body = {
      changeType: 'created',
      notificationUrl: args.notificationUrl,
      resource: "me/mailFolders('Inbox')/messages",
      expirationDateTime,
      clientState: this.clientState,
      // Lifecycle notifications go to the same endpoint; the route handler
      // distinguishes by inspecting payload.value[i].lifecycleEvent.
      lifecycleNotificationUrl: args.notificationUrl,
    };
    return this.callGraph<GraphSubscriptionResource>(
      args.accessToken,
      GRAPH_SUBSCRIPTIONS_URL,
      'POST',
      body,
    ).then((res) => mapSubscriptionResult(res, args.accountEmail));
  }

  /**
   * PATCH /subscriptions/{id} — push the expiration forward. Microsoft
   * does not change other fields on a PATCH; only `expirationDateTime`
   * is meaningful for renewal.
   */
  async renew(args: {
    accessToken: string;
    subscriptionId: string;
    accountEmail: string;
    minutes?: number;
  }): Promise<IntegrationResult<ProviderSubscription>> {
    const expirationDateTime = computeExpirationIso(args.minutes);
    const body = { expirationDateTime };
    const url = `${GRAPH_SUBSCRIPTIONS_URL}/${encodeURIComponent(args.subscriptionId)}`;
    return this.callGraph<GraphSubscriptionResource>(
      args.accessToken,
      url,
      'PATCH',
      body,
    ).then((res) => mapSubscriptionResult(res, args.accountEmail));
  }

  /**
   * DELETE /subscriptions/{id} — stop receiving notifications. Treats 404
   * as success-idempotent (the subscription is already gone).
   */
  async remove(args: {
    accessToken: string;
    subscriptionId: string;
  }): Promise<IntegrationResult<void>> {
    const url = `${GRAPH_SUBSCRIPTIONS_URL}/${encodeURIComponent(args.subscriptionId)}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('NETWORK', `Microsoft Graph network error: ${message}`);
    }
    if (res.status === 404 || res.ok) {
      return intOk(undefined);
    }
    return mapGraphHttpError(res, await safeReadText(res));
  }

  private async callGraph<T>(
    accessToken: string,
    url: string,
    method: 'POST' | 'PATCH',
    body: unknown,
  ): Promise<IntegrationResult<T>> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('NETWORK', `Microsoft Graph network error: ${message}`);
    }
    const text = await safeReadText(res);
    if (!res.ok) {
      return mapGraphHttpError(res, text);
    }
    let parsed: unknown;
    try {
      parsed = text.length === 0 ? {} : JSON.parse(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('MALFORMED_RESPONSE', `JSON parse: ${message}`, {
        status: res.status,
      });
    }
    return intOk(parsed as T);
  }
}

function computeExpirationIso(minutes: number | undefined): string {
  const m = typeof minutes === 'number' && Number.isFinite(minutes) ? minutes : DEFAULT_SUBSCRIPTION_MINUTES;
  const clamped = Math.min(Math.max(15, Math.floor(m)), MAX_SUBSCRIPTION_MINUTES);
  return new Date(Date.now() + clamped * 60 * 1000).toISOString();
}

function mapSubscriptionResult(
  res: IntegrationResult<GraphSubscriptionResource>,
  accountEmail: string,
): IntegrationResult<ProviderSubscription> {
  if (!res.ok) return res;
  const sub = res.value;
  if (!sub.id) {
    return intError('MALFORMED_RESPONSE', 'subscription response missing id');
  }
  if (!sub.expirationDateTime) {
    return intError(
      'MALFORMED_RESPONSE',
      'subscription response missing expirationDateTime',
    );
  }
  const expiresAt = new Date(sub.expirationDateTime);
  if (Number.isNaN(expiresAt.getTime())) {
    return intError(
      'MALFORMED_RESPONSE',
      `subscription expirationDateTime is not a valid ISO date: ${sub.expirationDateTime}`,
    );
  }
  return intOk({
    providerSubscriptionId: sub.id,
    resource: sub.resource ?? accountEmail,
    expiresAt,
  });
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function mapGraphHttpError(
  res: Response,
  text: string,
): { ok: false; error: IntegrationError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as GraphErrorBody;
    if (body.error) {
      detail = body.error.message ?? detail;
      reference = body.error.code;
    }
  } catch {
    // body wasn't JSON; keep statusText
  }
  if (res.status === 401) {
    return intError('TOKEN_EXPIRED', detail, { status: 401, reference });
  }
  if (res.status === 403) {
    return intError('FORBIDDEN', detail, { status: 403, reference });
  }
  if (res.status === 404) {
    return intError('NOT_FOUND', detail, { status: 404, reference });
  }
  if (res.status === 429) {
    const ra = res.headers.get('retry-after');
    const retryAfterMs = ra ? Number(ra) * 1000 : undefined;
    return intError('RATE_LIMITED', detail, {
      status: 429,
      reference,
      retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
    });
  }
  if (res.status >= 500) {
    return intError('UPSTREAM_ERROR', detail, { status: res.status, reference });
  }
  if (res.status === 400) {
    return intError('INVALID_ARGUMENT', detail, { status: 400, reference });
  }
  return intError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}
