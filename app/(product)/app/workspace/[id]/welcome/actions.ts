"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth";
import {
  decideApproval,
  ApprovalDecisionError,
} from "@/lib/approvals/decisions";

export interface ApproveActivationResult {
  ok: boolean;
  /** Human-readable reason on failure (e.g. already decided). */
  error?: string;
}

/**
 * One-click approve for the first-5-min activation draft. Reuses the shared
 * approval-decision core (the same path /approvals uses), so the magic-moment
 * surface and the queue stay in lockstep. Draft-only by contract — approving
 * marks the queue item APPROVED; the owner's own system performs any send.
 */
export async function approveActivationDraftAction(
  workspaceId: string,
  itemId: string,
): Promise<ApproveActivationResult> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  try {
    await decideApproval(
      { userId: member.userId, workspaceId, isOperator: false },
      { workspaceId, itemId, decision: "APPROVED" },
    );
  } catch (err) {
    if (err instanceof ApprovalDecisionError) {
      // ALREADY_DECIDED is a benign race (double-tap) — treat as success so
      // the customer still sees the payoff.
      if (err.code === "ALREADY_DECIDED") {
        return { ok: true };
      }
      return { ok: false, error: err.message };
    }
    throw err;
  }
  revalidatePath(`/app/workspace/${workspaceId}/welcome`);
  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
  return { ok: true };
}
