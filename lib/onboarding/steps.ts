// Onboarding state machine.
//
// Three-step Phase 1 wizard per the customer-surface shell task:
//   1. confirm_details — confirm workspace name + vertical + tier
//   2. connect_integration — placeholder; the actual integrations live in
//      a separate workstream. Phase 1 onboarding offers a "skip for now"
//      path so signup-to-first-value doesn't block on tool connection
//      (spec §10 open question #3 — optional connections at Phase 1).
//   3. done — wizard complete; OnboardingState.completedAt set.
//
// The state machine is intentionally linear (no branching) for Phase 1.
// Adding a step = add to ORDER and to STEP_META.

import type { OnboardingState } from "@prisma/client";

export type StepId = "confirm_details" | "connect_integration" | "done";

export const STEP_ORDER: readonly StepId[] = [
  "confirm_details",
  "connect_integration",
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
      "Hook up your CRM, MLS, AMS, ATS, or accounting system so the fleet has something to read. Optional in Phase 1.",
  },
  done: {
    id: "done",
    index: 3,
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
