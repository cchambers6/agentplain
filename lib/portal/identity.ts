/**
 * lib/portal/identity.ts
 *
 * Lightweight, account-free identity for END clients. An end client never gets
 * a User row, a Membership, or a password. They prove who they are by holding a
 * magic-link invite (PortalInvite) the owner sent, which — once clicked —
 * mints a short-lived session (PortalSession). The browser cookie carries only
 * the RAW token; the database stores only its sha256 hash, so a DB leak never
 * yields a live portal link or session (same discipline as lib/auth/token.ts,
 * which we reuse for token generation + hashing).
 *
 * All access is scoped by portalConfigId: a token minted for one portal can
 * never resolve against another. These run via withSystemContext — portal
 * tables are not under the workspace RLS policies (an end client has no GUC
 * identity); the portalConfigId scope IS the isolation boundary.
 */

import { generateRawToken, hashToken } from "@/lib/auth/token";
import { withSystemContext } from "@/lib/db/rls";
import { env } from "@/lib/env";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MintedToken {
  /** Raw token — only ever travels in the emailed URL or the cookie. */
  rawToken: string;
  expiresAt: Date;
}

export interface ResolvedClient {
  clientId: string;
  sessionId: string;
}

// ── Invites ──────────────────────────────────────────────────────────────────

/**
 * Create a single-use magic-link invite for an end client. Returns the raw
 * token to embed in the emailed URL; only the hash is persisted.
 */
export async function createPortalInvite(args: {
  portalConfigId: string;
  clientId: string;
  email: string;
}): Promise<MintedToken> {
  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + env.portalInviteTtlDays() * DAY_MS);
  await withSystemContext((tx) =>
    tx.portalInvite.create({
      data: {
        portalConfigId: args.portalConfigId,
        clientId: args.clientId,
        tokenHash: hashToken(rawToken),
        email: args.email,
        expiresAt,
      },
    }),
  );
  return { rawToken, expiresAt };
}

/**
 * Consume an invite token: verify it's unconsumed + unexpired + scoped to this
 * portal, mark it consumed, and return the client it identifies. Single-use —
 * a second call with the same token returns null.
 */
export async function consumePortalInvite(args: {
  portalConfigId: string;
  rawToken: string;
}): Promise<{ clientId: string; email: string } | null> {
  const tokenHash = hashToken(args.rawToken);
  return withSystemContext(async (tx) => {
    const invite = await tx.portalInvite.findFirst({
      where: {
        tokenHash,
        portalConfigId: args.portalConfigId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!invite) return null;
    await tx.portalInvite.update({
      where: { id: invite.id },
      data: { consumedAt: new Date() },
    });
    return { clientId: invite.clientId, email: invite.email };
  });
}

// ── Sessions ─────────────────────────────────────────────────────────────────

/**
 * Mint a session for a verified end client. Returns the raw session token to
 * set as the portal cookie; only the hash is stored.
 */
export async function createPortalSession(args: {
  portalConfigId: string;
  clientId: string;
}): Promise<MintedToken> {
  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + env.portalSessionTtlDays() * DAY_MS);
  await withSystemContext((tx) =>
    tx.portalSession.create({
      data: {
        portalConfigId: args.portalConfigId,
        clientId: args.clientId,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    }),
  );
  return { rawToken, expiresAt };
}

/**
 * Resolve a raw session token to its end client, scoped to this portal. Returns
 * null for an unknown, revoked, or expired token. Touches lastSeenAt on a hit.
 */
export async function resolvePortalSession(args: {
  portalConfigId: string;
  rawToken: string;
}): Promise<ResolvedClient | null> {
  if (!args.rawToken) return null;
  const tokenHash = hashToken(args.rawToken);
  return withSystemContext(async (tx) => {
    const session = await tx.portalSession.findFirst({
      where: {
        tokenHash,
        portalConfigId: args.portalConfigId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) return null;
    await tx.portalSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
    return { clientId: session.clientId, sessionId: session.id };
  });
}

/** Revoke a session (sign-out). No-op for an unknown token. */
export async function revokePortalSession(args: {
  portalConfigId: string;
  rawToken: string;
}): Promise<void> {
  if (!args.rawToken) return;
  const tokenHash = hashToken(args.rawToken);
  await withSystemContext((tx) =>
    tx.portalSession.updateMany({
      where: { tokenHash, portalConfigId: args.portalConfigId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  );
}

/**
 * Cookie options for the portal session, for use with response.cookies.set()
 * on a redirect Route Handler. Mirrors lib/auth/session.ts#buildSessionCookieOpts
 * — set the cookie on the NextResponse directly so Next.js 14 doesn't drop
 * Max-Age on the redirect (project_stay_signed_in_30day_fix).
 */
export function buildPortalCookieOpts(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    // Lax over the apex; portal lives on the same origin as the app.
    secure: env.appPublicOrigin().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: env.portalSessionTtlDays() * 24 * 60 * 60,
  };
}

export const portalCookieName = (): string => env.portalCookieName();
