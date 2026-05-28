"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { asDisciplineId } from "@/lib/disciplines";
import { setDisciplineEnabled } from "@/lib/disciplines/activation";

const ToggleSchema = z.object({
  workspaceId: z.string().uuid(),
  discipline: z.string().min(1),
  enabled: z.enum(["true", "false"]),
});

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

export async function toggleDisciplineAction(form: FormData): Promise<void> {
  const raw = ToggleSchema.parse({
    workspaceId: formStr(form, "workspaceId"),
    discipline: formStr(form, "discipline"),
    enabled: formStr(form, "enabled"),
  });

  const discipline = asDisciplineId(raw.discipline);
  if (!discipline) throw new Error(`Unknown discipline: ${raw.discipline}`);

  const member = await requireWorkspaceMember(raw.workspaceId, ["BROKER_OWNER"]);
  const ctx = {
    userId: member.userId,
    workspaceId: raw.workspaceId,
    isOperator: false,
  };

  await setDisciplineEnabled(ctx, {
    workspaceId: raw.workspaceId,
    discipline,
    enabled: raw.enabled === "true",
  });

  revalidatePath(`/app/workspace/${raw.workspaceId}/disciplines`);
  revalidatePath(`/app/workspace/${raw.workspaceId}/disciplines/${discipline}`);
}
