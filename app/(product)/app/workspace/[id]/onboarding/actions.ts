"use server";

// Advance the onboarding state machine one step. Validates the caller is
// still an active broker-owner on the workspace (defense in depth — RLS +
// app-layer check) and records an audit entry.
//
// Per-step write boundaries:
//   - set_preferences  → persists WorkspacePreference + appends
//                        PreferenceSignal rows; advances to
//                        first_fire_watch (NOT done — the wizard owes the
//                        customer a live first fire before completing).
//                        DISPATCHES the agentplain/onboarding.first-fire.
//                        requested event with { workspaceId }; the
//                        Inngest function reads OnboardingState.
//                        pickedSkillSlugs and fans out per slug.
//   - pick_skills      → persists OnboardingState.pickedSkillSlugs from
//                        the form's `pickedSkillSlugs` multi-select.
//                        Sanitized against the resolved pickable set.
//   - first_fire_watch → sets completedAt = now() and redirects to the
//                        dashboard. The customer has SEEN the wizard's
//                        last step; no more state machine to traverse.
//
// Per project_no_outbound_architecture.md: the only outbound surface in
// this file is the Inngest event dispatch, which targets an internal
// worker. No emails, no SMS, no customer-facing sends.

import { redirect } from "next/navigation";
import { withWorkspace } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { ONBOARDING_FIRST_FIRE_EVENT } from "@/lib/inngest/functions/onboarding-first-fire";
import {
  resolvePickableSkills,
  sanitizePickedSlugs,
} from "@/lib/onboarding/picked-skills";
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
import { getLogger } from "@/lib/observability";

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

function readPickedSlugsFromForm(form: FormData): string[] {
  const raw = form.getAll("pickedSkillSlugs");
  const slugs: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && v.length > 0) slugs.push(v);
  }
  return slugs;
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

  // Wave-9 — persist picked skill slugs on the pick_skills step. The
  // form sends one `pickedSkillSlugs` value per checked box (browsers
  // submit visible-checked checkboxes by name). Unchecked = absent =
  // sanitized to empty.
  let pickedSlugsForFirstFire: string[] | null = null;
  if (fromStep === "pick_skills") {
    const raw = readPickedSlugsFromForm(formData);
    const existingConnections = await withRls(rls, (tx) =>
      tx.integrationCredential.findMany({
        where: { workspaceId, status: "ACTIVE" },
        select: { provider: true },
      }),
    );
    const hasInbox = existingConnections.some(
      (c) => c.provider === "GOOGLE" || c.provider === "M365",
    );
    const pickable = resolvePickableSkills({ hasInbox });
    pickedSlugsForFirstFire = sanitizePickedSlugs(raw, pickable);
  }

  const nextStep = nextStepAfter(fromStep);
  const isFinalStep = fromStep === "first_fire_watch";

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

    const updateData: {
      currentStep: string;
      completedSteps: string[];
      completedAt?: Date | null;
      pickedSkillSlugs?: string[];
      firstFireRequestedAt?: Date | null;
    } = {
      currentStep: nextStep,
      completedSteps: Array.from(completed),
    };
    if (isFinalStep) {
      updateData.completedAt = new Date();
    }
    if (pickedSlugsForFirstFire !== null) {
      updateData.pickedSkillSlugs = pickedSlugsForFirstFire;
    }
    if (fromStep === "set_preferences") {
      // Stamp the request timestamp here so the watch panel's `since`
      // boundary is correct even if the Inngest event takes a moment to
      // hand off to the worker.
      updateData.firstFireRequestedAt = new Date();
    }

    await tx.onboardingState.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        ...updateData,
        completedSteps: updateData.completedSteps,
      },
      update: updateData,
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
          ...(pickedSlugsForFirstFire !== null
            ? { pickedSlugCount: pickedSlugsForFirstFire.length }
            : {}),
        },
      },
    });
  });

  // Wave-9 — dispatch the first-fire event after the OnboardingState
  // write commits, so the Inngest worker's fresh read sees the new
  // pickedSkillSlugs + firstFireRequestedAt. Best-effort: if the
  // dispatch fails (Inngest down, network blip), the customer still
  // advances to first_fire_watch and the watch panel falls back to the
  // "still working" timed-out copy after ~5 minutes. The normal cron
  // sweeps will pick up the workspace within their cadence either way.
  if (fromStep === "set_preferences") {
    try {
      await inngest.send({
        name: ONBOARDING_FIRST_FIRE_EVENT,
        data: { workspaceId },
      });
    } catch (err) {
      getLogger()
        .child({ boundary: "onboarding-action", workspace_id: workspaceId })
        .error(
          "onboarding first-fire event dispatch failed — wizard advances; cron will catch up",
          err,
        );
    }
  }

  if (isFinalStep) {
    redirect(`/app/workspace/${workspaceId}`);
  } else {
    redirect(`/app/workspace/${workspaceId}/onboarding`);
  }
}
