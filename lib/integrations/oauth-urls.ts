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
