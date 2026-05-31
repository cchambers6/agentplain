/**
 * lib/integrations/salesforce/oauth.ts
 *
 * Salesforce OAuth2 Authorization Code Grant — the ONLY file that
 * touches Salesforce's OAuth endpoints. Per
 * https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm
 * (read 2026-05-31):
 *   - Authorize: {loginHost}/services/oauth2/authorize
 *   - Token:     {loginHost}/services/oauth2/token
 *
 * Salesforce quirks the adapter handles:
 *   1. The token response carries an `instance_url` (e.g.
 *      https://yourorg.my.salesforce.com) — THE per-org API host. We
 *      persist it on `providerMetadata.instanceUrl` because all REST
 *      calls go to {instanceUrl}/services/data/v60.0/...
 *   2. Refresh tokens are long-lived and NOT rotated.
 *   3. The token response carries `id` — a URL pointing at the user-info
 *      endpoint we can call to label the connection (username + org id).
 *
 * HONEST CONCESSION: customers using their own dev-tier Connected App can
 * connect without partner-program enrollment. Production AppExchange
 * distribution requires a Connected App security review. Until that
 * lands, each customer provides their own client id/secret.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Salesforce REST seam is
 * `lib/integrations/salesforce-mcp/server.ts`. This file only speaks
 * OAuth + the one identity read needed to label the connection.
 */

import { intError, intOk, type IntegrationResult, type TokenSet } from '../types';

const DEFAULT_LOGIN_HOST = 'https://login.salesforce.com';
const DEFAULT_SANDBOX_LOGIN_HOST = 'https://test.salesforce.com';
export const SALESFORCE_API_VERSION = 'v60.0';

export interface SalesforceOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Must byte-match the registered Connected App callback URL. */
  redirectUri: string;
  /** login.salesforce.com (default) or test.salesforce.com (sandbox). */
  loginHost?: string;
  fetchImpl?: typeof fetch;
}

export interface SalesforceConnectResult {
  tokens: TokenSet;
  /** Per-org API host returned by Salesforce on the token response. */
  instanceUrl: string;
  /** Org id (stable per company). */
  orgId: string;
  /** Friendly customer label (username). */
  username: string;
}

