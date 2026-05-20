/**
 * lib/integrations/docusign/oauth.ts
 *
 * DocuSign Authorization Code Grant — the ONLY file that touches DocuSign's
 * OAuth endpoints. Per https://developers.docusign.com/platform/auth/authcode/
 * (read 2026-05-20):
 *   - Authorize: {baseUri}/oauth/auth        (built in lib/integrations/oauth-urls.ts)
 *   - Token:     {baseUri}/oauth/token       (Basic auth: base64(ik:secret))
 *   - UserInfo:  {baseUri}/oauth/userinfo    (Bearer; returns accounts[].base_uri)
 *
 * `baseUri` is the account server — account-d.docusign.com (demo) or
 * account.docusign.com (production). The per-account REST base (e.g.
 * https://demo.docusign.net) comes back from /oauth/userinfo and is what the
 * MCP server calls; we persist it on the credential's providerMetadata.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the eSignature REST SDK seam is
 * `lib/integrations/docusign-mcp/server.ts`. This file only speaks OAuth.
 */

import { intError, intOk, type IntegrationResult, type TokenSet } from '../types';

export interface DocuSignOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Account server base — account-d.docusign.com (demo) / account.docusign.com (prod). */
  baseUri: string;
  fetchImpl?: typeof fetch;
}

export interface DocuSignAccount {
  accountId: string;
  accountName: string;
  /** REST API base for this account, e.g. https://demo.docusign.net */
  apiBaseUri: string;
}

export interface DocuSignConnectResult {
  tokens: TokenSet;
  account: DocuSignAccount;
}

export class DocuSignOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUri: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: DocuSignOAuthConfig) {
    if (!config.clientId) throw new Error('DocuSignOAuth: clientId is required');
    if (!config.clientSecret) throw new Error('DocuSignOAuth: clientSecret is required');
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUri = config.baseUri.replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private basicAuth(): string {
    return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
  }

  /**
   * Exchange an authorization code for tokens, then resolve the default
   * account (id + REST base_uri) via /oauth/userinfo.
   */
  async exchangeCode(args: { code: string }): Promise<IntegrationResult<DocuSignConnectResult>> {
    const tokenRes = await this.postToken(
      new URLSearchParams({ grant_type: 'authorization_code', code: args.code }),
    );
    if (!tokenRes.ok) return tokenRes;
    const { accessToken, refreshToken, expiresAt, scopes } = tokenRes.value;
    if (!refreshToken) {
      return intError(
        'INVALID_ARGUMENT',
        'DocuSign did not return a refresh_token. Ensure the `extended` scope is requested.',
      );
    }
    const info = await this.fetchUserInfo(accessToken);
    if (!info.ok) return info;
    return intOk({
      tokens: {
        accessToken,
        refreshToken,
        expiresAt,
        scopes,
        accountId: info.value.account.accountId,
        accountEmail: info.value.email,
      },
      account: info.value.account,
    });
  }

  /** Refresh tokens. DocuSign rotates the refresh token; persist the returned one. */
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
        return intError('GRANT_REVOKED', `DocuSign returned invalid_grant on refresh: ${res.error.message}`, {
          status: res.error.status,
          reference: res.error.reference,
        });
      }
      return res;
    }
    return intOk({
      accessToken: res.value.accessToken,
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
      res = await this.fetchImpl(`${this.baseUri}/oauth/token`, {
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
    if (!res.ok) return mapDocusignHttpError(res, text);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      return intError('MALFORMED_RESPONSE', `token JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
    const at = parsed.access_token;
    const expiresIn = parsed.expires_in;
    if (typeof at !== 'string' || at.length === 0) {
      return intError('MALFORMED_RESPONSE', 'DocuSign token response missing access_token');
    }
    const seconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 28800;
    const refreshToken = typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null;
    const scope = typeof parsed.scope === 'string' ? parsed.scope : '';
    return intOk({
      accessToken: at,
      refreshToken,
      expiresAt: new Date(Date.now() + (seconds - 60) * 1000),
      scopes: scope.length > 0 ? scope.split(' ') : ['signature', 'extended'],
    });
  }

  private async fetchUserInfo(
    accessToken: string,
  ): Promise<IntegrationResult<{ email: string; account: DocuSignAccount }>> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUri}/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
    } catch (err) {
      return intError('NETWORK', `network error fetching userinfo: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapDocusignHttpError(res, text);
    let body: {
      email?: string;
      accounts?: Array<{ account_id?: string; account_name?: string; is_default?: boolean; base_uri?: string }>;
    };
    try {
      body = JSON.parse(text);
    } catch (err) {
      return intError('MALFORMED_RESPONSE', `userinfo JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const accounts = body.accounts ?? [];
    const chosen = accounts.find((a) => a.is_default) ?? accounts[0];
    if (!chosen?.account_id || !chosen.base_uri || !body.email) {
      return intError('MALFORMED_RESPONSE', 'DocuSign userinfo missing email or a default account with base_uri');
    }
    return intOk({
      email: body.email,
      account: {
        accountId: chosen.account_id,
        accountName: chosen.account_name ?? chosen.account_id,
        apiBaseUri: chosen.base_uri.replace(/\/$/, ''),
      },
    });
  }
}

function mapDocusignHttpError(res: Response, text: string): { ok: false; error: import('../types').IntegrationError } {
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
