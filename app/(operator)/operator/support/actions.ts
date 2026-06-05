"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma, SupportRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import { getEmailProvider } from "@/lib/email";
import { env } from "@/lib/env";
import {
  approveAndSendSupportReply,
  rejectSupportReply,
} from "@/lib/support/resolve-reply";
import {
  InngestSupportResolvedEventSink,
  PrismaSupportReplyStore,
} from "@/lib/support/prisma-resolve-store";

const SUPPORT_PATH = "/operator/support";

// Server actions return void; we surface the outcome by redirecting back
// with a ?msg=… banner the page renders. Operator never gets a silent
// failure on the send path — they see exactly what happened.
function backWith(msg: string): never {
  revalidatePath(SUPPORT_PATH);
  redirect(`${SUPPORT_PATH}?msg=${encodeURIComponent(msg)}`);
}

const formString = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

// ── Draft review: approve + send / reject ────────────────────────────────

/** Approve a support-handler reply draft, send it to the customer via
 *  Resend, and close the request. The edited body (if the operator
 *  changed it) is read from the form. This is the ONLY place a support
 *  reply is sent — never from the Inngest draft function. */
export async function approveAndSendSupportReplyAction(
  queueItemId: string,
  form: FormData,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) backWith("forbidden");

  const res = await approveAndSendSupportReply({
    queueItemId,
    operatorUserId: session.userId,
    editedBody: formString(form, "body"),
    replyTo: env.supportEmail(),
    store: new PrismaSupportReplyStore(),
    email: getEmailProvider(),
    events: new InngestSupportResolvedEventSink(),
  });

  if (!res.ok) {
    backWith(`approve failed: ${res.code}`);
  }
  backWith(`sent to ${res.value.sentTo}`);
}

/** Reject a draft without sending. The draft is archived (queue item
 *  REJECTED); the request returns to OPEN for manual handling. */
export async function rejectSupportReplyAction(
  queueItemId: string,
  form: FormData,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) backWith("forbidden");

  const res = await rejectSupportReply({
    queueItemId,
    operatorUserId: session.userId,
    reason: formString(form, "reason") || undefined,
    store: new PrismaSupportReplyStore(),
  });

  if (!res.ok) {
    backWith(`reject failed: ${res.code}`);
  }
  backWith("draft rejected");
}

// ── Raw request triage (requests with no fleet draft) ────────────────────

async function setStatus(
  id: string,
  status: SupportRequestStatus,
  operatorUserId: string,
): Promise<void> {
  await withSystemContext(async (tx) => {
    const updated = await tx.supportRequest.update({
      where: { id },
      data: {
        status,
        // Stamp / clear resolution metadata so a manual "mark resolved"
        // matches the approve-and-send path, and a reopen clears it.
        resolvedAt: status === "RESOLVED" ? new Date() : null,
        resolvedBy: status === "RESOLVED" ? operatorUserId : null,
      },
      select: { workspaceId: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: operatorUserId,
        workspaceId: updated.workspaceId,
        action: "support_request.status_changed",
        targetTable: "SupportRequest",
        targetId: id,
        payload: { status } satisfies Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath(SUPPORT_PATH);
}

export async function markSupportOpenAction(id: string): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) return;
  await setStatus(id, "OPEN", session.userId);
}

export async function markSupportResolvedAction(id: string): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) return;
  await setStatus(id, "RESOLVED", session.userId);
}

export async function reopenSupportAction(id: string): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) return;
  await setStatus(id, "NEW", session.userId);
}

/** Archive a request the operator is dismissing without a reply (spam /
 *  duplicate / non-actionable). Distinct from RESOLVED. */
export async function archiveSupportRequestAction(id: string): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) return;
  await setStatus(id, "ARCHIVED", session.userId);
}
