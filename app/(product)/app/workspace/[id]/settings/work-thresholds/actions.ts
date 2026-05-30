"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  withRls,
  type ComplianceSeverity,
  type WorkApprovalKind,
} from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/auth";

const KINDS: WorkApprovalKind[] = [
  "COMPLIANCE_FLAG",
  "LISTING_RECOMMENDATION",
  "BUYER_INQUIRY_REPLY_DRAFT",
  "PRICING_RECOMMENDATION",
];

const SEVERITIES: ComplianceSeverity[] = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "BLOCKER",
];

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function saveThresholdAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const kind = formStr(form, "kind") as WorkApprovalKind;
  const severityRaw = formStr(form, "severity");
  const severity =
    severityRaw === "NONE" || severityRaw === ""
      ? null
      : (severityRaw as ComplianceSeverity);

  if (!workspaceId || !KINDS.includes(kind)) {
    throw new Error("Invalid kind");
  }
  if (severity !== null && !SEVERITIES.includes(severity)) {
    throw new Error("Invalid severity");
  }

  // Wave-1 audit fix §9 #2: add an opt-in auto-approve confidence
  // threshold per kind. Default = empty (= require review). The
  // workspace explicitly sets a number to flip the gate; on read time
  // lib/skills/approval-threshold.ts evaluates and decides PENDING vs
  // AUTO_APPROVED. Never auto-approves without an explicit opt-in.
  const autoApproveRaw = formStr(form, "autoApproveMinConfidence").trim();
  let autoApproveWhen: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  if (autoApproveRaw === "") {
    autoApproveWhen = Prisma.JsonNull;
  } else {
    const parsed = Number.parseFloat(autoApproveRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      throw new Error(
        "Auto-approve confidence must be a number between 0 and 1 (inclusive)",
      );
    }
    autoApproveWhen = { minConfidence: parsed };
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  await withRls(ctx, async (tx) => {
    await tx.workThresholdConfig.upsert({
      where: { workspaceId_kind: { workspaceId, kind } },
      create: {
        workspaceId,
        kind,
        requiresApprovalAboveSeverity: severity,
        autoApproveWhen,
        configuredByUserId: member.userId,
      },
      update: {
        requiresApprovalAboveSeverity: severity,
        autoApproveWhen,
        configuredByUserId: member.userId,
        configuredAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "work_threshold.updated",
        targetTable: "WorkThresholdConfig",
        payload: {
          kind,
          severity: severity ?? "NONE",
          autoApproveMinConfidence:
            autoApproveRaw === "" ? null : Number.parseFloat(autoApproveRaw),
        },
      },
    });
  });

  revalidatePath(`/app/workspace/${workspaceId}/settings/work-thresholds`);
}
