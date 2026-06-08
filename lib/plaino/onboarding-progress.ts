/**
 * buildOnboardingProgressCard — pure, deterministic builder behind the V34
 * "onboarding progress" card (milestone trail with completion state).
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §4 (visual library extension).
 *
 * Purpose: show the customer WHERE they are in the setup journey and what
 * remains — the retention answer to "am I set up correctly?". The milestones
 * map to real workspace actions; each incomplete milestone is a deep link to
 * the specific settings page that resolves it.
 *
 * Reuses NextStepsOnboardingState from lib/plaino/next-steps.ts to avoid
 * duplicating the onboarding-state contract (same shape, same field names).
 *
 * PURE function. No I/O, no LLM, no migration. Cold-start safe.
 *
 * TEXT FALLBACK: always additive on top of the prose reply. Screen readers
 * see the milestone labels + done/not-done state verbatim.
 */
import type {
  OnboardingMilestone,
  OnboardingProgressCard,
} from './visual-card';
import type { NextStepsOnboardingState } from './next-steps';

export interface BuildOnboardingProgressArgs {
  workspaceId: string;
  onboarding: NextStepsOnboardingState;
}

interface MilestoneSpec {
  label: string;
  key: keyof NextStepsOnboardingState;
  path: string;
}

/** Ordered milestone definitions — the order is the canonical setup sequence. */
const MILESTONE_SPECS: MilestoneSpec[] = [
  {
    label: 'Pick your vertical',
    key: 'verticalPicked',
    path: 'onboarding',
  },
  {
    label: 'Connect your first tool',
    key: 'firstToolConnected',
    path: 'integrations',
  },
  {
    label: 'Set when the fleet works',
    key: 'scheduleWindowSet',
    path: 'settings',
  },
  {
    label: 'Review your first draft',
    key: 'firstDraftReviewed',
    path: 'approvals',
  },
];

/**
 * Build the V34 onboarding-progress card. Returns a card with one milestone
 * per setup step, a computed percentage, and deep links to incomplete steps.
 * Always returns the full milestone list regardless of completion state —
 * completed milestones have `done: true` so the renderer can show the trail.
 */
export function buildOnboardingProgressCard(
  args: BuildOnboardingProgressArgs,
): OnboardingProgressCard {
  const { workspaceId, onboarding } = args;
  const base = `/app/workspace/${workspaceId}`;

  const milestones: OnboardingMilestone[] = MILESTONE_SPECS.map((spec) => ({
    label: spec.label,
    done: onboarding[spec.key],
    href: `${base}/${spec.path}`,
  }));

  const doneCount = milestones.filter((m) => m.done).length;
  const pct = Math.round((doneCount / milestones.length) * 100);

  return {
    type: 'onboarding-progress',
    pct,
    milestones,
  };
}
