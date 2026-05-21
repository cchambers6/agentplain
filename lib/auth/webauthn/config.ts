// WebAuthn Relying Party configuration, resolved once from env.
//
// rpID  — registrable domain the credential is bound to (no scheme/port).
// rpName — user-visible name in the OS passkey prompt.
// origin — the full expected origin the assertion must have come from; this
//          is exactly APP_PUBLIC_ORIGIN and is what verify*Response checks.
//
// Keeping derivation here means routes never parse URLs or read RP_ID/RP_NAME
// directly — the WebAuthn boundary owns its own config surface.

import { env } from "../../env";

export interface WebAuthnConfig {
  rpID: string;
  rpName: string;
  origin: string;
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
  const origin = env.appPublicOrigin().replace(/\/$/, "");
  return {
    rpID: env.webauthnRpId() ?? hostFromOrigin(origin),
    rpName: env.webauthnRpName(),
    origin,
  };
}
