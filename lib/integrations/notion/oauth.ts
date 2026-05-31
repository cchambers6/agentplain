/**
 * lib/integrations/notion/oauth.ts
 *
 * Notion OAuth2 Authorization Code Grant — the ONLY file that touches
 * Notion's OAuth endpoints. Per
 * https://developers.notion.com/docs/authorization (read 2026-05-31):
 *   - Authorize: https://api.notion.com/v1/oauth/authorize
 *   - Token:     https://api.notion.com/v1/oauth/token
 *
 * Notion quirks:
 *   1. Token request uses HTTP Basic auth (Authorization: Basic
 *      base64(clientId:clientSecret)), body is JSON, NOT form-urlencoded.
 *   2. Access tokens are WORKSPACE-SCOPED and do NOT EXPIRE — there is
 *      no refresh token. We store the token with a sentinel far-future
 *      expiresAt and null refresh token. (Like FUB's API-key flow.)
 *   3. The token response carries `bot_id`, `workspace_id`,
 *      `workspace_name`, and `owner` — we persist them on
 *      providerMetadata for the operator UI.
 */

import { intError, intOk, type IntegrationResult, type TokenSet } from '../types';

const AUTHORIZE_ENDPOINT = 'https://api.notion.com/v1/oauth/authorize';
const TOKEN_ENDPOINT = 'https://api.notion.com/v1/oauth/token';

export const NOTION_API_BASE = 'https://api.notion.com/v1';
/** Notion's required API version header. */
export const NOTION_API_VERSION = '2022-06-28';
/** Notion access tokens do not expire; pin a far-future sentinel. */
const NOTION_SENTINEL_EXPIRES_AT = new Date('2099-12-31T00:00:00.000Z');

export interface NotionOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Must byte-match the registered redirect URI on the Notion app. */
  redirectUri: string;
  fetchImpl?: typeof fetch;
}

export interface NotionConnectResult {
  tokens: TokenSet;
  /** Notion bot id (the integration installation id). */
  botId: string;
  /** Notion workspace id the user granted. */
  workspaceId: string;
  workspaceName: string;
}

export class NotionOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: NotionOAuthConfig) {
    if (!config.clientId) throw new Error('NotionOAuth: clientId is required');
    if (!config.clientSecret) throw new Error('NotionOAuth: clientSecret is required');
    if (!config.redirectUri) throw new Error('NotionOAuth: redirectUri is required');
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async exchangeCode(args: { code: string }): Promise<IntegrationResult<NotionConnectResult>> {
    let res: Response;
    try {
      res = await this.fetchImpl(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.basicAuth()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Notion-Version': NOTION_API_VERSION,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: args.code,
          redirect_uri: this.redirectUri,
        }),
      });
    } catch (err) {
      return intError('NETWORK', `Notion token network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) return mapNotionHttpError(res, text);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      return intError('MALFORMED_RESPONSE', `Notion token JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
    const accessToken = parsed.access_token;
    const botId = parsed.bot_id;
    const workspaceId = parsed.workspace_id;
    const workspaceName = parsed.workspace_name;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      return intError('MALFORMED_RESPONSE', 'Notion token response missing access_token');
    }
    if (typeof botId !== 'string' || botId.length === 0) {
      return intError('MALFORMED_RESPONSE', 'Notion token response missing bot_id');
    }
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      return intError('MALFORMED_RESPONSE', 'Notion token response missing workspace_id');
    }
    const label = typeof workspaceName === 'string' && workspaceName.length > 0
      ? workspaceName
      : `Notion Workspace ${workspaceId.slice(0, 8)}`;
    return intOk({
      tokens: {
        accessToken,
        refreshToken: null,
        expiresAt: NOTION_SENTINEL_EXPIRES_AT,
        scopes: ['workspace:read', 'page:read', 'page:write', 'database:read'],
        accountId: workspaceId,
        accountEmail: label,
      },
      botId,
      workspaceId,
      workspaceName: label,
    });
  }

  private basicAuth(): string {
    return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
  }
}

function mapNotionHttpError(res: Response, text: string): { ok: false; error: import('../types').IntegrationError } {
  let detail = res.statusText || `HTTP ${res.status}`;
  let reference: string | undefined;
  try {
    const body = JSON.parse(text) as { message?: string; code?: string; error?: string; error_description?: string };
    detail = body.error_description ?? body.message ?? body.error ?? detail;
    reference = body.code ?? body.error;
  } catch {
    if (text) detail = text.slice(0, 240);
  }
  if (res.status === 401) return intError('UNAUTHORIZED', detail, { status: 401, reference });
  if (res.status === 403) return intError('FORBIDDEN', detail, { status: 403, reference });
  if (res.status === 404) return intError('NOT_FOUND', detail, { status: 404, reference });
  if (res.status === 429) return intError('RATE_LIMITED', detail, { status: 429, reference });
  return intError('UPSTREAM_ERROR', detail, { status: res.status, reference });
}

/** Build the Notion OAuth2 authorize URL. */
export function buildNotionAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    state: args.state,
    /** `owner=user` performs the OAuth grant on behalf of the authorizing
     *  user (their workspace selection), not a bot install. */
    owner: 'user',
  });
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

export { NOTION_SENTINEL_EXPIRES_AT };
