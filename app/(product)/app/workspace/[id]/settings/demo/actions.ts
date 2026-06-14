"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth";
import { clearDemoData } from "@/lib/onboarding/demo-seed";

/**
 * Remove the workspace's first-5-min demo dataset. BROKER_OWNER-gated.
 * Idempotent — clearing an already-clear workspace is a no-op.
 */
export async function clearDemoDataAction(workspaceId: string): Promise<void> {
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  await clearDemoData({ workspaceId });
  revalidatePath(`/app/workspace/${workspaceId}/settings/demo`);
  revalidatePath(`/app/workspace/${workspaceId}/settings`);
}
