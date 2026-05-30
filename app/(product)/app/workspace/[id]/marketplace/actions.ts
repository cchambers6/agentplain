"use server";

// Wave-2 marketplace install / uninstall actions.
//
// One form per skill on /marketplace. The action checks BROKER_OWNER
// membership, calls the marketplace lib's install/uninstall (which
// upserts WorkspaceSkillInstallation + writes an audit row), then
// revalidates the marketplace path.

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth";
import { installSkill, uninstallSkill } from "@/lib/skills/marketplace";

export async function installSkillAction(form: FormData): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const skillSlug = String(form.get("skillSlug") ?? "");
  if (!workspaceId) throw new Error("installSkillAction: missing workspaceId");
  if (!skillSlug) throw new Error("installSkillAction: missing skillSlug");
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  await installSkill({
    workspaceId,
    skillSlug,
    installedByUserId: member.userId,
  });
  revalidatePath(`/app/workspace/${workspaceId}/marketplace`);
}

export async function uninstallSkillAction(form: FormData): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const skillSlug = String(form.get("skillSlug") ?? "");
  if (!workspaceId) throw new Error("uninstallSkillAction: missing workspaceId");
  if (!skillSlug) throw new Error("uninstallSkillAction: missing skillSlug");
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  await uninstallSkill({
    workspaceId,
    skillSlug,
    installedByUserId: member.userId,
  });
  revalidatePath(`/app/workspace/${workspaceId}/marketplace`);
}
