"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { encryptPayloadForWrite } from "@/lib/security/payload-crypto";

const MAX_REQUEST_LEN = 4_000;

function formStr(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * Honest request-intake for the talk-to-the-fleet panel.
 *
 * There is no conversational LLM backend wired into the product surface
 * (per `feedback_no_quick_fixes.md` we will not fabricate a fake reply).
 * Instead the request lands as a real HandoffLogEntry — `fromAgent: "you"`,
 * `toAgent: "plaino"` — so it shows up in the workspace activity feed and
 * Plaino can pick it up in the morning briefing pass. This is the same
 * append-only log every agent handoff writes to; nothing is faked.
 *
 * The append also writes an AuditLog row so the action is attributable to
 * the broker-owner who submitted it.
 */
export async function submitFleetRequestAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const raw = formStr(form, "request");
  const request = raw.trim();

  if (!workspaceId) throw new Error("Missing workspaceId");
  if (request.length === 0) return;
  if (request.length > MAX_REQUEST_LEN) {
    throw new Error("Request too long");
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  await withRls(ctx, async (tx) => {
    const entry = await tx.handoffLogEntry.create({
      data: {
        workspaceId,
        fromAgent: "you",
        toAgent: "plaino",
        handoffType: "owner-request",
        payload: encryptPayloadForWrite({
          submittedAt: new Date().toISOString(),
          submittedByUserId: member.userId,
          body: request,
        }),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "fleet_request.submitted",
        targetTable: "HandoffLogEntry",
        targetId: entry.id,
        payload: { length: request.length },
      },
    });
  });

  revalidatePath(`/app/workspace/${workspaceId}/fleet`);
  revalidatePath(`/app/workspace/${workspaceId}/activity`);
}
