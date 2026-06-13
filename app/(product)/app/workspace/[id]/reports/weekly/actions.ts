"use server";

// Weekly report email preference toggle.
//
// The /reports/weekly page renders one switch: weekly report email on / off.
// Persists into `WorkspacePreference.weeklyReportEnabled`. The Friday
// weekly-customer-report cron reads it and skips opted-out workspaces. This
// is the in-app twin of the email's one-click unsubscribe link — both flip
// the same column. BROKER_OWNER-gated; upserts so older workspaces without a
// preference row flip cleanly.

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";

export async function setWeeklyReportEnabledAction(
  form: FormData,
): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const desired = String(form.get("desired") ?? ""); // "on" | "off"
  if (!workspaceId) {
    throw new Error("setWeeklyReportEnabledAction: missing workspaceId");
  }
  if (desired !== "on" && desired !== "off") {
    throw new Error(
      `setWeeklyReportEnabledAction: invalid desired state "${desired}"`,
    );
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const enabled = desired === "on";

  await withRls(ctx, async (tx) => {
    await tx.workspacePreference.upsert({
      where: { workspaceId },
      create: { workspaceId, weeklyReportEnabled: enabled },
      update: { weeklyReportEnabled: enabled },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: member.userId,
        action: enabled
          ? "weekly_report.enabled"
          : "weekly_report.disabled",
        targetTable: "WorkspacePreference",
        targetId: workspaceId,
        payload: { via: "dashboard" } satisfies Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath(`/app/workspace/${workspaceId}/reports/weekly`);
}
