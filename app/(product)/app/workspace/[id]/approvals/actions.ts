"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";

const VALID_DECISIONS = ["APPROVED", "REJECTED"] as const;
type Decision = (typeof VALID_DECISIONS)[number];

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function decideApprovalAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const itemId = formStr(form, "itemId");
  const decision = formStr(form, "decision") as Decision;
  const reason = formStr(form, "reason") || null;

  if (!workspaceId || !itemId) {
    throw new Error("Missing workspaceId or itemId");
  }
  if (!VALID_DECISIONS.includes(decision)) {
    throw new Error(`Invalid decision: ${decision}`);
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  await withRls(ctx, async (tx) => {
    const item = await tx.workApprovalQueueItem.findFirst({
      where: { id: itemId, workspaceId },
    });
    if (!item) throw new Error("Item not found");
    if (item.status !== "PENDING") {
      throw new Error(`Item already decided (${item.status})`);
    }

    await tx.workApprovalQueueItem.update({
      where: { id: itemId },
      data: {
        status: decision,
        decidedAt: new Date(),
        decidedByUserId: member.userId,
        decisionReason: reason,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: `work_approval.${decision.toLowerCase()}`,
        targetTable: "WorkApprovalQueueItem",
        targetId: itemId,
        payload: { kind: item.kind, agentSlug: item.agentSlug },
      },
    });
  });

  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
  redirect(`/app/workspace/${workspaceId}/approvals`);
}
