"use server";

// Server actions for the design-partner outreach CRM-lite. Same posture as
// /operator/leads: nothing here sends anything — per
// project_no_outbound_architecture.md the founder sends every touch from his
// own inbox; these actions only record what happened and what's next.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  STAGES,
  isOutreachStage,
  isTouchKind,
} from "@/lib/outreach/stages";

async function requireOperator(): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
}

function text(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function date(form: FormData, key: string): Date | null {
  const v = text(form, key);
  if (!v) return null;
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createProspectAction(form: FormData): Promise<void> {
  await requireOperator();
  const name = text(form, "name");
  if (!name) return; // name is the one required field
  const created = await withSystemContext((tx) =>
    tx.outreachProspect.create({
      data: {
        name,
        business: text(form, "business"),
        email: text(form, "email"),
        vertical: text(form, "vertical"),
        source: text(form, "source"),
        nextAction: text(form, "nextAction"),
        nextActionDate: date(form, "nextActionDate"),
        notes: text(form, "notes"),
      },
      select: { id: true },
    }),
  );
  revalidatePath("/operator/outreach");
  redirect(`/operator/outreach/${created.id}`);
}

export async function setStageAction(
  prospectId: string,
  form: FormData,
): Promise<void> {
  await requireOperator();
  const stage = text(form, "stage");
  if (!stage || !isOutreachStage(stage)) return;
  const reason = text(form, "reason");
  await withSystemContext(async (tx) => {
    const current = await tx.outreachProspect.findUnique({
      where: { id: prospectId },
      select: { stage: true },
    });
    if (!current || current.stage === stage) return;
    await tx.outreachProspect.update({
      where: { id: prospectId },
      data: {
        stage,
        reason: reason ?? undefined,
        revisitDate: date(form, "revisitDate") ?? undefined,
      },
    });
    // The touch log doubles as the stage-movement audit trail doc 06's
    // weekly review reads ("rows advanced / newly stuck / lost — with
    // reasons verbatim").
    await tx.outreachTouch.create({
      data: {
        prospectId,
        kind: "STAGE_CHANGE",
        note: `${STAGES[current.stage].label} → ${STAGES[stage].label}${reason ? ` — ${reason}` : ""}`,
      },
    });
  });
  revalidatePath(`/operator/outreach/${prospectId}`);
  revalidatePath("/operator/outreach");
}

export async function logTouchAction(
  prospectId: string,
  form: FormData,
): Promise<void> {
  await requireOperator();
  const kind = text(form, "kind");
  if (!kind || !isTouchKind(kind) || kind === "STAGE_CHANGE") return;
  await withSystemContext((tx) =>
    tx.outreachTouch.create({
      data: {
        prospectId,
        kind,
        note: text(form, "note"),
        occurredAt: date(form, "occurredAt") ?? undefined,
      },
    }),
  );
  revalidatePath(`/operator/outreach/${prospectId}`);
  revalidatePath("/operator/outreach");
}

export async function updatePlanAction(
  prospectId: string,
  form: FormData,
): Promise<void> {
  await requireOperator();
  await withSystemContext((tx) =>
    tx.outreachProspect.update({
      where: { id: prospectId },
      data: {
        nextAction: text(form, "nextAction"),
        nextActionDate: date(form, "nextActionDate"),
      },
    }),
  );
  revalidatePath(`/operator/outreach/${prospectId}`);
  revalidatePath("/operator/outreach");
}

export async function updateNotesAction(
  prospectId: string,
  form: FormData,
): Promise<void> {
  await requireOperator();
  await withSystemContext((tx) =>
    tx.outreachProspect.update({
      where: { id: prospectId },
      data: { notes: text(form, "notes") },
    }),
  );
  revalidatePath(`/operator/outreach/${prospectId}`);
}
