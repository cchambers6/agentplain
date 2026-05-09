"use server";

import { revalidatePath } from "next/cache";
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

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  await withRls(ctx, async (tx) => {
    await tx.workThresholdConfig.upsert({
      where: { workspaceId_kind: { workspaceId, kind } },
      create: {
        workspaceId,
        kind,
        requiresApprovalAboveSeverity: severity,
        configuredByUserId: member.userId,
      },
      update: {
        requiresApprovalAboveSeverity: severity,
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
        payload: { kind, severity: severity ?? "NONE" },
      },
    });
  });

  revalidatePath(`/app/workspace/${workspaceId}/settings/work-thresholds`);
}
