"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  captureDraftEditSignal,
  captureDraftRejectSignal,
} from "@/lib/preferences";
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
} from "@/lib/security/payload-crypto";

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

  // Capture the rejection as a preference signal so the next draft prompt
  // reflects what the broker-owner pushed back on. Best-effort: a capture
  // failure must not poison the decision — re-throw only if the decision
  // itself failed (which it didn't, since we're past the transaction).
  if (decision === "REJECTED" && reason && reason.trim().length > 0) {
    try {
      await captureDraftRejectSignal(ctx, {
        workspaceId,
        approvalItemId: itemId,
        reason,
      });
    } catch (err) {
      console.warn(
        `captureDraftRejectSignal failed (ignored): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
  redirect(`/app/workspace/${workspaceId}/approvals`);
}

export async function editApprovalDraftAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const itemId = formStr(form, "itemId");
  const body = formStr(form, "body");

  if (!workspaceId || !itemId) {
    throw new Error("Missing workspaceId or itemId");
  }
  if (body.length > 50_000) {
    throw new Error("Draft body too long");
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  let originalBody = "";
  await withRls(ctx, async (tx) => {
    const item = await tx.workApprovalQueueItem.findFirst({
      where: { id: itemId, workspaceId },
    });
    if (!item) throw new Error("Item not found");
    if (item.status !== "PENDING") {
      throw new Error(`Item already decided (${item.status})`);
    }

    const decrypted = decryptPayloadForRead(item.payload);
    const existing =
      decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)
        ? (decrypted as Record<string, unknown>)
        : {};
    if (typeof existing.body === "string") {
      originalBody = existing.body;
    }
    const next = { ...existing, body, editedAt: new Date().toISOString() };

    await tx.workApprovalQueueItem.update({
      where: { id: itemId },
      data: { payload: encryptPayloadForWrite(next) },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "work_approval.edited",
        targetTable: "WorkApprovalQueueItem",
        targetId: itemId,
        payload: { kind: item.kind, agentSlug: item.agentSlug },
      },
    });
  });

  // Capture the edit as a preference signal so the NEXT draft reflects
  // what the broker-owner changed. Best-effort: a capture failure must
  // not poison the edit — the row is already updated.
  try {
    await captureDraftEditSignal(ctx, {
      workspaceId,
      approvalItemId: itemId,
      originalBody,
      finalBody: body,
    });
  } catch (err) {
    console.warn(
      `captureDraftEditSignal failed (ignored): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  revalidatePath(`/app/workspace/${workspaceId}/approvals`);
}
