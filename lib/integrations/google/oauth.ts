/**
 * lib/integrations/google/oauth.ts
 *
 * Google OAuth 2.0 — authorization-code grant with refresh-token rotation.
 *
 * Endpoints per https://developers.google.com/identity/protocols/oauth2/web-server
 * (read 2026-05-11):
 *   - Authorization: https://accounts.google.com/o/oauth2/v2/auth
 *   - Token:         https://oauth2.googleapis.com/token
 *   - Revocation:    https://oauth2.googleapis.com/revoke
 *   - Userinfo:      https://openidconnect.googleapis.com/v1/userinfo
 *
 * Required `access_type=offline` + `prompt=consent` to guarantee a
 * `refresh_token` comes back. Google only issues `refresh_token` the FIRST
 * time consent is granted unless `prompt=consent` is forced.
 *
 * State / CSRF — `state` is a random 32-byte hex string the connect route
 * also stores in an iron-session cookie. The callback route asserts cookie
 * value === state param before exchanging the code (per
 * https://datatracker.ietf.org/doc/html/rfc6749#section-10.12).
 *
 * Per `feedback_no_silent_vendor_lock`: this file is the ONLY place that
 * touches Google's OAuth endpoints. Domain code calls `gmail-provider.ts`,
 * which calls into here.
 */

import { randomBytes } from 'node:crypto';
import {
  IntegrationResult,
  TokenSet,
  intError,
  intOk,
} from '../types';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * Scopes requested at OAuth time. Least privilege for PR-B's plumbing
 * needs: read mailbox content + read-only userinfo. PR-C may add
 * `gmail.modify` to the OAuth consent screen when it lands the
 * draft-creation step — that requires a re-grant flow, surfaced to the
 * operator UI when PR-C ships.
 *
 * `openid` + `email` + `profile` are needed to receive an id_token with
 * the `sub` claim (stable account identifier) and the verified email.
 */
