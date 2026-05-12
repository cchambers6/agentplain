"use server";

// Advance the onboarding state machine one step. Validates the caller is
// still an active broker-owner on the workspace (defense in depth — RLS +
// app-layer check) and records an audit entry.

import { redirect } from "next/navigation";
import { withWorkspace } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  STEP_META,
  isStepId,
  nextStepAfter,
  type StepId,
} from "@/lib/onboarding/steps";

export async function advanceOnboardingAction(
  workspaceId: string,
  fromStep: StepId,
  formData: FormData,
): Promise<void> {
  if (!isStepId(fromStep)) {
    throw new Error("Invalid onboarding step");
  }

  const { member, rls } = await withWorkspace(workspaceId, ["BROKER_OWNER"]);
  const skipped = formData.get("skipped") === "true";

  const nextStep = nextStepAfter(fromStep);
  const isDone = nextStep === "done";

  await withRls(rls, async (tx) => {
    const state = await tx.onboardingState.findUnique({
      where: { workspaceId },
    });
    const completed = new Set<string>(
      Array.isArray(state?.completedSteps)
        ? (state.completedSteps as unknown[]).filter(
            (s): s is string => typeof s === "string",
          )
        : [],
    );
    completed.add(fromStep);

    await tx.onboardingState.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        currentStep: nextStep,
        completedSteps: Array.from(completed),
        completedAt: isDone ? new Date() : null,
      },
      update: {
        currentStep: nextStep,
        completedSteps: Array.from(completed),
        completedAt: isDone ? new Date() : null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: member.userId,
        workspaceId,
        action: "onboarding.step_completed",
        targetTable: "OnboardingState",
        targetId: workspaceId,
        payload: {
          step: fromStep,
          stepLabel: STEP_META[fromStep].label,
          nextStep,
          skipped,
        },
      },
    });
  });

  if (isDone) {
    redirect(`/app/workspace/${workspaceId}`);
  } else {
    redirect(`/app/workspace/${workspaceId}/onboarding`);
  }
}
