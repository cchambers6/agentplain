// Tenant-isolation helper for workspace-scoped page loaders and server actions.
//
// `requireWorkspaceMember` already validates membership at the app layer;
// this thin wrapper additionally:
//   1. Loads the full Workspace row (vertical, tier, onboarding) so callers
//      don't redundantly hit the DB.
//   2. Returns the membership + workspace in one shape so the route can
//      destructure without two awaits.
//   3. Wraps the workspace read in withRls(ctx) so a stray query inside the
//      page loader is still bounded by RLS, not just the app-layer check.
//
// Per engineering_plan.md §10.2 + project_living_portable_architecture: the
// app-layer assertion is the primary gate; RLS is the LAST line of defense.
// Both run.

import { redirect } from "next/navigation";
import type { Role, Workspace } from "@prisma/client";
import { withRls, type RlsContext } from "../db/rls";
import { requireWorkspaceMember, type MembershipAssertion } from "./server";

export interface WorkspaceContext {
  member: MembershipAssertion;
  workspace: Workspace;
  /** RLS context for any further DB reads inside the same page/action. */
  rls: RlsContext;
}

export async function withWorkspace(
  workspaceId: string,
  allowedRoles: Role[] = ["BROKER_OWNER"],
): Promise<WorkspaceContext> {
  const member = await requireWorkspaceMember(workspaceId, allowedRoles);

  const ctx: RlsContext = {
    userId: member.userId,
    workspaceId: member.workspaceId,
    isOperator: false,
  };

  const workspace = await withRls(ctx, (tx) =>
    tx.workspace.findUnique({ where: { id: workspaceId } }),
  );

  if (!workspace) {
    // The RLS read returned null. Either the workspace was deleted between
    // the membership check and now, or RLS denied — both are equivalent
    // from the caller's perspective: send them home.
    redirect("/app");
  }

  return { member, workspace, rls: ctx };
}
