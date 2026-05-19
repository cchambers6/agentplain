/**
 * lib/integrations/microsoft/oauth.ts
 *
 * Microsoft identity platform v2.0 OAuth client. Symmetric peer of
 * `lib/integrations/google/oauth.ts`. Implements the three OAuth verbs the
 * `IntegrationProvider` interface demands:
 *
 *   - `exchangeCodeForTokens`  — authorization-code grant
 *   - `refreshTokens`          — refresh-token grant
 *   - `revokeTokens`           — Microsoft does NOT expose a revoke
 *                                endpoint for delegated grants; we treat
 *                                "revoke" as a logical no-op + audit log.
 *
 * Per https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 * (read 2026-05-17):
 *
 *   - Authorization URL: `{authority}/oauth2/v2.0/authorize`
 *   - Token URL:         `{authority}/oauth2/v2.0/token`
 *   - Authority for multi-tenant + personal accounts: `/common`
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the only place
 * agentplain touches `login.microsoftonline.com`. The Outlook MCP server
 * + `lib/integrations/outlook-mcp/auth.ts` already have their own (older)
 * refresh helper bound to the MCP request path; this file is the
 * IntegrationProvider seam used by the renewal cron + revocation flows.
 * The two paths share the same wire contract but live in different
 * subsystems — the MCP file refreshes per-tool-call, this one refreshes
 * per-cron-fire. Both write back through `encryptTokenSet`.
 *
 * Per `project_no_outbound_architecture.md`: scopes default to
 * `Mail.Read Mail.ReadWrite offline_access`. `Mail.Send` is deliberately
 * NOT requested.
 */

import {
  intError,
  intOk,
  type IntegrationError,
  type IntegrationResult,
  type TokenSet,
} from '../types';

/**
 * Default scopes requested at consent time. Mirrors the marketplace
 * catalog entry exactly. We deliberately omit `Mail.Send`.
 */
export const MICROSOFT_DEFAULT_SCOPES = [
  'Mail.Read',
  'Mail.ReadWrite',
  'offline_access',
  // openid + email + profile give us the v2 id_token with oid + preferred_username,
  // matching Google's openid+email+profile pattern for accountId / accountEmail
  // hydration.
  'openid',
  'email',
  'profile',
] as const;

export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** e.g. `https://login.microsoftonline.com/common`. */
  authority: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
}

interface MicrosoftTokenResponse {
  token_type?: string;
  scope?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
}

interface MicrosoftErrorResponse {
  error?: string;
  error_description?: string;
  error_codes?: number[];
  trace_id?: string;
}

export class MicrosoftOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly authority: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: MicrosoftOAuthConfig) {
    if (!config.clientId) {
      throw new Error('MicrosoftOAuth: clientId is required');
    }
    if (!config.clientSecret) {
      throw new Error('MicrosoftOAuth: clientSecret is required');
    }
    if (!config.authority) {
      throw new Error('MicrosoftOAuth: authority is required');
    }
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.authority = config.authority.replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  tokenUrl(): string {
    return `${this.authority}/oauth2/v2.0/token`;
  }

