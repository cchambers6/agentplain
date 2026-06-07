// GET /api/mobile/me
//
// Returns the bearer's identity + the workspaces they own. Powers the mobile
// workspace selector (V1 screen #2) and the post-login "open last workspace"
// landing. Reuses the same membership query shape as defaultWorkspaceIdFor
// (lib/auth/server.ts) — scoped to the caller's own userId, so a system-context
// read is correct (a user listing their own memberships).

import { NextResponse, type NextRequest } from "next/server";
import { readMobileSession } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await readMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const memberships = await withSystemContext((tx) =>
    tx.membership.findMany({
      where: {
        userId: session.userId,
        status: "ACTIVE",
        role: "BROKER_OWNER",
      },
      orderBy: { createdAt: "desc" },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            vertical: true,
            verticalTier: true,
          },
        },
      },
    }),
  );

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      isOperator: session.isOperator,
    },
    activeWorkspaceId: session.activeWorkspaceId,
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      vertical: m.workspace.vertical,
      tier: m.workspace.verticalTier,
      role: m.role,
    })),
  });
}