export const GOOGLE_DEFAULT_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
] as const;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Override for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class GoogleOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GoogleOAuthConfig) {
    if (!config.clientId) {
      throw new Error('GoogleOAuth: clientId is required');
    }
    if (!config.clientSecret) {
      throw new Error('GoogleOAuth: clientSecret is required');
    }
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * Generate a CSRF nonce (32 bytes hex). The caller stores it in a
   * signed cookie and echoes it in the `state` query param to the
   * authorize URL.
   */
  static generateState(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Build the URL the browser should redirect to. Compose with
   * `generateState()` upstream.
   */
  buildAuthorizationUrl(args: {
    redirectUri: string;
    state: string;
    scopes?: readonly string[];
    loginHint?: string;
  }): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: args.redirectUri,
      response_type: 'code',
      scope: (args.scopes ?? GOOGLE_DEFAULT_SCOPES).join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: args.state,
      include_granted_scopes: 'true',
    });
    if (args.loginHint) {
      params.set('login_hint', args.loginHint);
    }
    return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for tokens. On success, fetches the
   * userinfo endpoint to surface accountId (sub) + accountEmail.
   */
  async exchangeCodeForTokens(args: {
    code: string;
    redirectUri: string;
  }): Promise<IntegrationResult<TokenSet>> {
    const body = new URLSearchParams({
      code: args.code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await this.postForm(GOOGLE_TOKEN_URL, body);
    if (!tokenRes.ok) return tokenRes;

    const parsed = parseTokenResponse(tokenRes.value);
    if (!parsed.ok) return parsed;
    const { accessToken, refreshToken, expiresAt, scopes } = parsed.value;

    if (!refreshToken) {
      // Google withheld the refresh token. Usually means consent was
      // previously granted without prompt=consent. Surface a typed error
      // so the operator UI can show a clear "Disconnect and reconnect"
      // instruction rather than letting the cron loop with a missing
      // refresh token.
      return intError(
        'INVALID_ARGUMENT',
        'Google did not return a refresh_token. Re-run consent with prompt=consent — or revoke and reconnect from your Google account.',
      );
    }

    const profile = await this.fetchUserinfo(accessToken);
    if (!profile.ok) return profile;

    return intOk({
      accessToken,
      refreshToken,
      expiresAt,
      scopes,
      accountId: profile.value.sub,
      accountEmail: profile.value.email,
    });
  }

  /**
   * Refresh tokens. Google generally retains the refresh_token across
   * refresh calls but may rotate it. When the response includes a new
   * refresh_token, the caller MUST persist it; when absent, keep the
   * prior stored value.
   */
  async refreshTokens(args: {
    refreshToken: string;
    accountEmail: string;
    /** Caller-passed account id; preserved through the refresh because
     *  Google's refresh response does not echo it. */
    accountId: string;
  }): Promise<IntegrationResult<TokenSet>> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: args.refreshToken,
      grant_type: 'refresh_token',
    });

    const tokenRes = await this.postForm(GOOGLE_TOKEN_URL, body);
    if (!tokenRes.ok) {
      // invalid_grant means the user revoked the grant on Google's side
      // OR the refresh token was rotated and we're using a stale one.
      // We check `reference` (the raw OAuth2 error code from mapHttpError)
      // rather than message-matching, which is locale-sensitive.
      const isInvalidGrant =
        tokenRes.error.reference === 'invalid_grant' ||
        /invalid_grant/i.test(tokenRes.error.message);
      if (isInvalidGrant) {
        return intError(
          'GRANT_REVOKED',
          'Google returned invalid_grant on refresh — the user has revoked access or the refresh token was rotated and our copy is stale.',
          { status: tokenRes.error.status, reference: tokenRes.error.reference },
        );
      }
      return tokenRes;
    }

    const parsed = parseTokenResponse(tokenRes.value);
    if (!parsed.ok) return parsed;
    const { accessToken, refreshToken, expiresAt, scopes } = parsed.value;

    return intOk({
      accessToken,
      // Google may omit refresh_token on refresh; preserve the old one.
      refreshToken: refreshToken ?? args.refreshToken,
      expiresAt,
      scopes,
      accountId: args.accountId,
      accountEmail: args.accountEmail,
    });
  }

  /**
   * Revoke tokens. Per the revocation endpoint:
   *   POST https://oauth2.googleapis.com/revoke?token={token}
   * Returns 200 OK on success, 400 for invalid tokens (already revoked /
   * malformed). We treat 400 as success-idempotent.
   */
  async revokeTokens(args: { accessToken: string }): Promise<IntegrationResult<void>> {
    const url = `${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(args.accessToken)}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: 'POST' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('NETWORK', `network error: ${message}`);
    }
    if (res.ok) return intOk(undefined);
    // 400 with `invalid_token` → already revoked; treat as success.
    if (res.status === 400) {
      const body = await res.text();
      if (/invalid_token/i.test(body)) return intOk(undefined);
    }
    return mapHttpError(res, await res.text());
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async postForm(
    url: string,
    body: URLSearchParams,
  ): Promise<IntegrationResult<Record<string, unknown>>> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('NETWORK', `network error: ${message}`);
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text.length === 0 ? {} : JSON.parse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return intError('MALFORMED_RESPONSE', `failed to parse JSON: ${msg}`, {
        status: res.status,
      });
    }

    if (!res.ok) {
      return mapHttpError(res, text);
    }
    if (!parsed || typeof parsed !== 'object') {
      return intError('MALFORMED_RESPONSE', 'expected object response from Google', {
        status: res.status,
      });
    }
    return intOk(parsed as Record<string, unknown>);
  }

  private async fetchUserinfo(
    accessToken: string,
  ): Promise<IntegrationResult<{ sub: string; email: string }>> {
    let res: Response;
    try {
      res = await this.fetchImpl(GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('NETWORK', `network error fetching userinfo: ${message}`);
    }
    const text = await res.text();
    if (!res.ok) return mapHttpError(res, text);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return intError('MALFORMED_RESPONSE', `userinfo JSON parse failed: ${msg}`, {
        status: res.status,
      });
    }
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).sub !== 'string' ||
      typeof (body as Record<string, unknown>).email !== 'string'
    ) {
      return intError('MALFORMED_RESPONSE', 'userinfo missing sub/email');
    }
    const rec = body as { sub: string; email: string };
    return intOk({ sub: rec.sub, email: rec.email });
  }
}

// ── Parsers / mappers ───────────────────────────────────────────────────

interface ParsedTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
}

function parseTokenResponse(
  body: Record<string, unknown>,
): IntegrationResult<ParsedTokenResponse> {
  const at = body.access_token;
  const expiresIn = body.expires_in;
  const scope = body.scope;
  if (typeof at !== 'string' || at.length === 0) {
    return intError('MALFORMED_RESPONSE', 'token response missing access_token');
  }
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn)) {
    return intError('MALFORMED_RESPONSE', 'token response missing expires_in');
  }
  const refreshToken =
    typeof body.refresh_token === 'string' ? body.refresh_token : null;
  // Defensive: subtract 60s from the announced expiry to avoid edge-of-window
  // 401s on slow clocks.
  const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000);
  const scopes = typeof scope === 'string' && scope.length > 0 ? scope.split(' ') : [];
  return intOk({ accessToken: at, refreshToken, expiresAt, scopes });
}

function mapHttpError(
  res: Response,
  text: string,
): { ok: false; error: import('../types').IntegrationError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as {
      error?: string | { message?: string; code?: string };
      error_description?: string;
    };
    if (typeof body.error === 'string') {
      detail = body.error_description ?? body.error;
      // Preserve the raw OAuth2 error code (e.g. "invalid_grant",
      // "invalid_client") so callers can branch on it without
      // string-matching the human-readable message.
      reference = body.error;
    } else if (body.error && typeof body.error === 'object') {
      detail = body.error.message ?? detail;
      reference = body.error.code;
    }
  } catch {
    // text body; keep statusText
  }
  if (res.status === 401) {
    return intError('UNAUTHORIZED', detail, { status: 401, reference });
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
  return intError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}
