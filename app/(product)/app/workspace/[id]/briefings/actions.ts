"use server";

// Wave-2 briefings mute action.
//
// The briefings page renders one button: mute / unmute. Persists into
// `WorkspacePreference.briefingsMutedAt` (NULL = enabled, non-NULL =
// muted). The daily generator cron skips muted workspaces.
//
// Per `feedback_runner_portability.md`: this server action is the
// only mutation seam — the generator cron NEVER writes the mute
// column. The action is gated on BROKER_OWNER membership.

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function muteBriefingsAction(form: FormData): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const desired = String(form.get("desired") ?? ""); // "mute" | "unmute"
  if (!workspaceId) {
    throw new Error("muteBriefingsAction: missing workspaceId");
  }
  if (desired !== "mute" && desired !== "unmute") {
    throw new Error(`muteBriefingsAction: invalid desired state "${desired}"`);
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const now = new Date();

  await withRls(ctx, async (tx) => {
    // Upsert so workspaces without a preference row (older accounts)
    // still flip cleanly.
    await tx.workspacePreference.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        briefingsMutedAt: desired === "mute" ? now : null,
      },
      update: {
        briefingsMutedAt: desired === "mute" ? now : null,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: member.userId,
        action:
          desired === "mute" ? "briefing.muted" : "briefing.unmuted",
        payload: {
          at: now.toISOString(),
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath(`/app/workspace/${workspaceId}/briefings`);
}
