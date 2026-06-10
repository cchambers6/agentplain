"use server";

import { revalidatePath } from "next/cache";
import type { WorkApprovalKind } from "@/lib/db";
import { withRls } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/auth";
import { PrismaOpsFlagStore } from "@/lib/ops/prisma-flag-store";
import {
  writeWorkspaceAutonomySetting,
  type WorkspaceAutonomyPreference,
} from "@/lib/skills/autonomy-settings";
import { isAutoExecEligibleKind } from "@/lib/skills/bounded-execute";

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

const PREFERENCES: WorkspaceAutonomyPreference[] = ["inherit", "on", "off"];

/**
 * cv-x1 — persist one action class's per-workspace autonomy preference
 * (toggle + dollar ceiling) as workspace-scoped OpsFlag rows. Auth at
 * the action boundary (BROKER_OWNER), then the write goes through the
 * system-context flag store — the same store + flag names the
 * bounded-execute decision path reads fresh on every fire.
 *
 * Safety floor: only allowlisted kinds are writable, and the ceiling a
 * workspace sets can only LOWER the fleet ceiling (the clamp lives in
 * the decision path's resolver — a higher number stored here simply
 * never takes effect).
 */
export async function saveAutonomyAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const kind = formStr(form, "kind") as WorkApprovalKind;
  const preferenceRaw = formStr(form, "preference");
  const ceilingRaw = formStr(form, "ceilingUsd").trim();

  if (!workspaceId || !isAutoExecEligibleKind(kind)) {
    throw new Error("Invalid kind");
  }
  if (!PREFERENCES.includes(preferenceRaw as WorkspaceAutonomyPreference)) {
    throw new Error("Invalid preference");
  }
  const preference = preferenceRaw as WorkspaceAutonomyPreference;

  let ceilingUsd: number | null = null;
  if (ceilingRaw !== "") {
    const parsed = Number.parseFloat(ceilingRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(
        "Ceiling must be a positive dollar amount (or blank to inherit the fleet ceiling)",
      );
    }
    ceilingUsd = parsed;
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const result = await writeWorkspaceAutonomySetting({
    store: new PrismaOpsFlagStore(),
    workspaceId,
    kind,
    preference,
    ceilingUsd,
    updatedBy: `user:${member.userId}`,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }

  // Audit the owner's policy change alongside the auto-execute audit
  // rows so the trail shows WHO loosened/tightened WHAT, WHEN.
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  await withRls(ctx, (tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "workspace_autonomy.updated",
        targetTable: "OpsFlag",
        payload: {
          kind,
          preference,
          ceilingUsd,
        },
      },
    }),
  );

  revalidatePath(`/app/workspace/${workspaceId}/settings/autonomy`);
}
