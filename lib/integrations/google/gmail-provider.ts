/**
 * lib/integrations/google/gmail-provider.ts
 *
 * Gmail implementation of `IntegrationProvider`. Uses the googleapis SDK
 * for `users.watch` / `users.stop`; uses `./oauth.ts` for the OAuth2 flow;
 * uses `./webhook-handler.ts` for Pub/Sub OIDC verification + payload parsing.
 *
 * Lifetime per https://developers.google.com/workspace/gmail/api/guides/push
 * (read 2026-05-11):
 *   users.watch returns `historyId` (cursor) + `expiration` (epoch ms).
 *   Maximum lifetime: 7 days. Renewal = re-call users.watch with the same
 *   topic; the new response carries a fresh expiration. We never delete +
 *   recreate — that drops events on the floor.
 *
 * Per `feedback_no_silent_vendor_lock`: every Google API call lives in
 * `lib/integrations/google/`. Domain code (renewal cron, OAuth routes,
 * webhook receiver) never imports googleapis directly.
 *
 * Per `project_no_outbound_architecture.md`: this provider does not
 * expose users.messages.send. PR-C's draft step uses users.drafts.create
 * only, surfaced via a separate scope-widening flow.
 */

import { google, type gmail_v1 } from 'googleapis';
import {
  DecryptedCredential,
  IntegrationProvider,
  IntegrationResult,
  ProviderSubscription,
  SignatureVerification,
  TokenSet,
  WebhookPayload,
  intError,
  intOk,
} from '../types';
import { GoogleOAuth } from './oauth';
import { GmailWebhookHandler } from './webhook-handler';

export interface GmailProviderConfig {
  oauth: GoogleOAuth;
  webhookHandler: GmailWebhookHandler;
  /**
   * The Cloud Pub/Sub topic name receiving Gmail push notifications,
   * in the full form `projects/<project-id>/topics/<topic-id>`.
   *
   * Per https://developers.google.com/workspace/gmail/api/guides/push:
   * the topic must grant `gmail-api-push@system.gserviceaccount.com`
   * the Pub/Sub Publisher role. Setup is operator-side (Conner) per
   * docs/operator-integrations-setup.md.
   */
  pubsubTopicName: string;
}

export class GmailProvider implements IntegrationProvider {
  readonly name = 'GOOGLE' as const;
  private readonly oauth: GoogleOAuth;
  private readonly webhookHandler: GmailWebhookHandler;
  private readonly pubsubTopicName: string;

  constructor(config: GmailProviderConfig) {
    if (!config.pubsubTopicName) {
      throw new Error('GmailProvider: pubsubTopicName is required');
    }
    if (!/^projects\/[^/]+\/topics\/[^/]+$/.test(config.pubsubTopicName)) {
      throw new Error(
        `GmailProvider: pubsubTopicName must be of the form projects/<project>/topics/<topic>, got ${config.pubsubTopicName}`,
      );
    }
    this.oauth = config.oauth;
    this.webhookHandler = config.webhookHandler;
    this.pubsubTopicName = config.pubsubTopicName;
  }

  exchangeCodeForTokens(args: {
    code: string;
    redirectUri: string;
  }): Promise<IntegrationResult<TokenSet>> {
    return this.oauth.exchangeCodeForTokens(args);
  }

  refreshTokens(args: {
    refreshToken: string;
    accountEmail: string;
    accountId: string;
  }): Promise<IntegrationResult<TokenSet>> {
    return this.oauth.refreshTokens(args);
  }

  revokeTokens(args: { accessToken: string }): Promise<IntegrationResult<void>> {
    return this.oauth.revokeTokens(args);
  }

  /**
   * users.watch — create or update the push notification subscription.
   * Idempotent: re-calling with the same topic + labels refreshes the
   * expiration. The `notificationUrl` argument is informational only —
   * Gmail's push goes through Pub/Sub, which posts to whatever push
   * endpoint the operator configured on the Pub/Sub subscription. We
   * still store notificationUrl on the row for audit / cross-provider
   * symmetry.
   */
  async createSubscription(args: {
    credential: DecryptedCredential;
    notificationUrl: string;
  }): Promise<IntegrationResult<ProviderSubscription>> {
    return this.callWatch(args.credential);
  }

