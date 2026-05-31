/**
 * lib/integrations/types.ts
 *
 * Provider-neutral interface every external-system integration implements.
 * Per `project_living_portable_architecture` + `feedback_no_silent_vendor_lock`:
 * every vendor SDK call lives behind one of these adapters. Adding a new
 * provider (M365, Zoom, Slack) = new file under `lib/integrations/<provider>/`
 * + implements `IntegrationProvider`. Two-implementation rule satisfied
 * by `lib/integrations/test-provider.ts`.
 *
 * Result shape mirrors `lib/ops/types.ts` (OpsResult discriminated union)
 * so callers handle the failure path at the type level — no swallowing
 * errors via thrown exceptions that escape the integration boundary.
 *
 * No methods on this interface send email, calendar invites, SMS, or any
 * outbound message on the customer's behalf. Per
 * `project_no_outbound_architecture.md`: agentplain reads, advises, and
 * drafts; the customer's system executes outreach.
 */

// ── Result shape ─────────────────────────────────────────────────────────

export type IntegrationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: IntegrationError };

export type IntegrationErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_ARGUMENT'
  | 'UPSTREAM_ERROR'
  | 'TOKEN_EXPIRED'
  | 'GRANT_REVOKED'
  | 'SIGNATURE_INVALID'
  | 'NOT_IMPLEMENTED';

export interface IntegrationError {
  code: IntegrationErrorCode;
  message: string;
  /** HTTP status if the failure was a remote response. */
  status?: number;
  /** Vendor-specific identifier (e.g. Google error.code). */
  reference?: string;
  /** Retry hint in milliseconds — populated for RATE_LIMITED. */
  retryAfterMs?: number;
}

export function intOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function intError(
  code: IntegrationErrorCode,
  message: string,
  extra?: Omit<IntegrationError, 'code' | 'message'>,
): { ok: false; error: IntegrationError } {
  return { ok: false, error: { code, message, ...extra } };
}

// ── DTOs ─────────────────────────────────────────────────────────────────

/**
 * OAuth token bundle as the provider returned it. Plaintext at this layer
 * — callers MUST encrypt via `lib/security/encryption.ts` before persisting.
 * The interface speaks plaintext because the encryption seam belongs at
 * the storage boundary, not the protocol boundary.
 */
export interface TokenSet {
  accessToken: string;
  /** Refresh token. NULL when the provider did not return one. */
  refreshToken: string | null;
  /** UTC instant the access token expires. */
  expiresAt: Date;
  scopes: string[];
  /** Provider-supplied stable account identifier (Google: sub claim). */
  accountId: string;
  accountEmail: string;
}

/**
 * Minimal credential shape passed to provider methods. The full
 * IntegrationCredential row lives in Prisma; this is the runtime
 * (decrypted) view a provider method needs to do its work.
 */
export interface DecryptedCredential {
  id: string;
  workspaceId: string;
  /** Mirrors the Prisma `IntegrationProvider` enum. The push-subscription
   *  surface of `IntegrationProvider` (createSubscription/etc.) only ships
   *  for GOOGLE + M365; DOCUSIGN/QUICKBOOKS/SLACK are served by their own
   *  self-contained MCP servers that resolve + refresh credentials directly
   *  (see `lib/integrations/<vendor>-mcp/auth.ts`), so they never flow
   *  through `getProvider()`. This is the runtime credential view only. */
  provider:
    | 'GOOGLE'
    | 'M365'
    | 'DOCUSIGN'
    | 'QUICKBOOKS'
    | 'SLACK'
    | 'FOLLOW_UP_BOSS'
    | 'SIERRA_INTERACTIVE'
    | 'BOLDTRAIL';
  accountId: string;
  accountEmail: string;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date;
  /** Non-secret per-account routing data — see the Prisma column comment.
   *  NULL for providers that need none. */
  providerMetadata: Record<string, unknown> | null;
}

/**
 * Result of a successful watch / subscription create. The
 * `providerSubscriptionId` is the value that comes back on subsequent
 * webhook deliveries; agentplain stores it on `WebhookSubscription.subscriptionId`.
 */
export interface ProviderSubscription {
  providerSubscriptionId: string;
  resource: string;
  expiresAt: Date;
}

