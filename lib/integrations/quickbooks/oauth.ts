/**
 * lib/integrations/quickbooks/oauth.ts
 *
 * Intuit (QuickBooks Online) OAuth2 Authorization Code Grant — the ONLY file
 * that touches Intuit's OAuth endpoints. Per
 * https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
 * (read 2026-05-20):
 *   - Authorize: https://appcenter.intuit.com/connect/oauth2 (built in
 *                lib/integrations/oauth-urls.ts)
 *   - Token:     https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 *                (Basic auth: base64(clientId:clientSecret), form-urlencoded)
 *
 * Two Intuit-specific quirks this adapter handles:
 *   1. The authorization-code exchange REQUIRES `redirect_uri` in the POST body
 *      (it must byte-match the registered <origin>/api/integrations/quickbooks/
 *      oauth/callback). Refresh does NOT take redirect_uri.
 *   2. Intuit ROTATES the refresh token on every refresh — we always persist
 *      the returned refresh_token (and keep the prior one only if Intuit omits
 *      it, which it never does in practice).
 *
 * The accounting scope has no userinfo endpoint, so company identity is read
 * from the CompanyInfo entity against the API base. NOTE: a sandbox realmId
 * 401s against the production API base and vice versa — the environment is
 * pinned on the credential's providerMetadata so the server.ts seam targets
 * the matching base.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Accounting REST seam is
 * `lib/integrations/quickbooks-mcp/server.ts`. This file only speaks OAuth +
 * the one CompanyInfo read needed to label the connection.
 */

import { intError, intOk, type IntegrationResult, type TokenSet } from '../types';

const TOKEN_ENDPOINT = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

export type QuickbooksEnvironment = 'sandbox' | 'production';

