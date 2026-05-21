/**
 * lib/integrations/oauth-urls.ts
 *
 * Pure helpers for building per-provider OAuth authorize URLs. The
 * Phase C OAuth start route delegates here so the URL-builder seam is
 * import-free of `next/server` and trivially unit-testable.
 *
 * Per `feedback_no_silent_vendor_lock.md`: each provider's URL builder
 * lives next to its provider lib in `lib/integrations/<provider>/`. This
 * file is the dispatcher — one line per provider, no SDK imports.
 */

import { GoogleOAuth } from "./google/oauth";

export interface BuildAuthorizeUrlArgs {
  integrationId: string;
  scopes: string[];
  state: string;
  origin: string;
  googleClientId?: string;
  googleClientSecret?: string;
  microsoftClientId?: string;
  microsoftAuthority: string;
  docusignClientId?: string;
  docusignBaseUri?: string;
  quickbooksClientId?: string;
  slackClientId?: string;
}

export function buildAuthorizeUrl(args: BuildAuthorizeUrlArgs): string {
  if (args.integrationId === "gmail") {
    if (!args.googleClientId || !args.googleClientSecret) {
      throw new Error(
        "Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
      );
    }
    const oauth = new GoogleOAuth({
      clientId: args.googleClientId,
      clientSecret: args.googleClientSecret,
    });
    const redirectUri = new URL(
      "/api/auth/oauth/google/callback",
      args.origin,
    ).toString();
    return oauth.buildAuthorizationUrl({
      redirectUri,
      state: args.state,
    });
  }
  if (args.integrationId === "google-drive") {
    // Drive reuses the Gmail Google OAuth app but lands on its OWN callback
    // so it never triggers the Gmail users.watch the /api/auth/oauth/google
    // callback performs. The Drive scopes from the marketplace entry merge
    // with any already-granted Gmail scopes via include_granted_scopes.
    if (!args.googleClientId || !args.googleClientSecret) {
      throw new Error(
        "Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
      );
    }
    const oauth = new GoogleOAuth({
      clientId: args.googleClientId,
      clientSecret: args.googleClientSecret,
    });
    const redirectUri = new URL(
      "/api/integrations/google-drive/oauth/callback",
      args.origin,
    ).toString();
    return oauth.buildAuthorizationUrl({
      redirectUri,
      state: args.state,
      scopes: args.scopes,
    });
  }
  if (args.integrationId === "docusign") {
    if (!args.docusignClientId) {
      throw new Error(
        "DocuSign OAuth not configured. Set DOCUSIGN_OAUTH_CLIENT_ID and DOCUSIGN_OAUTH_CLIENT_SECRET.",
      );
    }
    const redirectUri = new URL(
      "/api/integrations/docusign/oauth/callback",
      args.origin,
    ).toString();
    return buildDocusignAuthorizeUrl({
      baseUri: args.docusignBaseUri ?? "https://account-d.docusign.com",
      clientId: args.docusignClientId,
      redirectUri,
      scopes: args.scopes,
      state: args.state,
    });
  }
  if (args.integrationId === "quickbooks") {
    if (!args.quickbooksClientId) {
      throw new Error(
        "QuickBooks OAuth not configured. Set QUICKBOOKS_OAUTH_CLIENT_ID and QUICKBOOKS_OAUTH_CLIENT_SECRET.",
      );
    }
    const redirectUri = new URL(
      "/api/integrations/quickbooks/oauth/callback",
      args.origin,
    ).toString();
    return buildQuickbooksAuthorizeUrl({
      clientId: args.quickbooksClientId,
      redirectUri,
      scopes: args.scopes,
      state: args.state,
    });
  }
  if (args.integrationId === "slack") {
    if (!args.slackClientId) {
      throw new Error(
        "Slack OAuth not configured. Set SLACK_OAUTH_CLIENT_ID and SLACK_OAUTH_CLIENT_SECRET.",
      );
    }
    const redirectUri = new URL(
      "/api/integrations/slack/oauth/callback",
      args.origin,
    ).toString();
    return buildSlackAuthorizeUrl({
      clientId: args.slackClientId,
      redirectUri,
      userScopes: args.scopes,
      state: args.state,
    });
  }
  if (args.integrationId === "outlook") {
    if (!args.microsoftClientId) {
      throw new Error(
        "Microsoft OAuth not configured. Set MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET.",
      );
    }
    const redirectUri = new URL(
      "/api/integrations/outlook/oauth/callback",
      args.origin,
    ).toString();
    return buildMicrosoftAuthorizeUrl({
      authority: args.microsoftAuthority,
      clientId: args.microsoftClientId,
      redirectUri,
      scopes: args.scopes,
      state: args.state,
    });
  }
  throw new Error(`OAuth start not implemented for integration: ${args.integrationId}`);
}

/**
 * Build the Microsoft identity platform v2.0 authorize URL.
 * Per https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 * (read 2026-05-16). `response_type=code` + `response_mode=query` keeps the
 * callback shape identical to Google's.
 */
export function buildMicrosoftAuthorizeUrl(args: {
  authority: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const base = args.authority.replace(/\/$/, "");
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: args.scopes.join(" "),
    state: args.state,
    prompt: "select_account",
  });
  return `${base}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Build the DocuSign Authorization Code Grant authorize URL.
 * Per https://developers.docusign.com/platform/auth/authcode/authcode-get-token/
 * (read 2026-05-20). `baseUri` is the account server — account-d.docusign.com
 * for demo, account.docusign.com for production. Scopes are space-delimited;
 * `signature extended` requests signing access plus a refresh token.
 */
export function buildDocusignAuthorizeUrl(args: {
  baseUri: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const base = args.baseUri.replace(/\/$/, "");
  const params = new URLSearchParams({
    response_type: "code",
    scope: args.scopes.join(" "),
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    state: args.state,
  });
  return `${base}/oauth/auth?${params.toString()}`;
}

/**
 * Build the Intuit (QuickBooks Online) OAuth2 authorize URL.
 * Per https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
 * (read 2026-05-20). The authorize endpoint is environment-independent
 * (appcenter.intuit.com); sandbox vs production is selected by which Intuit
 * app's client_id is used and which API base the server later calls. The
 * callback returns `code`, `state`, and `realmId` (the company id).
 */
export function buildQuickbooksAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    response_type: "code",
    scope: args.scopes.join(" "),
    redirect_uri: args.redirectUri,
    state: args.state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

/**
 * Build the Slack OAuth v2 authorize URL.
 * Per https://api.slack.com/authentication/oauth-v2 (read 2026-05-20). We
 * request user-token scopes via `user_scope` (not bot `scope`) so the search
 * API works and posts act as the customer. The callback returns a code we
 * exchange at oauth.v2.access; the user token comes back on
 * `authed_user.access_token`.
 */
export function buildSlackAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  userScopes: string[];
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    user_scope: args.userScopes.join(","),
    redirect_uri: args.redirectUri,
    state: args.state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
