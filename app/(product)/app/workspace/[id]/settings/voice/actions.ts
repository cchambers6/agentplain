"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  DRAFTING_TONES,
  setDraftingTone,
  captureVoiceCorrectionSignal,
  type DraftingTone,
} from "@/lib/preferences";

const formStr = (form: FormData, key: string): string => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

/**
 * Set the workspace's default drafting tone from the /settings/voice
 * picker. Focused setter — never touches learnedDraftNotes (those
 * accumulate from corrections and must survive a tone change).
 */
export async function saveDraftingToneAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const tone = formStr(form, "draftingTone");
  if (!workspaceId) throw new Error("Missing workspaceId");
  if (!(DRAFTING_TONES as readonly string[]).includes(tone)) {
    throw new Error("Invalid drafting tone");
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  await setDraftingTone(ctx, { workspaceId, draftingTone: tone as DraftingTone });
  await withRls(ctx, (tx) =>
    tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "preference.drafting_tone.updated",
        targetTable: "WorkspacePreference",
        payload: { draftingTone: tone },
      },
    }),
  );

  revalidatePath(`/app/workspace/${workspaceId}/settings/voice`);
}

/**
 * Record a "this doesn't sound like me" voice correction. Stores an
 * append-only PreferenceSignal AND prepends a learned note so the very
 * next draft fire applies it (cold-start-safe). No-op on a blank note.
 */
export async function saveVoiceCorrectionAction(form: FormData): Promise<void> {
  const workspaceId = formStr(form, "workspaceId");
  const note = formStr(form, "note").trim();
  if (!workspaceId) throw new Error("Missing workspaceId");
  if (note.length === 0) return;
  if (note.length > 2000) {
    throw new Error("Voice note capped at 2000 characters");
  }

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const captured = await captureVoiceCorrectionSignal(ctx, { workspaceId, note });
  if (captured) {
    await withRls(ctx, (tx) =>
      tx.auditLog.create({
        data: {
          actorUserId: member.userId,
          workspaceId,
          action: "preference.voice_correction.recorded",
          targetTable: "WorkspacePreference",
          payload: { noteLength: note.length },
        },
      }),
    );
  }

  revalidatePath(`/app/workspace/${workspaceId}/settings/voice`);
}
