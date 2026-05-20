"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, SupportRequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";

async function setStatus(
  id: string,
  status: SupportRequestStatus,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) return;

  await withSystemContext(async (tx) => {
    const updated = await tx.supportRequest.update({
      where: { id },
      data: { status },
      select: { workspaceId: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId: updated.workspaceId,
        action: "support_request.status_changed",
        targetTable: "SupportRequest",
        targetId: id,
        payload: { status } satisfies Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath("/operator/support");
}

export async function markSupportOpenAction(id: string): Promise<void> {
  await setStatus(id, "OPEN");
}

export async function markSupportResolvedAction(id: string): Promise<void> {
  await setStatus(id, "RESOLVED");
}

export async function reopenSupportAction(id: string): Promise<void> {
  await setStatus(id, "NEW");
}
