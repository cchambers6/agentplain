/**
 * lib/integrations/config-status.ts
 *
 * Server-only seam answering one question: "are the OAuth credentials for
 * this integration actually configured in this environment?"
 *
 * Why this lives apart from `marketplace.ts`: the marketplace catalog is
 * imported by client tile components, so it must stay free of `env`
 * (which reads server-only `process.env`). This module imports `env` and
 * is therefore server-only — call it from Server Components and route
 * handlers, then pass the boolean down to client tiles as a prop.
 *
 * The single source of truth for the connect surfaces: a tile/CTA that
 * starts an OAuth flow MUST gate on this so the UI never claims a
 * connection is "live" when clicking it would dead-end at the
 * `oauth_not_configured` branch in the start route. Per
 * `feedback_no_silent_vendor_lock.md`, the per-provider env wiring stays
 * mapped here next to the catalog rather than scattered across pages.
 */

import { env } from "../env";
import type { MarketplaceEntry, MarketplaceProviderKey } from "./marketplace";

/**
 * True when the provider behind this entry has its OAuth client id (and
 * secret, where one is exchanged server-side) present in the environment.
 * `coming-soon` entries (providerKey === null) are never configured.
 *
 * The provider→credential mapping mirrors `buildAuthorizeUrl` in
 * `oauth-urls.ts`: those are exactly the vars whose absence makes the
 * authorize-URL builder throw.
 */
export function isIntegrationConfigured(entry: MarketplaceEntry): boolean {
  return isProviderConfigured(entry.providerKey);
}

export function isProviderConfigured(provider: MarketplaceProviderKey): boolean {
  switch (provider) {
    case "GOOGLE":
      return Boolean(env.googleOAuthClientId() && env.googleOAuthClientSecret());
    case "M365":
      return Boolean(
        env.microsoftOAuthClientId() && env.microsoftOAuthClientSecret(),
      );
    case "DOCUSIGN":
      return Boolean(
        env.docusignOAuthClientId() && env.docusignOAuthClientSecret(),
      );
    case "QUICKBOOKS":
      return Boolean(
        env.quickbooksOAuthClientId() && env.quickbooksOAuthClientSecret(),
      );
    case "SLACK":
      return Boolean(env.slackOAuthClientId() && env.slackOAuthClientSecret());
    case null:
    default:
      return false;
  }
}
