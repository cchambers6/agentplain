/**
 * lib/integrations/hubspot/oauth.ts
 *
 * HubSpot OAuth2 Authorization Code Grant — the ONLY file that touches
 * HubSpot's OAuth endpoints. Per
 * https://developers.hubspot.com/docs/api/working-with-oauth (read 2026-05-31):
 *   - Authorize: https://app.hubspot.com/oauth/authorize
 *   - Token:     https://api.hubapi.com/oauth/v1/token
 *
 * HubSpot quirks:
 *   1. Refresh tokens are LONG-LIVED and NOT rotated on refresh — keep the
 *      original refresh token unless the response carries a new one.
 *   2. Token exchange is form-urlencoded (not JSON).
 *   3. The hub id (portal id) returned by /oauth/v1/access-tokens/{token}
 *      identifies the customer account; we persist it on
 *      `IntegrationCredential.accountId`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the HubSpot REST seam is
 * `lib/integrations/hubspot-mcp/server.ts`. This file only speaks OAuth +
 * the one access-token introspection read needed to label the connection.
 */

import { intError, intOk, type IntegrationResult, type TokenSet } from '../types';

const TOKEN_ENDPOINT = 'https://api.hubapi.com/oauth/v1/token';
const ACCESS_TOKEN_INFO_ENDPOINT = 'https://api.hubapi.com/oauth/v1/access-tokens';

export const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export interface HubspotOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Must byte-match the registered redirect URI on the HubSpot app. */
  redirectUri: string;
  fetchImpl?: typeof fetch;
}

export interface HubspotConnectResult {
  tokens: TokenSet;
  /** HubSpot portal/hub id — the per-customer account identifier. */
  hubId: string;
  /** Customer label (hub domain or admin email). Best-effort. */
  hubDomain: string;
}

export class HubspotOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HubspotOAuthConfig) {
    if (!config.clientId) throw new Error('HubspotOAuth: clientId is required');
    if (!config.clientSecret) throw new Error('HubspotOAuth: clientSecret is required');
    if (!config.redirectUri) throw new Error('HubspotOAuth: redirectUri is required');
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /** Exchange an authorization code for tokens; resolve the hub id via
   *  /oauth/v1/access-tokens/{token}. */
  async exchangeCode(args: { code: string }): Promise<IntegrationResult<HubspotConnectResult>> {
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
    const { accessToken, refreshToken, expiresAt, scopes } = tokenRes.value;
    if (!refreshToken) {
      return intError('MALFORMED_RESPONSE', 'HubSpot token response missing refresh_token.');
    }
    const info = await this.fetchAccessTokenInfo(accessToken);
    return intOk({
      tokens: {
        accessToken,
        refreshToken,
        expiresAt,
        scopes,
        accountId: info.hubId,
        accountEmail: info.hubDomain,
      },
      hubId: info.hubId,
      hubDomain: info.hubDomain,
    });
  }

  /** Refresh tokens. HubSpot does NOT rotate refresh tokens — keep the prior
   *  value when the response omits a new one (it usually does). */
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
        res.error.reference === 'BAD_REFRESH_TOKEN' ||
        /invalid_grant|expired/i.test(res.error.message);
      if (isInvalidGrant) {
        return intError('GRANT_REVOKED', `HubSpot refresh failed: ${res.error.message}`, {
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
  ): Promise<IntegrationResult<{ accessToken: string; refreshToken: string | null; expiresAt: Date; scopes: string[] }>> {
    let res: Response;
    try {
      res = await this.fetchImpl(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (err) {
      return intError('NETWORK', `HubSpot token network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapHubspotHttpError(res, text);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      return intError('MALFORMED_RESPONSE', `HubSpot token JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
    const at = parsed.access_token;
    const expiresIn = parsed.expires_in;
    if (typeof at !== 'string' || at.length === 0) {
      return intError('MALFORMED_RESPONSE', 'HubSpot token response missing access_token');
    }
    const seconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 1800;
    const refreshToken = typeof parsed.refresh_token === 'string' ? parsed.refresh_token : null;
    return intOk({
      accessToken: at,
      refreshToken,
      // 60s safety margin so we refresh before expiry.
      expiresAt: new Date(Date.now() + Math.max(60, seconds - 60) * 1000),
      scopes: [],
    });
  }

  /** Resolve the hub id + a customer label from /oauth/v1/access-tokens/{token}. */
  private async fetchAccessTokenInfo(accessToken: string): Promise<{ hubId: string; hubDomain: string }> {
    const fallback = { hubId: '0', hubDomain: 'HubSpot Account' };
    let res: Response;
    try {
      res = await this.fetchImpl(`${ACCESS_TOKEN_INFO_ENDPOINT}/${encodeURIComponent(accessToken)}`, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      return fallback;
    }
    if (!res.ok) return fallback;
    try {
      const body = (await res.json()) as { hub_id?: number | string; hub_domain?: string; user?: string };
      const hubId = body.hub_id !== undefined ? String(body.hub_id) : fallback.hubId;
      const hubDomain =
        (typeof body.hub_domain === 'string' && body.hub_domain.length > 0 ? body.hub_domain : null) ??
        (typeof body.user === 'string' && body.user.length > 0 ? body.user : null) ??
        `HubSpot Hub ${hubId}`;
      return { hubId, hubDomain };
    } catch {
      return fallback;
    }
  }
}

function mapHubspotHttpError(res: Response, text: string): { ok: false; error: import('../types').IntegrationError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as { message?: string; status?: string; category?: string; error?: string; error_description?: string };
    detail = body.error_description ?? body.message ?? body.error ?? body.status ?? detail;
    reference = body.category ?? body.error;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return intError('UNAUTHORIZED', detail, { status: 401, reference });
  if (res.status === 403) return intError('FORBIDDEN', detail, { status: 403, reference });
  if (res.status === 404) return intError('NOT_FOUND', detail, { status: 404, reference });
  if (res.status === 429) return intError('RATE_LIMITED', detail, { status: 429, reference });
  return intError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}

/** Build the HubSpot OAuth2 authorize URL.
 *  Per https://developers.hubspot.com/docs/api/working-with-oauth (read 2026-05-31). */
export function buildHubspotAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    scope: args.scopes.join(' '),
    response_type: 'code',
    state: args.state,
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}