export class SalesforceOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly loginHost: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SalesforceOAuthConfig) {
    if (!config.clientId) throw new Error('SalesforceOAuth: clientId is required');
    if (!config.clientSecret) throw new Error('SalesforceOAuth: clientSecret is required');
    if (!config.redirectUri) throw new Error('SalesforceOAuth: redirectUri is required');
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.loginHost = (config.loginHost ?? DEFAULT_LOGIN_HOST).replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async exchangeCode(args: { code: string }): Promise<IntegrationResult<SalesforceConnectResult>> {
    const tokenRes = await this.postToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: args.code,
      }),
    );
    if (!tokenRes.ok) return tokenRes;
    const { accessToken, refreshToken, expiresAt, scopes, instanceUrl, idUrl } = tokenRes.value;
    if (!refreshToken) {
      return intError(
        'MALFORMED_RESPONSE',
        'Salesforce token response missing refresh_token. The Connected App must request the `refresh_token` scope.',
      );
    }
    if (!instanceUrl) {
      return intError('MALFORMED_RESPONSE', 'Salesforce token response missing instance_url.');
    }
    const identity = await this.fetchIdentity(idUrl, accessToken);
    return intOk({
      tokens: {
        accessToken,
        refreshToken,
        expiresAt,
        scopes,
        accountId: identity.orgId,
        accountEmail: identity.username,
      },
      instanceUrl,
      orgId: identity.orgId,
      username: identity.username,
    });
  }

  async refreshTokens(args: {
    refreshToken: string;
    accountId: string;
    accountEmail: string;
  }): Promise<IntegrationResult<TokenSet>> {
    const res = await this.postToken(
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: args.refreshToken,
      }),
    );
    if (!res.ok) {
      const isInvalidGrant =
        res.error.reference === 'invalid_grant' ||
        /invalid_grant|expired access\/refresh token/i.test(res.error.message);
      if (isInvalidGrant) {
        return intError('GRANT_REVOKED', `Salesforce refresh failed: ${res.error.message}`, {
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

  // ── internals ──────────────────────────────────────────────────────────

  private async postToken(
    body: URLSearchParams,
  ): Promise<IntegrationResult<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date;
    scopes: string[];
    instanceUrl: string | null;
    idUrl: string | null;
  }>> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.loginHost}/services/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (err) {
      return intError('NETWORK', `Salesforce token network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapSalesforceHttpError(res, text);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      return intError('MALFORMED_RESPONSE', `Salesforce token JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
    const at = parsed.access_token;
    if (typeof at !== 'string' || at.length === 0) {
      return intError('MALFORMED_RESPONSE', 'Salesforce token response missing access_token');
    }
    const refreshToken = typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null;
    const instanceUrl = typeof parsed.instance_url === 'string' ? parsed.instance_url : null;
    const idUrl = typeof parsed.id === 'string' ? parsed.id : null;
    const scope = typeof parsed.scope === 'string' ? parsed.scope : '';
    // Salesforce does NOT return expires_in on the standard auth flow; access
    // tokens are session-tied (default ~2 hours, configurable). We refresh
    // proactively after ~90 minutes to stay well clear.
    return intOk({
      accessToken: at,
      refreshToken,
      expiresAt: new Date(Date.now() + 90 * 60 * 1000),
      scopes: scope.length > 0 ? scope.split(' ') : [],
      instanceUrl,
      idUrl,
    });
  }

  /** Best-effort identity lookup. Returns fallback labels on any failure
   *  rather than failing the connect. */
  private async fetchIdentity(
    idUrl: string | null,
    accessToken: string,
  ): Promise<{ orgId: string; username: string }> {
    const fallback = { orgId: 'salesforce-org', username: 'Salesforce Org' };
    if (!idUrl) return fallback;
    let res: Response;
    try {
      res = await this.fetchImpl(idUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
    } catch {
      return fallback;
    }
    if (!res.ok) return fallback;
    try {
      const body = (await res.json()) as {
        organization_id?: string;
        username?: string;
        email?: string;
        user_id?: string;
      };
      const orgId = body.organization_id ?? body.user_id ?? fallback.orgId;
      const username = body.username ?? body.email ?? fallback.username;
      return { orgId, username };
    } catch {
      return fallback;
    }
  }
}

function mapSalesforceHttpError(res: Response, text: string): { ok: false; error: import('../types').IntegrationError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as { error?: string; error_description?: string; message?: string };
    detail = body.error_description ?? body.message ?? body.error ?? detail;
    reference = body.error;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 400 && /invalid_grant/i.test(detail)) {
    return intError('GRANT_REVOKED', detail, { status: 400, reference });
  }
  if (res.status === 401) return intError('UNAUTHORIZED', detail, { status: 401, reference });
  if (res.status === 403) return intError('FORBIDDEN', detail, { status: 403, reference });
  if (res.status === 404) return intError('NOT_FOUND', detail, { status: 404, reference });
  if (res.status === 429) return intError('RATE_LIMITED', detail, { status: 429, reference });
  return intError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}

/** Build the Salesforce OAuth2 authorize URL. */
export function buildSalesforceAuthorizeUrl(args: {
  loginHost: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const base = (args.loginHost || DEFAULT_LOGIN_HOST).replace(/\/$/, '');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    scope: args.scopes.join(' '),
    state: args.state,
    // prompt=consent ensures customers see the grant screen when reconnecting.
    prompt: 'consent',
  });
  return `${base}/services/oauth2/authorize?${params.toString()}`;
}

export { DEFAULT_LOGIN_HOST as SALESFORCE_PROD_LOGIN_HOST, DEFAULT_SANDBOX_LOGIN_HOST };
