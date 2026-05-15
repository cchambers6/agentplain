"use server";

// Server actions for the /operator/inquiries triage surface. Each action
// flips an Inquiry row's `status`, records the triaging user, and lands an
// AuditLog row so the routing decision has a durable trail.
//
// Per `project_no_outbound_architecture.md`: no email or other outbound
// fires from triage. Operator decisions notify the prospect out-of-band
// through Conner's own inbox / tooling; this surface only records intent.
//
// "Mark workspace as Max" is the highest-stakes action because it tees up
// downstream workspace provisioning + invoicing. Per
// `feedback_no_quick_fixes.md` we do NOT provision the workspace here:
// provisioning runs against live Stripe and per-customer state and belongs
// in a dedicated flow once the quote is signed. The action records intent
// (status = TRIAGED_MAX) and leaves the actual workspace creation to the
// follow-up flow.

import { revalidatePath } from "next/cache";
import type { InquiryStatus, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";

type Action =
  | "triage_custom"
  | "triage_max"
  | "triage_both"
  | "decline"
  | "mark_converted"
  | "reopen";

const STATUS_FOR_ACTION: Record<Action, InquiryStatus> = {
  triage_custom: "TRIAGED_CUSTOM",
  triage_max: "TRIAGED_MAX",
  triage_both: "TRIAGED_BOTH",
  decline: "DECLINED",
  mark_converted: "CONVERTED",
  reopen: "NEW",
};

const ACTION_LABEL: Record<Action, string> = {
  triage_custom: "Mark as Custom-build",
  triage_max: "Mark as Max-tier",
  triage_both: "Mark as Both",
  decline: "Decline",
  mark_converted: "Mark converted",
  reopen: "Reopen",
};

async function applyTriage(inquiryId: string, action: Action): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  const status = STATUS_FOR_ACTION[action];

  await withSystemContext(async (tx) => {
    const existing = await tx.inquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, status: true, inquiryType: true },
    });
    if (!existing) {
      throw new Error(`Inquiry ${inquiryId} not found.`);
    }
    await tx.inquiry.update({
      where: { id: inquiryId },
      data: {
        status,
        triagedAt: action === "reopen" ? null : new Date(),
        triagedByUserId: action === "reopen" ? null : session.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: `inquiry.${action}`,
        targetTable: "Inquiry",
        targetId: inquiryId,
        payload: {
          fromStatus: existing.status,
          toStatus: status,
          inquiryType: existing.inquiryType,
          label: ACTION_LABEL[action],
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath("/operator/inquiries");
}

export async function triageInquiryCustomAction(
  inquiryId: string,
): Promise<void> {
  await applyTriage(inquiryId, "triage_custom");
}

export async function triageInquiryMaxAction(
  inquiryId: string,
): Promise<void> {
  await applyTriage(inquiryId, "triage_max");
}

export async function triageInquiryBothAction(
  inquiryId: string,
): Promise<void> {
  await applyTriage(inquiryId, "triage_both");
}

export async function declineInquiryAction(inquiryId: string): Promise<void> {
  await applyTriage(inquiryId, "decline");
}

export async function markInquiryConvertedAction(
  inquiryId: string,
): Promise<void> {
  await applyTriage(inquiryId, "mark_converted");
}

export async function reopenInquiryAction(inquiryId: string): Promise<void> {
  await applyTriage(inquiryId, "reopen");
}

// Free-text notes captured during triage — operator's read of the row
// (call scheduled, blockers, follow-ups). Stored on the Inquiry; not
// surfaced to the customer.
export async function updateInquiryNotesAction(
  inquiryId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  const rawNotes = formData.get("notes");
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
  await withSystemContext(async (tx) => {
    await tx.inquiry.update({
      where: { id: inquiryId },
      data: { triageNotes: notes.length > 0 ? notes : null },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "inquiry.notes_updated",
        targetTable: "Inquiry",
        targetId: inquiryId,
        payload: {
          length: notes.length,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath("/operator/inquiries");
}
