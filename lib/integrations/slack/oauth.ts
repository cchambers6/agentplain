/**
 * lib/integrations/slack/oauth.ts
 *
 * Slack OAuth v2 (user-token grant) — the ONLY file that touches Slack's
 * OAuth endpoints. Per https://api.slack.com/methods/oauth.v2.access +
 * https://api.slack.com/authentication/oauth-v2 (read 2026-05-20):
 *   - Authorize: https://slack.com/oauth/v2/authorize  (built in lib/integrations/oauth-urls.ts)
 *   - Token:     https://slack.com/api/oauth.v2.access  (form body; no Basic auth)
 *
 * We request `user_scope` (not bot scopes): `search.messages` is user-token
 * only, and posting must act AS the customer (per the no-outbound model).
 * So we store `authed_user.access_token` as the credential access token.
 *
 * Slack user tokens do NOT expire unless token rotation is enabled (we don't
 * enable it), so the TokenSet's `expiresAt` is parked far in the future and
 * `refreshToken` is null — the credential resolver therefore never refreshes.
 * `refreshTokens` exists only to satisfy the RefreshFn seam and returns
 * GRANT_REVOKED (it is never actually called given the far-future expiry).
 *
 * Per `feedback_no_silent_vendor_lock.md`: the Slack Web API seam is
 * `lib/integrations/slack-mcp/server.ts`. This file only speaks OAuth.
 */

import { intError, intOk, type IntegrationResult, type TokenSet } from '../types';

/** Slack user tokens don't expire (rotation disabled); park far in future so
 *  the credential resolver's near-expiry refresh path never triggers. */
const SLACK_FAR_FUTURE = new Date('2099-01-01T00:00:00Z');

export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Must byte-match the redirect_uri used in the authorize URL. */
  redirectUri: string;
  fetchImpl?: typeof fetch;
}

export interface SlackTeam {
  teamId: string;
  teamName: string;
  slackUserId: string;
}

export interface SlackConnectResult {
  tokens: TokenSet;
  team: SlackTeam;
}

interface SlackOAuthAccessResponse {
  ok: boolean;
  error?: string;
  authed_user?: { id?: string; access_token?: string; scope?: string };
  team?: { id?: string; name?: string };
}

export class SlackOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SlackOAuthConfig) {
    if (!config.clientId) throw new Error('SlackOAuth: clientId is required');
    if (!config.clientSecret) throw new Error('SlackOAuth: clientSecret is required');
    if (!config.redirectUri) throw new Error('SlackOAuth: redirectUri is required');
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * Exchange an authorization code for a USER token. The user token is
   * `authed_user.access_token`; we never persist the bot token.
   */
  async exchangeCode(args: { code: string }): Promise<IntegrationResult<SlackConnectResult>> {
    let res: Response;
    try {
      res = await this.fetchImpl('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: args.code,
          redirect_uri: this.redirectUri,
        }).toString(),
      });
    } catch (err) {
      return intError('NETWORK', `network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    const text = await res.text();
    let body: SlackOAuthAccessResponse;
    try {
      body = JSON.parse(text) as SlackOAuthAccessResponse;
    } catch (err) {
      return intError('MALFORMED_RESPONSE', `oauth.v2.access JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, {
        status: res.status,
      });
    }

    // Slack returns HTTP 200 even on logical errors; the `ok` field is the
    // real signal.
    if (!body.ok) {
      return intError('UPSTREAM_ERROR', body.error ?? 'slack_oauth_failed', {
        status: res.status,
        reference: body.error,
      });
    }

    const userToken = body.authed_user?.access_token;
    const slackUserId = body.authed_user?.id;
    const teamId = body.team?.id;
    const teamName = body.team?.name;
    if (!userToken || !slackUserId || !teamId) {
      return intError('MALFORMED_RESPONSE', 'Slack oauth.v2.access missing authed_user.access_token / id or team.id');
    }

    const scope = body.authed_user?.scope ?? '';
    const resolvedTeamName = teamName ?? teamId;
    return intOk({
      tokens: {
        accessToken: userToken,
        refreshToken: null,
        expiresAt: SLACK_FAR_FUTURE,
        scopes: scope.length > 0 ? scope.split(',') : [],
        accountId: slackUserId,
        // Slack doesn't return an email without users:read.email; the team
        // name is the human-readable label for the connected account.
        accountEmail: resolvedTeamName,
      },
      team: { teamId, teamName: resolvedTeamName, slackUserId },
    });
  }

  /**
   * Slack user tokens (rotation disabled) never refresh. This exists only to
   * satisfy the RefreshFn seam; the credential resolver never calls it because
   * the stored `expiresAt` is far in the future.
   */
  async refreshTokens(): Promise<IntegrationResult<TokenSet>> {
    return intError('GRANT_REVOKED', 'Slack user tokens do not refresh; reconnect Slack.');
  }
}
