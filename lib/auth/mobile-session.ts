// Mobile session bridge.
//
// The web app authenticates via an httpOnly iron-session cookie (session.ts).
// A React Native client can't hold an httpOnly cookie, so the native flow
// instead receives the SAME sealed session string in a JSON body (see
// app/api/auth/magic-link/exchange/route.ts), stores it in Expo SecureStore,
// and replays it as a bearer credential on every request:
//
//   Authorization: Bearer <sealed>      (preferred)
//   X-Session-Token: <sealed>           (fallback for clients that strip Authorization)
//
// Crucially this introduces NO new auth primitive: the bearer value is the
// exact iron-session seal produced by sealSessionToken(), unsealed with the
// same SESSION_PASSWORD. A compromised seal is identical in blast radius to a
// stolen web cookie, and the existing 24h/30d seal TTLs still bound it.
//
// These helpers return null on failure (not redirect()) because their callers
// are JSON API route handlers that must answer 401/403, never a 30x redirect
// to an HTML sign-in page.

import type { Role } from "@prisma/client";
import { withSystemContext } from "../db/rls";
import { unsealSessionToken, type SessionPayload } from "./session";
import type { MembershipAssertion } from "./server";

const BEARER_PREFIX = "Bearer ";

// These take a plain `Request` (not NextRequest) so the same bearer path
// works from any route handler — including /api/chat, whose handler is typed
// `Request`. NextRequest extends Request, so existing NextRequest callers are
// unaffected. Only the headers are read; no Next-specific surface is touched.

/** Pull the sealed session token from the request headers, or null. */
export function extractMobileToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith(BEARER_PREFIX)) {
    const token = auth.slice(BEARER_PREFIX.length).trim();
    if (token) return token;
  }
  const x = req.headers.get("x-session-token");
  if (x && x.trim()) return x.trim();
  return null;
}

/** Read + unseal the mobile session, or null if absent/invalid/expired. */
export async function readMobileSession(
  req: Request,
): Promise<SessionPayload | null> {
  const raw = extractMobileToken(req);
  if (!raw) return null;
  return unsealSessionToken(raw);
}

/**
 * Assert the bearer's user is an ACTIVE member of `workspaceId` with one of
 * the allowed roles. Returns the membership assertion, or null on any miss
 * (no session, wrong workspace, wrong role). Callers translate null → 401/403.
 *
 * Mirrors requireWorkspaceMember (server.ts) but reads the session from the
 * request bearer and returns null instead of redirecting — the app-layer gate
 * still runs ahead of RLS, per engineering_plan §10.2.
 */
export async function requireMobileWorkspaceMember(
  req: Request,
  workspaceId: string,
  allowedRoles: Role[] = ["BROKER_OWNER"],
): Promise<MembershipAssertion | null> {
  const session = await readMobileSession(req);
  if (!session) return null;
  const membership = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: {
        userId: session.userId,
        workspaceId,
        status: "ACTIVE",
        role: { in: allowedRoles },
      },
    }),
  );
  if (!membership) return null;
  return {
    userId: session.userId,
    email: session.email,
    workspaceId,
    role: membership.role,
    isOperator: session.isOperator,
  };
}
