/**
 * lib/integrations/google/webhook-handler.ts
 *
 * Cloud Pub/Sub push notification handling for Gmail.
 *
 * Authentication per https://cloud.google.com/pubsub/docs/push#authentication
 * (read 2026-05-11):
 *   - Pub/Sub adds an `Authorization: Bearer <OIDC JWT>` header to each push
 *     request when the subscription was configured with an OIDC token.
 *   - The JWT is signed by Google with rotating RSA keys. We verify the
 *     signature against the matching key from
 *     https://www.googleapis.com/oauth2/v3/certs (cached briefly by
 *     google-auth-library).
 *   - We check `aud` matches the configured audience and `email` matches
 *     the configured service-account email (both operator-controlled env
 *     vars).
 *
 * Payload shape per https://developers.google.com/workspace/gmail/api/guides/push
 * (read 2026-05-11) — Pub/Sub wraps Gmail's notification as:
 *   {
 *     message: {
 *       data: "<base64 of {emailAddress,historyId}>",
 *       messageId, publishTime, ...
 *     },
 *     subscription: "projects/.../subscriptions/..."
 *   }
 *
 * Per `feedback_verify_after_create`: the route handler writes a
 * WebhookEvent row BEFORE processing. This module is pure verification +
 * parsing — no side effects.
 */

import { OAuth2Client } from 'google-auth-library';
import {
  IntegrationResult,
  SignatureVerification,
  WebhookPayload,
  intError,
  intOk,
} from '../types';

export interface GmailWebhookHandlerConfig {
  /**
   * The expected `aud` claim — set on the Pub/Sub subscription's OIDC
   * config. Operator-supplied via `GMAIL_WEBHOOK_OIDC_AUDIENCE` env var.
   * Typically the receiving URL (e.g. https://agentplain.com/api/webhooks/google).
   */
  audience: string;
  /**
   * Service account email Pub/Sub authenticates as. Operator-supplied via
   * `GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL`. We assert the JWT's `email`
   * claim matches this exactly (not contains, not endsWith).
   */
  serviceAccountEmail: string;
  /** Override for tests. */
  oauthClient?: OAuth2Client;
}

export class GmailWebhookHandler {
  private readonly audience: string;
  private readonly serviceAccountEmail: string;
  private readonly oauthClient: OAuth2Client;

  constructor(config: GmailWebhookHandlerConfig) {
    if (!config.audience) {
      throw new Error('GmailWebhookHandler: audience is required');
    }
    if (!config.serviceAccountEmail) {
      throw new Error('GmailWebhookHandler: serviceAccountEmail is required');
    }
    this.audience = config.audience;
    this.serviceAccountEmail = config.serviceAccountEmail;
    this.oauthClient = config.oauthClient ?? new OAuth2Client();
  }

  /**
   * Verify the OIDC JWT in the Authorization header. Returns
   * `intError('SIGNATURE_INVALID', ...)` on ANY validation failure — the
   * caller writes the audit row and returns 401 to Pub/Sub so it retries
   * or alerts.
   */
  async verify(request: Request): Promise<IntegrationResult<SignatureVerification>> {
    const auth = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (!auth) {
      return intError(
        'SIGNATURE_INVALID',
        'missing Authorization header on Pub/Sub push',
      );
    }
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (!match) {
      return intError('SIGNATURE_INVALID', 'Authorization header is not Bearer-form');
    }
    const token = match[1].trim();
    if (token.length === 0) {
      return intError('SIGNATURE_INVALID', 'empty Bearer token');
    }

    let ticket;
    try {
      ticket = await this.oauthClient.verifyIdToken({
        idToken: token,
        audience: this.audience,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('SIGNATURE_INVALID', `verifyIdToken failed: ${message}`);
    }
    const payload = ticket.getPayload();
    if (!payload) {
      return intError('SIGNATURE_INVALID', 'verifyIdToken returned no payload');
    }
    if (payload.email !== this.serviceAccountEmail) {
      return intError(
        'SIGNATURE_INVALID',
        `email claim ${JSON.stringify(payload.email)} does not match expected ${JSON.stringify(this.serviceAccountEmail)}`,
      );
    }
    // verifyIdToken already enforces aud; double-check for defense in depth.
    if (payload.aud !== this.audience) {
      return intError(
        'SIGNATURE_INVALID',
        `aud claim ${JSON.stringify(payload.aud)} does not match expected ${JSON.stringify(this.audience)}`,
      );
    }
    return intOk({
      valid: true,
      accountIdentifier: payload.email,
    });
  }

  /**
   * Decode the Pub/Sub push body. Caller MUST have verified the signature
   * first — we don't repeat that work here. Returns the decoded Gmail
   * notification (emailAddress + historyId) plus the raw envelope for
   * WebhookEvent.rawPayload persistence.
   */
  async parse(request: Request): Promise<IntegrationResult<WebhookPayload>> {
    let body: unknown;
    try {
      body = await request.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('MALFORMED_RESPONSE', `Pub/Sub body is not JSON: ${message}`);
    }
    if (!body || typeof body !== 'object') {
      return intError('MALFORMED_RESPONSE', 'Pub/Sub body is not an object');
    }
    const env = body as { message?: { data?: unknown }; subscription?: unknown };
    const data = env.message?.data;
    if (typeof data !== 'string' || data.length === 0) {
      return intError('MALFORMED_RESPONSE', 'Pub/Sub envelope missing message.data');
    }
    let decoded: string;
    try {
      decoded = Buffer.from(data, 'base64').toString('utf8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('MALFORMED_RESPONSE', `base64 decode failed: ${message}`);
    }
    let inner: unknown;
    try {
      inner = JSON.parse(decoded);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError(
        'MALFORMED_RESPONSE',
        `decoded data is not JSON: ${message} — got ${decoded.slice(0, 200)}`,
      );
    }
    if (!inner || typeof inner !== 'object') {
      return intError('MALFORMED_RESPONSE', 'decoded notification is not an object');
    }
    const note = inner as { emailAddress?: unknown; historyId?: unknown };
    if (typeof note.emailAddress !== 'string') {
      return intError('MALFORMED_RESPONSE', 'notification missing emailAddress');
    }
    const historyIdRaw = note.historyId;
    const historyId =
      typeof historyIdRaw === 'string'
        ? historyIdRaw
        : typeof historyIdRaw === 'number'
        ? String(historyIdRaw)
        : null;
    if (!historyId) {
      return intError('MALFORMED_RESPONSE', 'notification missing historyId');
    }
    return intOk({
      raw: body,
      accountEmail: note.emailAddress,
      cursor: historyId,
    });
  }
}
