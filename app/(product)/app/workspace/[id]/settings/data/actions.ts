"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import {
  cancelWorkspaceClosure,
  initiateWorkspaceClosure,
  TypedConfirmationMismatchError,
} from "@/lib/customer-data";

// Server actions for the customer data-controls surface. Both actions are
// BROKER_OWNER-gated and operate ONLY on the workspace the caller is a
// member of — there is no path where workspace A's BROKER_OWNER can act
// on workspace B's data. The closure helpers re-assert the workspaceId
// inside the transaction so a smuggled hidden field still 404s.

const InitiateFormSchema = z.object({
  workspaceId: z.string().uuid(),
  typedConfirmation: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

export interface InitiateClosureActionState {
  ok: boolean;
  /** Surfaced beneath the form so the customer can correct + retry without
   *  losing the typed reason. */
  error?: string;
}

export async function initiateClosureAction(
  _prevState: InitiateClosureActionState,
  form: FormData,
): Promise<InitiateClosureActionState> {
  const raw = {
    workspaceId: formString(form, "workspaceId"),
    typedConfirmation: formString(form, "typedConfirmation"),
    reason: optionalFormString(form, "reason"),
  };
  const parsed = InitiateFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Required fields are missing. Type the workspace name to confirm.",
    };
  }

  const member = await requireWorkspaceMember(parsed.data.workspaceId, [
    "BROKER_OWNER",
  ]);

  try {
    await initiateWorkspaceClosure({
      workspaceId: parsed.data.workspaceId,
      actorUserId: member.userId,
      typedConfirmation: parsed.data.typedConfirmation,
      reason: parsed.data.reason,
    });
  } catch (err) {
    if (err instanceof TypedConfirmationMismatchError) {
      return {
        ok: false,
        error:
          "The name you typed doesn't match. Type the workspace name exactly to confirm.",
      };
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Could not start closure. Reach out to your service partner.",
    };
  }

  revalidatePath(`/app/workspace/${parsed.data.workspaceId}/settings/data`);
  redirect(`/app/workspace/${parsed.data.workspaceId}/settings/data?closed=initiated`);
}

const CancelFormSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function cancelClosureAction(form: FormData): Promise<void> {
  const parsed = CancelFormSchema.safeParse({
    workspaceId: formString(form, "workspaceId"),
  });
  if (!parsed.success) {
    throw new Error("invalid workspaceId");
  }
  const member = await requireWorkspaceMember(parsed.data.workspaceId, [
    "BROKER_OWNER",
  ]);

  await cancelWorkspaceClosure({
    workspaceId: parsed.data.workspaceId,
    actorUserId: member.userId,
  });

  revalidatePath(`/app/workspace/${parsed.data.workspaceId}/settings/data`);
  redirect(`/app/workspace/${parsed.data.workspaceId}/settings/data?closed=cancelled`);
}

function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

function optionalFormString(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
