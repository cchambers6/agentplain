/**
 * lib/integrations/test-provider.ts
 *
 * Second implementation of `IntegrationProvider`. Per
 * `feedback_runner_portability.md`: every adapter category has at least
 * two implementations. This one is the contract-pinning peer of
 * `lib/integrations/google/gmail-provider.ts`.
 *
 * Used by:
 *   - `lib/integrations/__tests__/contract.test.ts` parameterizes both
 *     implementations through the same assertions.
 *   - Local dev when no Google Cloud Project is wired up yet (the
 *     `INTEGRATIONS_PROVIDER=test` env var routes the registry here).
 *
 * Behavioral parity rule: when a provider semantic changes in the Google
 * adapter, mirror the same semantic here (or update the contract test to
 * branch). Drift here = false-pass tests.
 */

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
} from './types';

export interface TestProviderSeed {
  /** Pre-seeded code → token-set mappings. exchangeCodeForTokens looks up
   *  the input `code` here; missing → NOT_FOUND. */
  codeMap?: Record<string, TokenSet>;
  /** Pre-seeded refresh-token mappings. */
  refreshMap?: Record<string, TokenSet>;
  /** When set, verifyWebhookSignature returns this verdict regardless of
   *  the request shape. Default: valid=true with no accountIdentifier. */
  signatureVerdict?: SignatureVerification;
  /** When set, parseWebhookPayload returns this payload. Default: a
   *  synthetic Gmail-shaped payload with cursor='1' and accountEmail
   *  matching whatever the verifier returned. */
  parsedPayload?: WebhookPayload;
}

export class TestIntegrationProvider implements IntegrationProvider {
  readonly name: 'GOOGLE' | 'M365';
  private readonly codeMap: Map<string, TokenSet>;
  private readonly refreshMap: Map<string, TokenSet>;
  private readonly subscriptions: Map<string, ProviderSubscription>;
  private readonly signatureVerdict: SignatureVerification;
  private readonly parsedPayload?: WebhookPayload;
  /** Public for tests — recorded call log. */
  readonly calls: Array<{ method: string; args: unknown }> = [];

  constructor(args: { name?: 'GOOGLE' | 'M365'; seed?: TestProviderSeed } = {}) {
    this.name = args.name ?? 'GOOGLE';
    const seed = args.seed ?? {};
    this.codeMap = new Map(Object.entries(seed.codeMap ?? {}));
    this.refreshMap = new Map(Object.entries(seed.refreshMap ?? {}));
    this.subscriptions = new Map();
    this.signatureVerdict = seed.signatureVerdict ?? { valid: true };
    this.parsedPayload = seed.parsedPayload;
  }

  async exchangeCodeForTokens(args: {
    code: string;
    redirectUri: string;
  }): Promise<IntegrationResult<TokenSet>> {
    this.calls.push({ method: 'exchangeCodeForTokens', args });
    const found = this.codeMap.get(args.code);
    if (!found) {
      return intError('NOT_FOUND', `no token-set seeded for code ${args.code}`);
    }
    return intOk(found);
  }

  async refreshTokens(args: {
    refreshToken: string;
    accountEmail: string;
    accountId: string;
  }): Promise<IntegrationResult<TokenSet>> {
    this.calls.push({ method: 'refreshTokens', args });
    const found = this.refreshMap.get(args.refreshToken);
    if (!found) {
      return intError('GRANT_REVOKED', `no token-set seeded for refresh ${args.refreshToken}`);
    }
    return intOk(found);
  }

  async revokeTokens(args: { accessToken: string }): Promise<IntegrationResult<void>> {
    this.calls.push({ method: 'revokeTokens', args });
    return intOk(undefined);
  }

  async createSubscription(args: {
    credential: DecryptedCredential;
    notificationUrl: string;
  }): Promise<IntegrationResult<ProviderSubscription>> {
    this.calls.push({ method: 'createSubscription', args });
    const sub: ProviderSubscription = {
      providerSubscriptionId: `test-sub-${args.credential.accountId}-${Date.now()}`,
      resource: args.credential.accountEmail,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    this.subscriptions.set(sub.providerSubscriptionId, sub);
    return intOk(sub);
  }

  async renewSubscription(args: {
    credential: DecryptedCredential;
    subscriptionId: string;
    notificationUrl: string;
  }): Promise<IntegrationResult<ProviderSubscription>> {
    this.calls.push({ method: 'renewSubscription', args });
    const sub: ProviderSubscription = {
      providerSubscriptionId: args.subscriptionId,
      resource: args.credential.accountEmail,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
    this.subscriptions.set(sub.providerSubscriptionId, sub);
    return intOk(sub);
  }

  async deleteSubscription(args: {
    credential: DecryptedCredential;
    subscriptionId: string;
  }): Promise<IntegrationResult<void>> {
    this.calls.push({ method: 'deleteSubscription', args });
    this.subscriptions.delete(args.subscriptionId);
    return intOk(undefined);
  }

  async verifyWebhookSignature(
    request: Request,
  ): Promise<IntegrationResult<SignatureVerification>> {
    void request;
    return intOk(this.signatureVerdict);
  }

  async parseWebhookPayload(
    request: Request,
  ): Promise<IntegrationResult<WebhookPayload>> {
    if (this.parsedPayload) return intOk(this.parsedPayload);
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      raw = null;
    }
    return intOk({
      raw,
      accountEmail: this.signatureVerdict.accountIdentifier,
      cursor: '1',
    });
  }
}