  /**
   * Renewal = call users.watch again. Gmail does not have a separate
   * "renew" endpoint. The returned historyId may differ from the
   * previous one; the caller (renewal cron) updates the row with the
   * new value so future webhook deliveries match.
   */
  async renewSubscription(args: {
    credential: DecryptedCredential;
    subscriptionId: string;
    notificationUrl: string;
  }): Promise<IntegrationResult<ProviderSubscription>> {
    return this.callWatch(args.credential);
  }

  /**
   * users.stop — Gmail discontinues push notifications for this mailbox.
   * Idempotent: 200/204 on success, treated as success even on "not
   * watching" responses.
   */
  async deleteSubscription(args: {
    credential: DecryptedCredential;
    /** Required by the interface for symmetry with Graph (M365), but
     *  Gmail's users.stop endpoint doesn't take an id — it stops watching
     *  for the authenticated mailbox. We accept the field to match the
     *  contract; the value is intentionally unread. */
    subscriptionId: string;
  }): Promise<IntegrationResult<void>> {
    void args.subscriptionId;
    const client = this.makeGmailClient(args.credential);
    try {
      await client.users.stop({ userId: 'me' });
      return intOk(undefined);
    } catch (err) {
      return mapGoogleApiError(err);
    }
  }

  verifyWebhookSignature(
    request: Request,
  ): Promise<IntegrationResult<SignatureVerification>> {
    return this.webhookHandler.verify(request);
  }

  parseWebhookPayload(request: Request): Promise<IntegrationResult<WebhookPayload>> {
    return this.webhookHandler.parse(request);
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async callWatch(
    credential: DecryptedCredential,
  ): Promise<IntegrationResult<ProviderSubscription>> {
    const client = this.makeGmailClient(credential);
    try {
      const res = await client.users.watch({
        userId: 'me',
        requestBody: {
          topicName: this.pubsubTopicName,
          // Default behavior: receive a notification on every history
          // event in the inbox. Label filtering can narrow later (PR-C may
          // refine when categorization is in place).
          labelFilterBehavior: 'INCLUDE',
          labelIds: ['INBOX'],
        },
      });
      const historyId = res.data.historyId;
      const expirationStr = res.data.expiration;
      if (!historyId) {
        return intError('MALFORMED_RESPONSE', 'users.watch returned no historyId');
      }
      if (!expirationStr) {
        return intError('MALFORMED_RESPONSE', 'users.watch returned no expiration');
      }
      const expirationMs = Number(expirationStr);
      if (!Number.isFinite(expirationMs)) {
        return intError(
          'MALFORMED_RESPONSE',
          `users.watch returned non-numeric expiration: ${expirationStr}`,
        );
      }
      return intOk({
        providerSubscriptionId: historyId,
        resource: credential.accountEmail,
        expiresAt: new Date(expirationMs),
      });
    } catch (err) {
      return mapGoogleApiError(err);
    }
  }

  private makeGmailClient(credential: DecryptedCredential): gmail_v1.Gmail {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: credential.accessToken,
      refresh_token: credential.refreshToken ?? undefined,
    });
    return google.gmail({ version: 'v1', auth });
  }
}

// ── error mapping ────────────────────────────────────────────────────────

/**
 * googleapis throws `GaxiosError` (or AggregateError under some failure
 * paths). Both expose `code` and `response` for HTTP status. We treat the
 * value as `unknown` and pattern-match defensively.
 */
function mapGoogleApiError(err: unknown): { ok: false; error: import('../types').IntegrationError } {
  if (!err || typeof err !== 'object') {
    return intError('UPSTREAM_ERROR', String(err));
  }
  const rec = err as {
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const message =
    typeof rec.message === 'string' ? rec.message : 'unknown Google API error';
  const status =
    typeof rec.response?.status === 'number'
      ? rec.response.status
      : typeof rec.code === 'number'
      ? rec.code
      : undefined;

  if (status === 401) {
    return intError('TOKEN_EXPIRED', message, { status });
  }
  if (status === 403) {
    return intError('FORBIDDEN', message, { status });
  }
  if (status === 404) {
    return intError('NOT_FOUND', message, { status });
  }
  if (status === 429) {
    return intError('RATE_LIMITED', message, { status });
  }
  if (status && status >= 500) {
    return intError('UPSTREAM_ERROR', message, { status });
  }
  return intError('UPSTREAM_ERROR', message, status ? { status } : undefined);
}
