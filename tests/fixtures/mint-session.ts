/**
 * tests/fixtures/mint-session.ts
 *
 * Mint a valid iron-session token for a seeded user, the SAME way the
 * production magic-link exchange does (app/api/auth/magic-link/exchange/
 * route.ts). This introduces NO new auth primitive — it reuses
 * `sealSessionToken()` from lib/auth/session.ts, the single iron-session
 * boundary the web cookie AND the mobile bearer both go through (see
 * lib/auth/mobile-session.ts). The minted seal is byte-identical to what a
 * real login produces, so the smoke harness exercises the real auth path.
 *
 * REQUIRED ENV
 * ------------
 *   SESSION_PASSWORD       — the iron-session seal secret. MUST match the
 *                            target deployment's value or the server will
 *                            unseal to null and every request 401s. (For a
 *                            Vercel preview, copy the preview project's
 *                            SESSION_PASSWORD.)
 *   SESSION_COOKIE_NAME    — optional; defaults to `agentplain_session`,
 *                            matching env.sessionCookieName(). Only set this
 *                            if the target overrides it.
 *
 * The minted token is used two ways by the smoke harness:
 *   - as a `Authorization: Bearer <seal>` header (the mobile-session path)
 *     for JSON API routes, and
 *   - as a `Cookie: <name>=<seal>` header for the auth-gated HTML pages,
 *     which read the seal from the cookie jar (lib/auth/session.ts#readSession).
 * Both unseal the exact same payload with the exact same secret.
 */

import { sealSessionToken, type SessionPayload } from "@/lib/auth/session";
import { env } from "@/lib/env";

export interface MintSessionInput {
  userId: string;
  email: string;
  /** Workspace the session lands the user in. Set to the seeded workspace so
   *  the post-login redirect and the active-workspace reads resolve. */
  activeWorkspaceId: string | null;
  isOperator?: boolean;
  /** Mirror the exchange route's `remember` default (30-day seal). */
  remember?: boolean;
  /** Override issuedAt for deterministic tests; defaults to now. */
  issuedAtIso?: string;
}

export interface MintedSession {
  /** The sealed iron-session string — the bearer/cookie value. */
  token: string;
  /** The payload that was sealed (handy for assertions). */
  payload: SessionPayload;
  /** Ready-to-use request headers carrying the session both ways. */
  headers: {
    /** `Authorization: Bearer <seal>` — for JSON API routes. */
    bearer: Record<string, string>;
    /** `Cookie: <name>=<seal>` — for the auth-gated HTML pages. */
    cookie: Record<string, string>;
  };
  /** The cookie name the seal is stored under (for callers building their
   *  own header). */
  cookieName: string;
}

/**
 * Build the session payload exactly as the magic-link exchange route does.
 * Pure (no crypto, no env) so it can be asserted offline.
 */
export function buildSessionPayload(input: MintSessionInput): SessionPayload {
  return {
    userId: input.userId,
    email: input.email,
    isOperator: input.isOperator ?? false,
    activeWorkspaceId: input.activeWorkspaceId,
    issuedAt: input.issuedAtIso ?? new Date().toISOString(),
  };
}

/**
 * Seal a session for the seeded user. Reuses `sealSessionToken` so the seal
 * format / TTL / secret are identical to production. Requires SESSION_PASSWORD
 * in env (sealSessionToken reads it via env.sessionPassword(), which throws a
 * clear error when unset).
 */
export async function mintSession(
  input: MintSessionInput,
): Promise<MintedSession> {
  const payload = buildSessionPayload(input);
  const remember = input.remember ?? true;
  const token = await sealSessionToken(payload, { remember });
  const cookieName = env.sessionCookieName();
  return {
    token,
    payload,
    cookieName,
    headers: {
      bearer: { Authorization: `Bearer ${token}` },
      cookie: { Cookie: `${cookieName}=${token}` },
    },
  };
}
