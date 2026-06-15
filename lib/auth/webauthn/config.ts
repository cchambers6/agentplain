// WebAuthn Relying Party configuration, resolved once from env.
//
// rpID  — registrable domain the credential is bound to (no scheme/port).
//         The browser only accepts an rpID that is equal to, or a parent
//         registrable-domain suffix of, the current host. A *child* subdomain
//         (rpID "app.agentplain.com" on a page served at "agentplain.com") is
//         rejected with SecurityError. So in production the rpID MUST be the
//         registrable apex ("agentplain.com") and NOT the app subdomain, or
//         sign-in breaks on the apex and on www.
//
//         CORRECT-BY-DEFAULT: we derive the registrable apex from
//         APP_PUBLIC_ORIGIN's host by stripping a leading "app."/"www." label
//         (see deriveRpId). This means production is correct with zero extra
//         env vars set. RP_ID remains an explicit override for topologies the
//         heuristic can't infer (a custom apex, or a multi-part public suffix
//         like *.co.uk where "last two labels" would be a public suffix).
//
//         History: the 2026-05-27 apex regression was first fixed request-side
//         (PR #171), that code was later refactored away, and correctness was
//         offloaded to an unset RP_ID env var — so the bug returned silently
//         (prod served rpID "app.agentplain.com" on every host). Putting the
//         apex derivation back in code, with a unit test that pins the
//         *default*, is the durable fix: env drift can no longer reintroduce it.
//
// rpName — user-visible name in the OS passkey prompt.
// expectedOrigins — every full origin the product is served on. Passed as
//         a list to verifyAuthenticationResponse/verifyRegistrationResponse
//         so an assertion from apex, www, or app all verify against the same
//         credential. Sourced from WEBAUTHN_ALLOWED_ORIGINS when set;
//         otherwise derived from the canonical origin: when the host collapses
//         to an apex (production sibling topology) we accept apex + www + app,
//         else we accept just the single canonical host (localhost/preview).
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

const isBareHost = (host: string): boolean =>
  host === "localhost" ||
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || // IPv4
  host.includes(":"); // IPv6 / host:port

/**
 * Registrable apex for a host, derived without a Public Suffix List.
 *
 * We only collapse the two subdomains WE serve the app from — "app." and
 * "www." — to their shared parent. Every other host (the apex itself, a
 * preview "*.vercel.app", localhost, an IP) is returned verbatim so its rpID
 * equals its own host and stays self-consistent. This deliberately does NOT
 * blindly take the last two labels: that would turn a preview host
 * "branch.vercel.app" into "vercel.app" (a public suffix the browser rejects).
 *
 * Hosts behind a multi-part public suffix (e.g. "app.example.co.uk") collapse
 * to "example.co.uk", which is correct. The only case this can't infer is a
 * non-"app"/"www" production subdomain — set RP_ID explicitly for that.
 */
export const deriveRpId = (host: string): string => {
  if (isBareHost(host)) return host;
  const match = host.match(/^(?:app|www)\.(.+)$/i);
  return match ? match[1] : host;
};

/**
 * Default accept-list when WEBAUTHN_ALLOWED_ORIGINS is unset. When the host
 * collapses to an apex (i.e. we're on a production sibling host), accept the
 * three hosts we serve: apex, www, and app — all over the canonical scheme.
 * Otherwise (localhost, preview, IP) accept only the single canonical origin.
 */
const deriveExpectedOrigins = (canonicalOrigin: string): string[] => {
  const host = hostFromOrigin(canonicalOrigin);
  const apex = deriveRpId(host);
  if (apex === host) return [canonicalOrigin];
  let scheme = "https:";
  try {
    scheme = new URL(canonicalOrigin).protocol;
  } catch {
    /* keep https default */
  }
  const origins = [
    `${scheme}//${apex}`,
    `${scheme}//www.${apex}`,
    `${scheme}//app.${apex}`,
    canonicalOrigin,
  ];
  return [...new Set(origins)];
};

export function getWebAuthnConfig(): WebAuthnConfig {
  const canonicalOrigin = env.appPublicOrigin().replace(/\/$/, "");
  const allowed = env.webauthnAllowedOrigins();
  const expectedOrigins =
    allowed.length > 0 ? allowed : deriveExpectedOrigins(canonicalOrigin);
  return {
    rpID: env.webauthnRpId() ?? deriveRpId(hostFromOrigin(canonicalOrigin)),
    rpName: env.webauthnRpName(),
    canonicalOrigin,
    expectedOrigins,
  };
}
