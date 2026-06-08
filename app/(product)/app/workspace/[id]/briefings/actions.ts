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
import {
  decideApproval,
  ApprovalDecisionError,
  type ApprovalDecision,
} from "@/lib/approvals/decisions";

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

/**
 * Wave-5 (theme #7 / ratif #9): one-tap decision on the briefing card's
 * pre-staged top pending approval. Turns the briefing from a backward-
 * looking read into a do-it-now surface.
 *
 * Reuses the SHARED `lib/approvals/decisions#decideApproval` core (the same
 * one the /approvals page + the mobile app drive) so the audit trail and
 * the preference-signal capture can never drift between surfaces. This is a
 * decision (APPROVED/REJECTED), NOT a send — the customer's own system
 * performs any downstream action, per project_no_outbound_architecture.md.
 *
 * Graceful degradation: if the pre-staged item was already decided (the
 * customer acted on /approvals since the briefing was written), the shared
 * core throws ALREADY_DECIDED; we swallow it and just revalidate so the
 * stale action disappears rather than 500-ing the page.
 */
export async function decideTopApprovalFromBriefingAction(
  form: FormData,
): Promise<void> {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const itemId = String(form.get("itemId") ?? "");
  const decision = String(form.get("decision") ?? "") as ApprovalDecision;
  if (!workspaceId || !itemId) {
    throw new Error(
      "decideTopApprovalFromBriefingAction: missing workspaceId or itemId",
    );
  }
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    throw new Error(
      `decideTopApprovalFromBriefingAction: invalid decision "${decision}"`,
    );
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  try {
    await decideApproval(ctx, { workspaceId, itemId, decision, reason: null });
  } catch (err) {
    // A stale pre-staged action (already decided / removed) degrades to a
    // no-op refresh; anything else is a real bug worth surfacing.
    if (
      err instanceof ApprovalDecisionError &&
      (err.code === "ALREADY_DECIDED" || err.code === "NOT_FOUND")
    ) {
      revalidatePath(`/app/workspace/${workspaceId}/briefings`);
      return;
    }
    throw err;
  }

  revalidatePath(`/app/workspace/${workspaceId}/briefings`);
  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
}
