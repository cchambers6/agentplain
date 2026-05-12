// Onboarding state machine.
//
// Three-step Phase 1 wizard per the customer-surface task:
//   1. confirm_details      — confirm workspace name + vertical + tier
//   2. connect_integration  — first tool connection (read-only OAuth on
//                             arrival; today the customer surface offers
//                             "skip for now" so signup-to-first-value never
//                             blocks on integration plumbing, per spec §10
//                             open question #3 — optional connections at
//                             Phase 1).
//   3. set_preferences      — drafting tone, categorization defaults, and
//                             calendar window. UI-stub at Phase 1; the
//                             backend wiring lives in a later workstream,
//                             and the onboarding form persists nothing
//                             beyond the step completion.
//   4. done                 — wizard complete; OnboardingState.completedAt set.
//
// The state machine is intentionally linear (no branching) for Phase 1.
// Adding a step = add to ORDER and to STEP_META.

import type { OnboardingState } from "@prisma/client";

export type StepId =
  | "confirm_details"
  | "connect_integration"
  | "set_preferences"
  | "done";

export const STEP_ORDER: readonly StepId[] = [
  "confirm_details",
  "connect_integration",
  "set_preferences",
  "done",
];

export interface StepMeta {
  id: StepId;
  index: number;
  label: string;
  description: string;
}

export const STEP_META: Record<StepId, StepMeta> = {
  confirm_details: {
    id: "confirm_details",
    index: 1,
    label: "Confirm workspace details",
    description:
      "Workspace name, vertical, and tier. These get used in every agent's daily output.",
  },
  connect_integration: {
    id: "connect_integration",
    index: 2,
    label: "Connect your first integration",
    description:
      "Hook up the CRM, MLS, AMS, ATS, or accounting tool the fleet should read from. Optional at Phase 1 — you can skip and wire it up later.",
  },
  set_preferences: {
    id: "set_preferences",
    index: 3,
    label: "Set your preferences",
    description:
      "Drafting tone, categorization defaults, calendar window. The fleet uses these to keep drafts in your voice and on your schedule.",
  },
  done: {
    id: "done",
    index: 4,
    label: "Workspace ready",
    description: "The 9am block runs tomorrow.",
  },
};

export function readCompletedSteps(state: OnboardingState): StepId[] {
  const raw = state.completedSteps;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isStepId);
}

export function nextStepAfter(stepId: StepId): StepId {
  const i = STEP_ORDER.indexOf(stepId);
  if (i < 0 || i === STEP_ORDER.length - 1) return "done";
  return STEP_ORDER[i + 1]!;
}

export function isStepId(s: unknown): s is StepId {
  return typeof s === "string" && s in STEP_META;
}
