/**
 * buildNextSteps — the pure, cold-start-safe builder behind the V27 "what next"
 * card (the retention payload).
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §4.2.
 *
 * Priority order (spec): setup gaps → oldest drafts waiting → open compliance
 * flags → one unused high-value capability. Capped at 4. Each step is a real
 * deep link into the workspace.
 *
 * This is a PURE function reading durable workspace state on every fire
 * (feedback_cold_start_safe_agents) — the dispatcher attaches the card
 * deterministically from state, not from model free-text. No LLM, no I/O.
 * Every count it surfaces is real + conservative (feedback_no_guesses_no_estimates).
 */
import type { PlainoCapabilitySnapshot } from './types';
import type { NextStep, NextStepsCard, QueueGlance } from './visual-card';

/** The slice of onboarding state the builder needs — kept minimal so the
 *  builder has no coupling to the full onboarding module. */
export interface NextStepsOnboardingState {
  verticalPicked: boolean;
  firstToolConnected: boolean;
  scheduleWindowSet: boolean;
  firstDraftReviewed: boolean;
}

/** Approval-queue snapshot. `oldestAgeHrs` is the age of the oldest waiting
 *  draft (0 if none). */
export interface NextStepsApprovalState {
  draftsWaiting: number;
  oldestAgeHrs: number;
}

/** Compliance snapshot. */
export interface NextStepsComplianceState {
  openFlags: number;
}

export interface BuildNextStepsArgs {
  workspaceId: string;
  snapshot: PlainoCapabilitySnapshot;
  onboarding: NextStepsOnboardingState;
  approvals: NextStepsApprovalState;
  compliance: NextStepsComplianceState;
}

const MAX_STEPS = 4;

/**
 * Build the prioritized next-step list. Returns at most `MAX_STEPS` steps; the
 * single highest-priority step carries `weight: 'primary'` (rendered clay).
 * Always returns at least one step — when everything is healthy, the step is a
 * positive "you're all set, here's the digest" pointer (a next-step question
 * should never dead-end).
 */
export function buildNextSteps(args: BuildNextStepsArgs): NextStep[] {
  const { workspaceId, snapshot, onboarding, approvals, compliance } = args;
  const base = `/app/workspace/${workspaceId}`;
  const steps: NextStep[] = [];

  // 1 — setup gaps (highest priority: the workspace isn't producing value yet).
  if (!onboarding.verticalPicked) {
    steps.push({
      label: 'pick your vertical to tune the fleet',
      href: `${base}/onboarding`,
      weight: 'normal',
      why: 'the fleet drafts differently for each kind of business',
    });
  }
  if (!onboarding.firstToolConnected) {
    steps.push({
      label: 'connect your first tool',
      href: `${base}/integrations`,
      weight: 'normal',
      why: 'about 60 seconds — then the fleet can start reading',
    });
  }
  if (!onboarding.scheduleWindowSet) {
    steps.push({
      label: 'set when the fleet works',
      href: `${base}/settings`,
      weight: 'normal',
      why: 'pick the hours it drafts and pauses',
    });
  }

  // 2 — oldest drafts waiting on the owner.
  if (approvals.draftsWaiting > 0) {
    steps.push({
      label:
        approvals.draftsWaiting === 1
          ? 'review 1 draft waiting on you'
          : `review ${approvals.draftsWaiting} drafts waiting on you`,
      href: `${base}/approvals`,
      weight: 'normal',
      why:
        approvals.oldestAgeHrs >= 24
          ? `the oldest has waited ${Math.floor(approvals.oldestAgeHrs / 24)}d`
          : 'nothing sends until you approve it',
    });
  }

  // 3 — open compliance flags.
  if (compliance.openFlags > 0) {
    steps.push({
      label:
        compliance.openFlags === 1
          ? 'clear 1 compliance flag'
          : `clear ${compliance.openFlags} compliance flags`,
      href: `${base}/compliance`,
      weight: 'normal',
      why: 'the sentinel caught something to check before it goes out',
    });
  }

  // 4 — one unused high-value capability (expansion / retention).
  const firstUnused = snapshot.availableButUnconnected[0];
  if (firstUnused) {
    steps.push({
      label: `connect ${firstUnused.name} to unlock more`,
      href: `${base}/integrations`,
      weight: 'normal',
      why: `lights up ${firstUnused.category} work the fleet can't do yet`,
    });
  }

  // Cold-start safety: never dead-end a "what next?" question.
  if (steps.length === 0) {
    steps.push({
      label: "you're all set — see what the fleet did this week",
      href: `${base}/digest`,
      weight: 'normal',
      why: 'nothing needs you right now',
    });
  }

  const capped = steps.slice(0, MAX_STEPS);
  // Exactly one primary — the first (highest-priority) step.
  capped[0] = { ...capped[0], weight: 'primary' };
  return capped;
}

/**
 * Assemble the full V27 card (steps + queue glance) from the same state. The
 * queue glance is only attached when there's something in it (drafts or flags).
 */
export function buildNextStepsCard(args: BuildNextStepsArgs): NextStepsCard {
  const steps = buildNextSteps(args);
  const card: NextStepsCard = { type: 'next-steps', steps };
  const hasQueue =
    args.approvals.draftsWaiting > 0 || args.compliance.openFlags > 0;
  if (hasQueue) {
    const queue: QueueGlance = {
      drafts: args.approvals.draftsWaiting,
      flags: args.compliance.openFlags,
      oldestAgeHrs: args.approvals.oldestAgeHrs,
    };
    card.queue = queue;
  }
  return card;
}
