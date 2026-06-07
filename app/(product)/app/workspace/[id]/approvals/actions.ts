"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/auth";
import { submitFeedbackSchema } from "@/lib/feedback";
import {
  decideApproval,
  editApprovalDraft,
  submitDraftFeedback,
  type ApprovalDecision,
} from "@/lib/approvals/decisions";

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function decideApprovalAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const itemId = formStr(form, "itemId");
  const decision = formStr(form, "decision") as ApprovalDecision;
  const reason = formStr(form, "reason") || null;

  if (!workspaceId || !itemId) {
    throw new Error("Missing workspaceId or itemId");
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  await decideApproval(ctx, { workspaceId, itemId, decision, reason });

  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
  redirect(`/app/workspace/${workspaceId}/approvals`);
}

/**
 * Capture categorized "doesn't sound like us" feedback on a draft. Unlike
 * reject/edit, this does NOT decide the item — the draft stays in the queue.
 * Shared core (lib/approvals/decisions) persists the PreferenceFeedback row,
 * appends a learnedDraftNote so the NEXT draft reflects the correction, and
 * writes an audit row.
 */
export async function submitDraftFeedbackAction(form: FormData): Promise<void> {
  const parsed = submitFeedbackSchema.safeParse({
    workspaceId: formStr(form, "workspaceId"),
    approvalItemId: formStr(form, "itemId"),
    targetSkillSlug: formStr(form, "targetSkillSlug"),
    category: formStr(form, "category"),
    reason: formStr(form, "reason"),
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid feedback: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const { workspaceId, approvalItemId, targetSkillSlug, category, reason } =
    parsed.data;

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  await submitDraftFeedback(ctx, {
    workspaceId,
    approvalItemId,
    targetSkillSlug,
    category,
    reason,
  });

  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
}

export async function editApprovalDraftAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const itemId = formStr(form, "itemId");
  const body = formStr(form, "body");

  if (!workspaceId || !itemId) {
    throw new Error("Missing workspaceId or itemId");
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  await editApprovalDraft(ctx, { workspaceId, itemId, body });

  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
}
