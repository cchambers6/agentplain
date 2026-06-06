"use server";

// Server actions for the /operator/leads triage surface. Each action flips a
// LeadCapture row's `status` and stamps the triaging operator + time, so the
// follow-up decision has a durable trail on the row itself.
//
// Per project_no_outbound_architecture.md: nothing outbound fires from
// triage. Reaching out to the prospect happens out of band through Conner's
// own inbox; this surface only records intent.

import { revalidatePath } from "next/cache";
import type { LeadCaptureStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";

type Action = "mark_contacted" | "mark_converted" | "decline" | "reopen";

const STATUS_FOR_ACTION: Record<Action, LeadCaptureStatus> = {
  mark_contacted: "CONTACTED",
  mark_converted: "CONVERTED",
  decline: "DECLINED",
  reopen: "NEW",
};

async function applyStatus(leadId: string, action: Action): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  const status = STATUS_FOR_ACTION[action];
  await withSystemContext((tx) =>
    tx.leadCapture.updateMany({
      where: { id: leadId },
      data: {
        status,
        triagedAt: new Date(),
        triagedByUserId: session.userId,
      },
    }),
  );
  revalidatePath("/operator/leads");
}

export async function markLeadContactedAction(leadId: string): Promise<void> {
  await applyStatus(leadId, "mark_contacted");
}

export async function markLeadConvertedAction(leadId: string): Promise<void> {
  await applyStatus(leadId, "mark_converted");
}

export async function declineLeadAction(leadId: string): Promise<void> {
  await applyStatus(leadId, "decline");
}

export async function reopenLeadAction(leadId: string): Promise<void> {
  await applyStatus(leadId, "reopen");
}

export async function updateLeadNotesAction(
  leadId: string,
  _prev: { ok: boolean } | undefined,
  form: FormData,
): Promise<{ ok: boolean }> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  const notes = form.get("notes");
  await withSystemContext((tx) =>
    tx.leadCapture.updateMany({
      where: { id: leadId },
      data: { notes: typeof notes === "string" ? notes : null },
    }),
  );
  revalidatePath("/operator/leads");
  return { ok: true };
}
