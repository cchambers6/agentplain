"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { validateRetentionChoice } from "@/lib/plaino/chat-retention";
import {
  isPurgeableCategory,
  purgeCategory,
} from "@/lib/storage/category-purge";
import { recordStorageWrite } from "@/lib/storage/audit";

function formStr(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * Save the workspace-wide chat-retention setting. "lifetime" (the default /
 * recommended) clears any window so Plaino keeps chat for the life of the
 * account; a number is an opt-in auto-purge window. Opt-in by definition —
 * we never shorten retention on the customer's behalf.
 */
export async function saveChatRetentionAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const raw = formStr(form, "retentionDays");
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  let value: number | null;
  if (raw === "lifetime" || raw === "" || raw === "default") {
    value = null; // keep for the account lifetime
  } else {
    const requested = Number.parseInt(raw, 10);
    if (Number.isNaN(requested)) return;
    value = validateRetentionChoice({ requestedDays: requested }).days;
  }

  await withRls(ctx, async (tx) => {
    await tx.workspacePreference.upsert({
      where: { workspaceId },
      create: { workspaceId, chatRetentionDays: value },
      update: { chatRetentionDays: value },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "storage.chat_retention.updated",
        targetTable: "WorkspacePreference",
        payload: { chatRetentionDays: value },
      },
    });
  });

  revalidatePath(`/app/workspace/${workspaceId}/settings/data/storage`);
}

/**
 * Delete one data category for the workspace (conservative, live-workspace-
 * safe — see `lib/storage/category-purge.ts`). Records a storage-write audit
 * row so the deletion is itself on the transparency trail.
 */
export async function purgeCategoryAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const category = formStr(form, "category");
  const confirm = formStr(form, "confirm");
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  // Typed-confirmation gate — the input must equal "delete".
  if (confirm.trim().toLowerCase() !== "delete") {
    revalidatePath(`/app/workspace/${workspaceId}/settings/data/storage`);
    return;
  }
  if (!isPurgeableCategory(category)) return;

  const result = await purgeCategory({ workspaceId, category });

  await recordStorageWrite({
    workspaceId,
    model: category,
    operation: "delete",
    reason: `customer cleared the "${category}" category from the storage surface`,
    category,
    actorUserId: member.userId,
    ctx: { userId: member.userId, workspaceId, isOperator: false },
  });

  // Audit the specifics (counts) under the same trail.
  await withRls(
    { userId: member.userId, workspaceId, isOperator: false },
    (tx) =>
      tx.auditLog.create({
        data: {
          actorUserId: member.userId,
          workspaceId,
          action: "storage.category_purged",
          targetTable: category,
          payload: { deleted: result.deleted },
        },
      }),
  );

  revalidatePath(`/app/workspace/${workspaceId}/settings/data/storage`);
}
