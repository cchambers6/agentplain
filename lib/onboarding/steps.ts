// Onboarding state machine.
//
// Wave-9 self-serve wizard expands the original 3-step flow to 5 steps so
// the customer reaches a real first-fire inside the same session:
//
//   1. confirm_details      — confirm workspace name + vertical + tier
//                             (extended in wave-9 to show the disciplines
//                             that will be installed for the vertical).
//   2. connect_integration  — first tool connection (read-only OAuth on
//                             arrival; still "skip for now" to keep
//                             signup-to-first-value non-blocking).
//   3. pick_skills          — NEW. Pre-checked list of skills that will
//                             fire today, filtered to runtime: 'live' and
//                             to skills whose MCP dependencies are met
//                             for this workspace (per the honesty bar in
//                             feedback_offer_tightening_2026_05_28).
//   4. set_preferences      — drafting tone, categorization defaults, and
//                             calendar window. Submitting this step is
//                             what dispatches the
//                             `agentplain/onboarding.first-fire.requested`
//                             Inngest event.
//   5. first_fire_watch     — NEW. Live polling panel that watches for
//                             SkillRun rows created since the first-fire
//                             request. Customer clicks "open workspace"
//                             to land on the dashboard once they've seen
//                             the first fire (or after the watch window
//                             times out).
//   6. done                 — sentinel; OnboardingState.completedAt set.
//
// The state machine is intentionally linear (no branching). Adding a step
// = append to STEP_ORDER and to STEP_META.

import type { OnboardingState } from "@prisma/client";

export type StepId =
  | "confirm_details"
  | "connect_integration"
  | "pick_skills"
  | "set_preferences"
  | "first_fire_watch"
  | "done";

export const STEP_ORDER: readonly StepId[] = [
  "confirm_details",
  "connect_integration",
  "pick_skills",
  "set_preferences",
  "first_fire_watch",
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
    label: "Confirm your shop",
    description:
      "Your workspace, your vertical, the disciplines we'll install. A quick look so you know what's coming.",
  },
  connect_integration: {
    id: "connect_integration",
    index: 2,
    label: "Connect your inbox",
    description:
      "Hook up Gmail or Outlook so the fleet has something to read. Optional — you can skip and wire it up later.",
  },
  pick_skills: {
    id: "pick_skills",
    index: 3,
    label: "Pick what we'll watch",
    description:
      "These are the skills that will fire today. Defaults are sane; uncheck anything you don't want yet.",
  },
  set_preferences: {
    id: "set_preferences",
    index: 4,
    label: "Set your voice",
    description:
      "Drafting tone, categorization defaults, calendar window. The fleet uses these to keep drafts in your voice and on your schedule.",
  },
  first_fire_watch: {
    id: "first_fire_watch",
    index: 5,
    label: "Watch the first fire",
    description:
      "Plaino's fetching that for you. The first results land here in the next few minutes.",
  },
  done: {
    id: "done",
    index: 6,
    label: "Workspace ready",
    description: "Your fleet is rooted. Open the dashboard to see what landed.",
  },
};

/** Steps the customer actually interacts with — drives the StepCards
 *  progress display and the route guard. `done` is the terminal sentinel
 *  and is never rendered as its own card. */
export const INPUT_STEPS: readonly StepId[] = [
  "confirm_details",
  "connect_integration",
  "pick_skills",
  "set_preferences",
  "first_fire_watch",
];

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
