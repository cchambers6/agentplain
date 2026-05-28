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
