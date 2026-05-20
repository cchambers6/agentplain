"use server";

import { revalidatePath } from "next/cache";
import { removePasskey } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/auth/server";

// Remove one of the current user's passkeys. workspaceId is bound by the page
// so the action can re-assert membership (auth) before resolving the user id.
export async function removePasskeyAction(
  workspaceId: string,
  passkeyId: string,
): Promise<void> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  await removePasskey(member.userId, passkeyId);
  revalidatePath(`/app/workspace/${workspaceId}/settings/passkeys`);
}
