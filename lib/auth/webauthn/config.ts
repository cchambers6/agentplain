// WebAuthn Relying Party configuration, resolved once from env.
//
// rpID  — registrable domain the credential is bound to (no scheme/port).
//         In production this MUST be the registrable apex (e.g.
//         "agentplain.com") rather than a subdomain — the browser only
//         accepts an rpID equal to or a registrable-domain suffix of the
//         current host, so a subdomain-scoped rpID breaks sign-in on the
//         apex and any sibling subdomain that serves the same build.
// rpName — user-visible name in the OS passkey prompt.
// expectedOrigins — every full origin the product is served on. Passed as
//         a list to verifyAuthenticationResponse/verifyRegistrationResponse
//         so an assertion from apex, www, or app all verify against the
//         same credential. Sourced from WEBAUTHN_ALLOWED_ORIGINS when set,
//         otherwise falls back to [APP_PUBLIC_ORIGIN] for single-host dev.
// canonicalOrigin — the one origin we treat as primary for callbacks /
//         emails / metadataBase. Always APP_PUBLIC_ORIGIN.
//
// Keeping derivation here means routes never parse URLs or read
// RP_ID/RP_NAME/WEBAUTHN_ALLOWED_ORIGINS directly — the WebAuthn boundary
// owns its own config surface.

import { env } from "../../env";

export interface WebAuthnConfig {
  rpID: string;
  rpName: string;
  /** Canonical app origin — what we send in emails, OG tags, callback URLs. */
  canonicalOrigin: string;
  /**
   * Every origin we accept on verify. A list because apex + www + app all
   * serve the same build, and passkeys must work on every one.
   */
  expectedOrigins: string[];
}

const hostFromOrigin = (origin: string): string => {
  try {
    return new URL(origin).hostname;
  } catch {
    // APP_PUBLIC_ORIGIN should always be a valid URL; fall back to a value
    // that fails closed (browsers reject an empty rpID) rather than guessing.
    return "localhost";
  }
};

export function getWebAuthnConfig(): WebAuthnConfig {
  const canonicalOrigin = env.appPublicOrigin().replace(/\/$/, "");
  const allowed = env.webauthnAllowedOrigins();
  const expectedOrigins = allowed.length > 0 ? allowed : [canonicalOrigin];
  return {
    rpID: env.webauthnRpId() ?? hostFromOrigin(canonicalOrigin),
    rpName: env.webauthnRpName(),
    canonicalOrigin,
    expectedOrigins,
  };
}

const stripPort = (host: string): string => host.split(":")[0];

/**
 * The registrable parent domains we collapse subdomains onto. A passkey's
 * rpID MUST equal the page's host or be a registrable-PARENT of it, else the
 * browser throws SecurityError on navigator.credentials.get()/create(). The
 * app is served on BOTH the apex (agentplain.com) and the app subdomain
 * (app.agentplain.com) from one deployment, so a fixed rpID of
 * "app.agentplain.com" is INVALID on the apex (a child can't be the rpID of
 * its parent). Collapsing every agentplain host to "agentplain.com" makes one
 * credential work across apex + www + app. Add future production parents here.
 */
const REGISTRABLE_PARENTS = ["agentplain.com"] as const;

/**
 * Resolve the WebAuthn rpID for the host a request is actually served on.
 *   - RP_ID env, when set, always wins (explicit pin / escape hatch).
 *   - A host equal to or under a known registrable parent → that parent, so a
 *     single passkey works across apex, www, and app.
 *   - Anything else (preview *.vercel.app, localhost) → the full host, which is
 *     always a valid rpID for its own origin. This is why passkeys are
 *     testable on Vercel previews now: rpID follows the preview host instead of
 *     being pinned to a domain the preview isn't served on.
 */
export function resolveRpId(host: string): string {
  const override = env.webauthnRpId();
  if (override) return override;
  const bare = stripPort(host);
  for (const parent of REGISTRABLE_PARENTS) {
    if (bare === parent || bare.endsWith(`.${parent}`)) return parent;
  }
  return bare || "localhost";
}

export interface RequestOriginInfo {
  /** Host header as served (may include a port in dev). */
  host: string;
  /** Full origin the browser used, e.g. https://app.agentplain.com. */
  origin: string;
}

/**
 * Per-request WebAuthn config. rpID follows the request host (see resolveRpId);
 * expectedOrigins is the union of the request's own origin, the canonical app
 * origin, and any WEBAUTHN_ALLOWED_ORIGINS — so an assertion verifies on
 * whichever host the user is on without pre-listing every host.
 */
export function getWebAuthnConfigForRequest(
  req: RequestOriginInfo,
): WebAuthnConfig {
  const canonicalOrigin = env.appPublicOrigin().replace(/\/$/, "");
  const requestOrigin = req.origin.replace(/\/$/, "");
  const allowed = env.webauthnAllowedOrigins();
  const expectedOrigins = Array.from(
    new Set([requestOrigin, canonicalOrigin, ...allowed].filter(Boolean)),
  );
  return {
    rpID: resolveRpId(req.host),
    rpName: env.webauthnRpName(),
    canonicalOrigin,
    expectedOrigins,
  };
}
