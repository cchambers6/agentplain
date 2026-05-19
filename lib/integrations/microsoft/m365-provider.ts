/**
 * lib/integrations/microsoft/m365-provider.ts
 *
 * Microsoft Graph implementation of `IntegrationProvider`. Symmetric peer
 * of `lib/integrations/google/gmail-provider.ts`. Composes the three
 * Microsoft-side primitives:
 *
 *   - `MicrosoftOAuth`                — exchange / refresh / revoke
 *   - `MicrosoftSubscriptionClient`   — create / renew / delete subscription
 *   - `MicrosoftWebhookHandler`       — verify + parse incoming notifications
 *
 * Per `feedback_no_silent_vendor_lock.md`: domain code (the renewal cron,
 * the OAuth callback, the webhook receiver) speaks the
 * `IntegrationProvider` interface and reaches Microsoft through this class
 * only. Direct `fetch('https://graph.microsoft.com/...')` calls outside
 * `lib/integrations/microsoft/` + `lib/integrations/outlook-mcp/server.ts`
 * are PR-review blocks.
 *
 * Per `project_no_outbound_architecture.md`: this provider does not
 * expose `/me/sendMail`. Drafts are written via the Outlook MCP server's
 * `draft_message` tool (POST /me/messages); send is the customer's job.
 *
 * Per `feedback_cold_start_safe_agents.md`: no decrypted credential is
 * memoized on the provider instance. Callers pass a `DecryptedCredential`
 * per call, which the renewal cron re-decrypts on every fire.
 */

import {
  intOk,
  type DecryptedCredential,
  type IntegrationProvider,
  type IntegrationResult,
  type ProviderSubscription,
  type SignatureVerification,
  type TokenSet,
  type WebhookPayload,
} from '../types';
import { MicrosoftOAuth } from './oauth';
import { MicrosoftSubscriptionClient } from './subscriptions';
import { MicrosoftWebhookHandler } from './webhook-handler';

export interface M365ProviderConfig {
  oauth: MicrosoftOAuth;
  subscriptions: MicrosoftSubscriptionClient;
  webhookHandler: MicrosoftWebhookHandler;
}

export class M365Provider implements IntegrationProvider {
  readonly name = 'M365' as const;
  private readonly oauth: MicrosoftOAuth;
  private readonly subscriptions: MicrosoftSubscriptionClient;
  private readonly webhookHandler: MicrosoftWebhookHandler;

  constructor(config: M365ProviderConfig) {
    this.oauth = config.oauth;
    this.subscriptions = config.subscriptions;
    this.webhookHandler = config.webhookHandler;
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

  async revokeTokens(args: { accessToken: string }): Promise<IntegrationResult<void>> {
    // Microsoft does not expose a delegated-grant revoke endpoint. The
    // OAuth client returns ok(); the caller flips the row to REVOKED.
    return this.oauth.revokeTokens(args);
  }

  async createSubscription(args: {
    credential: DecryptedCredential;
    notificationUrl: string;
  }): Promise<IntegrationResult<ProviderSubscription>> {
    return this.subscriptions.create({
      accessToken: args.credential.accessToken,
      notificationUrl: args.notificationUrl,
      accountEmail: args.credential.accountEmail,
    });
  }

  async renewSubscription(args: {
    credential: DecryptedCredential;
    subscriptionId: string;
    notificationUrl: string;
  }): Promise<IntegrationResult<ProviderSubscription>> {
    // Microsoft Graph renew = PATCH with new expirationDateTime. The
    // notificationUrl is set at create-time and cannot change without a
    // re-create; this method ignores the arg (kept for interface
    // symmetry with the Google provider).
    void args.notificationUrl;
    return this.subscriptions.renew({
      accessToken: args.credential.accessToken,
      subscriptionId: args.subscriptionId,
      accountEmail: args.credential.accountEmail,
    });
  }

  async deleteSubscription(args: {
    credential: DecryptedCredential;
    subscriptionId: string;
  }): Promise<IntegrationResult<void>> {
    return this.subscriptions.remove({
      accessToken: args.credential.accessToken,
      subscriptionId: args.subscriptionId,
    });
  }

  verifyWebhookSignature(
    request: Request,
  ): Promise<IntegrationResult<SignatureVerification>> {
    // Microsoft validation handshakes have no body and no signature; the
    // route handler short-circuits BEFORE calling verify(). If we get
    // here, it's a real notification — fall through to clientState
    // verification.
    return this.webhookHandler.verify(request);
  }

  parseWebhookPayload(
    request: Request,
  ): Promise<IntegrationResult<WebhookPayload>> {
    return this.webhookHandler.parse(request);
  }

  /**
   * Inspect a Request for the validation handshake. The route handler
   * calls this BEFORE verify(); if the request is a handshake, the route
   * responds with the token as text/plain 200 and skips event persistence.
   *
   * Static so the route handler doesn't need a provider instance to
   * detect the handshake — keeps the validation reply path independent of
   * env-var wiring (the response is just an echo).
   */
  static detectValidation(request: Request) {
    return MicrosoftWebhookHandler.detectValidation(request);
  }

  /**
   * Acknowledge a handshake. Pure helper; no side effects. The route
   * handler does the actual NextResponse construction.
   */
  static validationReplyBody(token: string): IntegrationResult<string> {
    return intOk(token);
  }
}