/**
 * Verifier output. When `valid === true`, `accountIdentifier` (if known)
 * is the Pub/Sub topic / Graph clientState we can cross-reference to a
 * stored WebhookSubscription row.
 */
export interface SignatureVerification {
  valid: boolean;
  accountIdentifier?: string;
  reason?: string;
}

export interface WebhookPayload {
  /** Provider-specific payload as JSON. Always written verbatim to
   *  `WebhookEvent.rawPayload` before any further processing. */
  raw: unknown;
  /** Best-effort surfacing of the account/resource the event targets.
   *  For Gmail Push: the `emailAddress` from the decoded message body. */
  accountEmail?: string;
  /** Provider cursor / sequence value. For Gmail Push: `historyId`. */
  cursor?: string;
}

// ── The interface ───────────────────────────────────────────────────────

export interface IntegrationProvider {
  readonly name: 'GOOGLE' | 'M365';

  /**
   * Exchange an authorization code for tokens. Implements the standard
   * OAuth2 authorization-code grant. Returns the plaintext bundle; the
   * caller encrypts before persistence.
   */
  exchangeCodeForTokens(args: {
    code: string;
    redirectUri: string;
  }): Promise<IntegrationResult<TokenSet>>;

  /**
   * Refresh tokens. Some providers rotate the refresh token; the returned
   * TokenSet's `refreshToken` is the value to persist (which may differ
   * from the input). When `refreshToken` comes back NULL, keep the prior
   * stored refresh token.
   *
   * `accountId` is required: the provider's refresh response does not
   * always echo it (Google's doesn't), so the caller carries it through.
   */
  refreshTokens(args: {
    refreshToken: string;
    accountEmail: string;
    accountId: string;
  }): Promise<IntegrationResult<TokenSet>>;

  /**
   * Revoke tokens at the provider. Idempotent on already-revoked tokens.
   */
  revokeTokens(args: { accessToken: string }): Promise<IntegrationResult<void>>;

  /**
   * Create a push notification subscription. Gmail: users.watch.
   * M365: Graph subscription create.
   */
  createSubscription(args: {
    credential: DecryptedCredential;
    notificationUrl: string;
  }): Promise<IntegrationResult<ProviderSubscription>>;

  /**
   * Renew an existing subscription before it expires. Gmail: re-call
   * users.watch (same topic). M365: PATCH the subscription with a new
   * expirationDateTime.
   */
  renewSubscription(args: {
    credential: DecryptedCredential;
    subscriptionId: string;
    notificationUrl: string;
  }): Promise<IntegrationResult<ProviderSubscription>>;

  /**
   * Stop receiving webhooks for this subscription. Gmail: users.stop.
   * M365: DELETE subscription.
   */
  deleteSubscription(args: {
    credential: DecryptedCredential;
    subscriptionId: string;
  }): Promise<IntegrationResult<void>>;

  /**
   * Verify a provider push notification's authenticity. Gmail/Pub/Sub:
   * validates the OIDC JWT in the Authorization header against Google's
   * public keys + checks audience. M365: validates clientState + tenant.
   *
   * Returns SIGNATURE_INVALID inside `intError` (not a thrown exception)
   * so the route handler always writes an audit row.
   */
  verifyWebhookSignature(
    request: Request,
  ): Promise<IntegrationResult<SignatureVerification>>;

  /**
   * Parse the verified webhook body. NEVER called before
   * verifyWebhookSignature returns valid=true. Pure parser — does not
   * call back to the provider.
   */
  parseWebhookPayload(request: Request): Promise<IntegrationResult<WebhookPayload>>;
}

// ── OAuth flow helpers ───────────────────────────────────────────────────

/**
 * Returned by `buildAuthorizationUrl`. The caller (OAuth connect route)
 * sets `state` in a signed cookie and redirects the browser to `url`.
 * The callback route reads the cookie back and asserts state equality
 * before exchanging the code.
 */
export interface AuthorizationUrl {
  url: string;
  state: string;
}

export interface OAuthInitParams {
  redirectUri: string;
  /** Free-form data the connect route wants to read on callback.
   *  Encoded into the `state` value. Always validated by HMAC, never trusted
   *  on its face. */
  workspaceId: string;
  /** Caller-supplied CSRF nonce. Stored in cookie, echoed in state, compared
   *  on callback. */
  nonce: string;
}
