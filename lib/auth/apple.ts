// Sign in with Apple — identity-token verification.
//
// The native app obtains an Apple identity token (a signed JWT) via
// expo-apple-authentication and POSTs it to /api/auth/apple. This module
// verifies it end-to-end with Node's built-in crypto + Apple's published
// JWKS — NO new dependency, and the vendor coupling (Apple's endpoints +
// claim shape) stays behind this one module per feedback_no_silent_vendor_lock.
//
// Verification (per Apple's "Verifying a User" guidance):
//   1. RS256 signature against the Apple public key whose `kid` matches the
//      token header (keys fetched from https://appleid.apple.com/auth/keys).
//   2. iss === https://appleid.apple.com
//   3. aud ∈ the configured audiences (the app bundle id; env-overridable).
//   4. exp in the future (small clock-skew leeway).
//
// On success we return the stable `sub` (Apple's per-user, per-team id) and
// the email when Apple includes it (first authorization only). The caller
// matches/creates a User by `sub`.

import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";
import { env } from "../env";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const JWKS_TTL_MS = 60 * 60 * 1000; // 1h
const CLOCK_SKEW_S = 60;

export class AppleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleAuthError";
  }
}

export interface AppleIdentity {
  /** Stable Apple subject id (the value we persist as User.appleSub). */
  sub: string;
  /** Present only when Apple includes it (first authorization). */
  email: string | null;
  emailVerified: boolean;
  /** Echoed nonce, when the client supplied one. */
  nonce: string | null;
}

interface AppleJwk {
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
}

interface JwksCache {
  keys: AppleJwk[];
  fetchedAt: number;
}

let cache: JwksCache | null = null;

function b64urlToJson<T>(seg: string): T {
  const json = Buffer.from(seg, "base64url").toString("utf8");
  return JSON.parse(json) as T;
}

async function fetchJwks(force: boolean): Promise<AppleJwk[]> {
  if (!force && cache && Date.now() - cache.fetchedAt < JWKS_TTL_MS) {
    return cache.keys;
  }
  const res = await fetch(APPLE_JWKS_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    if (cache) return cache.keys; // serve stale rather than fail hard
    throw new AppleAuthError(`Could not fetch Apple keys (${res.status})`);
  }
  const body = (await res.json()) as { keys?: AppleJwk[] };
  const keys = body.keys ?? [];
  cache = { keys, fetchedAt: Date.now() };
  return keys;
}

async function findKey(kid: string): Promise<AppleJwk | null> {
  let keys = await fetchJwks(false);
  let key = keys.find((k) => k.kid === kid);
  if (!key) {
    // Apple rotated keys — force a refresh once before giving up.
    keys = await fetchJwks(true);
    key = keys.find((k) => k.kid === kid);
  }
  return key ?? null;
}

/**
 * Verify an Apple identity token and return the identity. Throws
 * AppleAuthError on any failure (bad signature, wrong audience/issuer,
 * expired).
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  options?: { expectedNonce?: string },
): Promise<AppleIdentity> {
  const parts = identityToken.split(".");
  if (parts.length !== 3) {
    throw new AppleAuthError("Malformed identity token");
  }
  const [headerSeg, payloadSeg, sigSeg] = parts;

  let header: { kid?: string; alg?: string };
  let payload: {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    nonce?: string;
  };
  try {
    header = b64urlToJson(headerSeg);
    payload = b64urlToJson(payloadSeg);
  } catch {
    throw new AppleAuthError("Unreadable identity token");
  }

  if (header.alg !== "RS256" || !header.kid) {
    throw new AppleAuthError("Unexpected token algorithm");
  }

  const jwk = await findKey(header.kid);
  if (!jwk) throw new AppleAuthError("No matching Apple signing key");

  // Build the RSA public key from the JWK and verify the RS256 signature.
  // AppleJwk carries the same fields as a JWK; cast to the structural JWK type
  // Node's createPublicKey expects (its declared type has no index signature).
  const publicKey = createPublicKey({
    key: jwk as unknown as JsonWebKey,
    format: "jwk",
  });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerSeg}.${payloadSeg}`);
  verifier.end();
  const signatureValid = verifier.verify(
    publicKey,
    Buffer.from(sigSeg, "base64url"),
  );
  if (!signatureValid) throw new AppleAuthError("Invalid token signature");

  // Claim checks.
  if (payload.iss !== APPLE_ISSUER) {
    throw new AppleAuthError("Unexpected token issuer");
  }
  const allowedAudiences = env.appleAllowedAudiences();
  if (!payload.aud || !allowedAudiences.includes(payload.aud)) {
    throw new AppleAuthError("Token audience mismatch");
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_S < now) {
    throw new AppleAuthError("Token has expired");
  }
  if (!payload.sub) throw new AppleAuthError("Token missing subject");
  if (options?.expectedNonce && payload.nonce !== options.expectedNonce) {
    throw new AppleAuthError("Token nonce mismatch");
  }

  const emailVerified =
    payload.email_verified === true || payload.email_verified === "true";

  return {
    sub: payload.sub,
    email: payload.email ?? null,
    emailVerified,
    nonce: payload.nonce ?? null,
  };
}

/** For tests: reset the in-memory JWKS cache. */
export function __resetAppleJwksCacheForTests(): void {
  cache = null;
}
