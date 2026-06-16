// Server-side helpers for route handlers + page loaders. Layered:
//
//   readSession()     → read-only; null if not signed in.
//   requireUser()     → throws 401 / redirects if not signed in.
//   requireWorkspaceMember(role) → asserts active membership in URL workspace.
//
// Per engineering_plan §10.2: RLS is the LAST line of defense. The application
// layer must STILL assert role-in-workspace before touching the DB.

import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { withSystemContext } from "../db/rls";
import { readSession, type SessionPayload } from "./session";

export interface AuthorizedSession {
  userId: string;
  email: string;
  isOperator: boolean;
  activeWorkspaceId: string | null;
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  return readSession();
}

export async function requireUser(): Promise<AuthorizedSession> {
  const session = await readSession();
  if (!session) redirect("/app/sign-in");
  return session;
}

export interface MembershipAssertion {
  userId: string;
  email: string;
  workspaceId: string;
  role: Role;
  /** Operator flag from the session — lets workspace surfaces show the
   *  internal operator entry point without a second session read. */
  isOperator: boolean;
  /** The resolved Membership row id. The membership is already loaded to
   *  authorize the request, so surfacing its id costs nothing and lets
   *  callers (e.g. the welcome-tour complete route) write back to the exact
   *  user×workspace row without a second lookup. */
  membershipId: string;
  /** First-run welcome-tour state for this member. NULL = not yet seen;
   *  the workspace layout renders the walkthrough only while this is null. */
  welcomeTourSeenAt: Date | null;
}

/**
 * Assert the current user is an ACTIVE member of `workspaceId` with one of
 * the allowed roles. Returns the resolved Membership info; redirects on miss.
 */
export async function requireWorkspaceMember(
  workspaceId: string,
  allowedRoles: Role[] = ["BROKER_OWNER"],
): Promise<MembershipAssertion> {
  const session = await requireUser();
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
  if (!membership) {
    // Not a member, or wrong role: 404-equivalent (do not leak existence).
    redirect("/app");
  }
  return {
    userId: session.userId,
    email: session.email,
    workspaceId,
    role: membership.role,
    isOperator: session.isOperator,
    membershipId: membership.id,
    welcomeTourSeenAt: membership.welcomeTourSeenAt,
  };
}

/** True if any active broker-owner membership exists. Used by /app to land. */
export async function defaultWorkspaceIdFor(
  userId: string,
): Promise<string | null> {
  const m = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: { userId, role: "BROKER_OWNER", status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
  );
  return m?.workspaceId ?? null;
}