export function quickbooksApiBase(environment: QuickbooksEnvironment): string {
  // Sandbox realm files only resolve against the sandbox host; production realm
  // files only against the production host. Mismatch => 401.
  return environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

export interface QuickbooksOAuthConfig {
  clientId: string;
  clientSecret: string;
  environment: QuickbooksEnvironment;
  /** Must byte-match the registered redirect; required by Intuit on code exchange. */
  redirectUri: string;
  fetchImpl?: typeof fetch;
}

export interface QuickbooksCompany {
  /** Intuit company id (realmId). */
  realmId: string;
  /** CompanyInfo.CompanyName, or a fallback label. */
  companyName: string;
}

export interface QuickbooksConnectResult {
  tokens: TokenSet;
  company: QuickbooksCompany;
}

export class QuickbooksOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly environment: QuickbooksEnvironment;
  private readonly redirectUri: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: QuickbooksOAuthConfig) {
    if (!config.clientId) throw new Error('QuickbooksOAuth: clientId is required');
    if (!config.clientSecret) throw new Error('QuickbooksOAuth: clientSecret is required');
    if (!config.redirectUri) throw new Error('QuickbooksOAuth: redirectUri is required');
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.environment = config.environment;
    this.redirectUri = config.redirectUri;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private basicAuth(): string {
    return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
  }

  /**
   * Exchange an authorization code for tokens, then resolve the company label
   * via CompanyInfo. `realmId` arrives on the callback query string, not in the
   * token response, so it is supplied by the caller.
   */
  async exchangeCode(args: { code: string; realmId: string }): Promise<IntegrationResult<QuickbooksConnectResult>> {
    if (!args.realmId) {
      return intError('INVALID_ARGUMENT', 'QuickBooks callback did not include realmId.');
    }
    const tokenRes = await this.postToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: args.code,
        redirect_uri: this.redirectUri,
      }),
    );
    if (!tokenRes.ok) return tokenRes;
    const { accessToken, refreshToken, expiresAt, scopes } = tokenRes.value;
    if (!refreshToken) {
      return intError('MALFORMED_RESPONSE', 'Intuit token response missing refresh_token.');
    }
    const companyName = await this.fetchCompanyName(accessToken, args.realmId);
    return intOk({
      tokens: {
        accessToken,
        refreshToken,
        expiresAt,
        scopes,
        accountId: args.realmId,
        accountEmail: companyName,
      },
      company: { realmId: args.realmId, companyName },
    });
  }

  /** Refresh tokens. Intuit ROTATES the refresh token; persist the returned one. */
  async refreshTokens(args: {
    refreshToken: string;
    accountId: string;
    accountEmail: string;
  }): Promise<IntegrationResult<TokenSet>> {
    const res = await this.postToken(
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: args.refreshToken }),
    );
    if (!res.ok) {
      const isInvalidGrant =
        res.error.reference === 'invalid_grant' || /invalid_grant/i.test(res.error.message);
      if (isInvalidGrant) {
        return intError('GRANT_REVOKED', `Intuit returned invalid_grant on refresh: ${res.error.message}`, {
          status: res.error.status,
          reference: res.error.reference,
        });
      }
      return res;
    }
    return intOk({
      accessToken: res.value.accessToken,
      // Intuit always rotates; keep the prior token only as a paranoid fallback.
      refreshToken: res.value.refreshToken ?? args.refreshToken,
      expiresAt: res.value.expiresAt,
      scopes: res.value.scopes,
      accountId: args.accountId,
      accountEmail: args.accountEmail,
    });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async postToken(
    body: URLSearchParams,
  ): Promise<IntegrationResult<{ accessToken: string; refreshToken: string | null; expiresAt: Date; scopes: string[] }>> {
    let res: Response;
    try {
      res = await this.fetchImpl(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.basicAuth()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (err) {
      return intError('NETWORK', `network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapIntuitHttpError(res, text);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      return intError('MALFORMED_RESPONSE', `token JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
    const at = parsed.access_token;
    const expiresIn = parsed.expires_in;
    if (typeof at !== 'string' || at.length === 0) {
      return intError('MALFORMED_RESPONSE', 'Intuit token response missing access_token');
    }
    const seconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 3600;
    const refreshToken = typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null;
    const scope = typeof parsed.scope === 'string' ? parsed.scope : '';
    return intOk({
      accessToken: at,
      refreshToken,
      expiresAt: new Date(Date.now() + (seconds - 60) * 1000),
      scopes: scope.length > 0 ? scope.split(' ') : ['com.intuit.quickbooks.accounting'],
    });
  }

  /**
   * Best-effort company label. The accounting-only scope has no userinfo, so we
   * read CompanyInfo once. On any failure we fall back to a realmId-derived
   * label rather than failing the connect — labelling is non-load-bearing.
   */
  private async fetchCompanyName(accessToken: string, realmId: string): Promise<string> {
    const fallback = `QuickBooks Company ${realmId}`;
    const base = quickbooksApiBase(this.environment);
    let res: Response;
    try {
      res = await this.fetchImpl(
        `${base}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
      );
    } catch {
      return fallback;
    }
    if (!res.ok) return fallback;
    try {
      const body = (await res.json()) as { CompanyInfo?: { CompanyName?: string } };
      const name = body.CompanyInfo?.CompanyName;
      return typeof name === 'string' && name.length > 0 ? name : fallback;
    } catch {
      return fallback;
    }
  }
}

function mapIntuitHttpError(res: Response, text: string): { ok: false; error: import('../types').IntegrationError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as { error?: string; error_description?: string; message?: string };
    detail = body.error_description ?? body.message ?? body.error ?? detail;
    reference = body.error;
  } catch {
    /* keep statusText */
  }
  if (res.status === 401) return intError('UNAUTHORIZED', detail, { status: 401, reference });
  if (res.status === 403) return intError('FORBIDDEN', detail, { status: 403, reference });
  if (res.status === 404) return intError('NOT_FOUND', detail, { status: 404, reference });
  if (res.status === 429) return intError('RATE_LIMITED', detail, { status: 429, reference });
  return intError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}
