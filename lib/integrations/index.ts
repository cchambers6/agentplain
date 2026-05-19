/**
 * lib/integrations/index.ts
 *
 * Domain-facing entrypoint for integrations. Two responsibilities:
 *
 *   1. **Provider registry** — return the configured IntegrationProvider
 *      for a given provider enum value. Tests inject the
 *      `TestIntegrationProvider`; production wires `GmailProvider`.
 *
 *   2. **Credential codec** — encrypt/decrypt the OAuth tokens at the
 *      database boundary. Plaintext lives in memory for the duration of a
 *      single request / cron fire and never crosses the I/O seam. Uses
 *      `lib/security/encryption.ts` (AES-256-GCM, v1 format).
 *
 * Per `feedback_no_silent_vendor_lock`: all `googleapis` imports stay in
 * `lib/integrations/google/`. This file imports the Google adapter as a
 * concrete class but exposes it only behind the `IntegrationProvider`
 * interface — domain code (OAuth routes, webhook receiver, cron) speaks
 * the interface.
 *
 * Per `feedback_no_prod_secrets_in_dev`: in `.env.local`, use a dev-tier
 * Google Cloud Project. Production credentials only live in Vercel
 * Production env. The registry reads `GOOGLE_OAUTH_CLIENT_ID/SECRET` etc.
 * from env at construction time.
 */

import { IntegrationCredential, IntegrationProvider as DbProvider } from '@prisma/client';
import { decrypt, encrypt } from '@/lib/security/encryption';
import { GmailProvider } from './google/gmail-provider';
import { GoogleOAuth } from './google/oauth';
import { GmailWebhookHandler } from './google/webhook-handler';
import { M365Provider } from './microsoft/m365-provider';
import { MicrosoftOAuth } from './microsoft/oauth';
import { MicrosoftSubscriptionClient } from './microsoft/subscriptions';
import { MicrosoftWebhookHandler } from './microsoft/webhook-handler';
import { TestIntegrationProvider } from './test-provider';
import type {
  DecryptedCredential,
  IntegrationProvider,
  TokenSet,
} from './types';

// ── Provider factory ────────────────────────────────────────────────────

/**
 * Holder for instantiated providers. Build once at boot; reuse across
 * requests. Provider construction reads env once — re-creating per
 * request would re-read env on hot paths.
 */
let cached: Partial<Record<DbProvider, IntegrationProvider>> = {};

/**
 * For tests: reset the cache and (optionally) inject a TestIntegrationProvider.
 */
export function resetProviderRegistryForTests(
  overrides: Partial<Record<DbProvider, IntegrationProvider>> = {},
): void {
  cached = { ...overrides };
}

export function getProvider(provider: DbProvider): IntegrationProvider {
  const hit = cached[provider];
  if (hit) return hit;
  const built = buildProvider(provider);
  cached[provider] = built;
  return built;
}

function buildProvider(provider: DbProvider): IntegrationProvider {
  // Honor an explicit test-mode env override even in non-test environments.
  // Used by local dev when Google Cloud Project is not yet wired up.
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestIntegrationProvider({ name: provider === 'GOOGLE' ? 'GOOGLE' : 'M365' });
  }

  if (provider === 'GOOGLE') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const pubsubTopicName = process.env.GOOGLE_PUBSUB_TOPIC;
    const audience = process.env.GMAIL_WEBHOOK_OIDC_AUDIENCE;
    const serviceAccountEmail = process.env.GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL;

    if (!clientId || !clientSecret) {
      throw new Error(
        'getProvider(GOOGLE): GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required. ' +
          'See docs/operator-integrations-setup.md for Google Cloud Project setup.',
      );
    }
    if (!pubsubTopicName) {
      throw new Error(
        'getProvider(GOOGLE): GOOGLE_PUBSUB_TOPIC is required (form projects/<project>/topics/<topic>).',
      );
    }
    if (!audience || !serviceAccountEmail) {
      throw new Error(
        'getProvider(GOOGLE): GMAIL_WEBHOOK_OIDC_AUDIENCE and GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL are required for Pub/Sub OIDC verification.',
      );
    }
    const oauth = new GoogleOAuth({ clientId, clientSecret });
    const webhookHandler = new GmailWebhookHandler({ audience, serviceAccountEmail });
    return new GmailProvider({ oauth, webhookHandler, pubsubTopicName });
  }

  if (provider === 'M365') {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    const authority =
      process.env.MICROSOFT_OAUTH_AUTHORITY ?? 'https://login.microsoftonline.com/common';
    const clientState = process.env.MICROSOFT_WEBHOOK_CLIENT_STATE;
    if (!clientId || !clientSecret) {
      throw new Error(
        'getProvider(M365): MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET are required. ' +
          'See docs/operator-integrations-setup.md for Azure app registration setup.',
      );
    }
    if (!clientState) {
      throw new Error(
        'getProvider(M365): MICROSOFT_WEBHOOK_CLIENT_STATE is required (32-byte random hex). ' +
          'This shared secret is echoed by Graph on every notification and verifies authenticity.',
      );
    }
    const oauth = new MicrosoftOAuth({ clientId, clientSecret, authority });
    const subscriptions = new MicrosoftSubscriptionClient({ clientState });
    const webhookHandler = new MicrosoftWebhookHandler({ clientState });
    return new M365Provider({ oauth, subscriptions, webhookHandler });
  }

  throw new Error(`getProvider: provider ${provider} is not implemented.`);
}

// ── Credential codec ────────────────────────────────────────────────────

/**
 * Encrypt a TokenSet for persistence. Returns the two ciphertext strings
 * + metadata fields the IntegrationCredential row needs.
 *
 * NB: every call constructs the IV fresh inside encryption.ts (per
 * encryption.ts:IV_BYTES + randomBytes), so repeated encrypts of the same
 * plaintext produce different ciphertexts. Idempotency lives in the
 * database upsert path, not here.
 */
export function encryptTokenSet(tokens: TokenSet): {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  scopes: string[];
  expiresAt: Date;
} {
  return {
    accessTokenEncrypted: encrypt(tokens.accessToken),
    refreshTokenEncrypted:
      tokens.refreshToken !== null ? encrypt(tokens.refreshToken) : null,
    scopes: tokens.scopes,
    expiresAt: tokens.expiresAt,
  };
}

/**
 * Decrypt an IntegrationCredential row into a plaintext DecryptedCredential
 * for use inside one request/cron fire. NEVER persist a DecryptedCredential
 * back to the database — that would defeat the encryption-at-rest invariant.
 */
export function decryptCredential(row: IntegrationCredential): DecryptedCredential {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    accountId: row.accountId,
    accountEmail: row.accountEmail,
    accessToken: decrypt(row.accessTokenEncrypted),
    refreshToken:
      row.refreshTokenEncrypted !== null ? decrypt(row.refreshTokenEncrypted) : null,
    scopes: row.scopes,
    expiresAt: row.expiresAt,
  };
}

// ── Re-exports ──────────────────────────────────────────────────────────

export type { IntegrationProvider, DecryptedCredential, TokenSet } from './types';
export {
  intOk,
  intError,
  type IntegrationResult,
  type IntegrationError,
  type IntegrationErrorCode,
  type ProviderSubscription,
  type SignatureVerification,
  type WebhookPayload,
} from './types';
