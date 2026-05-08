// Magic-link token generation + hashing.
//
// Tokens are 32 bytes (256 bits) of randomness, base64url-encoded. We persist
// only the sha256 hash so a database leak does not leak active sign-in URLs.

import { createHash, randomBytes } from "node:crypto";

export const MAGIC_LINK_TOKEN_BYTES = 32;
export const MAGIC_LINK_TTL_MINUTES = 15;

export function generateRawToken(): string {
  return randomBytes(MAGIC_LINK_TOKEN_BYTES).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function tokenExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
}
