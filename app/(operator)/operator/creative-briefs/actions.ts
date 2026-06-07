"use server";

// Server actions for /operator/creative-briefs — the human-creator handoff
// queue. Each action drives a CreatorBrief through its status machine
// (lib/creative-handoff/lifecycle) under the operator RLS clause.
//
// Per project_no_outbound_architecture.md: nothing outbound fires here. The
// operator reaches the creator out of band; these actions only record the
// dispatch + the delivered asset + the acceptance decision on the row.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { transitionBrief } from "@/lib/creative-handoff";

async function assertOperator(): Promise<{ userId: string }> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  return { userId: session.userId };
}

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** DRAFT → BRIEFED. Records the creator the brief went to. */
export async function dispatchBriefAction(
  briefId: string,
  form: FormData,
): Promise<void> {
  await assertOperator();
  await transitionBrief({
    briefId,
    to: "BRIEFED",
    creatorRef: str(form, "creatorRef") ?? "unspecified creator",
  });
  revalidatePath("/operator/creative-briefs");
}

/** BRIEFED → DELIVERED. Records where the finished asset landed. */
export async function deliverBriefAction(
  briefId: string,
  form: FormData,
): Promise<void> {
  await assertOperator();
  const assetRef = str(form, "assetRef");
  if (!assetRef) {
    throw new Error("A delivered asset reference (URL or path) is required.");
  }
  await transitionBrief({
    briefId,
    to: "DELIVERED",
    delivery: { assetRef, note: str(form, "note") ?? undefined },
  });
  revalidatePath("/operator/creative-briefs");
}

/** DELIVERED → ACCEPTED. Stamps the deciding operator + time. */
export async function acceptBriefAction(
  briefId: string,
  form: FormData,
): Promise<void> {
  const { userId } = await assertOperator();
  await transitionBrief({
    briefId,
    to: "ACCEPTED",
    reviewNotes: str(form, "reviewNotes"),
    decidedByUserId: userId,
  });
  revalidatePath("/operator/creative-briefs");
}

/** DELIVERED → REJECTED. Stamps the deciding operator + time. */
export async function rejectBriefAction(
  briefId: string,
  form: FormData,
): Promise<void> {
  const { userId } = await assertOperator();
  await transitionBrief({
    briefId,
    to: "REJECTED",
    reviewNotes: str(form, "reviewNotes"),
    decidedByUserId: userId,
  });
  revalidatePath("/operator/creative-briefs");
}

/** REJECTED → BRIEFED. Re-brief the same creator (or a new one). */
export async function rebriefAction(
  briefId: string,
  form: FormData,
): Promise<void> {
  await assertOperator();
  await transitionBrief({
    briefId,
    to: "BRIEFED",
    creatorRef: str(form, "creatorRef"),
  });
  revalidatePath("/operator/creative-briefs");
}

/** DRAFT|BRIEFED|REJECTED → CANCELLED. */
export async function cancelBriefAction(briefId: string): Promise<void> {
  await assertOperator();
  await transitionBrief({ briefId, to: "CANCELLED" });
  revalidatePath("/operator/creative-briefs");
}