  async exchangeCodeForTokens(args: {
    code: string;
    redirectUri: string;
  }): Promise<IntegrationResult<TokenSet>> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: args.code,
      redirect_uri: args.redirectUri,
      grant_type: 'authorization_code',
      scope: MICROSOFT_DEFAULT_SCOPES.join(' '),
    });
    const tokens = await this.postForm(this.tokenUrl(), body);
    if (!tokens.ok) return tokens;
    const parsed = parseTokenResponse(tokens.value);
    if (!parsed.ok) return parsed;
    if (!parsed.value.refreshToken) {
      // Microsoft only returns refresh_token when `offline_access` was
      // requested AND granted. Surface a typed error so the operator UI
      // can show "re-grant with offline_access" instead of the cron
      // looping with no refresh token.
      return intError(
        'INVALID_ARGUMENT',
        'Microsoft did not return a refresh_token. Re-grant with offline_access in the scope set.',
      );
    }
    // The /me Graph call is performed by the OAuth callback route (not
    // here) because the callback already needs the user's id + email for
    // the IntegrationCredential upsert; this method preserves the
    // accountId/accountEmail from the caller. Callers that don't need
    // identity (renewal-only paths) pass through the prior values.
    return intOk({
      accessToken: parsed.value.accessToken,
      refreshToken: parsed.value.refreshToken,
      expiresAt: parsed.value.expiresAt,
      scopes: parsed.value.scopes,
      accountId: '',
      accountEmail: '',
    });
  }

  async refreshTokens(args: {
    refreshToken: string;
    accountEmail: string;
    accountId: string;
  }): Promise<IntegrationResult<TokenSet>> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: args.refreshToken,
      grant_type: 'refresh_token',
      scope: MICROSOFT_DEFAULT_SCOPES.join(' '),
    });
    const tokens = await this.postForm(this.tokenUrl(), body);
    if (!tokens.ok) {
      // Microsoft surfaces an opaque "invalid_grant" with AADSTS70000
      // (and related codes) when the refresh token is no longer valid.
      // We branch on reference (the raw `error` code) rather than
      // string-matching the localized description.
      const isInvalidGrant =
        tokens.error.reference === 'invalid_grant' ||
        /AADSTS70000|AADSTS700016|AADSTS9002313|invalid_grant/i.test(
          tokens.error.message,
        );
      if (isInvalidGrant) {
        return intError(
          'GRANT_REVOKED',
          'Microsoft returned invalid_grant on refresh — credential is revoked.',
          {
            status: tokens.error.status,
            reference: tokens.error.reference,
          },
        );
      }
      return tokens;
    }
    const parsed = parseTokenResponse(tokens.value);
    if (!parsed.ok) return parsed;
    return intOk({
      accessToken: parsed.value.accessToken,
      // Microsoft may omit refresh_token on refresh; preserve the old one.
      refreshToken: parsed.value.refreshToken ?? args.refreshToken,
      expiresAt: parsed.value.expiresAt,
      scopes: parsed.value.scopes,
      accountId: args.accountId,
      accountEmail: args.accountEmail,
    });
  }

  /**
   * Microsoft does NOT expose a delegated-grant revoke endpoint. The
   * customer revokes by visiting https://account.live.com or their
   * tenant admin's "Application access" page. The IntegrationProvider
   * interface demands a `revokeTokens` method, so we return ok and let
   * the caller mark the credential REVOKED on its own side.
   */
  async revokeTokens(_args: {
    accessToken: string;
  }): Promise<IntegrationResult<void>> {
    void _args;
    return intOk(undefined);
  }

  private async postForm(
    url: string,
    body: URLSearchParams,
  ): Promise<IntegrationResult<MicrosoftTokenResponse>> {
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
      return intError('NETWORK', `Microsoft token endpoint network error: ${message}`);
    }
    const text = await res.text();
    if (!res.ok) {
      return mapMicrosoftHttpError(res, text);
    }
    let parsed: unknown;
    try {
      parsed = text.length === 0 ? {} : JSON.parse(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return intError('MALFORMED_RESPONSE', `token JSON parse: ${message}`, {
        status: res.status,
      });
    }
    if (!parsed || typeof parsed !== 'object') {
      return intError(
        'MALFORMED_RESPONSE',
        'token response was not an object',
        { status: res.status },
      );
    }
    return intOk(parsed as MicrosoftTokenResponse);
  }
}

interface ParsedTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
}

function parseTokenResponse(
  body: MicrosoftTokenResponse,
): IntegrationResult<ParsedTokenResponse> {
  if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
    return intError('MALFORMED_RESPONSE', 'token response missing access_token');
  }
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  const refreshToken =
    typeof body.refresh_token === 'string' && body.refresh_token.length > 0
      ? body.refresh_token
      : null;
  const scopes = (body.scope ?? '').split(/\s+/).filter(Boolean);
  // Subtract 60s for clock skew.
  const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000);
  return intOk({
    accessToken: body.access_token,
    refreshToken,
    expiresAt,
    scopes,
  });
}

function mapMicrosoftHttpError(
  res: Response,
  text: string,
): { ok: false; error: IntegrationError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as MicrosoftErrorResponse;
    if (body.error) {
      reference = body.error;
      detail = body.error_description ?? body.error;
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
