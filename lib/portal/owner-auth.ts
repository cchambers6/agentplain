/**
 * lib/portal/owner-auth.ts
 *
 * JSON-friendly owner gate for the portal's owner-facing API routes (setup +
 * invite). Unlike requireWorkspaceMember (which redirects — built for pages),
 * this returns null on failure so a Route Handler can answer 401/403 with JSON.
 * An owner (BROKER_OWNER / OWNER / ADMIN) of the workspace, or an operator, may
 * configure the portal and invite clients.
 */

import type { Role } from "@prisma/client";
import { readSession } from "@/lib/auth/session";
import { withSystemContext } from "@/lib/db/rls";

export interface PortalOwner {
  userId: string;
  email: string;
}

const OWNER_ROLES: Role[] = ["BROKER_OWNER", "OWNER", "ADMIN"];

export async function resolvePortalOwner(
  workspaceId: string,
): Promise<PortalOwner | null> {
  const session = await readSession();
  if (!session) return null;
  if (session.isOperator) return { userId: session.userId, email: session.email };

  const membership = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: {
        userId: session.userId,
        workspaceId,
        status: "ACTIVE",
        role: { in: OWNER_ROLES },
      },
      select: { id: true },
    }),
  );
  return membership ? { userId: session.userId, email: session.email } : null;
}
