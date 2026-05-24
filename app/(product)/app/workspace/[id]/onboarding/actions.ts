"use server";

// Advance the onboarding state machine one step. Validates the caller is
// still an active broker-owner on the workspace (defense in depth — RLS +
// app-layer check) and records an audit entry. The set_preferences step
// also persists the form values into WorkspacePreference + records a
// PreferenceSignal per axis so the audit trail survives later overwrites.

import { redirect } from "next/navigation";
import { withWorkspace } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  STEP_META,
  isStepId,
  nextStepAfter,
  type StepId,
} from "@/lib/onboarding/steps";
import {
  onboardingPreferencesSchema,
  recordPreferenceSignal,
  upsertOnboardingPreference,
  type OnboardingPreferencesInput,
} from "@/lib/preferences";

function readPreferencesFromForm(form: FormData): OnboardingPreferencesInput {
  const candidate = {
    draftingTone: form.get("draftingTone")?.toString().trim() || undefined,
    categorizationNotes:
      form.get("categorizationNotes")?.toString() || undefined,
    calendarWindow: form.get("calendarWindow")?.toString().trim() || undefined,
  };
  const parsed = onboardingPreferencesSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `Invalid set_preferences input: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data;
}

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

  // Persist preferences BEFORE advancing the wizard. If parsing fails we
  // raise — better to refuse the step transition than let a stale prefs
  // row mask a broken form. Skipped set_preferences (the "skip for now"
  // button is connect_integration-only today; harmless to guard) lands
  // an empty payload.
  if (fromStep === "set_preferences" && !skipped) {
    const prefsInput = readPreferencesFromForm(formData);
    await upsertOnboardingPreference(rls, {
      workspaceId,
      draftingTone: prefsInput.draftingTone,
      categorizationNotes: prefsInput.categorizationNotes,
      calendarWindow: prefsInput.calendarWindow,
    });
    // Append-only signal log — one row per non-empty axis. Each signal
    // captures what the broker-owner picked so a future learning pass
    // (or a counsel audit) can reconstruct the state.
    const axisEntries: Array<[string, string | undefined]> = [
      ['tone', prefsInput.draftingTone],
      ['categorization', prefsInput.categorizationNotes],
      ['calendar', prefsInput.calendarWindow],
    ];
    for (const [kind, value] of axisEntries) {
      if (!value || value.trim().length === 0) continue;
      await recordPreferenceSignal(rls, {
        workspaceId,
        source: 'ONBOARDING_FORM',
        kind,
        text: value,
      });
    }
  }

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
