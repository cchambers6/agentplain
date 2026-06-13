"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/auth";
import { submitFeedbackSchema } from "@/lib/feedback";
import {
  decideApproval,
  editApprovalDraft,
  submitDraftFeedback,
  ApprovalDecisionError,
  type ApprovalDecision,
} from "@/lib/approvals/decisions";
import { withRls } from "@/lib/db";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { PrismaRedlineStore } from "@/lib/agents/sentinel/prisma-redline-store";

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

const formStrList = (form: FormData, key: string): string[] =>
  form.getAll(key).filter((v): v is string => typeof v === "string" && v.length > 0);

/**
 * Batch-approve a set of routine, low-stakes items in one tap ("approve all 12
 * chase emails"). Eligibility is gated client-side (lib/approvals/presentation
 * `isBatchEligible`) AND each item is still funneled through the SAME shared
 * `decideApproval` core — so the audit row, RLS check, and already-decided
 * guard are identical to a one-off approve. Items that were decided out from
 * under us (a race, a second tab) are skipped, not failed: a batch should
 * clear what it can and move on.
 */
export async function batchApproveAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const itemIds = formStrList(form, "itemId");

  if (!workspaceId) throw new Error("Missing workspaceId");
  if (itemIds.length === 0) {
    redirect(`/app/workspace/${workspaceId}/approvals`);
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  for (const itemId of itemIds) {
    try {
      await decideApproval(ctx, {
        workspaceId,
        itemId,
        decision: "APPROVED",
        reason: null,
      });
    } catch (err) {
      // Skip items already decided elsewhere; surface anything unexpected.
      if (err instanceof ApprovalDecisionError) continue;
      throw err;
    }
  }

  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
  redirect(`/app/workspace/${workspaceId}/approvals`);
}

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

/**
 * Counsel-feedback redline loop — INPUT side (pride-audit theme #14).
 *
 * When counsel (via the BROKER_OWNER operator) red-lines a sentinel rewrite
 * suggestion — i.e. supplies the language they ACTUALLY want used in place of
 * a flagged phrase — this records ONE durable CounselRedline. Once five
 * agreeing red-lines accumulate for a (rule, clause) bucket, the rewrite
 * engine embeds that learned language verbatim in future suggestions.
 *
 * This closes the loop the rewrite engine reads from on every fire. Without
 * this surface the redline store would be a read-only port with no writer —
 * exactly the "port exists, adapter does not" gap the pride audit flagged.
 */
export async function recordCounselRedlineAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const ruleId = formStr(form, "ruleId");
  const clausePattern = formStr(form, "clausePattern");
  const preferredLanguage = formStr(form, "preferredLanguage");
  const rationale = formStr(form, "rationale") || null;

  if (!workspaceId || !ruleId || !clausePattern || !preferredLanguage) {
    throw new Error(
      "Missing workspaceId, ruleId, clausePattern, or preferredLanguage",
    );
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  // Resolve the workspace vertical so the red-line buckets correctly.
  const workspace = await withRls(ctx, (tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { vertical: true },
    }),
  );
  if (!workspace) throw new Error("Workspace not found");
  const verticalSlug = verticalSlugFromEnum(workspace.vertical);

  // The CounselRedline table is operator-only (RLS); the store defaults to
  // the system-operator context for the write.
  await new PrismaRedlineStore().record({
    workspaceId,
    verticalSlug,
    ruleId,
    clausePattern,
    preferredLanguage,
    rationale,
    recordedBy: member.userId,
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
